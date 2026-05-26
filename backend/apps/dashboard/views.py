"""
Executive dashboard endpoints.

All endpoints are read-only, tenant-scoped via request.hospital, JWT-protected,
and lightly cached (per-hospital) on the heavier ones.

Frontend contract: frontend/src/lib/api/dashboard.ts (the TypeScript interfaces
there are the canonical schema — these views are written to match exactly).

Endpoints:
    GET /api/v1/dashboard/stats/
    GET /api/v1/dashboard/ward-occupancy/
    GET /api/v1/dashboard/recent-opd/
    GET /api/v1/dashboard/ot-schedule/
    GET /api/v1/dashboard/alerts/
    GET /api/v1/dashboard/monthly-trend/
    GET /api/v1/dashboard/opd-weekly/
    GET /api/v1/dashboard/revenue-breakdown/
"""
from datetime import timedelta
from decimal import Decimal

from django.core.cache import cache
from django.db.models import Count, Q, Sum, F
from django.db.models.functions import TruncMonth, TruncDate
from django.utils import timezone

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from drf_spectacular.utils import extend_schema, OpenApiResponse, inline_serializer
from rest_framework import serializers as drf_serializers


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _hospital(request):
    """Return the hospital from request.hospital, or None if unset.
    All querysets must guard with `if hospital: qs = qs.filter(hospital=hospital)`
    so the endpoint still works in a misconfigured / single-tenant install.
    """
    return getattr(request, "hospital", None)


def _scoped(qs, hospital, field="hospital"):
    """Apply hospital scoping if hospital is non-None."""
    if hospital is None:
        return qs
    return qs.filter(**{field: hospital})


def _cache_key(name: str, hospital) -> str:
    hid = getattr(hospital, "id", "noh")
    # Bucket to the current minute so 30s polling from many clients hits cache
    bucket = timezone.now().strftime("%Y%m%d%H%M")
    return f"dashboard:{name}:{hid}:{bucket}"


def _cached(key: str, fn, ttl: int = 60):
    """Tiny memoizer. Set ttl=0 to disable."""
    if ttl <= 0:
        return fn()
    hit = cache.get(key)
    if hit is not None:
        return hit
    val = fn()
    cache.set(key, val, ttl)
    return val


# Map server status enums → frontend lowercase enums.
# QueueToken (server): WAITING, IN_VITALS, IN_CONSULT, DONE, SKIPPED
# Frontend wants:      waiting, in_consult,            done,   billing
QUEUE_TOKEN_STATUS_MAP = {
    "WAITING":   "waiting",
    "IN_VITALS": "waiting",     # still pre-consult from the dashboard's POV
    "IN_CONSULT": "in_consult",
    "DONE":      "done",
    "SKIPPED":   "done",
}

# SurgeryBooking (server): SCHEDULED, CHECKED_IN, IN_PROGRESS, COMPLETED, CANCELLED, POSTPONED
# Frontend wants:          pending,   pending,    ongoing,     done,      cancelled, cancelled
OT_STATUS_MAP = {
    "SCHEDULED":   "pending",
    "CHECKED_IN":  "pending",
    "IN_PROGRESS": "ongoing",
    "COMPLETED":   "done",
    "CANCELLED":   "cancelled",
    "POSTPONED":   "cancelled",
}


def _ward_status(occupied: int, capacity: int) -> str:
    if capacity <= 0:
        return "normal"
    ratio = occupied / capacity
    if ratio >= 0.9:
        return "critical"
    if ratio >= 0.75:
        return "warning"
    return "normal"


def _doctor_display_name(doctor) -> str:
    if not doctor:
        return ""
    user = getattr(doctor, "user", None)
    if not user:
        return ""
    name = (user.get_full_name() or "").strip() or user.username
    return f"Dr. {name}"


# ─────────────────────────────────────────────────────────────────────────────
# /stats/
# ─────────────────────────────────────────────────────────────────────────────

@extend_schema(
    tags=["dashboard"],
    summary="Headline counters for the executive dashboard",
    responses=OpenApiResponse(
        response=inline_serializer(
            name="DashboardStats",
            fields={
                "opd_today":         drf_serializers.IntegerField(),
                "ipd_census":        drf_serializers.IntegerField(),
                "ipd_capacity":      drf_serializers.IntegerField(),
                "ot_scheduled":      drf_serializers.IntegerField(),
                "ot_completed":      drf_serializers.IntegerField(),
                "ot_ongoing":        drf_serializers.IntegerField(),
                "revenue_today":     drf_serializers.DecimalField(max_digits=14, decimal_places=2),
                "revenue_target":    drf_serializers.DecimalField(max_digits=14, decimal_places=2),
                "emergency_today":   drf_serializers.IntegerField(),
                "pharmacy_bills":    drf_serializers.IntegerField(),
                "lab_orders":        drf_serializers.IntegerField(),
                "lab_pending":       drf_serializers.IntegerField(),
                "discharges_today":  drf_serializers.IntegerField(),
                "discharge_pending": drf_serializers.IntegerField(),
                "opd_yesterday":     drf_serializers.IntegerField(),
                "revenue_yesterday": drf_serializers.DecimalField(max_digits=14, decimal_places=2),
            },
        ),
    ),
)
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def stats(request):
    """Snapshot of today's headline numbers + yesterday comparators."""
    hospital = _hospital(request)
    today = timezone.localdate()
    yesterday = today - timedelta(days=1)

    def compute():
        # Lazy imports to keep migrations/import-time clean
        from apps.opd.models import Consultation
        from apps.ipd.models import Admission, Bed, DischargeSummary
        from apps.ot.models import SurgeryBooking
        from apps.billing.models import Invoice
        from apps.lab.models import LabOrder
        from apps.pharmacy.models import PharmacyOrder
        from apps.reception.models import Appointment

        # OPD = consultations created today (not draft-only — count anything started)
        opd_today_qs = _scoped(
            Consultation.objects.filter(consultation_date=today), hospital
        )
        opd_today = opd_today_qs.count()
        opd_yesterday = _scoped(
            Consultation.objects.filter(consultation_date=yesterday), hospital
        ).count()

        # IPD census = active admissions; capacity = beds not in MAINTENANCE
        ipd_census = _scoped(
            Admission.objects.filter(status="ADMITTED"), hospital
        ).count()
        ipd_capacity = _scoped(
            Bed.objects.exclude(status="MAINTENANCE"), hospital
        ).count()

        # OT — today by status (scheduled_start is a DateTimeField → use __date)
        ot_today_qs = _scoped(
            SurgeryBooking.objects.filter(scheduled_start__date=today), hospital
        )
        ot_counts = ot_today_qs.aggregate(
            scheduled = Count("id", filter=Q(status__in=["SCHEDULED", "CHECKED_IN"])),
            ongoing   = Count("id", filter=Q(status="IN_PROGRESS")),
            completed = Count("id", filter=Q(status="COMPLETED")),
        )

        # Revenue = sum of invoices paid/partial today (i.e. money actually collected)
        # We use amount_paid, not total_amount, so the figure reflects collections.
        rev_today = _scoped(
            Invoice.objects.filter(bill_date=today).exclude(status__in=["DRAFT", "CANCELLED"]),
            hospital,
        ).aggregate(s=Sum("amount_paid"))["s"] or Decimal("0.00")
        rev_yesterday = _scoped(
            Invoice.objects.filter(bill_date=yesterday).exclude(status__in=["DRAFT", "CANCELLED"]),
            hospital,
        ).aggregate(s=Sum("amount_paid"))["s"] or Decimal("0.00")

        # Target = yesterday × 1.05 as a sensible default. Override later via
        # a hospital-level setting when product decides what "target" means.
        rev_target = (rev_yesterday * Decimal("1.05")).quantize(Decimal("0.01"))

        # Emergencies today — appointments + admissions tagged EMERGENCY
        emergency_today = (
            _scoped(
                Appointment.objects.filter(
                    scheduled_date=today, visit_type="EMERGENCY"
                ),
                hospital,
            ).count()
            + _scoped(
                Admission.objects.filter(
                    admitted_at__date=today, admission_type="EMERGENCY"
                ),
                hospital,
            ).count()
        )

        # Pharmacy bills completed today
        pharmacy_bills = _scoped(
            PharmacyOrder.objects.filter(order_date=today, status="COMPLETED"),
            hospital,
        ).count()

        # Lab orders + pending
        lab_today_qs = _scoped(
            LabOrder.objects.filter(order_date=today), hospital
        )
        lab_orders = lab_today_qs.count()
        lab_pending = lab_today_qs.exclude(status__in=["REPORTED", "CANCELLED"]).count()

        # Discharges today + pending discharge summaries
        discharges_today = _scoped(
            Admission.objects.filter(discharged_at__date=today), hospital
        ).count()
        # "Pending" = admission discharged but no finalized summary yet
        discharge_pending = _scoped(
            Admission.objects.filter(
                status="DISCHARGED"
            ).filter(
                Q(discharge_summary__isnull=True)
                | Q(discharge_summary__finalized_at__isnull=True)
            ),
            hospital,
        ).count()

        return {
            "opd_today":         opd_today,
            "opd_yesterday":     opd_yesterday,
            "ipd_census":        ipd_census,
            "ipd_capacity":      ipd_capacity,
            "ot_scheduled":      ot_counts["scheduled"] or 0,
            "ot_ongoing":        ot_counts["ongoing"] or 0,
            "ot_completed":      ot_counts["completed"] or 0,
            "revenue_today":     str(rev_today),
            "revenue_yesterday": str(rev_yesterday),
            "revenue_target":    str(rev_target),
            "emergency_today":   emergency_today,
            "pharmacy_bills":    pharmacy_bills,
            "lab_orders":        lab_orders,
            "lab_pending":       lab_pending,
            "discharges_today":  discharges_today,
            "discharge_pending": discharge_pending,
        }

    return Response(_cached(_cache_key("stats", hospital), compute, ttl=60))


# ─────────────────────────────────────────────────────────────────────────────
# /ward-occupancy/
# ─────────────────────────────────────────────────────────────────────────────

@extend_schema(
    tags=["dashboard"],
    summary="Per-ward bed occupancy",
    responses=OpenApiResponse(
        response=inline_serializer(
            name="WardOccupancy",
            fields={
                "id":       drf_serializers.IntegerField(),
                "name":     drf_serializers.CharField(),
                "occupied": drf_serializers.IntegerField(),
                "capacity": drf_serializers.IntegerField(),
                "status":   drf_serializers.ChoiceField(choices=["normal", "warning", "critical"]),
            },
            many=True,
        ),
    ),
)
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def ward_occupancy(request):
    hospital = _hospital(request)

    def compute():
        from apps.ipd.models import Ward

        wards = _scoped(
            Ward.objects.filter(is_active=True), hospital
        ).order_by("ward_type", "name")

        out = []
        for w in wards:
            # Beds in this ward via Room → Bed chain
            from apps.ipd.models import Bed
            beds = _scoped(
                Bed.objects.filter(room__ward=w), hospital
            )
            capacity = beds.exclude(status="MAINTENANCE").count()
            occupied = beds.filter(status="OCCUPIED").count()
            out.append({
                "id":       w.id,
                "name":     w.name,
                "occupied": occupied,
                "capacity": capacity,
                "status":   _ward_status(occupied, capacity),
            })
        return out

    # Cheap query — short cache
    return Response(_cached(_cache_key("ward-occupancy", hospital), compute, ttl=30))


# ─────────────────────────────────────────────────────────────────────────────
# /recent-opd/
# ─────────────────────────────────────────────────────────────────────────────

@extend_schema(
    tags=["dashboard"],
    summary="Recent OPD queue tokens (today)",
    responses=OpenApiResponse(
        response=inline_serializer(
            name="RecentOpdPatient",
            fields={
                "id":           drf_serializers.IntegerField(),
                "mrn":          drf_serializers.CharField(),
                "full_name":    drf_serializers.CharField(),
                "token_number": drf_serializers.IntegerField(),
                "doctor_name":  drf_serializers.CharField(),
                "status":       drf_serializers.ChoiceField(
                    choices=["waiting", "in_consult", "done", "billing"]
                ),
            },
            many=True,
        ),
    ),
)
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def recent_opd(request):
    """Latest 10 queue tokens for today, newest first."""
    hospital = _hospital(request)
    today = timezone.localdate()

    from apps.reception.models import QueueToken

    qs = _scoped(
        QueueToken.objects.filter(visit_date=today).select_related(
            "patient", "doctor__user"
        ),
        hospital,
    ).order_by("-issued_at")[:10]

    out = []
    for tok in qs:
        # token_no like "N-001" → numeric tail
        token_number = 0
        if tok.token_no and "-" in tok.token_no:
            try:
                token_number = int(tok.token_no.split("-")[-1])
            except ValueError:
                token_number = 0
        out.append({
            "id":           tok.id,
            "mrn":          tok.patient.mrn,
            "full_name":    tok.patient.full_name,
            "token_number": token_number,
            "doctor_name":  _doctor_display_name(tok.doctor),
            "status":       QUEUE_TOKEN_STATUS_MAP.get(tok.status, "waiting"),
        })
    return Response(out)


# ─────────────────────────────────────────────────────────────────────────────
# /ot-schedule/
# ─────────────────────────────────────────────────────────────────────────────

@extend_schema(
    tags=["dashboard"],
    summary="Today's OT schedule",
    responses=OpenApiResponse(
        response=inline_serializer(
            name="OtScheduleEntry",
            fields={
                "id":         drf_serializers.IntegerField(),
                "ot_name":    drf_serializers.CharField(),
                "procedure":  drf_serializers.CharField(),
                "surgeon":    drf_serializers.CharField(),
                "start_time": drf_serializers.CharField(),
                "end_time":   drf_serializers.CharField(),
                "status":     drf_serializers.ChoiceField(
                    choices=["pending", "ongoing", "done", "cancelled"]
                ),
            },
            many=True,
        ),
    ),
)
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def ot_schedule(request):
    """All surgeries scheduled today, ordered by scheduled_start."""
    hospital = _hospital(request)
    today = timezone.localdate()

    from apps.ot.models import SurgeryBooking

    qs = _scoped(
        SurgeryBooking.objects.filter(
            scheduled_start__date=today
        ).select_related("theatre", "procedure", "primary_surgeon__user"),
        hospital,
    ).order_by("scheduled_start")

    out = []
    for b in qs:
        out.append({
            "id":         b.id,
            "ot_name":    b.theatre.code,
            "procedure":  b.procedure.name if b.procedure else "",
            "surgeon":    _doctor_display_name(b.primary_surgeon),
            "start_time": timezone.localtime(b.scheduled_start).strftime("%H:%M"),
            "end_time":   timezone.localtime(b.scheduled_end).strftime("%H:%M"),
            "status":     OT_STATUS_MAP.get(b.status, "pending"),
        })
    return Response(out)


# ─────────────────────────────────────────────────────────────────────────────
# /alerts/
# ─────────────────────────────────────────────────────────────────────────────

@extend_schema(
    tags=["dashboard"],
    summary="Synthesized operational alerts",
    description=(
        "Not stored — recomputed every call from blood bank, lab, pharmacy, "
        "inventory and discharge state. Returned in priority order."
    ),
    responses=OpenApiResponse(
        response=inline_serializer(
            name="DashboardAlert",
            fields={
                "id":      drf_serializers.IntegerField(),
                "level":   drf_serializers.ChoiceField(
                    choices=["critical", "warning", "info", "success"]
                ),
                "title":   drf_serializers.CharField(),
                "message": drf_serializers.CharField(),
                "created": drf_serializers.CharField(),
            },
            many=True,
        ),
    ),
)
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def alerts(request):
    """Computed operational alerts. Stable IDs are not meaningful — they're
    sequence positions in the response; the frontend just uses them as keys.
    """
    hospital = _hospital(request)
    today = timezone.localdate()
    now_iso = timezone.now().isoformat()

    def compute():
        from apps.blood_bank.models import BloodBag
        from apps.lab.models import LabOrder
        from apps.ipd.models import Admission
        from apps.inventory.models import StockBatch, StockItem
        from apps.ot.models import SurgeryBooking

        out = []

        # 1) Blood stock critical — any blood group with <3 available bags
        bag_counts = (
            _scoped(BloodBag.objects.filter(status="AVAILABLE"), hospital)
            .values("blood_group")
            .annotate(n=Count("id"))
            .order_by("n")
        )
        for row in bag_counts:
            if row["n"] < 3:
                out.append({
                    "level":   "critical",
                    "title":   f"Blood stock critical — {row['blood_group']}",
                    "message": f"Only {row['n']} unit(s) available",
                    "created": now_iso,
                })

        # 2) Pending discharge summaries
        pending_dc = _scoped(
            Admission.objects.filter(status="DISCHARGED").filter(
                Q(discharge_summary__isnull=True)
                | Q(discharge_summary__finalized_at__isnull=True)
            ),
            hospital,
        ).count()
        if pending_dc:
            out.append({
                "level":   "warning",
                "title":   f"{pending_dc} discharge summaries pending",
                "message": "Doctors yet to finalize discharge documents",
                "created": now_iso,
            })

        # 3) Lab pending — count of non-final lab orders
        lab_pending = _scoped(
            LabOrder.objects.filter(order_date=today).exclude(
                status__in=["REPORTED", "CANCELLED"]
            ),
            hospital,
        ).count()
        if lab_pending >= 10:
            out.append({
                "level":   "warning",
                "title":   f"Lab results — {lab_pending} pending",
                "message": "Backlog above warning threshold",
                "created": now_iso,
            })

        # 4) Inventory items at/below reorder level
        # Aggregate current stock per item; flag if total <= reorder_level
        low_stock = (
            _scoped(
                StockItem.objects.filter(is_active=True, reorder_level__gt=0),
                hospital,
            )
            .annotate(on_hand=Sum("batches__current_quantity"))
            .filter(Q(on_hand__lte=F("reorder_level")) | Q(on_hand__isnull=True))
            .count()
        )
        if low_stock:
            out.append({
                "level":   "info" if low_stock < 10 else "warning",
                "title":   f"Inventory low stock — {low_stock} item(s)",
                "message": "Items at or below reorder level",
                "created": now_iso,
            })

        # 5) Next OT scheduled today
        next_ot = _scoped(
            SurgeryBooking.objects.filter(
                scheduled_start__gte=timezone.now(),
                scheduled_start__date=today,
                status__in=["SCHEDULED", "CHECKED_IN"],
            ).select_related("theatre", "procedure").order_by("scheduled_start"),
            hospital,
        ).first()
        if next_ot:
            t = timezone.localtime(next_ot.scheduled_start).strftime("%H:%M")
            out.append({
                "level":   "info",
                "title":   f"Next OT — {next_ot.theatre.code} at {t}",
                "message": next_ot.procedure.name if next_ot.procedure else "",
                "created": now_iso,
            })

        # Stamp sequential IDs
        for i, a in enumerate(out, start=1):
            a["id"] = i
        return out

    return Response(_cached(_cache_key("alerts", hospital), compute, ttl=60))


# ─────────────────────────────────────────────────────────────────────────────
# /monthly-trend/
# ─────────────────────────────────────────────────────────────────────────────

@extend_schema(
    tags=["dashboard"],
    summary="Last 5 months — admissions, OPD visits, revenue",
    responses=OpenApiResponse(
        response=inline_serializer(
            name="MonthlyTrend",
            fields={
                "month":          drf_serializers.CharField(),
                "ipd_admissions": drf_serializers.IntegerField(),
                "opd_visits":     drf_serializers.IntegerField(),
                "revenue":        drf_serializers.IntegerField(
                    help_text="Lakhs (₹), rounded"
                ),
            },
            many=True,
        ),
    ),
)
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def monthly_trend(request):
    """5-month trend ending current month."""
    hospital = _hospital(request)

    def compute():
        from apps.opd.models import Consultation
        from apps.ipd.models import Admission
        from apps.billing.models import Invoice

        today = timezone.localdate()
        # First-of-month, 4 months ago → 5 buckets including current
        start = (today.replace(day=1) - timedelta(days=31 * 4)).replace(day=1)

        # Aggregate per month — bucket by truncated date (handles cross-year)
        adm = (
            _scoped(
                Admission.objects.filter(admitted_at__date__gte=start), hospital
            )
            .annotate(m=TruncMonth("admitted_at"))
            .values("m")
            .annotate(n=Count("id"))
        )
        # Key is a date (month-truncated). Normalize to date for dict key.
        adm_by_month = {row["m"].date() if hasattr(row["m"], "date") else row["m"]: row["n"] for row in adm}

        cons = (
            _scoped(
                Consultation.objects.filter(consultation_date__gte=start), hospital
            )
            .annotate(m=TruncMonth("consultation_date"))
            .values("m")
            .annotate(n=Count("id"))
        )
        cons_by_month = {row["m"].date() if hasattr(row["m"], "date") else row["m"]: row["n"] for row in cons}

        inv = (
            _scoped(
                Invoice.objects.filter(bill_date__gte=start).exclude(
                    status__in=["DRAFT", "CANCELLED"]
                ),
                hospital,
            )
            .annotate(m=TruncMonth("bill_date"))
            .values("m")
            .annotate(s=Sum("amount_paid"))
        )
        rev_by_month = {
            (row["m"].date() if hasattr(row["m"], "date") else row["m"]):
                (row["s"] or Decimal("0"))
            for row in inv
        }

        # Build 5 ordered buckets walking back 4 months from current
        cur = today.replace(day=1)
        months = []
        for _ in range(5):
            months.append(cur)
            # previous month
            cur = (cur - timedelta(days=1)).replace(day=1)
        months.reverse()

        out = []
        for d in months:
            label = d.strftime("%b")
            revenue_rupees = rev_by_month.get(d, Decimal("0"))
            # Round to lakhs (1 lakh = 100,000) — matches MOCK shape
            revenue_lakhs = int(revenue_rupees / Decimal("100000"))
            out.append({
                "month":          label,
                "ipd_admissions": adm_by_month.get(d, 0),
                "opd_visits":     cons_by_month.get(d, 0),
                "revenue":        revenue_lakhs,
            })
        return out

    return Response(_cached(_cache_key("monthly-trend", hospital), compute, ttl=300))


# ─────────────────────────────────────────────────────────────────────────────
# /opd-weekly/
# ─────────────────────────────────────────────────────────────────────────────

@extend_schema(
    tags=["dashboard"],
    summary="Last 7 days — new vs follow-up OPD visits",
    responses=OpenApiResponse(
        response=inline_serializer(
            name="OpdDailyCount",
            fields={
                "date":         drf_serializers.CharField(),
                "new_patients": drf_serializers.IntegerField(),
                "followup":     drf_serializers.IntegerField(),
            },
            many=True,
        ),
    ),
)
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def opd_weekly(request):
    hospital = _hospital(request)

    def compute():
        from apps.reception.models import Appointment

        today = timezone.localdate()
        start = today - timedelta(days=6)  # 7 days inclusive

        rows = (
            _scoped(
                Appointment.objects.filter(scheduled_date__gte=start),
                hospital,
            )
            .values("scheduled_date", "visit_type")
            .annotate(n=Count("id"))
        )

        # bucket -> {"new_patients": x, "followup": y}
        buckets = {}
        for r in rows:
            d = r["scheduled_date"]
            b = buckets.setdefault(d, {"new_patients": 0, "followup": 0})
            if r["visit_type"] == "NEW":
                b["new_patients"] += r["n"]
            elif r["visit_type"] == "FOLLOWUP":
                b["followup"] += r["n"]
            # EMERGENCY / TELE are not counted on this chart

        out = []
        for i in range(7):
            d = start + timedelta(days=i)
            b = buckets.get(d, {"new_patients": 0, "followup": 0})
            # MOCK uses "Mon 6" — abbreviated weekday + day-of-month (no leading zero).
            # %d gives leading-zero day; strip it manually for cross-platform safety.
            day_no_pad = str(d.day)
            out.append({
                "date":         f"{d.strftime('%a')} {day_no_pad}",
                "new_patients": b["new_patients"],
                "followup":     b["followup"],
            })
        return out

    return Response(_cached(_cache_key("opd-weekly", hospital), compute, ttl=120))


# ─────────────────────────────────────────────────────────────────────────────
# /revenue-breakdown/
# ─────────────────────────────────────────────────────────────────────────────

@extend_schema(
    tags=["dashboard"],
    summary="Today's revenue by service category",
    responses=OpenApiResponse(
        response=inline_serializer(
            name="RevenueBreakdown",
            fields={
                "label":  drf_serializers.CharField(),
                "value":  drf_serializers.IntegerField(help_text="Percent share, 0–100"),
                "amount": drf_serializers.DecimalField(max_digits=14, decimal_places=2),
            },
            many=True,
        ),
    ),
)
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def revenue_breakdown(request):
    """Revenue by ServiceCatalog category for today.

    Fallback: if InvoiceItem rows have no service link (cash-only items),
    they're grouped under 'OTHER'.
    """
    hospital = _hospital(request)
    today = timezone.localdate()

    def compute():
        from apps.billing.models import InvoiceItem

        # Sum item totals by category (via invoice.bill_date = today)
        items = _scoped(
            InvoiceItem.objects.filter(
                invoice__bill_date=today
            ).exclude(invoice__status__in=["DRAFT", "CANCELLED"]),
            hospital,
        ).select_related("service")

        # Friendly labels for the frontend
        LABELS = {
            "CONSULTATION":  "OPD",
            "INVESTIGATION": "Lab",
            "PROCEDURE":     "OT",
            "ROOM":          "IPD",
            "MEDICINE":      "Pharmacy",
            "PACKAGE":       "Package",
            "OTHER":         "Other",
        }
        ORDER = ["OPD", "IPD", "OT", "Lab", "Pharmacy", "Package", "Other"]

        buckets = {label: Decimal("0.00") for label in ORDER}
        for it in items:
            cat = it.service.category if it.service_id else "OTHER"
            label = LABELS.get(cat, "Other")
            buckets[label] = buckets.get(label, Decimal("0.00")) + (it.total or Decimal("0"))

        total = sum(buckets.values(), Decimal("0.00"))
        out = []
        for label in ORDER:
            amount = buckets[label]
            if amount <= 0:
                continue
            pct = int((amount / total) * 100) if total > 0 else 0
            out.append({
                "label":  label,
                "value":  pct,
                "amount": str(amount.quantize(Decimal("0.01"))),
            })
        return out

    return Response(_cached(_cache_key("revenue-breakdown", hospital), compute, ttl=60))
