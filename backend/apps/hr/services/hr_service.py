"""HR service — employee onboarding, leave workflows."""
from __future__ import annotations
from decimal import Decimal
from datetime import timedelta
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from ..models import Employee, LeaveType, LeaveBalance, LeaveRequest, Designation


def _gen_employee_code(hospital):
    year = timezone.now().year
    prefix = f"EMP-{year}-"
    last = (Employee.objects.filter(hospital=hospital, employee_code__startswith=prefix)
            .order_by("-employee_code").first())
    if last:
        try:
            n = int(last.employee_code.split("-")[-1]) + 1
        except (ValueError, IndexError):
            n = 1
    else:
        n = 1
    return f"{prefix}{n:04d}"


def _gen_leave_code(hospital):
    today = timezone.now().date()
    prefix = f"LV-{today.strftime('%Y%m%d')}-"
    last = (LeaveRequest.objects.filter(hospital=hospital, code__startswith=prefix)
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
def onboard_employee(*, hospital, designation, first_name, last_name,
                       phone, date_of_joining, **extra):
    emp = Employee.objects.create(
        hospital=hospital,
        employee_code=_gen_employee_code(hospital),
        designation=designation,
        first_name=first_name, last_name=last_name,
        middle_name=extra.get("middle_name", ""),
        gender=extra.get("gender", "M"),
        phone=phone, email=extra.get("email", ""),
        date_of_birth=extra.get("date_of_birth"),
        date_of_joining=date_of_joining,
        department=extra.get("department"),
        employment_type=extra.get("employment_type", "PERM"),
        address=extra.get("address", ""),
        aadhaar_number=extra.get("aadhaar_number", ""),
        pan_number=extra.get("pan_number", ""),
        bank_name=extra.get("bank_name", ""),
        bank_account_number=extra.get("bank_account_number", ""),
        bank_ifsc=extra.get("bank_ifsc", ""),
        emergency_contact_name=extra.get("emergency_contact_name", ""),
        emergency_contact_phone=extra.get("emergency_contact_phone", ""),
        user=extra.get("user"),
        status="ACTIVE",
    )
    # Auto-create leave balances for current year
    year = date_of_joining.year
    for lt in LeaveType.objects.filter(hospital=hospital, is_active=True):
        LeaveBalance.objects.create(
            employee=emp, leave_type=lt, year=year,
            allocated=lt.days_per_year,
        )
    return emp


@transaction.atomic
def apply_leave(*, hospital, employee, leave_type, start_date, end_date, reason,
                 contact_during_leave=""):
    if end_date < start_date:
        raise ValidationError("End date cannot be before start date.")

    num_days = Decimal(str((end_date - start_date).days + 1))

    # Check balance
    year = start_date.year
    try:
        balance = LeaveBalance.objects.get(
            employee=employee, leave_type=leave_type, year=year,
        )
    except LeaveBalance.DoesNotExist:
        raise ValidationError(
            f"No leave balance for {leave_type.code} in {year}.")
    if balance.available < num_days:
        raise ValidationError(
            f"Insufficient balance: {balance.available} {leave_type.code} available, "
            f"{num_days} requested.")

    req = LeaveRequest.objects.create(
        hospital=hospital,
        code=_gen_leave_code(hospital),
        employee=employee, leave_type=leave_type,
        start_date=start_date, end_date=end_date,
        num_days=num_days, reason=reason,
        contact_during_leave=contact_during_leave,
        status="SUBMITTED",
    )
    # Reserve in pending
    balance.pending += num_days
    balance.save(update_fields=["pending"])
    return req


@transaction.atomic
def approve_leave(req: LeaveRequest, *, approved_by, decision_notes=""):
    if req.status != "SUBMITTED":
        raise ValidationError(f"Cannot approve {req.status} leave.")
    balance = LeaveBalance.objects.get(
        employee=req.employee, leave_type=req.leave_type, year=req.start_date.year,
    )
    balance.pending -= req.num_days
    balance.used += req.num_days
    balance.save(update_fields=["pending", "used"])

    req.status = "APPROVED"
    req.approved_by = approved_by
    req.decision_at = timezone.now()
    req.decision_notes = decision_notes
    req.save(update_fields=["status", "approved_by", "decision_at",
                              "decision_notes", "updated_at"])
    return req


@transaction.atomic
def reject_leave(req: LeaveRequest, *, rejected_by, decision_notes=""):
    if req.status != "SUBMITTED":
        raise ValidationError(f"Cannot reject {req.status} leave.")
    balance = LeaveBalance.objects.get(
        employee=req.employee, leave_type=req.leave_type, year=req.start_date.year,
    )
    balance.pending -= req.num_days
    balance.save(update_fields=["pending"])

    req.status = "REJECTED"
    req.approved_by = rejected_by
    req.decision_at = timezone.now()
    req.decision_notes = decision_notes
    req.save()
    return req
