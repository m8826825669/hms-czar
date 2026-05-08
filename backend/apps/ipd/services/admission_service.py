"""IPD admission business logic.

Decoupled from views so flows can be triggered from UI buttons,
Celery beat (daily charge accrual), or webhook callbacks.

Key flows:
  admit_patient()                  : allocate bed + create Admission
  accrue_daily_charges()           : create DailyCharge rows up to today
  add_admission_service()          : ad-hoc procedure / consultation charge
  discharge_patient()              : finalize charges + roll into Invoice + free bed
"""
from datetime import date, timedelta
from decimal import Decimal
from django.db import transaction
from django.utils import timezone

from apps.billing.models import Invoice, InvoiceItem
from apps.billing.services.invoice_service import determine_gst_split
from ..models import (Admission, Bed, DailyCharge, AdmissionService,
                      DischargeSummary)


# ─────────────────────────────────── Admit ──────────────────────────────────────

def admit_patient(*, hospital, user, patient, bed, attending_doctor,
                  admission_diagnosis, admission_type="PLANNED",
                  chief_complaint="", department=None,
                  expected_discharge_date=None, admission_notes=""):
    """Create an Admission and lock the bed."""
    if bed.status != "AVAILABLE":
        raise ValueError(
            f"Bed {bed.display_code} is {bed.status}, not AVAILABLE."
        )
    # Defensive: ensure the bed isn't tied to an active admission
    active = Admission.objects.filter(bed=bed, status="ADMITTED").exists()
    if active:
        raise ValueError(
            f"Bed {bed.display_code} already has an active admission."
        )

    with transaction.atomic():
        admission = Admission.objects.create(
            hospital=hospital,
            created_by=user,
            code=Admission.generate_code(hospital, timezone.localdate()),
            patient=patient,
            bed=bed,
            attending_doctor=attending_doctor,
            department=department,
            admission_type=admission_type,
            admission_diagnosis=admission_diagnosis,
            chief_complaint=chief_complaint,
            admission_notes=admission_notes,
            expected_discharge_date=expected_discharge_date,
            locked_bed_rent=bed.bed_rent,
            locked_nursing_charge=bed.nursing_charge,
            locked_gst_rate=bed.gst_rate,
            status="ADMITTED",
        )
        bed.status = "OCCUPIED"
        bed.save(update_fields=["status"])
    return admission


# ─────────────────────────────────── Transfer ───────────────────────────────────

def transfer_to_bed(*, admission, new_bed, user, reason=""):
    """Move an active admission to a different bed.

    Old bed → AVAILABLE, new bed → OCCUPIED, locked rates updated.
    Past DailyCharge rows are preserved (already billed at old rate).
    """
    if admission.status != "ADMITTED":
        raise ValueError(f"Cannot transfer {admission.status} admission")
    if new_bed.status != "AVAILABLE":
        raise ValueError(f"Bed {new_bed.display_code} is not available")
    if new_bed.id == admission.bed_id:
        raise ValueError("That's the same bed")

    with transaction.atomic():
        old_bed = admission.bed
        admission.bed = new_bed
        admission.locked_bed_rent = new_bed.bed_rent
        admission.locked_nursing_charge = new_bed.nursing_charge
        admission.locked_gst_rate = new_bed.gst_rate
        admission.notes = (
            (admission.notes or "")
            + f"\n[{timezone.now():%Y-%m-%d %H:%M}] Transferred from "
            f"{old_bed.display_code} to {new_bed.display_code}. {reason}"
        ).strip()
        admission.save(update_fields=[
            "bed", "locked_bed_rent", "locked_nursing_charge",
            "locked_gst_rate", "notes",
        ])
        old_bed.status = "AVAILABLE"
        old_bed.save(update_fields=["status"])
        new_bed.status = "OCCUPIED"
        new_bed.save(update_fields=["status"])
    return admission


# ─────────────────────────────── Daily charges ──────────────────────────────────

def accrue_daily_charges(admission, *, up_to=None):
    """Create DailyCharge rows for any uncovered days from admission_date
    through `up_to` (default: today, or discharge date).

    Returns the list of newly-created rows. Idempotent.
    """
    if admission.status not in ("ADMITTED", "DISCHARGED"):
        return []

    end_date = (
        up_to
        or (admission.discharged_at.date() if admission.discharged_at
            else timezone.localdate())
    )
    start_date = admission.admitted_at.date()

    if end_date < start_date:
        return []

    existing = set(
        admission.daily_charges.values_list("charge_date", flat=True)
    )

    created = []
    cur = start_date
    while cur <= end_date:
        if cur not in existing:
            row = DailyCharge.objects.create(
                hospital=admission.hospital,
                admission=admission,
                charge_date=cur,
                bed_rent=admission.locked_bed_rent,
                nursing_charge=admission.locked_nursing_charge,
                gst_rate=admission.locked_gst_rate,
            )
            created.append(row)
        cur += timedelta(days=1)
    return created


# ─────────────────────────────── Service line ───────────────────────────────────

def add_admission_service(*, admission, user, description, unit_price,
                          quantity=Decimal("1"), gst_rate=Decimal("18.00"),
                          service=None, service_date=None, notes=""):
    """Add an ad-hoc service line to the admission (procedure, special visit)."""
    if admission.status != "ADMITTED":
        raise ValueError(f"Cannot add service to {admission.status} admission")
    return AdmissionService.objects.create(
        hospital=admission.hospital,
        created_by=user,
        admission=admission,
        service=service,
        description=description,
        quantity=Decimal(str(quantity)),
        unit_price=Decimal(str(unit_price)),
        gst_rate=Decimal(str(gst_rate)),
        service_date=service_date or timezone.localdate(),
        notes=notes,
    )


# ─────────────────────────────────── Discharge ──────────────────────────────────

def discharge_patient(admission, *, user, discharge_type="ROUTINE",
                      include_pharmacy=True, include_lab=True):
    """Discharge the admission.

    Steps (atomic):
      1. Accrue daily charges through today.
      2. Create a final Invoice with line items for:
           - one line per DailyCharge (or rolled by category — see below)
           - one line per AdmissionService
           - optionally pharmacy orders during stay (toggle)
           - optionally lab orders during stay (toggle)
      3. Mark admission DISCHARGED, free the bed.
      4. Return the invoice for review/payment.

    Daily charges are rolled into 3 summary lines on the final invoice
    (Bed Rent, Nursing, Other) for clarity. The full DailyCharge ledger is
    available on the admission detail page.
    """
    if admission.status != "ADMITTED":
        raise ValueError(f"Cannot discharge {admission.status} admission")

    with transaction.atomic():
        # 1. Final daily charge accrual
        admission.discharged_at = timezone.now()
        admission.save(update_fields=["discharged_at"])
        accrue_daily_charges(admission)

        # 2. Build the invoice
        hospital = admission.hospital
        patient = admission.patient
        hospital_state = getattr(hospital, "state", "")
        patient_state = getattr(patient, "state", "")
        gst_split = determine_gst_split(
            hospital_state=hospital_state, patient_state=patient_state,
        )

        invoice = Invoice.objects.create(
            hospital=hospital,
            created_by=user,
            code=Invoice.generate_code(hospital, timezone.localdate()),
            bill_date=timezone.localdate(),
            patient=patient,
            patient_state=patient_state,
            hospital_state=hospital_state,
            gst_split=gst_split,
            status="DRAFT",
            notes=f"IPD discharge — admission {admission.code}",
        )

        idx = 0

        # ── Roll up daily charges by component ──
        days = admission.daily_charges.count()
        if days:
            total_bed_rent = sum(
                (Decimal(c.bed_rent) for c in admission.daily_charges.all()),
                Decimal("0"),
            )
            total_nursing = sum(
                (Decimal(c.nursing_charge) for c in admission.daily_charges.all()),
                Decimal("0"),
            )
            total_other = sum(
                (Decimal(c.other_charge) for c in admission.daily_charges.all()),
                Decimal("0"),
            )
            # Bed rent — one line, days × locked rate
            if total_bed_rent > 0:
                InvoiceItem.objects.create(
                    hospital=hospital, created_by=user,
                    invoice=invoice,
                    service_name=f"Bed Rent ({admission.bed.display_code}) × {days} day(s)",
                    hsn_code="9993",
                    quantity=Decimal(str(days)),
                    unit_price=admission.locked_bed_rent,
                    gst_rate=admission.locked_gst_rate,
                    order_index=idx,
                )
                idx += 1
            if total_nursing > 0:
                InvoiceItem.objects.create(
                    hospital=hospital, created_by=user,
                    invoice=invoice,
                    service_name=f"Nursing Care × {days} day(s)",
                    hsn_code="9993",
                    quantity=Decimal(str(days)),
                    unit_price=admission.locked_nursing_charge,
                    gst_rate=admission.locked_gst_rate,
                    order_index=idx,
                )
                idx += 1
            if total_other > 0:
                # Group misc per-day add-ons under one line
                InvoiceItem.objects.create(
                    hospital=hospital, created_by=user,
                    invoice=invoice,
                    service_name="Other daily charges (equipment / monitoring)",
                    hsn_code="9993",
                    quantity=Decimal("1"),
                    unit_price=total_other,
                    gst_rate=admission.locked_gst_rate,
                    order_index=idx,
                )
                idx += 1

        # ── Admission services (procedures, special visits) ──
        for s in admission.services.all().order_by("service_date"):
            InvoiceItem.objects.create(
                hospital=hospital, created_by=user,
                invoice=invoice,
                service_name=s.description,
                hsn_code=s.service.hsn_code if s.service else "9993",
                quantity=s.quantity,
                unit_price=s.unit_price,
                gst_rate=s.gst_rate,
                order_index=idx,
            )
            idx += 1

        # ── Roll-up: pharmacy orders during stay ──
        if include_pharmacy:
            try:
                from apps.pharmacy.models import PharmacyOrder
                pharm_orders = PharmacyOrder.objects.filter(
                    hospital=hospital,
                    patient=patient,
                    status="COMPLETED",
                    dispensed_at__gte=admission.admitted_at,
                    dispensed_at__lte=admission.discharged_at,
                ).exclude(invoice__isnull=False)
                for po in pharm_orders:
                    InvoiceItem.objects.create(
                        hospital=hospital, created_by=user,
                        invoice=invoice,
                        service_name=f"Pharmacy [{po.code}] — "
                                      f"{po.items.count()} medications",
                        hsn_code="3004",
                        quantity=Decimal("1"),
                        unit_price=po.subtotal,
                        gst_rate=Decimal("12.00"),
                        order_index=idx,
                    )
                    idx += 1
            except Exception:
                pass  # Pharmacy app may not be installed

        # ── Roll-up: lab orders during stay ──
        if include_lab:
            try:
                from apps.lab.models import LabOrder
                lab_orders = LabOrder.objects.filter(
                    hospital=hospital,
                    patient=patient,
                    order_date__gte=admission.admitted_at.date(),
                    order_date__lte=admission.discharged_at.date(),
                ).exclude(invoice__isnull=False).exclude(status="CANCELLED")
                for lo in lab_orders:
                    test_count = lo.items.count()
                    InvoiceItem.objects.create(
                        hospital=hospital, created_by=user,
                        invoice=invoice,
                        service_name=f"Laboratory [{lo.code}] — "
                                      f"{test_count} test(s)",
                        hsn_code="9993",
                        quantity=Decimal("1"),
                        unit_price=lo.subtotal,
                        gst_rate=Decimal("0.00"),
                        order_index=idx,
                    )
                    idx += 1
            except Exception:
                pass

        invoice.recalculate_totals()
        invoice.status = "PENDING"
        invoice.save(update_fields=["status"])

        # 3. Update admission + free bed
        admission.invoice = invoice
        admission.status = (
            "DISCHARGED" if discharge_type == "ROUTINE"
            else discharge_type if discharge_type in
                 ("DAMA", "EXPIRED", "ABSCONDED", "TRANSFERRED")
            else "DISCHARGED"
        )
        admission.discharge_type = discharge_type
        admission.save(update_fields=["invoice", "status", "discharge_type"])

        bed = admission.bed
        bed.status = "AVAILABLE"
        bed.save(update_fields=["status"])

    return admission


# ─────────────────────────────────── Discharge summary ──────────────────────────

def upsert_discharge_summary(admission, *, user, doctor=None, finalize=False,
                             **fields):
    """Create or update the DischargeSummary for an admission. If finalize=True
    AND fields are valid, lock the document by setting finalized_at."""
    summary, _ = DischargeSummary.objects.get_or_create(
        hospital=admission.hospital,
        admission=admission,
        defaults={"created_by": user, "prepared_by": doctor},
    )
    if summary.is_finalized:
        raise ValueError("Discharge summary is already finalized and locked.")
    for k, v in fields.items():
        if hasattr(summary, k):
            setattr(summary, k, v)
    if doctor and not summary.prepared_by:
        summary.prepared_by = doctor
    if finalize:
        if not summary.final_diagnosis:
            raise ValueError("final_diagnosis required to finalize")
        if not summary.course_in_hospital:
            raise ValueError("course_in_hospital required to finalize")
        summary.finalized_at = timezone.now()
    summary.save()
    return summary
