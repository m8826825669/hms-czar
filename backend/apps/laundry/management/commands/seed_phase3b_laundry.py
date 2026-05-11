"""Seed linen items + initial stock."""
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.db import transaction
from apps.core.models import Hospital
from apps.laundry.models import (
    LinenItem, LinenStock, LaundryBatch, LaundryBatchItem, LinenLoss,
)

LINEN_ITEMS = [
    # (code, name, category, color, size, cost_per_unit, laundry_cost, lifetime_washes)
    ("BS-WHT",   "White Bedsheet",            "BEDSHEET", "White",       "90x190 cm", 350,  8,  100),
    ("BS-BLU",   "Blue Bedsheet (OT)",        "BEDSHEET", "Blue",        "90x190 cm", 400,  10, 100),
    ("PIL-WHT",  "Pillow Cover White",        "PILLOW",   "White",       "Standard",  80,   3,  100),
    ("BLK-PNK",  "Patient Blanket Pink",      "BLANKET",  "Pink",        "Single",    600,  15, 80),
    ("BLK-GRN",  "Patient Blanket Green",     "BLANKET",  "Green",       "Single",    600,  15, 80),
    ("TWL-LRG",  "Bath Towel Large",          "TOWEL",    "White",       "Large",     180,  5,  120),
    ("TWL-SML",  "Hand Towel Small",          "TOWEL",    "White",       "Small",     80,   3,  120),
    ("GWN-PT",   "Patient Gown",              "GOWN",     "Light Blue",  "L",         200,  6,  60),
    ("SCR-OT",   "Surgical Scrubs",           "SCRUB",    "Green",       "M",         500,  12, 80),
    ("DRP-OT",   "OT Drape Sheet",            "OT_DRAPE", "Green",       "Standard",  450,  10, 60),
    ("CRT-WRD",  "Ward Curtain",              "CURTAIN",  "Cream",       "Std",       1200, 25, 50),
    ("UNI-NRS",  "Nursing Uniform",           "UNIFORM",  "White",       "M",         600,  15, 100),
]


class Command(BaseCommand):
    help = "Seed laundry items + sample stock."

    def add_arguments(self, parser):
        parser.add_argument("--reset", action="store_true")
        parser.add_argument("--with-stock", action="store_true",
                             help="Create initial LinenStock allocations to wards")

    @transaction.atomic
    def handle(self, *args, **options):
        hospital = Hospital.objects.first()
        if not hospital:
            self.stderr.write("No Hospital found.")
            return

        if options["reset"]:
            LinenLoss.objects.all().delete()
            LaundryBatchItem.objects.all().delete()
            LaundryBatch.objects.all().delete()
            LinenStock.objects.all().delete()
            LinenItem.objects.all().delete()

        for (code, name, cat, color, size, cost, wash_cost, lifetime) in LINEN_ITEMS:
            obj, created = LinenItem.objects.update_or_create(
                hospital=hospital, code=code,
                defaults={
                    "name": name, "category": cat,
                    "color": color, "size": size,
                    "cost_per_unit": Decimal(str(cost)),
                    "laundry_cost_per_wash": Decimal(str(wash_cost)),
                    "expected_lifetime_washes": lifetime,
                    "is_active": True,
                },
            )
            self.stdout.write(f"  {'✓' if created else '↻'} {code} {name}")

        if options["with_stock"]:
            from apps.department.models import Department
            depts = list(Department.objects.filter(hospital=hospital).order_by("id")[:4])
            if depts:
                self.stdout.write("\nAllocating linen stock to departments...")
                for item in LinenItem.objects.filter(hospital=hospital):
                    for d in depts:
                        # Simple allocation based on category
                        total = 50 if item.category in ("BEDSHEET", "PILLOW",
                                                          "GOWN") else 20
                        stock, created = LinenStock.objects.update_or_create(
                            hospital=hospital, item=item,
                            department=d, ward_label="",
                            defaults={
                                "total_units": total,
                                "in_use": int(total * 0.5),
                                "in_laundry": int(total * 0.2),
                                "clean_in_stock": int(total * 0.3),
                                "minimum_threshold": max(5, int(total * 0.15)),
                            },
                        )
                self.stdout.write(self.style.SUCCESS(
                    f"Allocated stock for {LinenItem.objects.count()} items × {len(depts)} depts"
                ))

        self.stdout.write(self.style.SUCCESS(
            f"\nDone. {LinenItem.objects.count()} linen items, "
            f"{LinenStock.objects.count()} stock entries."
        ))
