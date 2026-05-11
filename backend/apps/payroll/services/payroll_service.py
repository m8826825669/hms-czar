"""Payroll service — payroll run processing."""
from __future__ import annotations
from decimal import Decimal
from calendar import monthrange
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from ..models import (
    SalaryComponent, SalaryStructure, SalaryStructureLine,
    PayrollRun, Payslip, PayslipLine,
)


@transaction.atomic
def create_payroll_run(*, hospital, year: int, month: int) -> PayrollRun:
    existing = PayrollRun.objects.filter(
        hospital=hospital, year=year, month=month).first()
    if existing:
        return existing
    run = PayrollRun.objects.create(
        hospital=hospital,
        code=f"PR-{year}{month:02d}",
        year=year, month=month, status="DRAFT",
    )
    return run


@transaction.atomic
def process_payroll(run: PayrollRun) -> PayrollRun:
    """Process all active employees for the given run month."""
    from apps.hr.models import Employee
    if run.status not in ("DRAFT", "PROCESSING"):
        raise ValidationError(f"Cannot process in status {run.status}")

    run.status = "PROCESSING"
    run.save(update_fields=["status"])

    days_in_month = monthrange(run.year, run.month)[1]

    total_gross = Decimal("0")
    total_deduct = Decimal("0")
    total_net = Decimal("0")
    count = 0

    for emp in Employee.objects.filter(hospital=run.hospital, status="ACTIVE"):
        try:
            structure = emp.salary_structure
        except SalaryStructure.DoesNotExist:
            continue

        # Skip if existing payslip present and is FINALIZED/PAID
        existing = Payslip.objects.filter(payroll_run=run, employee=emp).first()
        if existing and existing.status != "DRAFT":
            continue
        if existing:
            existing.lines.all().delete()
            payslip = existing
        else:
            payslip = Payslip.objects.create(
                payroll_run=run, employee=emp,
                code=f"PS-{run.year}{run.month:02d}-{emp.id:05d}",
                days_worked=Decimal(str(days_in_month)),
                status="DRAFT",
            )

        gross_earn = Decimal("0")
        gross_deduct = Decimal("0")

        for line in structure.lines.select_related("component"):
            comp = line.component
            amt = line.amount
            PayslipLine.objects.create(
                payslip=payslip, component=comp, amount=amt,
                is_earning=(comp.component_type == "EARN"),
            )
            if comp.component_type == "EARN":
                gross_earn += amt
            elif comp.component_type == "DEDUCT":
                gross_deduct += amt

        payslip.gross_earnings = gross_earn
        payslip.gross_deductions = gross_deduct
        payslip.net_pay = gross_earn - gross_deduct
        payslip.save(update_fields=["gross_earnings", "gross_deductions", "net_pay"])

        total_gross += gross_earn
        total_deduct += gross_deduct
        total_net += payslip.net_pay
        count += 1

    run.total_employees = count
    run.total_gross = total_gross
    run.total_deductions = total_deduct
    run.total_net = total_net
    run.status = "PROCESSED"
    run.processed_at = timezone.now()
    run.save()
    return run


@transaction.atomic
def approve_payroll(run: PayrollRun):
    if run.status != "PROCESSED":
        raise ValidationError(f"Can only approve PROCESSED run, current: {run.status}")
    run.status = "APPROVED"
    run.approved_at = timezone.now()
    run.save(update_fields=["status", "approved_at"])
    Payslip.objects.filter(payroll_run=run, status="DRAFT").update(status="FINALIZED")
    return run


@transaction.atomic
def mark_paid(run: PayrollRun):
    if run.status != "APPROVED":
        raise ValidationError(f"Can only pay APPROVED run, current: {run.status}")
    run.status = "PAID"
    run.paid_at = timezone.now()
    run.save(update_fields=["status", "paid_at"])
    Payslip.objects.filter(payroll_run=run).update(
        status="PAID", paid_at=timezone.now(),
    )
    return run


@transaction.atomic
def setup_salary_structure(employee, *, gross_salary: Decimal,
                              effective_from, component_breakdown: dict):
    """component_breakdown: {component_code: amount}"""
    from ..models import SalaryStructure, SalaryStructureLine
    structure, _ = SalaryStructure.objects.update_or_create(
        employee=employee,
        defaults={"gross_salary": gross_salary,
                   "effective_from": effective_from},
    )
    structure.lines.all().delete()
    for code, amt in component_breakdown.items():
        comp = SalaryComponent.objects.get(hospital=employee.hospital, code=code)
        SalaryStructureLine.objects.create(
            structure=structure, component=comp, amount=Decimal(str(amt)),
        )
    return structure
