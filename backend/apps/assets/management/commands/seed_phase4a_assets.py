"""Seed asset categories + sample assets."""
from datetime import date, timedelta
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.core.models import Hospital
from apps.assets.models import AssetCategory, Asset, AssetMaintenanceLog, AMC, AssetDisposal


CATEGORIES = [
    ("MED",    "Medical Equipment",       "MEDICAL_EQUIP", 15),
    ("LAB",    "Laboratory Equipment",    "LAB_EQUIP",     15),
    ("IT",     "IT Hardware",             "IT_HARDWARE",   25),
    ("FURN",   "Furniture",               "FURNITURE",     10),
    ("VEH",    "Vehicles",                "VEHICLE",       15),
    ("KIT",    "Kitchen Equipment",       "KITCHEN_EQUIP", 15),
    ("OFC",    "Office Equipment",        "OFFICE_EQUIP",  20),
]

# (name, cat_code, serial, manufacturer, model, purchase_date_offset_days, cost, warranty_months)
ASSETS = [
    ("Patient Monitor — ICU 1",   "MED",  "PM-2023-001", "Philips",    "IntelliVue MX450",  365, 285000, 24),
    ("Patient Monitor — ICU 2",   "MED",  "PM-2023-002", "Philips",    "IntelliVue MX450",  365, 285000, 24),
    ("Ventilator — ICU 1",         "MED",  "VEN-2023-001", "Hamilton",  "T1",                450, 750000, 36),
    ("Ventilator — ICU 2",         "MED",  "VEN-2023-002", "Hamilton",  "T1",                450, 750000, 36),
    ("Defibrillator — OT-1",       "MED",  "DEF-2023-001", "Zoll",      "X Series",          300, 320000, 24),
    ("Anaesthesia Machine OT-1",   "MED",  "ANA-2023-001", "Drager",    "Fabius Plus XL",    300, 1850000, 60),
    ("X-Ray Machine",               "MED",  "XR-2022-001", "Siemens",   "Multix Impact",     600, 4500000, 60),
    ("Ultrasound Scanner",          "MED",  "US-2023-001", "GE",        "Logiq P9",          200, 1200000, 36),
    ("ECG Machine",                 "MED",  "ECG-2023-001","Schiller",  "Cardiovit AT-101",  180, 85000, 24),
    ("Blood Gas Analyzer",          "LAB",  "BGA-2023-001","Roche",     "Cobas b 121",       300, 650000, 36),
    ("Hematology Analyzer",         "LAB",  "HEM-2023-001","Sysmex",    "XN-1000",           400, 2200000, 60),
    ("Biochemistry Analyzer",       "LAB",  "BIO-2023-001","Beckman",   "AU5800",            350, 3500000, 60),
    ("Dell OptiPlex 7080 — Reception", "IT", "PC-RCP-001", "Dell",      "OptiPlex 7080",     500, 75000, 36),
    ("Dell OptiPlex 7080 — Pharmacy",  "IT", "PC-PHR-001", "Dell",      "OptiPlex 7080",     500, 75000, 36),
    ("HP LaserJet Printer — Reception","IT", "PR-RCP-001", "HP",        "LaserJet Pro M404", 500, 22000, 12),
    ("OT Table — OT-1",             "FURN", "BED-OT1-001","Skytron",   "6500 Elite",        700, 1450000, 60),
    ("Hospital Bed (Manual) #001",  "FURN", "BED-WRD-001","Maharaja",  "STD-2",             250, 18000, 12),
    ("Hospital Bed (Manual) #002",  "FURN", "BED-WRD-002","Maharaja",  "STD-2",             250, 18000, 12),
    ("Hospital Bed (ICU Electric) #001", "FURN","BED-ICU-001","Stryker", "InTouch",         300, 425000, 36),
]


class Command(BaseCommand):
    help = "Seed assets module."

    def add_arguments(self, parser):
        parser.add_argument("--reset", action="store_true")

    @transaction.atomic
    def handle(self, *args, **options):
        hospital = Hospital.objects.first()
        if not hospital:
            self.stderr.write("No Hospital found.")
            return

        if options["reset"]:
            AssetDisposal.objects.all().delete()
            AMC.objects.all().delete()
            AssetMaintenanceLog.objects.all().delete()
            Asset.objects.all().delete()
            AssetCategory.objects.all().delete()

        cat_map = {}
        for (code, name, cat_type, dep) in CATEGORIES:
            obj, _ = AssetCategory.objects.update_or_create(
                hospital=hospital, code=code,
                defaults={
                    "name": name, "category_type": cat_type,
                    "default_depreciation_pct": Decimal(str(dep)),
                    "is_active": True,
                },
            )
            cat_map[code] = obj

        today = timezone.localdate()
        for (name, cat_code, serial, mfr, model, offset_days, cost, warranty_months) in ASSETS:
            purchase_date = today - timedelta(days=offset_days)
            warranty_end = purchase_date + timedelta(days=warranty_months * 30)
            existing = Asset.objects.filter(hospital=hospital,
                                              serial_number=serial).first()
            if existing:
                self.stdout.write(f"  ↻ Skipped existing: {serial}")
                continue
            from apps.assets.services import asset_service
            a = asset_service.register_asset(
                hospital=hospital, name=name, category=cat_map[cat_code],
                serial_number=serial, manufacturer=mfr, model_number=model,
                purchase_date=purchase_date,
                purchase_cost=Decimal(str(cost)),
                warranty_start_date=purchase_date,
                warranty_end_date=warranty_end,
                useful_life_years=10,
            )
            self.stdout.write(f"  ✓ {a.asset_code} — {name}")

        self.stdout.write(self.style.SUCCESS(
            f"\nDone. {AssetCategory.objects.count()} categories, "
            f"{Asset.objects.count()} assets registered."
        ))
