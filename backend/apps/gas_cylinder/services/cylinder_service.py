"""
Gas Cylinder service.

Operations: issue, return, send to refill, receive from refill, inspection log.
"""
from __future__ import annotations
from datetime import timedelta
from decimal import Decimal
from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Count
from django.utils import timezone

from ..models import (
    CylinderType, Cylinder, CylinderUsage,
    RefillRecord, CylinderInspection,
)


def _gen_refill_code(hospital):
    today = timezone.now().date()
    prefix = f"RF-{today.strftime('%Y%m%d')}-"
    last = (RefillRecord.objects
            .filter(hospital=hospital, code__startswith=prefix)
            .order_by("-code").first())
    if last:
        try:
            n = int(last.code.split("-")[-1]) + 1
        except (ValueError, IndexError):
            n = 1
    else:
        n = 1
    return f"{prefix}{n:04d}"


@transaction.atomic
def issue_cylinder(cylinder: Cylinder, *, department=None, location: str = "",
                    received_by: str = "", user=None) -> Cylinder:
    if cylinder.status not in ("AVAILABLE", "PARTIAL"):
        raise ValidationError(
            f"Cannot issue cylinder in status {cylinder.status}. "
            f"Must be AVAILABLE or PARTIAL.",
        )

    cylinder.status = "IN_USE"
    cylinder.current_department = department
    cylinder.current_location = location
    cylinder.save(update_fields=["status", "current_department",
                                   "current_location", "updated_at"])

    CylinderUsage.objects.create(
        cylinder=cylinder, event_type="ISSUED",
        department=department, location=location,
        fill_at_event=cylinder.fill_percentage,
        received_by=received_by, handled_by=user,
    )
    return cylinder


@transaction.atomic
def return_cylinder(cylinder: Cylinder, *, fill_percentage: int,
                     user=None, notes: str = "") -> Cylinder:
    """Return cylinder from use; if low, mark for refill."""
    if cylinder.status != "IN_USE":
        raise ValidationError("Cylinder is not in use.")

    cylinder.fill_percentage = max(0, min(100, fill_percentage))
    if fill_percentage <= 5:
        cylinder.status = "EMPTY"
    elif fill_percentage >= 95:
        cylinder.status = "AVAILABLE"
    else:
        cylinder.status = "PARTIAL"
    cylinder.current_department = None
    cylinder.current_location = "Storage"
    cylinder.save(update_fields=[
        "status", "fill_percentage", "current_department",
        "current_location", "updated_at",
    ])

    CylinderUsage.objects.create(
        cylinder=cylinder, event_type="RETURNED",
        location="Storage", fill_at_event=fill_percentage,
        handled_by=user, notes=notes,
    )
    return cylinder


@transaction.atomic
def send_for_refill(hospital, cylinders, *, vendor_name: str,
                     expected_return_at=None, user=None) -> RefillRecord:
    if not cylinders:
        raise ValidationError("At least one cylinder required.")

    rec = RefillRecord.objects.create(
        hospital=hospital,
        code=_gen_refill_code(hospital),
        vendor_name=vendor_name,
        sent_at=timezone.now(),
        expected_return_at=expected_return_at,
        cylinders_sent=len(cylinders),
    )
    for cyl in cylinders:
        cyl.status = "AT_VENDOR"
        cyl.current_department = None
        cyl.current_location = f"Vendor: {vendor_name}"
        cyl.save(update_fields=["status", "current_department",
                                  "current_location", "updated_at"])
        CylinderUsage.objects.create(
            cylinder=cyl, event_type="REFILL_OUT",
            fill_at_event=cyl.fill_percentage,
            handled_by=user, notes=f"Refill batch {rec.code}",
        )
    return rec


@transaction.atomic
def receive_from_refill(refill: RefillRecord, *, cylinder_ids: list,
                         total_cost: Decimal = Decimal("0"),
                         invoice_ref: str = "", user=None) -> RefillRecord:
    """Mark cylinders refilled and update fill to 100%."""
    cylinders = Cylinder.objects.filter(id__in=cylinder_ids)

    for cyl in cylinders:
        cyl.status = "AVAILABLE"
        cyl.fill_percentage = 100
        cyl.current_location = "Storage"
        cyl.last_refilled_at = timezone.now()
        cyl.refill_count = cyl.refill_count + 1
        cyl.save()
        CylinderUsage.objects.create(
            cylinder=cyl, event_type="REFILL_IN",
            fill_at_event=100, handled_by=user,
            notes=f"Received from {refill.code}",
        )

    refill.cylinders_received = cylinders.count()
    refill.received_at = timezone.now()
    refill.total_cost = total_cost
    refill.invoice_reference = invoice_ref
    refill.is_completed = (refill.cylinders_received >= refill.cylinders_sent)
    refill.save()
    return refill


@transaction.atomic
def record_inspection(cylinder: Cylinder, *, inspection_type: str,
                       outcome: str, inspected_by: str = "",
                       findings: str = "", certificate_ref: str = "",
                       next_due_in_days: int = None) -> CylinderInspection:
    insp = CylinderInspection.objects.create(
        cylinder=cylinder,
        inspection_type=inspection_type,
        outcome=outcome,
        inspected_by=inspected_by,
        findings=findings,
        certificate_ref=certificate_ref,
        inspection_date=timezone.localdate(),
        next_due_date=(timezone.localdate() + timedelta(days=next_due_in_days)
                        if next_due_in_days else None),
    )
    if inspection_type == "HYDRO":
        cylinder.last_hydro_test = insp.inspection_date
        cylinder.next_hydro_test_due = insp.next_due_date
        cylinder.save(update_fields=["last_hydro_test",
                                       "next_hydro_test_due", "updated_at"])

    if outcome == "FAILED":
        cylinder.status = "RETIRED"
        cylinder.save(update_fields=["status", "updated_at"])

    return insp


def inventory_summary(hospital):
    """Return dict of cylinder counts by gas_type + status."""
    today = timezone.localdate()

    by_gas_status = (Cylinder.objects
                     .filter(hospital=hospital, is_active=True)
                     .values("cylinder_type__gas_type", "status")
                     .annotate(count=Count("id"))
                     .order_by("cylinder_type__gas_type", "status"))

    stock = {}
    for row in by_gas_status:
        gt = row["cylinder_type__gas_type"]
        stock.setdefault(gt, {})[row["status"]] = row["count"]

    # Hydro test due
    hydro_due = list(Cylinder.objects.filter(
        hospital=hospital, is_active=True,
        next_hydro_test_due__lte=today + timedelta(days=30),
    ).values("id", "serial_number", "next_hydro_test_due",
              "cylinder_type__gas_type", "cylinder_type__size")
     .order_by("next_hydro_test_due")[:50])

    return {
        "as_of": today.isoformat(),
        "stock_by_gas_status": stock,
        "totals": {
            "available": Cylinder.objects.filter(
                hospital=hospital, status="AVAILABLE", is_active=True
            ).count(),
            "in_use": Cylinder.objects.filter(
                hospital=hospital, status="IN_USE", is_active=True
            ).count(),
            "empty": Cylinder.objects.filter(
                hospital=hospital, status="EMPTY", is_active=True
            ).count(),
            "at_vendor": Cylinder.objects.filter(
                hospital=hospital, status="AT_VENDOR", is_active=True
            ).count(),
            "hydro_due_30d": len(hydro_due),
        },
        "hydro_due": hydro_due,
    }
