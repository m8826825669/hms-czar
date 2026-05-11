"""
Blood Bank service.

Workflows:
  • register_donor()                 — eligibility checks
  • record_donation()                — creates BloodDonation, updates donor stats
  • complete_screening()             — marks tests done; if all pass, auto-creates
                                        BloodBag(s) per requested components
  • create_requisition()
  • find_compatible_bags()           — for cross-match candidates
  • crossmatch_bag()                 — record a cross-match result
  • reserve_bag_for_requisition()
  • issue_bag()                      — moves bag → ISSUED, optional billing
  • complete_transfusion()
  • discard_bag()
  • expire_old_bags()                — Celery task helper
  • inventory_summary()              — for dashboards
"""
from __future__ import annotations
from datetime import timedelta
from decimal import Decimal
from typing import List, Optional

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone

from ..models import (
    BloodDonor, BloodDonation, BloodBag, BloodRequisition,
    CrossMatch, BloodIssue, COMPATIBILITY,
)


# ─────────────────────────────────────────────────────────────────────────────
# ID generators
# ─────────────────────────────────────────────────────────────────────────────

def _gen_id(model, hospital, prefix, field):
    today = timezone.now().date()
    full_prefix = f"{prefix}-{today.strftime('%Y%m%d')}-"
    last = (model.objects
            .filter(hospital=hospital, **{f"{field}__startswith": full_prefix})
            .order_by(f"-{field}").first())
    if last:
        try:
            n = int(getattr(last, field).split("-")[-1]) + 1
        except (ValueError, IndexError):
            n = 1
    else:
        n = 1
    return f"{full_prefix}{n:04d}"


# ─────────────────────────────────────────────────────────────────────────────
# Donor lifecycle
# ─────────────────────────────────────────────────────────────────────────────

@transaction.atomic
def register_donor(*, hospital, first_name, last_name, gender, dob,
                   blood_group, phone, **extra) -> BloodDonor:
    """Register a new donor. Performs basic age check at create time."""
    today = timezone.localdate()
    age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
    if age < 18 or age > 65:
        raise ValidationError(
            f"Donor age must be between 18 and 65 (got {age}).",
        )

    donor = BloodDonor.objects.create(
        hospital=hospital,
        donor_id=_gen_id(BloodDonor, hospital, "BD", "donor_id"),
        first_name=first_name,
        last_name=last_name or "",
        gender=gender,
        dob=dob,
        blood_group=blood_group,
        phone=phone,
        email=extra.get("email", ""),
        address=extra.get("address", ""),
        aadhaar_last4=extra.get("aadhaar_last4", ""),
        weight_kg=extra.get("weight_kg", Decimal("0.00")),
        donor_type=extra.get("donor_type", "VOLUNTARY"),
        notes=extra.get("notes", ""),
    )
    return donor


@transaction.atomic
def record_donation(
    *,
    donor: BloodDonor,
    volume_collected_ml: int = 350,
    pre_hb_g_dl: Decimal = Decimal("0"),
    pre_bp_systolic: int = 0,
    pre_bp_diastolic: int = 0,
    pre_pulse: int = 0,
    pre_temperature_c: Decimal = Decimal("0"),
    collected_by=None,
    notes: str = "",
) -> BloodDonation:
    """Record a donation event. Validates donor eligibility."""
    eligible, reason = donor.can_donate_today()
    if not eligible:
        raise ValidationError(f"Donor not eligible: {reason}")

    donation = BloodDonation.objects.create(
        hospital=donor.hospital,
        donation_id=_gen_id(BloodDonation, donor.hospital, "DON", "donation_id"),
        donor=donor,
        donation_date=timezone.now(),
        volume_collected_ml=volume_collected_ml,
        blood_group=donor.blood_group,
        pre_hb_g_dl=pre_hb_g_dl,
        pre_bp_systolic=pre_bp_systolic,
        pre_bp_diastolic=pre_bp_diastolic,
        pre_pulse=pre_pulse,
        pre_temperature_c=pre_temperature_c,
        collected_by=collected_by,
        notes=notes,
        status="COLLECTED",
    )

    # Update donor stats
    donor.last_donation_date = timezone.localdate()
    donor.total_donations = donor.total_donations + 1
    donor.save(update_fields=["last_donation_date", "total_donations", "updated_at"])

    return donation


@transaction.atomic
def complete_screening(
    donation: BloodDonation,
    *,
    test_hiv: str,
    test_hbsag: str,
    test_hcv: str,
    test_syphilis: str,
    test_malaria: str,
    components: Optional[List[str]] = None,
    storage_location: str = "",
    screened_by=None,
    discard_reason: str = "",
) -> BloodDonation:
    """
    Mark all 5 mandatory tests; if all NEGATIVE, auto-create BloodBag(s)
    per requested components (default: WHOLE).
    """
    donation.test_hiv = test_hiv
    donation.test_hbsag = test_hbsag
    donation.test_hcv = test_hcv
    donation.test_syphilis = test_syphilis
    donation.test_malaria = test_malaria
    donation.screening_completed_at = timezone.now()
    donation.screened_by = screened_by

    if not donation.all_tests_complete:
        raise ValidationError("All 5 tests must be NEGATIVE or POSITIVE (not PENDING).")

    if donation.any_test_failed:
        donation.status = "FAILED"
        donation.discard_reason = discard_reason or "Failed reactive screening"
        donation.save()
        return donation

    if not donation.all_tests_passed:
        donation.status = "SCREENING"
        donation.save()
        return donation

    # All passed → create bags
    components = components or ["WHOLE"]
    today = timezone.localdate()

    for comp in components:
        shelf_days = BloodBag.SHELF_LIFE_DAYS.get(comp, 35)
        # Component volumes (rough): WHOLE ≈ donation, PRBC ≈ 60%, FFP ≈ 25%, etc.
        comp_volume = {
            "WHOLE":     donation.volume_collected_ml,
            "PRBC":      int(donation.volume_collected_ml * 0.60),
            "FFP":       int(donation.volume_collected_ml * 0.25),
            "PLATELETS": int(donation.volume_collected_ml * 0.10),
            "CRYO":      int(donation.volume_collected_ml * 0.05),
        }.get(comp, donation.volume_collected_ml)

        BloodBag.objects.create(
            hospital=donation.hospital,
            bag_id=_gen_id(BloodBag, donation.hospital, "BB", "bag_id"),
            donation=donation,
            component=comp,
            blood_group=donation.blood_group,
            volume_ml=comp_volume,
            collected_at=donation.donation_date,
            expiry_date=today + timedelta(days=shelf_days),
            status="AVAILABLE",
            storage_location=storage_location,
        )

    donation.status = "PASSED"
    donation.save()
    return donation


# ─────────────────────────────────────────────────────────────────────────────
# Requisition + cross-match + issue
# ─────────────────────────────────────────────────────────────────────────────

@transaction.atomic
def create_requisition(
    *,
    hospital,
    patient,
    requested_by,
    blood_group: str,
    component: str = "PRBC",
    units_required: int = 1,
    urgency: str = "ROUTINE",
    purpose: str = "",
    department=None,
    admission=None,
    notes: str = "",
) -> BloodRequisition:
    if units_required < 1:
        raise ValidationError("units_required must be ≥ 1")

    return BloodRequisition.objects.create(
        hospital=hospital,
        code=_gen_id(BloodRequisition, hospital, "BR", "code"),
        patient=patient,
        requested_by=requested_by,
        department=department,
        admission=admission,
        blood_group=blood_group,
        component=component,
        units_required=units_required,
        urgency=urgency,
        purpose=purpose,
        notes=notes,
        status="PENDING",
    )


def find_compatible_bags(requisition: BloodRequisition):
    """Returns AVAILABLE bags that match recipient's compatibility map."""
    compatible_groups = COMPATIBILITY.get(requisition.blood_group, [])
    today = timezone.localdate()

    return BloodBag.objects.filter(
        hospital=requisition.hospital,
        status="AVAILABLE",
        component=requisition.component,
        blood_group__in=compatible_groups,
        expiry_date__gte=today,
    ).order_by("expiry_date")  # FIFO — oldest first


@transaction.atomic
def crossmatch_bag(
    requisition: BloodRequisition,
    bag: BloodBag,
    *,
    result: str,
    notes: str = "",
    performed_by=None,
) -> CrossMatch:
    if result not in ("COMPATIBLE", "INCOMPATIBLE"):
        raise ValidationError("result must be COMPATIBLE or INCOMPATIBLE")

    if bag.hospital_id != requisition.hospital_id:
        raise ValidationError("Bag and requisition belong to different hospitals.")

    cm, _ = CrossMatch.objects.update_or_create(
        requisition=requisition,
        bag=bag,
        defaults={
            "result": result,
            "notes": notes,
            "performed_by": performed_by,
            "performed_at": timezone.now(),
        },
    )

    if requisition.status == "PENDING":
        requisition.status = "CROSSMATCH"
        requisition.save(update_fields=["status", "updated_at"])

    return cm


@transaction.atomic
def reserve_bag_for_requisition(requisition: BloodRequisition, bag: BloodBag):
    """Mark a bag as RESERVED (cross-match passed)."""
    if bag.status != "AVAILABLE":
        raise ValidationError(f"Bag is not available (status={bag.status}).")

    cm = CrossMatch.objects.filter(requisition=requisition, bag=bag,
                                    result="COMPATIBLE").first()
    if not cm:
        raise ValidationError("Bag has no compatible cross-match for this requisition.")

    bag.status = "RESERVED"
    bag.issued_to_requisition = requisition
    bag.save(update_fields=["status", "issued_to_requisition", "updated_at"])

    if requisition.status in ("PENDING", "CROSSMATCH"):
        requisition.status = "RESERVED"
        requisition.save(update_fields=["status", "updated_at"])

    return bag


@transaction.atomic
def issue_bag(
    bag: BloodBag,
    *,
    issued_to_dept: str = "",
    received_by_name: str = "",
    issued_by=None,
    create_invoice: bool = True,
    unit_price: Decimal = Decimal("1500"),
    gst_rate: Decimal = Decimal("0"),
) -> BloodIssue:
    """Move bag to ISSUED status; record issue and optionally generate invoice."""
    if bag.status != "RESERVED":
        raise ValidationError(
            f"Bag must be RESERVED before issue (current: {bag.status}). "
            f"Cross-match and reserve first."
        )
    requisition = bag.issued_to_requisition
    if not requisition:
        raise ValidationError("Bag has no linked requisition.")

    bag.status = "ISSUED"
    bag.save(update_fields=["status", "updated_at"])

    issue = BloodIssue.objects.create(
        requisition=requisition,
        bag=bag,
        issued_to_dept=issued_to_dept,
        received_by_name=received_by_name,
        issued_by=issued_by,
    )

    # Optional billing
    if create_invoice:
        _bill_blood_issue(issue, unit_price=unit_price, gst_rate=gst_rate)

    # If all units fulfilled → mark requisition ISSUED
    fulfilled = BloodIssue.objects.filter(requisition=requisition).count()
    if fulfilled >= requisition.units_required:
        requisition.status = "ISSUED"
        requisition.issued_at = timezone.now()
        requisition.save(update_fields=["status", "issued_at", "updated_at"])

    return issue


def _bill_blood_issue(issue: BloodIssue, *, unit_price: Decimal, gst_rate: Decimal):
    """Bill blood issue to admission services (if linked) or standalone invoice."""
    requisition = issue.requisition
    if requisition.admission_id:
        from apps.ipd.models import AdmissionService
        AdmissionService.objects.create(
            admission=requisition.admission,
            description=(
                f"Blood: {issue.bag.get_component_display()} "
                f"{issue.bag.get_blood_group_display()} ({issue.bag.bag_id})"
            ),
            quantity=1,
            unit_price=unit_price,
            gst_rate=gst_rate,
            service_date=timezone.localdate(),
        )
    else:
        from apps.billing.models import Invoice, InvoiceLine
        from apps.billing.services.invoice_service import (
            generate_invoice_code, recalculate_invoice_totals,
        )
        inv = Invoice.objects.create(
            hospital=requisition.hospital,
            code=generate_invoice_code(requisition.hospital),
            patient=requisition.patient,
            invoice_type="BLOOD_BANK",
            status="PENDING",
            notes=f"Blood issue against {requisition.code}",
        )
        InvoiceLine.objects.create(
            invoice=inv,
            description=(
                f"Blood: {issue.bag.get_component_display()} "
                f"{issue.bag.get_blood_group_display()} ({issue.bag.bag_id})"
            ),
            hsn_code="9993",
            quantity=1,
            unit_price=unit_price,
            gst_rate=gst_rate,
        )
        recalculate_invoice_totals(inv)
        issue.invoice = inv
        issue.save(update_fields=["invoice"])


@transaction.atomic
def complete_transfusion(
    issue: BloodIssue,
    *,
    started_at=None,
    completed_at=None,
    reactions: str = "",
    bag_returned: bool = False,
):
    if started_at:
        issue.transfusion_started_at = started_at
    if completed_at:
        issue.transfusion_completed_at = completed_at
    issue.reactions_observed = reactions
    issue.bag_returned = bag_returned
    issue.save()
    return issue


@transaction.atomic
def discard_bag(bag: BloodBag, *, reason: str, user=None) -> BloodBag:
    if bag.status == "ISSUED":
        raise ValidationError("Cannot discard a bag that has already been issued.")
    bag.status = "DISCARDED"
    bag.discard_reason = reason
    bag.discarded_at = timezone.now()
    bag.discarded_by = user
    bag.save(update_fields=["status", "discard_reason", "discarded_at",
                              "discarded_by", "updated_at"])
    return bag


def expire_old_bags():
    """Mark bags past their expiry as EXPIRED. Returns count updated."""
    today = timezone.localdate()
    qs = BloodBag.objects.filter(
        status__in=["AVAILABLE", "RESERVED", "QUARANTINE"],
        expiry_date__lt=today,
    )
    count = qs.count()
    qs.update(status="EXPIRED", updated_at=timezone.now())
    return count


# ─────────────────────────────────────────────────────────────────────────────
# Inventory summary
# ─────────────────────────────────────────────────────────────────────────────

def inventory_summary(hospital):
    """Dict of bag counts grouped by group + component, plus expiring soon."""
    today = timezone.localdate()
    soon = today + timedelta(days=7)

    # Stock by blood_group + component
    by_group_comp = (
        BloodBag.objects.filter(
            hospital=hospital,
            status="AVAILABLE",
            expiry_date__gte=today,
        )
        .values("blood_group", "component")
        .annotate(count=Count("id"))
        .order_by("blood_group", "component")
    )

    # Build a map: { blood_group: { component: count } }
    stock = {}
    for row in by_group_comp:
        stock.setdefault(row["blood_group"], {})[row["component"]] = row["count"]

    # Expiring within 7 days
    expiring_soon = list(BloodBag.objects.filter(
        hospital=hospital,
        status="AVAILABLE",
        expiry_date__gte=today,
        expiry_date__lt=soon,
    ).order_by("expiry_date").values(
        "id", "bag_id", "component", "blood_group",
        "expiry_date", "storage_location",
    ))

    return {
        "as_of": today.isoformat(),
        "stock_by_group_component": stock,
        "totals": {
            "available": BloodBag.objects.filter(
                hospital=hospital, status="AVAILABLE", expiry_date__gte=today,
            ).count(),
            "reserved": BloodBag.objects.filter(
                hospital=hospital, status="RESERVED",
            ).count(),
            "quarantine": BloodBag.objects.filter(
                hospital=hospital, status="QUARANTINE",
            ).count(),
            "expiring_soon": len(expiring_soon),
            "expired_pending_discard": BloodBag.objects.filter(
                hospital=hospital, status="EXPIRED",
            ).count(),
        },
        "expiring_soon": expiring_soon,
    }
