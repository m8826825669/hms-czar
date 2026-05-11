"""Insurance / TPA service."""
from __future__ import annotations
from decimal import Decimal
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from ..models import PreAuth, Claim, ClaimLine, PolicyCoverage


def _gen_code(model, hospital, prefix):
    today = timezone.now().date()
    full = f"{prefix}-{today.strftime('%Y%m%d')}-"
    last = model.objects.filter(hospital=hospital, code__startswith=full).order_by("-code").first()
    if last:
        try:
            n = int(last.code.split("-")[-1]) + 1
        except (ValueError, IndexError):
            n = 1
    else:
        n = 1
    return f"{full}{n:04d}"


@transaction.atomic
def submit_pre_auth(*, hospital, patient, policy, primary_diagnosis, treatment_plan,
                      requested_amount, **extra):
    pa = PreAuth.objects.create(
        hospital=hospital,
        code=_gen_code(PreAuth, hospital, "PA"),
        patient=patient, policy=policy,
        admission=extra.get("admission"),
        urgency=extra.get("urgency", "PLANNED"),
        request_date=extra.get("request_date", timezone.localdate()),
        expected_admission_date=extra.get("expected_admission_date"),
        expected_stay_days=extra.get("expected_stay_days", 1),
        primary_diagnosis=primary_diagnosis,
        treatment_plan=treatment_plan,
        requested_amount=Decimal(str(requested_amount)),
        requested_by=extra.get("requested_by"),
        status="SUBMITTED",
        submitted_at=timezone.now(),
    )
    return pa


@transaction.atomic
def approve_pre_auth(pa: PreAuth, *, approved_amount, tpa_reference="",
                       valid_until=None, decision_notes=""):
    if pa.status not in ("SUBMITTED", "DRAFT"):
        raise ValidationError(f"Cannot approve in status {pa.status}.")
    pa.approved_amount = Decimal(str(approved_amount))
    pa.status = "APPROVED" if pa.approved_amount >= pa.requested_amount else "PARTIAL"
    pa.tpa_reference = tpa_reference
    pa.valid_until = valid_until
    pa.decision_notes = decision_notes
    pa.decision_at = timezone.now()
    pa.save()
    return pa


@transaction.atomic
def reject_pre_auth(pa: PreAuth, *, reason):
    pa.status = "REJECTED"
    pa.decision_notes = reason
    pa.decision_at = timezone.now()
    pa.save()
    return pa


@transaction.atomic
def file_claim(*, hospital, patient, policy, invoice=None, pre_auth=None,
                 admission=None, claim_type="CASHLESS", bill_amount=Decimal("0"),
                 co_pay_amount=Decimal("0"), deductions=Decimal("0"),
                 lines=None, **extra):
    claim = Claim.objects.create(
        hospital=hospital,
        code=_gen_code(Claim, hospital, "CL"),
        patient=patient, policy=policy,
        invoice=invoice, pre_auth=pre_auth, admission=admission,
        claim_type=claim_type,
        bill_amount=Decimal(str(bill_amount)),
        co_pay_amount=Decimal(str(co_pay_amount)),
        deductions=Decimal(str(deductions)),
        claim_amount=Decimal(str(bill_amount)) - Decimal(str(co_pay_amount))
                       - Decimal(str(deductions)),
        notes=extra.get("notes", ""),
        status="SUBMITTED",
    )
    if lines:
        for ld in lines:
            ClaimLine.objects.create(
                claim=claim,
                description=ld["description"],
                quantity=Decimal(str(ld.get("quantity", 1))),
                rate=Decimal(str(ld["rate"])),
                amount=Decimal(str(ld["amount"])),
            )
    return claim


@transaction.atomic
def settle_claim(claim: Claim, *, settled_amount, settled_date=None):
    claim.settled_amount = Decimal(str(settled_amount))
    claim.settled_date = settled_date or timezone.localdate()
    claim.status = "SETTLED"
    claim.save()
    return claim
