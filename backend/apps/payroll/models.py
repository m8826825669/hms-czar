"""
Payroll module — Phase 4b.

Models:
  • SalaryComponent       — earnings/deductions catalog (Basic, HRA, DA, PF, ESI, TDS)
  • SalaryStructure       — per-employee component allocations
  • PayrollRun            — monthly payroll batch
  • Payslip               — individual payslip per employee per month
  • PayslipLine           — line-level breakdown
  • LoanAdvance           — employee loans / advances tracked for deductions
"""
from decimal import Decimal
from django.db import models
from django.utils import timezone


class SalaryComponent(models.Model):
    COMPONENT_TYPES = [
        ("EARN",   "Earning"),
        ("DEDUCT", "Deduction"),
        ("REIMB",  "Reimbursement"),
    ]
    CALCULATION_TYPES = [
        ("FIXED",   "Fixed Amount"),
        ("PCT_BASIC","% of Basic"),
        ("PCT_GROSS","% of Gross"),
        ("FORMULA",  "Custom Formula"),
    ]

    hospital = models.ForeignKey("core.Hospital", on_delete=models.CASCADE,
                                  related_name="salary_components")
    code = models.CharField(max_length=20, db_index=True,
        help_text="e.g. BASIC, HRA, DA, PF, ESI, TDS")
    name = models.CharField(max_length=100)
    component_type = models.CharField(max_length=10, choices=COMPONENT_TYPES)
    calculation_type = models.CharField(max_length=10, choices=CALCULATION_TYPES,
                                          default="FIXED")
    default_value = models.DecimalField(max_digits=10, decimal_places=2,
                                          default=Decimal("0"),
        help_text="Amount or percentage (depending on calculation_type)")

    is_taxable = models.BooleanField(default=True)
    is_pf_applicable = models.BooleanField(default=False,
        help_text="If TRUE and component_type is EARN, includes in PF calculation")
    is_active = models.BooleanField(default=True)
    display_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["component_type", "display_order", "code"]
        unique_together = [["hospital", "code"]]

    def __str__(self):
        return f"{self.code} — {self.name}"


class SalaryStructure(models.Model):
    """Per-employee salary structure (active component allocations)."""
    employee = models.OneToOneField("hr.Employee", on_delete=models.CASCADE,
                                       related_name="salary_structure")
    effective_from = models.DateField()
    effective_to = models.DateField(null=True, blank=True)
    gross_salary = models.DecimalField(max_digits=12, decimal_places=2,
                                         default=Decimal("0"))
    notes = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class SalaryStructureLine(models.Model):
    structure = models.ForeignKey(SalaryStructure, on_delete=models.CASCADE,
                                     related_name="lines")
    component = models.ForeignKey(SalaryComponent, on_delete=models.PROTECT,
                                     related_name="structure_lines")
    amount = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        unique_together = [["structure", "component"]]
        ordering = ["component__display_order", "component__code"]


class PayrollRun(models.Model):
    STATUSES = [
        ("DRAFT",     "Draft"),
        ("PROCESSING","Processing"),
        ("PROCESSED", "Processed"),
        ("APPROVED",  "Approved for Payment"),
        ("PAID",      "Paid"),
        ("CANCELLED", "Cancelled"),
    ]

    hospital = models.ForeignKey("core.Hospital", on_delete=models.CASCADE,
                                  related_name="payroll_runs")
    code = models.CharField(max_length=30, unique=True, db_index=True,
        help_text="Auto-generated, e.g. PR-202611")
    year = models.PositiveIntegerField()
    month = models.PositiveIntegerField()
    status = models.CharField(max_length=12, choices=STATUSES, default="DRAFT")

    total_employees = models.PositiveIntegerField(default=0)
    total_gross = models.DecimalField(max_digits=14, decimal_places=2,
                                        default=Decimal("0"))
    total_deductions = models.DecimalField(max_digits=14, decimal_places=2,
                                              default=Decimal("0"))
    total_net = models.DecimalField(max_digits=14, decimal_places=2,
                                      default=Decimal("0"))

    processed_at = models.DateTimeField(null=True, blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-year", "-month"]
        unique_together = [["hospital", "year", "month"]]


class Payslip(models.Model):
    STATUSES = [
        ("DRAFT",    "Draft"),
        ("FINALIZED","Finalized"),
        ("PAID",     "Paid"),
    ]

    payroll_run = models.ForeignKey(PayrollRun, on_delete=models.CASCADE,
                                       related_name="payslips")
    employee = models.ForeignKey("hr.Employee", on_delete=models.PROTECT,
                                    related_name="payslips")
    code = models.CharField(max_length=30, unique=True, db_index=True)

    days_worked = models.DecimalField(max_digits=5, decimal_places=1)
    days_leave_paid = models.DecimalField(max_digits=5, decimal_places=1,
                                            default=Decimal("0"))
    days_leave_lwp = models.DecimalField(max_digits=5, decimal_places=1,
                                           default=Decimal("0"))

    gross_earnings = models.DecimalField(max_digits=12, decimal_places=2,
                                            default=Decimal("0"))
    gross_deductions = models.DecimalField(max_digits=12, decimal_places=2,
                                              default=Decimal("0"))
    net_pay = models.DecimalField(max_digits=12, decimal_places=2,
                                    default=Decimal("0"))

    status = models.CharField(max_length=12, choices=STATUSES, default="DRAFT")
    paid_at = models.DateTimeField(null=True, blank=True)
    paid_via = models.CharField(max_length=20, blank=True, default="",
        help_text="BANK_TRANSFER / CASH / CHEQUE")
    payment_reference = models.CharField(max_length=80, blank=True, default="")
    notes = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-payroll_run", "employee"]
        unique_together = [["payroll_run", "employee"]]


class PayslipLine(models.Model):
    payslip = models.ForeignKey(Payslip, on_delete=models.CASCADE,
                                   related_name="lines")
    component = models.ForeignKey(SalaryComponent, on_delete=models.PROTECT,
                                     related_name="payslip_lines")
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    is_earning = models.BooleanField()

    class Meta:
        ordering = ["-is_earning", "component__display_order"]


class LoanAdvance(models.Model):
    STATUSES = [
        ("ACTIVE",  "Active"),
        ("CLOSED",  "Closed"),
        ("WAIVED",  "Waived"),
    ]
    employee = models.ForeignKey("hr.Employee", on_delete=models.PROTECT,
                                    related_name="loans")
    code = models.CharField(max_length=30, unique=True)
    loan_amount = models.DecimalField(max_digits=12, decimal_places=2)
    monthly_deduction = models.DecimalField(max_digits=10, decimal_places=2)
    total_paid = models.DecimalField(max_digits=12, decimal_places=2,
                                       default=Decimal("0"))
    issued_date = models.DateField()
    status = models.CharField(max_length=10, choices=STATUSES, default="ACTIVE")
    reason = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
