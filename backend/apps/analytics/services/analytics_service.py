"""
Analytics service — cross-module aggregations.

Every function here returns plain Python primitives (dicts / lists) so they
can be serialised directly to JSON. We deliberately keep imports lazy and
wrap each call site in a try/except to make the analytics dashboard
tolerant of partially-installed modules. If, say, the blood bank app is
not migrated yet, the dashboard still renders the rest.
"""
from __future__ import annotations

import calendar
import decimal
import datetime as dt
from collections import OrderedDict
from typing import Any

from django.apps import apps
from django.db.models import Count, Sum, Avg, F, Q, DecimalField, ExpressionWrapper
from django.db.models.functions import TruncMonth, TruncDate
from django.utils import timezone


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
ZERO = decimal.Decimal("0")


def _d(value) -> decimal.Decimal:
    return decimal.Decimal(value or 0)


def _safe(fn, default=None):
    """Run *fn* and return its result, swallowing all exceptions.

    Used everywhere so a missing model or empty table never breaks the dashboard.
    """
    try:
        return fn()
    except Exception:
        return default


def _model(label):
    """Return a model class or None when the app/model is not installed."""
    try:
        return apps.get_model(*label.split("."))
    except Exception:
        return None


def _month_range(year: int, month: int):
    first = dt.date(year, month, 1)
    last_day = calendar.monthrange(year, month)[1]
    last = dt.date(year, month, last_day)
    return first, last


def _start_of_month(d: dt.date) -> dt.date:
    return d.replace(day=1)


# ---------------------------------------------------------------------------
# KPI cards
# ---------------------------------------------------------------------------
def kpi_cards(hospital_id: int | None = None) -> dict[str, Any]:
    """Top-row KPI cards — quick at-a-glance numbers."""
    today = timezone.localdate()
    start_today = dt.datetime.combine(today, dt.time.min)

    out: dict[str, Any] = {
        "as_of": today.isoformat(),
        "today_opd_visits":     _safe(lambda: _opd_today(today, hospital_id), 0),
        "today_admissions":     _safe(lambda: _admissions_today(today, hospital_id), 0),
        "today_discharges":     _safe(lambda: _discharges_today(today, hospital_id), 0),
        "occupied_beds":        _safe(lambda: _occupied_beds(hospital_id), 0),
        "total_beds":           _safe(lambda: _total_beds(hospital_id), 0),
        "today_ot_cases":       _safe(lambda: _ot_today(today, hospital_id), 0),
        "today_lab_orders":     _safe(lambda: _lab_today(today, hospital_id), 0),
        "today_pharmacy_sales": _safe(lambda: float(_pharmacy_sales_today(today, hospital_id)), 0.0),
        "today_revenue":        _safe(lambda: float(_revenue_today(today, hospital_id)), 0.0),
        "ar_outstanding":       _safe(lambda: float(_ar_outstanding(hospital_id)), 0.0),
        "blood_units_in_stock": _safe(lambda: _blood_units(hospital_id), 0),
        "active_staff":         _safe(lambda: _active_staff(hospital_id), 0),
        "open_complaints":      _safe(lambda: _open_complaints(hospital_id), 0),
    }
    if out["total_beds"]:
        out["occupancy_pct"] = round(100.0 * out["occupied_beds"] / out["total_beds"], 1)
    else:
        out["occupancy_pct"] = 0.0
    return out


def _opd_today(today, hospital_id):
    Visit = _model("opd.OPDVisit")
    if not Visit:
        return 0
    qs = Visit.objects.filter(visit_date__date=today) if _has_field(Visit, "visit_date") else Visit.objects.filter(created_at__date=today)
    if hospital_id and _has_field(Visit, "hospital"):
        qs = qs.filter(hospital_id=hospital_id)
    return qs.count()


def _admissions_today(today, hospital_id):
    Adm = _model("ipd.Admission")
    if not Adm:
        return 0
    qs = Adm.objects.filter(admission_date__date=today) if _has_field(Adm, "admission_date") else Adm.objects.filter(created_at__date=today)
    if hospital_id and _has_field(Adm, "hospital"):
        qs = qs.filter(hospital_id=hospital_id)
    return qs.count()


def _discharges_today(today, hospital_id):
    Adm = _model("ipd.Admission")
    if not Adm or not _has_field(Adm, "discharge_date"):
        return 0
    qs = Adm.objects.filter(discharge_date__date=today)
    if hospital_id and _has_field(Adm, "hospital"):
        qs = qs.filter(hospital_id=hospital_id)
    return qs.count()


def _occupied_beds(hospital_id):
    Bed = _model("ipd.Bed")
    if not Bed:
        return 0
    qs = Bed.objects.filter(status__in=["OCCUPIED", "occupied"]) if _has_field(Bed, "status") else Bed.objects.none()
    if hospital_id and _has_field(Bed, "hospital"):
        qs = qs.filter(hospital_id=hospital_id)
    return qs.count()


def _total_beds(hospital_id):
    Bed = _model("ipd.Bed")
    if not Bed:
        return 0
    qs = Bed.objects.all()
    if hospital_id and _has_field(Bed, "hospital"):
        qs = qs.filter(hospital_id=hospital_id)
    return qs.count()


def _ot_today(today, hospital_id):
    Booking = _model("ot.OTBooking")
    if not Booking:
        return 0
    field = "scheduled_start" if _has_field(Booking, "scheduled_start") else "created_at"
    qs = Booking.objects.filter(**{f"{field}__date": today})
    if hospital_id and _has_field(Booking, "hospital"):
        qs = qs.filter(hospital_id=hospital_id)
    return qs.count()


def _lab_today(today, hospital_id):
    Order = _model("lab.LabOrder")
    if not Order:
        return 0
    qs = Order.objects.filter(created_at__date=today)
    if hospital_id and _has_field(Order, "hospital"):
        qs = qs.filter(hospital_id=hospital_id)
    return qs.count()


def _pharmacy_sales_today(today, hospital_id):
    Dispense = _model("pharmacy.Dispense")
    if not Dispense:
        return ZERO
    qs = Dispense.objects.filter(created_at__date=today)
    if hospital_id and _has_field(Dispense, "hospital"):
        qs = qs.filter(hospital_id=hospital_id)
    amt_field = "total_amount" if _has_field(Dispense, "total_amount") else ("amount" if _has_field(Dispense, "amount") else None)
    if not amt_field:
        return ZERO
    return _d(qs.aggregate(s=Sum(amt_field))["s"])


def _revenue_today(today, hospital_id):
    Invoice = _model("billing.Invoice")
    if not Invoice:
        return ZERO
    qs = Invoice.objects.filter(created_at__date=today)
    if hospital_id and _has_field(Invoice, "hospital"):
        qs = qs.filter(hospital_id=hospital_id)
    field = "grand_total" if _has_field(Invoice, "grand_total") else ("total" if _has_field(Invoice, "total") else None)
    if not field:
        return ZERO
    return _d(qs.aggregate(s=Sum(field))["s"])


def _ar_outstanding(hospital_id):
    Invoice = _model("billing.Invoice")
    if not Invoice:
        return ZERO
    qs = Invoice.objects.all()
    if hospital_id and _has_field(Invoice, "hospital"):
        qs = qs.filter(hospital_id=hospital_id)
    if _has_field(Invoice, "status"):
        qs = qs.exclude(status__in=["PAID", "paid", "CANCELLED", "cancelled", "REFUNDED", "refunded"])
    grand = "grand_total" if _has_field(Invoice, "grand_total") else ("total" if _has_field(Invoice, "total") else None)
    paid  = "amount_paid" if _has_field(Invoice, "amount_paid") else None
    if not grand:
        return ZERO
    if paid:
        expr = ExpressionWrapper(F(grand) - F(paid), output_field=DecimalField(max_digits=14, decimal_places=2))
        return _d(qs.aggregate(s=Sum(expr))["s"])
    return _d(qs.aggregate(s=Sum(grand))["s"])


def _blood_units(hospital_id):
    Unit = _model("blood_bank.BloodUnit")
    if not Unit:
        return 0
    qs = Unit.objects.all()
    if _has_field(Unit, "status"):
        qs = qs.filter(status__in=["AVAILABLE", "available", "IN_STOCK", "in_stock"])
    if hospital_id and _has_field(Unit, "hospital"):
        qs = qs.filter(hospital_id=hospital_id)
    return qs.count()


def _active_staff(hospital_id):
    Emp = _model("hr.Employee")
    if not Emp:
        return 0
    qs = Emp.objects.all()
    if _has_field(Emp, "status"):
        qs = qs.filter(status="ACTIVE")
    if hospital_id and _has_field(Emp, "hospital"):
        qs = qs.filter(hospital_id=hospital_id)
    return qs.count()


def _open_complaints(hospital_id):
    Ticket = _model("complaints.Ticket")
    if not Ticket:
        return 0
    qs = Ticket.objects.all()
    if _has_field(Ticket, "status"):
        qs = qs.exclude(status__in=["RESOLVED", "CLOSED", "resolved", "closed"])
    if hospital_id and _has_field(Ticket, "hospital"):
        qs = qs.filter(hospital_id=hospital_id)
    return qs.count()


def _has_field(model, field_name) -> bool:
    try:
        model._meta.get_field(field_name)
        return True
    except Exception:
        return False


# ---------------------------------------------------------------------------
# Time-series — revenue and OPD volume over months
# ---------------------------------------------------------------------------
def revenue_monthly(months: int = 6, hospital_id: int | None = None) -> list[dict]:
    Invoice = _model("billing.Invoice")
    if not Invoice:
        return []
    today = timezone.localdate()
    start = _start_of_month(today) - dt.timedelta(days=1)
    start = start.replace(day=1)
    # Walk back (months-1) more months
    cur = start
    for _ in range(months - 1):
        cur = (cur - dt.timedelta(days=1)).replace(day=1)
    qs = Invoice.objects.filter(created_at__date__gte=cur)
    if hospital_id and _has_field(Invoice, "hospital"):
        qs = qs.filter(hospital_id=hospital_id)
    grand = "grand_total" if _has_field(Invoice, "grand_total") else "total"

    rows = (
        qs.annotate(month=TruncMonth("created_at"))
          .values("month")
          .annotate(revenue=Sum(grand), invoices=Count("id"))
          .order_by("month")
    )
    return [
        {
            "month":    r["month"].strftime("%Y-%m"),
            "revenue":  float(r["revenue"] or 0),
            "invoices": r["invoices"],
        }
        for r in rows
    ]


def opd_volume_daily(days: int = 30, hospital_id: int | None = None) -> list[dict]:
    Visit = _model("opd.OPDVisit")
    if not Visit:
        return []
    today = timezone.localdate()
    start = today - dt.timedelta(days=days - 1)
    date_field = "visit_date" if _has_field(Visit, "visit_date") else "created_at"
    qs = Visit.objects.filter(**{f"{date_field}__date__gte": start})
    if hospital_id and _has_field(Visit, "hospital"):
        qs = qs.filter(hospital_id=hospital_id)
    rows = (
        qs.annotate(day=TruncDate(date_field))
          .values("day")
          .annotate(visits=Count("id"))
          .order_by("day")
    )
    return [{"date": r["day"].isoformat(), "visits": r["visits"]} for r in rows]


# ---------------------------------------------------------------------------
# Departmental revenue split
# ---------------------------------------------------------------------------
def revenue_by_department(month: int | None = None, year: int | None = None, hospital_id: int | None = None) -> list[dict]:
    Invoice = _model("billing.Invoice")
    InvoiceLine = _model("billing.InvoiceLine")
    if not (Invoice and InvoiceLine):
        return []
    today = timezone.localdate()
    year = year or today.year
    month = month or today.month
    first, last = _month_range(year, month)

    qs = InvoiceLine.objects.filter(
        invoice__created_at__date__gte=first,
        invoice__created_at__date__lte=last,
    )
    if hospital_id and _has_field(Invoice, "hospital"):
        qs = qs.filter(invoice__hospital_id=hospital_id)

    # Department FK may live on InvoiceLine or on the linked service
    amount_field = "amount" if _has_field(InvoiceLine, "amount") else ("total" if _has_field(InvoiceLine, "total") else None)
    if not amount_field:
        return []

    if _has_field(InvoiceLine, "department"):
        rows = qs.values("department__name").annotate(total=Sum(amount_field)).order_by("-total")
        return [{"department": r["department__name"] or "Unassigned", "revenue": float(r["total"] or 0)} for r in rows]
    if _has_field(InvoiceLine, "service") and _has_field(_model("billing.ServiceCatalog") or InvoiceLine, "department"):
        rows = qs.values("service__department__name").annotate(total=Sum(amount_field)).order_by("-total")
        return [{"department": r["service__department__name"] or "Unassigned", "revenue": float(r["total"] or 0)} for r in rows]
    return []


# ---------------------------------------------------------------------------
# OT utilization
# ---------------------------------------------------------------------------
def ot_utilization(days: int = 30, hospital_id: int | None = None) -> list[dict]:
    Booking = _model("ot.OTBooking")
    Theatre = _model("ot.OperationTheatre")
    if not (Booking and Theatre):
        return []
    today = timezone.localdate()
    start = today - dt.timedelta(days=days - 1)
    field = "scheduled_start" if _has_field(Booking, "scheduled_start") else "created_at"
    qs = Booking.objects.filter(**{f"{field}__date__gte": start})
    if hospital_id and _has_field(Booking, "hospital"):
        qs = qs.filter(hospital_id=hospital_id)
    rows = qs.values("theatre__name").annotate(cases=Count("id")).order_by("-cases")
    return [{"theatre": r["theatre__name"] or "Unknown", "cases": r["cases"]} for r in rows]


# ---------------------------------------------------------------------------
# IPD occupancy by ward
# ---------------------------------------------------------------------------
def ipd_occupancy_by_ward(hospital_id: int | None = None) -> list[dict]:
    Bed = _model("ipd.Bed")
    if not Bed:
        return []
    qs = Bed.objects.all()
    if hospital_id and _has_field(Bed, "hospital"):
        qs = qs.filter(hospital_id=hospital_id)
    ward_field = "ward__name" if _has_field(Bed, "ward") else None
    if not ward_field:
        return []
    grouped: dict[str, dict] = {}
    for row in qs.values("ward__name", "status").annotate(c=Count("id")):
        ward = row["ward__name"] or "Unassigned"
        if ward not in grouped:
            grouped[ward] = {"ward": ward, "total": 0, "occupied": 0}
        grouped[ward]["total"] += row["c"]
        if str(row["status"]).upper() == "OCCUPIED":
            grouped[ward]["occupied"] += row["c"]
    rows = list(grouped.values())
    for r in rows:
        r["occupancy_pct"] = round(100.0 * r["occupied"] / r["total"], 1) if r["total"] else 0.0
    return sorted(rows, key=lambda x: x["ward"])


# ---------------------------------------------------------------------------
# AR aging buckets
# ---------------------------------------------------------------------------
def ar_aging(hospital_id: int | None = None) -> dict[str, Any]:
    Invoice = _model("billing.Invoice")
    if not Invoice:
        return {"buckets": []}
    qs = Invoice.objects.all()
    if hospital_id and _has_field(Invoice, "hospital"):
        qs = qs.filter(hospital_id=hospital_id)
    if _has_field(Invoice, "status"):
        qs = qs.exclude(status__in=["PAID", "paid", "CANCELLED", "cancelled", "REFUNDED", "refunded"])
    grand = "grand_total" if _has_field(Invoice, "grand_total") else "total"
    paid = "amount_paid" if _has_field(Invoice, "amount_paid") else None

    today = timezone.localdate()
    buckets = OrderedDict([
        ("0-30",   {"label": "0-30 days",   "min_days":  0, "max_days":  30, "amount": ZERO, "count": 0}),
        ("31-60",  {"label": "31-60 days",  "min_days": 31, "max_days":  60, "amount": ZERO, "count": 0}),
        ("61-90",  {"label": "61-90 days",  "min_days": 61, "max_days":  90, "amount": ZERO, "count": 0}),
        ("90+",    {"label": "90+ days",    "min_days": 91, "max_days": 99999, "amount": ZERO, "count": 0}),
    ])
    for inv in qs.iterator():
        created = getattr(inv, "created_at", None)
        if not created:
            continue
        days = (today - created.date()).days
        outstanding = _d(getattr(inv, grand, 0))
        if paid:
            outstanding -= _d(getattr(inv, paid, 0))
        if outstanding <= 0:
            continue
        for b in buckets.values():
            if b["min_days"] <= days <= b["max_days"]:
                b["amount"] += outstanding
                b["count"] += 1
                break
    return {
        "buckets": [
            {"bucket": b["label"], "amount": float(b["amount"]), "count": b["count"]}
            for b in buckets.values()
        ]
    }


# ---------------------------------------------------------------------------
# Top diagnoses
# ---------------------------------------------------------------------------
def top_diagnoses(limit: int = 10, hospital_id: int | None = None) -> list[dict]:
    Encounter = _model("emr.Encounter")
    if not Encounter:
        return []
    diag_field = None
    for f in ("primary_diagnosis", "diagnosis", "icd_code"):
        if _has_field(Encounter, f):
            diag_field = f
            break
    if not diag_field:
        return []
    qs = Encounter.objects.exclude(**{f"{diag_field}__isnull": True}).exclude(**{f"{diag_field}__exact": ""})
    if hospital_id and _has_field(Encounter, "hospital"):
        qs = qs.filter(hospital_id=hospital_id)
    rows = (
        qs.values(diag_field)
          .annotate(c=Count("id"))
          .order_by("-c")[:limit]
    )
    return [{"diagnosis": r[diag_field] or "Unknown", "count": r["c"]} for r in rows]


# ---------------------------------------------------------------------------
# Pharmacy turnover
# ---------------------------------------------------------------------------
def pharmacy_turnover(months: int = 6, hospital_id: int | None = None) -> list[dict]:
    Dispense = _model("pharmacy.Dispense")
    if not Dispense:
        return []
    today = timezone.localdate()
    cur = _start_of_month(today)
    for _ in range(months - 1):
        cur = (cur - dt.timedelta(days=1)).replace(day=1)
    qs = Dispense.objects.filter(created_at__date__gte=cur)
    if hospital_id and _has_field(Dispense, "hospital"):
        qs = qs.filter(hospital_id=hospital_id)
    amt = "total_amount" if _has_field(Dispense, "total_amount") else ("amount" if _has_field(Dispense, "amount") else None)
    if not amt:
        return []
    rows = (
        qs.annotate(month=TruncMonth("created_at"))
          .values("month")
          .annotate(revenue=Sum(amt), transactions=Count("id"))
          .order_by("month")
    )
    return [
        {
            "month":        r["month"].strftime("%Y-%m"),
            "revenue":      float(r["revenue"] or 0),
            "transactions": r["transactions"],
        } for r in rows
    ]


# ---------------------------------------------------------------------------
# Lab turnover
# ---------------------------------------------------------------------------
def lab_turnover(months: int = 6, hospital_id: int | None = None) -> list[dict]:
    Order = _model("lab.LabOrder")
    if not Order:
        return []
    today = timezone.localdate()
    cur = _start_of_month(today)
    for _ in range(months - 1):
        cur = (cur - dt.timedelta(days=1)).replace(day=1)
    qs = Order.objects.filter(created_at__date__gte=cur)
    if hospital_id and _has_field(Order, "hospital"):
        qs = qs.filter(hospital_id=hospital_id)
    rows = (
        qs.annotate(month=TruncMonth("created_at"))
          .values("month")
          .annotate(orders=Count("id"))
          .order_by("month")
    )
    return [{"month": r["month"].strftime("%Y-%m"), "orders": r["orders"]} for r in rows]


# ---------------------------------------------------------------------------
# Blood inventory
# ---------------------------------------------------------------------------
def blood_inventory(hospital_id: int | None = None) -> list[dict]:
    Unit = _model("blood_bank.BloodUnit")
    if not Unit:
        return []
    qs = Unit.objects.all()
    if _has_field(Unit, "status"):
        qs = qs.filter(status__in=["AVAILABLE", "available", "IN_STOCK", "in_stock"])
    if hospital_id and _has_field(Unit, "hospital"):
        qs = qs.filter(hospital_id=hospital_id)
    bg_field = "blood_group" if _has_field(Unit, "blood_group") else None
    if not bg_field:
        return []
    rows = qs.values(bg_field).annotate(c=Count("id")).order_by(bg_field)
    return [{"blood_group": r[bg_field] or "?", "units": r["c"]} for r in rows]


# ---------------------------------------------------------------------------
# Asset depreciation
# ---------------------------------------------------------------------------
def asset_depreciation_summary(hospital_id: int | None = None) -> dict[str, Any]:
    Asset = _model("assets.Asset")
    if not Asset:
        return {"category_breakdown": [], "totals": {"acquisition_value": 0, "current_value": 0, "depreciation": 0}}
    qs = Asset.objects.all()
    if hospital_id and _has_field(Asset, "hospital"):
        qs = qs.filter(hospital_id=hospital_id)
    acq = "acquisition_value" if _has_field(Asset, "acquisition_value") else ("purchase_value" if _has_field(Asset, "purchase_value") else None)
    cur = "current_value" if _has_field(Asset, "current_value") else ("book_value" if _has_field(Asset, "book_value") else None)
    if not (acq and cur):
        return {"category_breakdown": [], "totals": {"acquisition_value": 0, "current_value": 0, "depreciation": 0}}
    cat_field = "category__name" if _has_field(Asset, "category") else None
    if cat_field:
        rows = qs.values(cat_field).annotate(acq=Sum(acq), cur=Sum(cur)).order_by("-acq")
        breakdown = [
            {
                "category": r[cat_field] or "Uncategorised",
                "acquisition_value": float(r["acq"] or 0),
                "current_value": float(r["cur"] or 0),
                "depreciation": float((r["acq"] or 0) - (r["cur"] or 0)),
            } for r in rows
        ]
    else:
        breakdown = []
    totals = qs.aggregate(acq=Sum(acq), cur=Sum(cur))
    acq_total = float(totals["acq"] or 0)
    cur_total = float(totals["cur"] or 0)
    return {
        "category_breakdown": breakdown,
        "totals": {
            "acquisition_value": acq_total,
            "current_value":     cur_total,
            "depreciation":      acq_total - cur_total,
        },
    }


# ---------------------------------------------------------------------------
# HR headcount by department
# ---------------------------------------------------------------------------
def hr_headcount(hospital_id: int | None = None) -> list[dict]:
    Emp = _model("hr.Employee")
    if not Emp:
        return []
    qs = Emp.objects.all()
    if _has_field(Emp, "status"):
        qs = qs.filter(status="ACTIVE")
    if hospital_id and _has_field(Emp, "hospital"):
        qs = qs.filter(hospital_id=hospital_id)
    if _has_field(Emp, "department"):
        rows = qs.values("department__name").annotate(c=Count("id")).order_by("-c")
        return [{"department": r["department__name"] or "Unassigned", "headcount": r["c"]} for r in rows]
    return [{"department": "All", "headcount": qs.count()}]


# ---------------------------------------------------------------------------
# Attendance summary
# ---------------------------------------------------------------------------
def attendance_summary(date: dt.date | None = None, hospital_id: int | None = None) -> dict[str, int]:
    Daily = _model("attendance.DailyAttendance")
    Emp = _model("hr.Employee")
    if not Daily:
        return {"present": 0, "absent": 0, "late": 0, "on_leave": 0, "half_day": 0, "unmarked": 0}
    date = date or timezone.localdate()
    qs = Daily.objects.filter(work_date=date) if _has_field(Daily, "work_date") else Daily.objects.filter(date=date)
    if hospital_id and _has_field(Daily, "hospital"):
        qs = qs.filter(hospital_id=hospital_id)

    counts = {row["status"]: row["c"] for row in qs.values("status").annotate(c=Count("id"))}
    total_emp = 0
    if Emp:
        emp_qs = Emp.objects.all()
        if _has_field(Emp, "status"):
            emp_qs = emp_qs.filter(status="ACTIVE")
        if hospital_id and _has_field(Emp, "hospital"):
            emp_qs = emp_qs.filter(hospital_id=hospital_id)
        total_emp = emp_qs.count()
    marked = qs.count()
    return {
        "present":  counts.get("PRESENT", 0),
        "absent":   counts.get("ABSENT", 0),
        "late":     counts.get("LATE", 0),
        "on_leave": counts.get("ON_LEAVE", 0),
        "half_day": counts.get("HALF_DAY", 0),
        "unmarked": max(total_emp - marked, 0),
    }


# ---------------------------------------------------------------------------
# Insurance claim summary
# ---------------------------------------------------------------------------
def insurance_claim_summary(months: int = 6, hospital_id: int | None = None) -> dict[str, Any]:
    Claim = _model("insurance.Claim")
    if not Claim:
        return {"by_status": [], "by_month": []}
    today = timezone.localdate()
    cur = _start_of_month(today)
    for _ in range(months - 1):
        cur = (cur - dt.timedelta(days=1)).replace(day=1)
    qs = Claim.objects.filter(created_at__date__gte=cur)
    if hospital_id and _has_field(Claim, "hospital"):
        qs = qs.filter(hospital_id=hospital_id)

    by_status = list(qs.values("status").annotate(c=Count("id")).order_by("status"))
    amt_field = "claim_amount" if _has_field(Claim, "claim_amount") else None
    by_month_qs = qs.annotate(month=TruncMonth("created_at")).values("month").annotate(claims=Count("id"))
    if amt_field:
        by_month_qs = by_month_qs.annotate(amount=Sum(amt_field))
    return {
        "by_status": [{"status": r["status"], "count": r["c"]} for r in by_status],
        "by_month": [
            {
                "month":  r["month"].strftime("%Y-%m"),
                "claims": r["claims"],
                "amount": float(r.get("amount") or 0),
            } for r in by_month_qs.order_by("month")
        ],
    }


# ---------------------------------------------------------------------------
# Complaints SLA
# ---------------------------------------------------------------------------
def complaints_sla(months: int = 3, hospital_id: int | None = None) -> dict[str, Any]:
    Ticket = _model("complaints.Ticket")
    if not Ticket:
        return {"by_status": [], "avg_resolution_hours": 0}
    today = timezone.localdate()
    cur = _start_of_month(today)
    for _ in range(months - 1):
        cur = (cur - dt.timedelta(days=1)).replace(day=1)
    qs = Ticket.objects.filter(created_at__date__gte=cur)
    if hospital_id and _has_field(Ticket, "hospital"):
        qs = qs.filter(hospital_id=hospital_id)

    by_status = list(qs.values("status").annotate(c=Count("id")).order_by("status"))

    resolved = qs.filter(status__in=["RESOLVED", "CLOSED"]) if _has_field(Ticket, "status") else qs.none()
    avg_hours = 0.0
    if _has_field(Ticket, "resolved_at"):
        total = 0.0
        n = 0
        for t in resolved.iterator():
            ra = getattr(t, "resolved_at", None)
            ca = getattr(t, "created_at", None)
            if ra and ca:
                total += (ra - ca).total_seconds() / 3600.0
                n += 1
        if n:
            avg_hours = round(total / n, 1)
    return {
        "by_status": [{"status": r["status"], "count": r["c"]} for r in by_status],
        "avg_resolution_hours": avg_hours,
    }


# ---------------------------------------------------------------------------
# Composite dashboard payload
# ---------------------------------------------------------------------------
def dashboard_payload(hospital_id: int | None = None) -> dict[str, Any]:
    return {
        "kpis":            kpi_cards(hospital_id),
        "revenue_monthly": revenue_monthly(6, hospital_id),
        "opd_volume":      opd_volume_daily(30, hospital_id),
        "revenue_by_dept": revenue_by_department(hospital_id=hospital_id),
        "ot_utilization":  ot_utilization(30, hospital_id),
        "ipd_occupancy":   ipd_occupancy_by_ward(hospital_id),
        "ar_aging":        ar_aging(hospital_id),
        "top_diagnoses":   top_diagnoses(10, hospital_id),
        "blood_inventory": blood_inventory(hospital_id),
        "hr_headcount":    hr_headcount(hospital_id),
        "attendance":      attendance_summary(hospital_id=hospital_id),
        "pharmacy_turn":   pharmacy_turnover(6, hospital_id),
        "lab_turnover":    lab_turnover(6, hospital_id),
        "asset_deprec":    asset_depreciation_summary(hospital_id),
        "insurance":       insurance_claim_summary(6, hospital_id),
        "complaints":      complaints_sla(3, hospital_id),
    }


# ---------------------------------------------------------------------------
# Report dispatcher — for the custom report builder
# ---------------------------------------------------------------------------
REPORT_DISPATCH = {
    "OPD_VOLUME":      lambda p, h: opd_volume_daily(p.get("days", 30), h),
    "IPD_OCCUPANCY":   lambda p, h: ipd_occupancy_by_ward(h),
    "OT_UTILIZATION":  lambda p, h: ot_utilization(p.get("days", 30), h),
    "REVENUE_MONTHLY": lambda p, h: revenue_monthly(p.get("months", 6), h),
    "REVENUE_DEPT":    lambda p, h: revenue_by_department(p.get("month"), p.get("year"), h),
    "AR_AGING":        lambda p, h: ar_aging(h),
    "PHARMACY_TURN":   lambda p, h: pharmacy_turnover(p.get("months", 6), h),
    "LAB_TURNOVER":    lambda p, h: lab_turnover(p.get("months", 6), h),
    "BLOOD_INVENTORY": lambda p, h: blood_inventory(h),
    "DIAGNOSES_TOP":   lambda p, h: top_diagnoses(p.get("limit", 10), h),
    "ASSET_DEPREC":    lambda p, h: asset_depreciation_summary(h),
    "HR_HEADCOUNT":    lambda p, h: hr_headcount(h),
    "ATTENDANCE_SUM":  lambda p, h: attendance_summary(p.get("date"), h),
    "INSURANCE_CLAIM": lambda p, h: insurance_claim_summary(p.get("months", 6), h),
    "COMPLAINTS_SLA":  lambda p, h: complaints_sla(p.get("months", 3), h),
}


def run_report(report_type: str, parameters: dict | None = None, hospital_id: int | None = None):
    """Dispatch a report by type and return the result list/dict."""
    fn = REPORT_DISPATCH.get(report_type)
    if not fn:
        raise ValueError(f"Unknown report type: {report_type}")
    return fn(parameters or {}, hospital_id)
