"""Seed payroll components + auto-generate structures for all employees."""
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.db import transaction
from apps.core.models import Hospital
from apps.hr.models import Employee
from apps.payroll.models import SalaryComponent, SalaryStructure, SalaryStructureLine
from apps.payroll.services import payroll_service


# (code, name, type, calc, default_value, is_taxable, is_pf, display_order)
COMPONENTS = [
    ("BASIC", "Basic Salary",            "EARN", "PCT_GROSS", 50,  True,  True,  10),
    ("HRA",   "House Rent Allowance",    "EARN", "PCT_BASIC", 40,  False, False, 20),
    ("DA",    "Dearness Allowance",      "EARN", "PCT_BASIC", 10,  True,  False, 30),
    ("MEDA",  "Medical Allowance",       "EARN", "FIXED",     1250,False, False, 40),
    ("TRANS", "Transport Allowance",     "EARN", "FIXED",     1600,False, False, 50),
    ("SPEC",  "Special Allowance",       "EARN", "FIXED",     0,   True,  False, 60),

    ("PF",    "Provident Fund (12%)",    "DEDUCT","PCT_BASIC",12,  False, False, 100),
    ("ESI",   "ESI (0.75%)",             "DEDUCT","PCT_GROSS",0.75,False, False, 110),
    ("TDS",   "Tax Deducted at Source",  "DEDUCT","FIXED",    0,   False, False, 120),
    ("PT",    "Professional Tax",        "DEDUCT","FIXED",    200, False, False, 130),
    ("LOAN",  "Loan/Advance Repayment",  "DEDUCT","FIXED",    0,   False, False, 140),
]


class Command(BaseCommand):
    help = "Seed payroll components + per-employee structures."

    def add_arguments(self, parser):
        parser.add_argument("--reset", action="store_true")
        parser.add_argument("--structures", action="store_true",
            help="Also auto-create salary structures for all employees.")

    @transaction.atomic
    def handle(self, *args, **options):
        hospital = Hospital.objects.first()
        if not hospital:
            self.stderr.write("No Hospital found.")
            return

        if options["reset"]:
            SalaryStructureLine.objects.all().delete()
            SalaryStructure.objects.all().delete()
            SalaryComponent.objects.all().delete()

        for (code, name, ct, calc, val, tax, pf, order) in COMPONENTS:
            SalaryComponent.objects.update_or_create(
                hospital=hospital, code=code,
                defaults={
                    "name": name, "component_type": ct,
                    "calculation_type": calc,
                    "default_value": Decimal(str(val)),
                    "is_taxable": tax, "is_pf_applicable": pf,
                    "display_order": order, "is_active": True,
                },
            )
        self.stdout.write(f"  ✓ {SalaryComponent.objects.count()} components")

        if options["structures"]:
            from datetime import date
            n = 0
            for emp in Employee.objects.filter(hospital=hospital, status="ACTIVE"):
                gross = emp.designation.base_salary
                if gross <= 0:
                    continue
                basic = (gross * Decimal("0.50")).quantize(Decimal("0.01"))
                hra = (basic * Decimal("0.40")).quantize(Decimal("0.01"))
                da = (basic * Decimal("0.10")).quantize(Decimal("0.01"))
                meda = Decimal("1250")
                trans = Decimal("1600")
                special = gross - basic - hra - da - meda - trans
                if special < 0:
                    special = Decimal("0")
                pf = (basic * Decimal("0.12")).quantize(Decimal("0.01"))
                esi = (gross * Decimal("0.0075")).quantize(Decimal("0.01")) \
                      if gross <= Decimal("21000") else Decimal("0")
                pt = Decimal("200")

                breakdown = {
                    "BASIC": basic, "HRA": hra, "DA": da,
                    "MEDA": meda, "TRANS": trans, "SPEC": special,
                    "PF": pf, "ESI": esi, "PT": pt,
                }
                payroll_service.setup_salary_structure(
                    emp, gross_salary=gross,
                    effective_from=emp.date_of_joining,
                    component_breakdown=breakdown,
                )
                n += 1
            self.stdout.write(f"  ✓ {n} salary structures generated")

        self.stdout.write(self.style.SUCCESS("Done."))
