"""Security service — visitor pass, gate pass, incident workflows."""
from __future__ import annotations
from decimal import Decimal
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone
from ..models import VisitorPass, GatePass, Incident


def _gen_code(model, hospital, prefix, field="pass_number"):
    today = timezone.now().date()
    full_prefix = f"{prefix}-{today.strftime('%Y%m%d')}-"
    qs = model.objects.filter(hospital=hospital,
                                **{f"{field}__startswith": full_prefix})
    last = qs.order_by(f"-{field}").first()
    if last:
        try:
            n = int(getattr(last, field).split("-")[-1]) + 1
        except (ValueError, IndexError):
            n = 1
    else:
        n = 1
    return f"{full_prefix}{n:04d}"


@transaction.atomic
def issue_visitor_pass(*, hospital, visitor_name, visitor_phone,
                         visit_type, **extra):
    return VisitorPass.objects.create(
        hospital=hospital,
        pass_number=_gen_code(VisitorPass, hospital, "VST"),
        visitor_name=visitor_name, visitor_phone=visitor_phone,
        visit_type=visit_type,
        id_proof_type=extra.get("id_proof_type", ""),
        id_proof_number=extra.get("id_proof_number", ""),
        photo_url=extra.get("photo_url", ""),
        purpose=extra.get("purpose", ""),
        visiting_patient=extra.get("visiting_patient"),
        visiting_person=extra.get("visiting_person", ""),
        relationship=extra.get("relationship", ""),
        department_to_visit=extra.get("department_to_visit"),
        room_number=extra.get("room_number", ""),
        expected_exit_time=extra.get("expected_exit_time"),
        issued_by=extra.get("issued_by"),
        status="ACTIVE",
    )


@transaction.atomic
def log_visitor_exit(pass_obj: VisitorPass, *, exit_logged_by=None):
    if pass_obj.status != "ACTIVE":
        raise ValidationError(f"Pass is {pass_obj.status}, cannot log exit.")
    pass_obj.actual_exit_time = timezone.now()
    pass_obj.exit_logged_by = exit_logged_by
    pass_obj.status = "EXITED"
    pass_obj.save(update_fields=["actual_exit_time", "exit_logged_by",
                                   "status", "updated_at"])
    return pass_obj


@transaction.atomic
def issue_gate_pass(*, hospital, pass_type, items_description, purpose,
                      issued_to_party, **extra):
    return GatePass.objects.create(
        hospital=hospital,
        pass_number=_gen_code(GatePass, hospital, "GP"),
        pass_type=pass_type,
        items_description=items_description, purpose=purpose,
        issued_to_party=issued_to_party,
        issued_to_phone=extra.get("issued_to_phone", ""),
        vehicle_number=extra.get("vehicle_number", ""),
        sender_department=extra.get("sender_department"),
        expected_return_at=extra.get("expected_return_at"),
        estimated_value=Decimal(str(extra.get("estimated_value", 0))),
        issued_by=extra.get("issued_by"),
        approved_by=extra.get("approved_by"),
        status="ISSUED",
    )


@transaction.atomic
def mark_gate_pass_returned(gp: GatePass, *, received_by=None):
    if gp.status != "ISSUED" and gp.status != "OVERDUE":
        raise ValidationError(f"Gate pass is {gp.status}.")
    if gp.pass_type != "RETURNABLE":
        gp.status = "CLOSED"
    else:
        gp.status = "RETURNED"
    gp.actual_return_at = timezone.now()
    gp.received_at_gate_by = received_by
    gp.save()
    return gp


@transaction.atomic
def log_incident(*, hospital, incident_type, severity, title, description,
                   location, occurred_at=None, **extra):
    return Incident.objects.create(
        hospital=hospital,
        incident_number=_gen_code(Incident, hospital, "INC",
                                     field="incident_number"),
        incident_type=incident_type, severity=severity,
        title=title, description=description, location=location,
        occurred_at=occurred_at or timezone.now(),
        department=extra.get("department"),
        persons_involved=extra.get("persons_involved", ""),
        witnesses=extra.get("witnesses", ""),
        reported_by=extra.get("reported_by"),
        handled_by=extra.get("handled_by"),
        estimated_loss=Decimal(str(extra.get("estimated_loss", 0))),
        status="REPORTED",
    )


@transaction.atomic
def escalate_incident(inc: Incident, *, fir_number="", actions_taken=""):
    inc.police_involved = True
    inc.fir_number = fir_number
    inc.actions_taken = actions_taken
    inc.status = "ESCALATED"
    inc.save()
    return inc
