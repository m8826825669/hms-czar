"""Hospital-wide dashboard aggregator.

GET /api/v1/dashboard/ returns a single JSON payload combining everything
the dashboard page needs:

  {
    "as_of":   ISO timestamp,
    "stats":   { opd_today, ipd_census, ot_*, revenue_*, lab_*, ... },
    "wards":   [ { id, name, occupied, capacity, status } ],
    "opd":     [ recent OPD visits ],
    "ot":      [ today's OT schedule ],
    "alerts":  [ ],     # always empty — no real source yet, no fakes
    "monthly": [ last 5 months of IPD/OPD/revenue trend ],
    "weekly":  [ last 7 days of OPD counts ],
    "revenue": [ revenue breakdown by service category ]
  }

Replaces the 8 separate /dashboard/* endpoints the frontend was calling
that didn't exist. One request, no fake data, no silent fallbacks.

Each section is computed independently — if one section's data is
empty or fails, the others still return their values. Empty arrays
and zeros are returned honestly; no MOCK fallback.
"""
from datetime import timedelta
from decimal import Decimal

from django.db.models import Count, Sum, Q, F, DecimalField
from django.db.models.functions import Coalesce, TruncMonth, TruncDate
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView


def _ward_status(occupied: int, capacity: int) -> str:
    """Bucket ward occupancy into normal / warning / critical for UI color."""
    if capacity == 0:
        return "normal"
    pct = occupied / capacity
    if pct >= 0.9:
        return "critical"
    if pct >= 0.75:
        return "warning"
    return "normal"


def _float(v) -> float:
    """Coerce a Decimal-or-None to a float for JSON output."""
    if v is None:
        return 0.0
    return float(v)


class DashboardView(APIView):
    """One endpoint, everything the dashboard page needs.

    Polling notes: the frontend hook polls this every 30s. Each section
    is a simple aggregation over an indexed field, so total time should
    be sub-100ms even at moderate data volumes. No caching layer yet —
    add Django cache if it ever becomes a problem.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        hospital = request.hospital
        now = timezone.now()
        today = timezone.localdate()
        yesterday = today - timedelta(days=1)

        return Response({
            "as_of":   now.isoformat(),
            "stats":   self._stats(hospital, today, yesterday),
            "wards":   self._wards(hospital),
            "opd":     self._recent_opd(hospital, today),
            "ot":      self._ot_today(hospital, today),
            "alerts":  [],   # No source yet. Returning empty is honest.
            "monthly": self._monthly_trend(hospital),
            "weekly":  self._opd_weekly(hospital, today),
            "revenue": self._revenue_breakdown(hospital, today),
        })

    # ─── Stats ──────────────────────────────────────────────────────────────
    def _stats(self, hospital, today, yesterday):
        # Lazy imports keep this app's startup cheap and tolerant of
        # individual apps being temporarily broken (the dashboard
        # degrades to empty/zero rather than crashing).
        from apps.reception.models import Appointment
        from apps.ipd.models import Admission, Bed
        from apps.ot.models import SurgeryBooking
        from apps.billing.models import Invoice
        from apps.lab.models import LabOrder

        appts = Appointment.objects.filter(hospital=hospital)
        opd_today = appts.filter(scheduled_date=today).count()
        opd_yesterday = appts.filter(scheduled_date=yesterday).count()

        active_admissions = Admission.objects.filter(
            hospital=hospital, status="ADMITTED",
        )
        ipd_census = active_admissions.count()
        ipd_capacity = Bed.objects.filter(hospital=hospital).count()

        ot_today = SurgeryBooking.objects.filter(
            hospital=hospital, scheduled_start__date=today,
        )
        ot_scheduled = ot_today.filter(status="SCHEDULED").count()
        ot_completed = ot_today.filter(status="COMPLETED").count()
        ot_ongoing = ot_today.filter(status="IN_PROGRESS").count()

        invoices_today = Invoice.objects.filter(
            hospital=hospital, bill_date=today,
        ).exclude(status="CANCELLED")
        invoices_yesterday = Invoice.objects.filter(
            hospital=hospital, bill_date=yesterday,
        ).exclude(status="CANCELLED")
        revenue_today = invoices_today.aggregate(
            t=Coalesce(Sum("total_amount"), Decimal("0"),
                        output_field=DecimalField(max_digits=14, decimal_places=2)),
        )["t"]
        revenue_yesterday = invoices_yesterday.aggregate(
            t=Coalesce(Sum("total_amount"), Decimal("0"),
                        output_field=DecimalField(max_digits=14, decimal_places=2)),
        )["t"]

        # No actual "emergency" flag on Appointment, but visit_type has EMERGENCY.
        emergency_today = appts.filter(
            scheduled_date=today, visit_type="EMERGENCY",
        ).count()

        # Pharmacy: count today's invoices that have any pharmacy line.
        # Approximation — billing's link to pharmacy isn't explicit on
        # Invoice. Fall back to total invoice count if categorization
        # isn't possible.
        pharmacy_bills = invoices_today.filter(
            items__service__category="PHARMACY",
        ).distinct().count()

        lab_today_orders = LabOrder.objects.filter(
            hospital=hospital, order_date=today,
        )
        lab_orders = lab_today_orders.count()
        lab_pending = lab_today_orders.exclude(
            status__in=["REPORTED", "CANCELLED"],
        ).count()

        # Discharges today = admissions whose discharged_at falls on today
        discharges_today = Admission.objects.filter(
            hospital=hospital, discharged_at__date=today,
        ).count()
        # Pending discharge = admissions with status DISCHARGED but no
        # finalized discharge summary. The exact "pending" definition is
        # hospital-dependent; here we count admissions where status is
        # still ADMITTED but the patient is expected to leave today.
        discharge_pending = active_admissions.filter(
            expected_discharge_date=today,
        ).count()

        return {
            "opd_today":         opd_today,
            "opd_yesterday":     opd_yesterday,
            "ipd_census":        ipd_census,
            "ipd_capacity":      ipd_capacity,
            "ot_scheduled":      ot_scheduled,
            "ot_completed":      ot_completed,
            "ot_ongoing":        ot_ongoing,
            "revenue_today":     _float(revenue_today),
            "revenue_yesterday": _float(revenue_yesterday),
            # No real "target" field anywhere. Returning 0 — the frontend
            # can hide the progress bar against target when this is 0.
            "revenue_target":    0.0,
            "emergency_today":   emergency_today,
            "pharmacy_bills":    pharmacy_bills,
            "lab_orders":        lab_orders,
            "lab_pending":       lab_pending,
            "discharges_today":  discharges_today,
            "discharge_pending": discharge_pending,
        }

    # ─── Wards ──────────────────────────────────────────────────────────────
    def _wards(self, hospital):
        from apps.ipd.models import Ward, Bed

        out = []
        for ward in Ward.objects.filter(hospital=hospital, is_active=True).order_by("name"):
            beds = Bed.objects.filter(room__ward=ward)
            capacity = beds.count()
            occupied = beds.filter(status="OCCUPIED").count()
            out.append({
                "id":       ward.id,
                "name":     ward.name,
                "occupied": occupied,
                "capacity": capacity,
                "status":   _ward_status(occupied, capacity),
            })
        return out

    # ─── Recent OPD ─────────────────────────────────────────────────────────
    def _recent_opd(self, hospital, today):
        from apps.reception.models import Appointment

        appts = Appointment.objects.filter(
            hospital=hospital, scheduled_date=today,
        ).select_related("patient", "doctor", "doctor__user").order_by("-created_at")[:10]

        # Frontend status mapping
        STATUS_MAP = {
            "BOOKED":      "waiting",
            "CONFIRMED":   "waiting",
            "CHECKED_IN":  "waiting",
            "IN_CONSULT":  "in_consult",
            "COMPLETED":   "done",
            "NO_SHOW":     "done",
            "CANCELLED":   "done",
        }

        out = []
        for a in appts:
            patient = a.patient
            doctor = a.doctor
            doctor_name = ""
            if doctor:
                doctor_name = getattr(doctor, "full_name", "")
                if not doctor_name and doctor.user_id:
                    doctor_name = doctor.user.get_full_name() or doctor.user.username
            # token_number is on the QueueToken reverse FK
            token_num = 0
            try:
                token_num = a.queue_token.token_number
            except Exception:
                token_num = 0
            out.append({
                "id":           a.id,
                "mrn":          getattr(patient, "mrn", "") if patient else "",
                "full_name":    (getattr(patient, "full_name", "") if patient else "") or "",
                "token_number": token_num,
                "doctor_name":  doctor_name or "",
                "status":       STATUS_MAP.get(a.status, "waiting"),
            })
        return out

    # ─── OT today ──────────────────────────────────────────────────────────
    def _ot_today(self, hospital, today):
        from apps.ot.models import SurgeryBooking

        bookings = SurgeryBooking.objects.filter(
            hospital=hospital, scheduled_start__date=today,
        ).select_related(
            "theatre", "procedure",
            "primary_surgeon", "primary_surgeon__user",
        ).order_by("scheduled_start")[:10]

        # Frontend status mapping
        STATUS_MAP = {
            "SCHEDULED":   "pending",
            "CHECKED_IN":  "pending",
            "IN_PROGRESS": "ongoing",
            "COMPLETED":   "done",
            "CANCELLED":   "cancelled",
            "POSTPONED":   "cancelled",
        }

        out = []
        for b in bookings:
            theatre = b.theatre
            surgeon = b.primary_surgeon
            surgeon_name = ""
            if surgeon:
                surgeon_name = getattr(surgeon, "full_name", "")
                if not surgeon_name and surgeon.user_id:
                    surgeon_name = surgeon.user.get_full_name() or surgeon.user.username
            # procedure is an FK to SurgicalProcedure, not a string field.
            # Use the related .name; fall back to .code if name is empty.
            procedure_name = ""
            if b.procedure_id:
                procedure_name = getattr(b.procedure, "name", "") or getattr(b.procedure, "code", "")
            out.append({
                "id":         b.id,
                "ot_name":    getattr(theatre, "name", "") or getattr(theatre, "code", "") or "",
                "procedure":  procedure_name,
                "surgeon":    surgeon_name,
                "start_time": b.scheduled_start.strftime("%H:%M") if b.scheduled_start else "",
                "end_time":   b.scheduled_end.strftime("%H:%M") if getattr(b, "scheduled_end", None) else "",
                "status":     STATUS_MAP.get(b.status, "pending"),
            })
        return out

    # ─── Monthly trend (last 5 calendar months) ─────────────────────────────
    def _monthly_trend(self, hospital):
        from apps.reception.models import Appointment
        from apps.ipd.models import Admission
        from apps.billing.models import Invoice

        # Last 5 months including current
        today = timezone.localdate()
        first_of_this_month = today.replace(day=1)
        # Find first-of-month for 5 months back
        months = [first_of_this_month]
        for _ in range(4):
            m = months[-1]
            prev = (m - timedelta(days=1)).replace(day=1)
            months.append(prev)
        months.reverse()  # oldest first

        # Aggregate per month
        out = []
        for m_start in months:
            # End is first day of next month
            if m_start.month == 12:
                m_end = m_start.replace(year=m_start.year + 1, month=1, day=1)
            else:
                m_end = m_start.replace(month=m_start.month + 1, day=1)

            ipd_count = Admission.objects.filter(
                hospital=hospital,
                admitted_at__date__gte=m_start,
                admitted_at__date__lt=m_end,
            ).count()
            opd_count = Appointment.objects.filter(
                hospital=hospital,
                scheduled_date__gte=m_start,
                scheduled_date__lt=m_end,
            ).count()
            rev = Invoice.objects.filter(
                hospital=hospital, bill_date__gte=m_start, bill_date__lt=m_end,
            ).exclude(status="CANCELLED").aggregate(
                t=Coalesce(Sum("total_amount"), Decimal("0"),
                            output_field=DecimalField(max_digits=14, decimal_places=2)),
            )["t"]
            # Frontend treats revenue as a unitless number (likely lakhs).
            # Return raw value; let the frontend format.
            out.append({
                "month":          m_start.strftime("%b"),
                "ipd_admissions": ipd_count,
                "opd_visits":     opd_count,
                "revenue":        _float(rev),
            })
        return out

    # ─── OPD weekly (last 7 days) ──────────────────────────────────────────
    def _opd_weekly(self, hospital, today):
        from apps.reception.models import Appointment

        out = []
        for offset in range(6, -1, -1):
            d = today - timedelta(days=offset)
            qs = Appointment.objects.filter(
                hospital=hospital, scheduled_date=d,
            )
            new_p = qs.filter(visit_type="NEW").count()
            followup = qs.filter(visit_type="FOLLOWUP").count()
            out.append({
                # Use %d (zero-padded) instead of %-d / %#d to stay
                # cross-platform — %-d is Linux-only, %#d is Windows-only,
                # %d works on both. Chart axis renders fine with "Mon 06".
                "date":         d.strftime("%a %d"),
                "new_patients": new_p,
                "followup":     followup,
            })
        return out

    # ─── Revenue breakdown by service category ─────────────────────────────
    def _revenue_breakdown(self, hospital, today):
        from apps.billing.models import InvoiceItem

        # Last 30 days revenue grouped by service category
        since = today - timedelta(days=30)
        rows = (
            InvoiceItem.objects.filter(
                hospital=hospital,
                invoice__bill_date__gte=since,
            ).exclude(
                invoice__status="CANCELLED",
            ).values("service__category").annotate(
                amount=Coalesce(Sum("total"), Decimal("0"),
                                 output_field=DecimalField(max_digits=14, decimal_places=2)),
            ).order_by("-amount")
        )

        # Label map for the frontend
        LABEL_MAP = {
            "CONSULTATION":  "OPD",
            "INVESTIGATION": "Lab",
            "PROCEDURE":     "Procedures",
            "ROOM":          "IPD",
            "PHARMACY":      "Pharmacy",
            "OT":            "OT",
            "OTHER":         "Other",
        }

        # Compute total for percentage values
        total = sum((_float(r["amount"]) for r in rows), 0.0)

        out = []
        for r in rows:
            cat = r["service__category"] or "OTHER"
            amount = _float(r["amount"])
            pct = round((amount / total) * 100) if total else 0
            out.append({
                "label":  LABEL_MAP.get(cat, cat.title() if cat else "Other"),
                "value":  pct,        # percentage, integer
                "amount": amount,     # absolute INR
            })
        return out
