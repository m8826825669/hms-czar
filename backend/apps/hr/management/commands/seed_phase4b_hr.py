"""Seed HR module."""
from datetime import date, timedelta
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.db import transaction
from apps.core.models import Hospital
from apps.hr.models import (
    Designation, Employee, LeaveType, LeaveBalance,
)


DESIGNATIONS = [
    ("MD",         "Medical Director",          "EXEC", 250000),
    ("CONS-CARD",  "Consultant — Cardiology",   "SR",   180000),
    ("CONS-ORTHO", "Consultant — Orthopaedics", "SR",   170000),
    ("MO",         "Medical Officer",            "MID",  75000),
    ("RMO",        "Resident MO",                "JR",   55000),
    ("HEAD-NURSE", "Head Nurse",                 "MGR",  60000),
    ("STAFF-NURSE","Staff Nurse",                "MID",  35000),
    ("ANM",        "Auxiliary Nurse",            "JR",   22000),
    ("LAB-TECH",   "Lab Technician",             "MID",  28000),
    ("PHARM",      "Pharmacist",                 "MID",  32000),
    ("RECEPTION",  "Receptionist",               "JR",   18000),
    ("BILLING",    "Billing Executive",          "JR",   22000),
    ("ADMIN-MGR",  "Administration Manager",     "MGR",  85000),
    ("ACCT",       "Accountant",                 "MID",  35000),
    ("HK-SUP",     "HK Supervisor",              "MID",  25000),
    ("HK-CLN",     "Housekeeping Cleaner",       "JR",   12000),
    ("SECURITY",   "Security Guard",             "JR",   16000),
    ("DRIVER",     "Driver",                     "JR",   18000),
]

LEAVE_TYPES = [
    ("CL",  "Casual Leave",       12, True,  False),
    ("SL",  "Sick Leave",          7, True,  False),
    ("EL",  "Earned Leave",       21, True,  True),
    ("ML",  "Maternity Leave",   180, True,  False),
    ("PL",  "Paternity Leave",    15, True,  False),
    ("LWP", "Leave Without Pay",  30, False, False),
]

# Sample employees: (first, last, gender, phone, desig_code, dept_code, doj_offset_days)
EMPLOYEES = [
    ("Rajesh",    "Sharma",    "M", "9810010001", "MD",         "ADMIN",      2000),
    ("Priya",     "Verma",     "F", "9810010002", "CONS-CARD",  "CARD",       1500),
    ("Anil",      "Kumar",     "M", "9810010003", "CONS-ORTHO", "ORTHO",      1200),
    ("Sneha",     "Patel",     "F", "9810010004", "MO",         "OPD",         800),
    ("Vikram",    "Reddy",     "M", "9810010005", "MO",         "EMERG",       800),
    ("Pooja",     "Singh",     "F", "9810010006", "RMO",        "OPD",         400),
    ("Sunita",    "Devi",      "F", "9810010007", "HEAD-NURSE", "ICU",        1800),
    ("Meena",     "Kumari",    "F", "9810010008", "STAFF-NURSE","WARD",       1000),
    ("Geeta",     "Yadav",     "F", "9810010009", "STAFF-NURSE","ICU",         900),
    ("Lakshmi",   "Bai",       "F", "9810010010", "ANM",         "WARD",       300),
    ("Ramesh",    "Joshi",     "M", "9810010011", "LAB-TECH",    "LAB",        700),
    ("Amit",      "Singh",     "M", "9810010012", "PHARM",       "PHARMACY",   600),
    ("Sarita",    "Devi",      "F", "9810010013", "RECEPTION",   "RECEPTION",  500),
    ("Manoj",     "Yadav",     "M", "9810010014", "BILLING",     "ADMIN",      450),
    ("Anita",     "Gupta",     "F", "9810010015", "ADMIN-MGR",   "ADMIN",     1700),
    ("Suresh",    "Mishra",    "M", "9810010016", "ACCT",        "ADMIN",     1200),
    ("Geeta",     "Devi",      "F", "9810010017", "HK-CLN",      "ADMIN",      200),
    ("Ramesh",    "Kumar",     "M", "9810010018", "HK-CLN",      "ADMIN",      200),
    ("Manoj",     "Yadav",     "M", "9810010019", "HK-SUP",      "ADMIN",      600),
    ("Vijay",     "Singh",     "M", "9810010020", "SECURITY",    "ADMIN",      400),
]


class Command(BaseCommand):
    help = "Seed HR module."

    def add_arguments(self, parser):
        parser.add_argument("--reset", action="store_true")

    @transaction.atomic
    def handle(self, *args, **options):
        from datetime import date
        hospital = Hospital.objects.first()
        if not hospital:
            self.stderr.write("No Hospital found.")
            return

        if options["reset"]:
            LeaveRequest = __import__("apps.hr.models",
                fromlist=["LeaveRequest"]).LeaveRequest
            LeaveRequest.objects.all().delete()
            LeaveBalance.objects.all().delete()
            Employee.objects.all().delete()
            LeaveType.objects.all().delete()
            Designation.objects.all().delete()

        # Designations
        desig_map = {}
        for (code, title, grade, salary) in DESIGNATIONS:
            obj, _ = Designation.objects.update_or_create(
                hospital=hospital, code=code,
                defaults={"title": title, "grade": grade,
                           "base_salary": Decimal(str(salary)),
                           "is_active": True},
            )
            desig_map[code] = obj
        self.stdout.write(f"  ✓ {len(desig_map)} designations")

        # Leave types
        for (code, name, days, paid, cf) in LEAVE_TYPES:
            LeaveType.objects.update_or_create(
                hospital=hospital, code=code,
                defaults={"name": name, "days_per_year": Decimal(str(days)),
                           "is_paid": paid, "is_carry_forward": cf,
                           "is_active": True},
            )
        self.stdout.write(f"  ✓ {len(LEAVE_TYPES)} leave types")

        # Employees
        from apps.department.models import Department
        from apps.hr.services import hr_service
        today = date.today()
        for (first, last, g, phone, desig_code, dept_code, doj_offset) in EMPLOYEES:
            existing = Employee.objects.filter(hospital=hospital, phone=phone).first()
            if existing:
                continue
            dept = Department.objects.filter(hospital=hospital,
                                               code=dept_code).first()
            doj = today - timedelta(days=doj_offset)
            hr_service.onboard_employee(
                hospital=hospital,
                designation=desig_map[desig_code],
                first_name=first, last_name=last, phone=phone,
                date_of_joining=doj,
                gender=g, department=dept,
                employment_type="PERM",
            )
        self.stdout.write(self.style.SUCCESS(
            f"\nDone. {Designation.objects.count()} designations, "
            f"{LeaveType.objects.count()} leave types, "
            f"{Employee.objects.count()} employees."
        ))
