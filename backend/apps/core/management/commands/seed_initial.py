"""Seeds initial data for a fresh HMS install.

Creates:
  - 1 default Hospital (configurable via env)
  - All Permission entries for the 26 modules
  - 18 system Roles with appropriate permissions
  - 1 super admin user
  - A few sample departments & locations

Run:
    python manage.py seed_initial
    python manage.py seed_initial --reset    # wipe & reseed
"""
from __future__ import annotations
from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.core.models import Hospital, Department, Location
from apps.accounts.models import User, Role, Permission, UserRole


# ─── Permissions: code, description, module ────────────────
# Pattern: <module>.<action>
PERMS: list[tuple[str, str, str]] = [
    # core / system
    ("system.admin", "Full system administration", "system"),
    ("audit.view", "View audit logs", "system"),
    # reception
    ("reception.view", "View reception data", "reception"),
    ("reception.register_patient", "Register new patient", "reception"),
    ("reception.book_appointment", "Book appointment", "reception"),
    ("reception.issue_visitor_pass", "Issue visitor pass", "reception"),
    # opd
    ("opd.view", "View OPD records", "opd"),
    ("opd.consult", "Conduct OPD consultation", "opd"),
    ("opd.prescribe", "Issue prescription", "opd"),
    ("opd.refer", "Refer patient", "opd"),
    # ipd
    ("ipd.view", "View IPD records", "ipd"),
    ("ipd.admit", "Admit patient", "ipd"),
    ("ipd.discharge", "Discharge patient", "ipd"),
    ("ipd.transfer", "Transfer patient", "ipd"),
    # ward
    ("ward.view", "View ward data", "ward"),
    ("ward.allocate_bed", "Allocate / release bed", "ward"),
    # ot
    ("ot.view", "View OT schedule", "ot"),
    ("ot.schedule", "Schedule surgery", "ot"),
    ("ot.record", "Record OT notes", "ot"),
    # emr
    ("emr.view", "View EMR", "emr"),
    ("emr.write", "Write clinical notes", "emr"),
    ("emr.export", "Export patient records", "emr"),
    # nursing
    ("nursing.view", "View nursing data", "nursing"),
    ("nursing.vitals", "Record vitals", "nursing"),
    ("nursing.mar", "Medication administration", "nursing"),
    # specialist
    ("specialist.view", "View doctor profiles", "specialist"),
    ("specialist.manage_slots", "Manage own OPD slots", "specialist"),
    # blood_bank
    ("bloodbank.view", "View blood bank", "bloodbank"),
    ("bloodbank.donor", "Manage donors", "bloodbank"),
    ("bloodbank.issue", "Issue blood unit", "bloodbank"),
    # research
    ("research.view", "View research projects", "research"),
    ("research.manage", "Manage research projects", "research"),
    # pharmacy
    ("pharmacy.view", "View pharmacy", "pharmacy"),
    ("pharmacy.dispense", "Dispense medication", "pharmacy"),
    ("pharmacy.purchase", "Pharmacy purchase orders", "pharmacy"),
    # stock
    ("stock.view", "View stock", "stock"),
    ("stock.requisition", "Create stock requisition", "stock"),
    ("stock.po", "Approve purchase order", "stock"),
    ("stock.grn", "Receive goods (GRN)", "stock"),
    # bottles
    ("bottles.view", "View bottle inventory", "bottles"),
    ("bottles.manage", "Manage cylinders / IV bottles", "bottles"),
    # dietary
    ("dietary.view", "View dietary plans", "dietary"),
    ("dietary.assign", "Assign meal plan", "dietary"),
    # laundry
    ("laundry.view", "View laundry data", "laundry"),
    ("laundry.dispatch", "Dispatch / receive laundry", "laundry"),
    # ambulance
    ("ambulance.view", "View ambulance trips", "ambulance"),
    ("ambulance.dispatch", "Dispatch ambulance", "ambulance"),
    # internal_comms
    ("comms.view", "View internal channels", "comms"),
    ("comms.post", "Post messages / announcements", "comms"),
    # staff (HR)
    ("staff.view", "View staff records", "staff"),
    ("staff.manage", "Manage staff records", "staff"),
    ("staff.payroll", "Run payroll", "staff"),
    # attendance
    ("attendance.view", "View attendance / leave", "attendance"),
    ("attendance.approve_leave", "Approve leave applications", "attendance"),
    # crisis
    ("crisis.view", "View crisis dashboard", "crisis"),
    ("crisis.trigger", "Trigger code blue / disaster", "crisis"),
    # protection
    ("protection.view", "View security logs", "protection"),
    ("protection.report_incident", "Report security incident", "protection"),
    # admin_security
    ("adminsec.view", "View security dashboard", "adminsec"),
    ("adminsec.manage", "Manage MFA / sessions / break-glass", "adminsec"),
    # billing
    ("billing.view", "View bills", "billing"),
    ("billing.create", "Create / capture charges", "billing"),
    ("billing.collect", "Receive payments / refunds", "billing"),
    # accounting
    ("accounting.view", "View accounting data", "accounting"),
    ("accounting.entry", "Make journal entries", "accounting"),
    ("accounting.gst", "File GST returns", "accounting"),
    # scheduling
    ("scheduling.view", "View resource schedule", "scheduling"),
    ("scheduling.book", "Book resource", "scheduling"),
    # reports
    ("reports.view", "View MIS reports", "reports"),
    ("reports.export", "Export MIS reports", "reports"),
]


# ─── Roles: code, name, perm-codes (or "*" for all) ────────
ROLES: list[tuple[str, str, list[str]]] = [
    ("SUPER_ADMIN", "Super Administrator", ["*"]),
    ("HOSPITAL_ADMIN", "Hospital Administrator", ["*"]),
    ("DOCTOR", "Doctor / Consultant", [
        "opd.view", "opd.consult", "opd.prescribe", "opd.refer",
        "ipd.view", "ipd.admit", "ipd.discharge", "ipd.transfer",
        "ot.view", "ot.schedule", "ot.record",
        "emr.view", "emr.write",
        "specialist.view", "specialist.manage_slots",
        "nursing.view",
        "billing.view",
    ]),
    ("NURSE", "Nurse", [
        "ipd.view", "ward.view", "ward.allocate_bed",
        "nursing.view", "nursing.vitals", "nursing.mar",
        "emr.view", "pharmacy.view",
    ]),
    ("RECEPTIONIST", "Receptionist", [
        "reception.view", "reception.register_patient",
        "reception.book_appointment", "reception.issue_visitor_pass",
        "specialist.view", "billing.view",
    ]),
    ("OPD_CLERK", "OPD Clerk / Cashier", [
        "opd.view", "billing.view", "billing.create", "billing.collect",
    ]),
    ("IPD_CLERK", "IPD Clerk", [
        "ipd.view", "ipd.admit", "ward.view", "ward.allocate_bed",
        "billing.view", "billing.create",
    ]),
    ("PHARMACIST", "Pharmacist", [
        "pharmacy.view", "pharmacy.dispense", "pharmacy.purchase",
        "stock.view",
    ]),
    ("STORE_KEEPER", "Store Keeper", [
        "stock.view", "stock.requisition", "stock.grn",
        "bottles.view", "bottles.manage",
    ]),
    ("LAB_TECH", "Lab Technician", [
        "emr.view",  # Lab module to be added in Phase 6+
    ]),
    ("RADIOLOGIST", "Radiologist", [
        "emr.view", "emr.write",
    ]),
    ("DIETICIAN", "Dietician", [
        "dietary.view", "dietary.assign", "ipd.view", "emr.view",
    ]),
    ("HOUSEKEEPING", "Housekeeping / Laundry", [
        "ward.view", "laundry.view", "laundry.dispatch",
    ]),
    ("AMBULANCE_DRIVER", "Ambulance Driver", [
        "ambulance.view", "ambulance.dispatch",
    ]),
    ("SECURITY_GUARD", "Security Guard", [
        "protection.view", "protection.report_incident",
        "reception.issue_visitor_pass",
    ]),
    ("HR_ADMIN", "HR Administrator", [
        "staff.view", "staff.manage", "staff.payroll",
        "attendance.view", "attendance.approve_leave",
    ]),
    ("ACCOUNTANT", "Accountant", [
        "billing.view", "billing.create", "billing.collect",
        "accounting.view", "accounting.entry", "accounting.gst",
        "reports.view", "reports.export",
    ]),
    ("PATIENT", "Patient (portal)", []),  # Self-service, very few perms
]


class Command(BaseCommand):
    help = "Seed initial hospital, permissions, roles, and super admin."

    def add_arguments(self, parser):
        parser.add_argument("--reset", action="store_true",
                            help="Delete existing roles/permissions/seeded users first")
        parser.add_argument("--admin-username", default="admin")
        parser.add_argument("--admin-password", default="ChangeMe@123")
        parser.add_argument("--admin-email", default="admin@hospital.local")

    @transaction.atomic
    def handle(self, *args, **opts):
        if opts["reset"]:
            self.stdout.write(self.style.WARNING("Resetting permissions, roles, seed users..."))
            UserRole.objects.all().delete()
            User.objects.filter(username__in=[opts["admin_username"]]).delete()
            Role.objects.filter(is_system=True).delete()
            Permission.objects.all().delete()

        # 1. Hospital
        hospital, created = Hospital.objects.get_or_create(
            code=settings.HMS_DEFAULT_HOSPITAL_CODE,
            defaults={
                "name": "City General Hospital",
                "legal_name": "City General Hospital Pvt Ltd",
                "address_line1": "Plot 1, Hospital Road",
                "city": "Ghaziabad",
                "state": "Uttar Pradesh",
                "pincode": "201001",
                "phone": "+91-9876543210",
                "email": "info@hospital.local",
                "registration_number": "HOSP/REG/2024/001",
            },
        )
        self.stdout.write(self.style.SUCCESS(
            f"Hospital: {hospital.name} ({'created' if created else 'exists'})"
        ))

        # 2. Permissions
        created_perms = 0
        for code, desc, module in PERMS:
            _, c = Permission.objects.get_or_create(
                code=code, defaults={"description": desc, "module": module}
            )
            created_perms += int(c)
        self.stdout.write(self.style.SUCCESS(
            f"Permissions: {Permission.objects.count()} total ({created_perms} new)"
        ))

        # 3. Roles
        all_perms = list(Permission.objects.all())
        for code, name, perm_codes in ROLES:
            role, _ = Role.objects.get_or_create(
                hospital=hospital, code=code,
                defaults={"name": name, "is_system": True},
            )
            role.name = name
            role.is_system = True
            role.save(update_fields=["name", "is_system"])
            if perm_codes == ["*"]:
                role.permissions.set(all_perms)
            else:
                role.permissions.set(Permission.objects.filter(code__in=perm_codes))
        self.stdout.write(self.style.SUCCESS(f"Roles: {Role.objects.count()} total"))

        # 4. Super admin
        admin, created = User.objects.get_or_create(
            username=opts["admin_username"],
            defaults={
                "email": opts["admin_email"],
                "first_name": "Super",
                "last_name": "Admin",
                "hospital": hospital,
                "is_staff": True,
                "is_superuser": True,
            },
        )
        admin.set_password(opts["admin_password"])
        admin.hospital = hospital
        admin.is_staff = True
        admin.is_superuser = True
        admin.save()
        super_admin_role = Role.objects.get(hospital=hospital, code="SUPER_ADMIN")
        UserRole.objects.get_or_create(user=admin, role=super_admin_role, department=None)
        self.stdout.write(self.style.SUCCESS(
            f"Super admin: {admin.username} / {opts['admin_password']} ({'created' if created else 'updated'})"
        ))

        # 5. Sample departments
        sample_depts = [
            ("OPD", "Outpatient Department", "CLINICAL"),
            ("IPD", "Inpatient Department", "CLINICAL"),
            ("CARDIO", "Cardiology", "CLINICAL"),
            ("ORTHO", "Orthopaedics", "CLINICAL"),
            ("PEDIATRIC", "Paediatrics", "CLINICAL"),
            ("OBGY", "Obstetrics & Gynaecology", "CLINICAL"),
            ("RAD", "Radiology", "DIAGNOSTIC"),
            ("LAB", "Laboratory", "DIAGNOSTIC"),
            ("PHARMA", "Pharmacy", "SUPPORT"),
            ("STORE", "Central Store", "SUPPORT"),
            ("HR", "Human Resources", "ADMIN"),
            ("FIN", "Finance & Accounts", "ADMIN"),
        ]
        for code, name, dtype in sample_depts:
            Department.objects.get_or_create(
                hospital=hospital, code=code,
                defaults={"name": name, "dept_type": dtype},
            )
        self.stdout.write(self.style.SUCCESS(f"Departments: {Department.objects.count()}"))

        # 6. Sample locations
        for i in range(1, 7):
            Location.objects.get_or_create(
                hospital=hospital, code=f"OPD-{i}",
                defaults={"name": f"OPD Cabin {i}", "location_type": "OPD"},
            )
        Location.objects.get_or_create(
            hospital=hospital, code="REC-1",
            defaults={"name": "Main Reception", "location_type": "RECEPTION"},
        )
        Location.objects.get_or_create(
            hospital=hospital, code="PHARMA-1",
            defaults={"name": "Main Pharmacy", "location_type": "PHARMACY"},
        )
        self.stdout.write(self.style.SUCCESS(f"Locations: {Location.objects.count()}"))

        self.stdout.write(self.style.SUCCESS("\n✓ Seeding complete."))
        self.stdout.write(f"  Login at /admin/ or POST /api/v1/auth/login/")
        self.stdout.write(f"  Username: {opts['admin_username']}")
        self.stdout.write(f"  Password: {opts['admin_password']}")
