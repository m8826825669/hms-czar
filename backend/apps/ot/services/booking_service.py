"""
OT booking service.

Public functions:
  • book_surgery(...)              — create with theatre availability check
  • check_in_patient(...)          — booking → CHECKED_IN
  • start_surgery(...)             — booking → IN_PROGRESS, theatre → OCCUPIED
  • complete_surgery(...)          — booking → COMPLETED, theatre → CLEANING,
                                      bills consumables + procedure to admission
                                      OR creates standalone invoice for day-care
  • cancel_surgery(...)            — booking → CANCELLED
  • postpone_surgery(...)          — booking → POSTPONED with new schedule
  • add_team_member(...)
  • add_consumable(...)
  • upsert_register(...)           — create or edit OTRegister, finalize gate
  • check_theatre_conflicts(...)   — for booking forms
"""
from __future__ import annotations
from decimal import Decimal
from datetime import datetime, timedelta
from typing import Optional

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from ..models import (
    OperationTheatre, SurgicalProcedure, SurgeryBooking,
    SurgeryTeam, OTRegister, OTConsumable,
)


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _generate_booking_code(hospital):
    """Generate OT-YYYYMMDD-NNNN."""
    today = timezone.now().date()
    prefix = f"OT-{today.strftime('%Y%m%d')}-"
    last = (SurgeryBooking.objects
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


def check_theatre_conflicts(theatre, start, end, exclude_booking_id=None):
    """Return overlapping SurgeryBooking queryset for the given window.

    Considers SCHEDULED, CHECKED_IN, IN_PROGRESS bookings (anything not
    CANCELLED/COMPLETED/POSTPONED).
    """
    qs = SurgeryBooking.objects.filter(
        theatre=theatre,
        status__in=["SCHEDULED", "CHECKED_IN", "IN_PROGRESS"],
        scheduled_start__lt=end,
        scheduled_end__gt=start,
    )
    if exclude_booking_id:
        qs = qs.exclude(id=exclude_booking_id)
    return qs


# ─────────────────────────────────────────────────────────────────────────────
# Booking lifecycle
# ─────────────────────────────────────────────────────────────────────────────

@transaction.atomic
def book_surgery(
    *,
    hospital,
    patient,
    theatre: OperationTheatre,
    procedure: SurgicalProcedure,
    primary_surgeon,
    scheduled_start: datetime,
    scheduled_end: datetime,
    anaesthetist=None,
    admission=None,
    urgency: str = "ELECTIVE",
    pre_op_diagnosis: str = "",
    pre_op_assessment: str = "",
    consent_obtained: bool = False,
    notes: str = "",
    booked_by=None,
) -> SurgeryBooking:
    """Create a SurgeryBooking with conflict check and locked pricing."""
    if scheduled_end <= scheduled_start:
        raise ValidationError("scheduled_end must be after scheduled_start.")

    if not theatre.is_active:
        raise ValidationError(f"Theatre {theatre.code} is not active.")

    conflicts = check_theatre_conflicts(theatre, scheduled_start, scheduled_end)
    if conflicts.exists():
        existing = conflicts.first()
        raise ValidationError(
            f"Theatre {theatre.code} already has an overlapping booking "
            f"({existing.code}) from "
            f"{existing.scheduled_start.strftime('%H:%M')} to "
            f"{existing.scheduled_end.strftime('%H:%M')}."
        )

    booking = SurgeryBooking(
        hospital=hospital,
        code=_generate_booking_code(hospital),
        patient=patient,
        theatre=theatre,
        procedure=procedure,
        primary_surgeon=primary_surgeon,
        anaesthetist=anaesthetist,
        admission=admission,
        urgency=urgency,
        scheduled_start=scheduled_start,
        scheduled_end=scheduled_end,
        pre_op_diagnosis=pre_op_diagnosis,
        pre_op_assessment=pre_op_assessment,
        consent_obtained=consent_obtained,
        notes=notes,
        booked_by=booked_by,
        status="SCHEDULED",
    )
    booking.lock_pricing()
    booking.save()

    # Auto-add primary surgeon and (if present) anaesthetist to the team
    SurgeryTeam.objects.create(booking=booking, doctor=primary_surgeon, role="SURGEON")
    if anaesthetist:
        SurgeryTeam.objects.create(booking=booking, doctor=anaesthetist, role="ANAESTHETIST")

    return booking


@transaction.atomic
def check_in_patient(booking: SurgeryBooking) -> SurgeryBooking:
    if booking.status != "SCHEDULED":
        raise ValidationError(f"Cannot check-in a booking in status {booking.status}.")
    booking.status = "CHECKED_IN"
    booking.save(update_fields=["status", "updated_at"])
    return booking


@transaction.atomic
def start_surgery(booking: SurgeryBooking) -> SurgeryBooking:
    if booking.status not in ("SCHEDULED", "CHECKED_IN"):
        raise ValidationError(f"Cannot start surgery in status {booking.status}.")

    booking.status = "IN_PROGRESS"
    booking.actual_start = timezone.now()
    booking.save(update_fields=["status", "actual_start", "updated_at"])

    booking.theatre.status = "OCCUPIED"
    booking.theatre.save(update_fields=["status", "updated_at"])
    return booking


@transaction.atomic
def complete_surgery(booking: SurgeryBooking, *, generate_invoice: bool = True) -> SurgeryBooking:
    """Mark surgery complete, free up the theatre, and bill.

    Billing rules:
      • If the booking has an admission, all consumables + procedure fee are
        added as AdmissionService entries (rolled up at discharge).
      • Otherwise, a standalone invoice is created with line items for procedure
        + each consumable.
    """
    if booking.status != "IN_PROGRESS":
        raise ValidationError("Surgery must be IN_PROGRESS to complete.")

    booking.status = "COMPLETED"
    booking.actual_end = timezone.now()
    booking.save(update_fields=["status", "actual_end", "updated_at"])

    booking.theatre.status = "CLEANING"
    booking.theatre.save(update_fields=["status", "updated_at"])

    if generate_invoice:
        if booking.admission_id:
            _bill_to_admission(booking)
        else:
            _bill_standalone(booking)

    return booking


def _bill_to_admission(booking: SurgeryBooking):
    """Add procedure + consumables as AdmissionService rows."""
    from apps.ipd.models import AdmissionService

    admission = booking.admission
    today = timezone.now().date()

    # Procedure line
    AdmissionService.objects.create(
        admission=admission,
        description=f"Surgery: {booking.procedure.name} ({booking.code})",
        quantity=1,
        unit_price=booking.locked_procedure_price,
        gst_rate=booking.locked_gst_rate,
        service_date=today,
    )

    # Consumables
    for cons in booking.consumables.all():
        AdmissionService.objects.create(
            admission=admission,
            description=f"OT consumable: {cons.item_name}",
            quantity=cons.quantity,
            unit_price=cons.unit_price,
            gst_rate=cons.gst_rate,
            service_date=today,
        )


def _bill_standalone(booking: SurgeryBooking):
    """Create a standalone invoice for non-IPD surgeries (day-care, OPD)."""
    from apps.billing.models import Invoice, InvoiceLine
    from apps.billing.services.invoice_service import (
        generate_invoice_code, recalculate_invoice_totals,
    )

    inv = Invoice.objects.create(
        hospital=booking.hospital,
        code=generate_invoice_code(booking.hospital),
        patient=booking.patient,
        invoice_type="OT",
        status="PENDING",
        notes=f"Day-care surgery: {booking.procedure.name} ({booking.code})",
    )

    # Procedure line
    InvoiceLine.objects.create(
        invoice=inv,
        description=f"Surgery: {booking.procedure.name}",
        hsn_code=booking.procedure.hsn_code or "9993",
        quantity=1,
        unit_price=booking.locked_procedure_price,
        gst_rate=booking.locked_gst_rate,
    )

    # Consumables
    for cons in booking.consumables.all():
        InvoiceLine.objects.create(
            invoice=inv,
            description=f"OT consumable: {cons.item_name}",
            hsn_code="9993",
            quantity=cons.quantity,
            unit_price=cons.unit_price,
            gst_rate=cons.gst_rate,
        )

    recalculate_invoice_totals(inv)

    booking.invoice = inv
    booking.save(update_fields=["invoice", "updated_at"])


@transaction.atomic
def cancel_surgery(booking: SurgeryBooking, *, reason: str, user=None) -> SurgeryBooking:
    if booking.status in ("COMPLETED", "CANCELLED"):
        raise ValidationError("Cannot cancel a completed or already-cancelled booking.")

    booking.status = "CANCELLED"
    booking.cancellation_reason = reason
    booking.cancelled_at = timezone.now()
    booking.cancelled_by = user
    booking.save(update_fields=[
        "status", "cancellation_reason", "cancelled_at", "cancelled_by", "updated_at",
    ])
    return booking


@transaction.atomic
def postpone_surgery(
    booking: SurgeryBooking,
    new_start: datetime,
    new_end: datetime,
    *,
    reason: str = "",
) -> SurgeryBooking:
    if booking.status in ("COMPLETED", "IN_PROGRESS", "CANCELLED"):
        raise ValidationError(f"Cannot postpone in status {booking.status}.")

    conflicts = check_theatre_conflicts(
        booking.theatre, new_start, new_end, exclude_booking_id=booking.id,
    )
    if conflicts.exists():
        raise ValidationError(
            f"Theatre {booking.theatre.code} has a conflict at the new time."
        )

    booking.scheduled_start = new_start
    booking.scheduled_end = new_end
    booking.status = "POSTPONED"
    if reason:
        booking.notes = (booking.notes + "\n" if booking.notes else "") + \
            f"Postponed: {reason}"
    booking.save(update_fields=[
        "scheduled_start", "scheduled_end", "status", "notes", "updated_at",
    ])
    return booking


# ─────────────────────────────────────────────────────────────────────────────
# Team + consumables + register
# ─────────────────────────────────────────────────────────────────────────────

def add_team_member(booking, *, role, doctor=None, member_name="", notes=""):
    return SurgeryTeam.objects.create(
        booking=booking, role=role, doctor=doctor,
        member_name=member_name, notes=notes,
    )


def add_consumable(booking, *, item_name, quantity, unit_price,
                    unit="pcs", gst_rate=Decimal("0"), notes="", added_by=None):
    return OTConsumable.objects.create(
        booking=booking,
        item_name=item_name,
        quantity=quantity,
        unit=unit,
        unit_price=unit_price,
        gst_rate=gst_rate,
        notes=notes,
        added_by=added_by,
    )


@transaction.atomic
def upsert_register(booking, *, prepared_by=None, finalize=False, **fields):
    """Create or update the OTRegister.

    Refuses to edit if already finalized. To finalize, requires
    surgical_steps and intra_op_findings non-empty.
    """
    register, _ = OTRegister.objects.get_or_create(booking=booking)

    if register.is_finalized:
        raise ValidationError("OT Register is already finalized and cannot be edited.")

    allowed_fields = {
        "pre_op_findings", "surgical_steps", "intra_op_findings",
        "complications", "blood_loss_ml", "blood_transfused_units",
        "instruments_used", "implants_used", "specimens_sent",
        "anaesthesia_type", "anaesthesia_notes",
        "post_op_orders", "condition_on_shifting",
    }
    for k, v in fields.items():
        if k in allowed_fields and v is not None:
            setattr(register, k, v)

    if prepared_by:
        register.prepared_by = prepared_by
    register.prepared_at = timezone.now()

    if finalize:
        if not register.surgical_steps.strip() or not register.intra_op_findings.strip():
            raise ValidationError(
                "Cannot finalize: surgical_steps and intra_op_findings are required."
            )
        register.finalized_at = timezone.now()

    register.save()
    return register
