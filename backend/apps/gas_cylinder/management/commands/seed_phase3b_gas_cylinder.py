"""Seed cylinder types + individual cylinders."""
from datetime import date, timedelta
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.core.models import Hospital
from apps.gas_cylinder.models import (
    CylinderType, Cylinder, CylinderUsage,
    RefillRecord, CylinderInspection,
)


TYPES = [
    # (code, gas_type, size, capacity_l, pressure_kpa, refill_cost, deposit)
    ("O2-D",      "O2",      "D",   415,  13700,   500, 2000),
    ("O2-M",      "O2",      "M",  3000,  13700,  2500, 8000),
    ("O2-H",      "O2",      "H",  7000,  13700,  5000, 15000),
    ("N2O-E",     "N2O",     "E",   680,   5000,  1200, 4000),
    ("MED-AIR-D", "MED_AIR", "D",   415,  13700,   400, 2000),
    ("CO2-E",     "CO2",     "E",   680,   5800,   800, 3000),
    ("ENTONOX-D", "ENTONOX", "D",   415,  13700,   700, 2500),
]

# (type_code, serial_no, fill%, manufacture_year, hydro_test_year)
CYLINDERS = [
    ("O2-D",  "OXG-D-001", 100, 2023, 2023),
    ("O2-D",  "OXG-D-002", 100, 2023, 2023),
    ("O2-D",  "OXG-D-003",  60, 2022, 2022),
    ("O2-D",  "OXG-D-004",  20, 2022, 2022),
    ("O2-M",  "OXG-M-001", 100, 2024, 2024),
    ("O2-M",  "OXG-M-002", 100, 2024, 2024),
    ("O2-H",  "OXG-H-001", 100, 2024, 2024),
    ("N2O-E", "N2O-E-001", 100, 2023, 2023),
    ("N2O-E", "N2O-E-002",  80, 2023, 2023),
    ("MED-AIR-D", "AIR-D-001", 100, 2023, 2023),
    ("MED-AIR-D", "AIR-D-002", 100, 2023, 2023),
    ("CO2-E", "CO2-E-001", 100, 2023, 2023),
    ("ENTONOX-D", "ENT-D-001", 100, 2024, 2024),
]


class Command(BaseCommand):
    help = "Seed cylinder types + cylinders."

    def add_arguments(self, parser):
        parser.add_argument("--reset", action="store_true")

    @transaction.atomic
    def handle(self, *args, **options):
        hospital = Hospital.objects.first()
        if not hospital:
            self.stderr.write("No Hospital found.")
            return

        if options["reset"]:
            CylinderInspection.objects.all().delete()
            CylinderUsage.objects.all().delete()
            RefillRecord.objects.all().delete()
            Cylinder.objects.all().delete()
            CylinderType.objects.all().delete()

        type_map = {}
        for (code, gas, size, cap, pres, refill, dep) in TYPES:
            obj, _ = CylinderType.objects.update_or_create(
                hospital=hospital, code=code,
                defaults={
                    "gas_type": gas, "size": size,
                    "capacity_litres": cap, "typical_pressure_kpa": pres,
                    "refill_cost": Decimal(str(refill)),
                    "deposit_amount": Decimal(str(dep)),
                    "is_active": True,
                },
            )
            type_map[code] = obj
            self.stdout.write(f"  ✓ Type: {code}")

        today = timezone.localdate()
        for (type_code, serial, fill, mfg_year, hydro_year) in CYLINDERS:
            ct = type_map[type_code]
            status = "AVAILABLE" if fill >= 95 else "PARTIAL" if fill >= 20 else "EMPTY"
            obj, created = Cylinder.objects.update_or_create(
                hospital=hospital, serial_number=serial,
                defaults={
                    "cylinder_type": ct,
                    "fill_percentage": fill,
                    "status": status,
                    "current_location": "Central Storage",
                    "manufacture_date": date(mfg_year, 1, 15),
                    "manufacturer": "INOX Air Products" if "O2" in type_code else "Linde India",
                    "last_hydro_test": date(hydro_year, 1, 15),
                    "next_hydro_test_due": date(hydro_year + 5, 1, 15),
                    "refill_count": 0,
                    "is_active": True,
                },
            )
            self.stdout.write(f"  ✓ Cylinder: {serial} ({type_code}, {fill}%)")

        self.stdout.write(self.style.SUCCESS(
            f"\nDone. {CylinderType.objects.count()} types, "
            f"{Cylinder.objects.count()} cylinders."
        ))
