"""Seed inventory: stores, categories, suppliers, sample stock items + batches."""
from datetime import date, timedelta
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.core.models import Hospital
from apps.inventory.models import (
    StoreLocation, ItemCategory, Supplier, StockItem, StockBatch,
    PurchaseOrder, POLine, GRN, GRNLine,
    StockRequisition, RequisitionLine, StockIssue, IssueLine, StockTransfer,
)


STORES = [
    ("MAIN",    "Central / Main Store",   "MAIN",      "Ground floor"),
    ("MED",     "Medical Consumables",     "MEDICAL",   "1st floor"),
    ("SURG",    "Surgical Store",          "SURGICAL",  "2nd floor (near OT)"),
    ("HKEEP",   "Housekeeping Supplies",   "HOUSEKEEPING".replace("HOUSEKEEPING","GENERAL"), "Basement"),
    ("STAT",    "Stationery / Office",     "GENERAL",   "1st floor admin"),
    ("LINEN",   "Linen Store",             "LINEN",     "Basement"),
    ("KITCHEN", "Kitchen Pantry",          "KITCHEN",   "Ground floor"),
]
CATEGORIES = [
    ("DRESS",    "Dressing & Bandages"),
    ("SYRINGE",  "Syringes & Needles"),
    ("GLOVES",   "Gloves"),
    ("MASK",     "Masks & PPE"),
    ("CLEAN",    "Cleaning Agents"),
    ("STAT",     "Stationery"),
    ("LINEN",    "Linen / Fabric"),
    ("PROVI",    "Provisions / Food"),
    ("MISC",     "Miscellaneous"),
]
SUPPLIERS = [
    ("SUP001", "MediKart Supplies Pvt Ltd", "Rajesh Mehta", "9810099001",
     "rajesh@medikart.in", "07AAACM1234A1Z5", 30),
    ("SUP002", "HealthCare Distributors",    "Priya Singh", "9810099002",
     "priya@hcd.in", "07AAACH5678B1Z2", 45),
    ("SUP003", "Surgical World",              "Arun Kumar", "9810099003",
     "arun@surgworld.in", "07AAACS9012C1Z8", 30),
    ("SUP004", "CleanPro Hospitality",        "Sunita Verma", "9810099004",
     "sunita@cleanpro.in", "07AAACC3456D1Z3", 15),
    ("SUP005", "Office Mart",                 "Mohan Lal", "9810099005",
     "mohan@officemart.in", "07AAACO7890E1Z6", 30),
]
# (code, name, category_code, type, uom, gst, reorder, min, max, purchase_price, issue_rate)
ITEMS = [
    ("DRES-COTW",  "Cotton Wool (500g)",        "DRESS",   "CONSUMABLE", "PCS",  18, 50, 20, 200, 80, 100),
    ("DRES-GAUZE", "Gauze Roll (10cm × 4m)",    "DRESS",   "CONSUMABLE", "PCS",  18, 100, 50, 500, 25, 35),
    ("DRES-BAND",  "Crepe Bandage (10cm)",      "DRESS",   "CONSUMABLE", "PCS",  18, 80, 30, 300, 45, 60),
    ("SYR-5ML",    "Disposable Syringe 5ml",    "SYRINGE", "CONSUMABLE", "PCS",  12, 200, 100, 1000, 4, 6),
    ("SYR-10ML",   "Disposable Syringe 10ml",   "SYRINGE", "CONSUMABLE", "PCS",  12, 150, 75, 800, 6, 9),
    ("NEED-23G",   "Needle 23G × 1\"",          "SYRINGE", "CONSUMABLE", "PCS",  12, 200, 100, 1000, 2, 3),
    ("GLV-S-M",    "Surgical Gloves Medium",    "GLOVES",  "CONSUMABLE", "PAIR", 12, 100, 50, 500, 15, 22),
    ("GLV-S-L",    "Surgical Gloves Large",     "GLOVES",  "CONSUMABLE", "PAIR", 12, 100, 50, 500, 15, 22),
    ("GLV-EX-M",   "Examination Gloves Medium", "GLOVES",  "CONSUMABLE", "PCS",  12, 500, 200, 2000, 5, 7),
    ("MASK-3P",    "3-Ply Surgical Mask",       "MASK",    "CONSUMABLE", "PCS",  18, 500, 200, 2000, 3, 5),
    ("MASK-N95",   "N95 Respirator",             "MASK",    "CONSUMABLE", "PCS",  18, 50, 20, 200, 65, 90),
    ("CLN-PHEN",   "Phenyl 5L",                  "CLEAN",   "HOUSEKEEPING", "LTR", 18, 20, 10, 100, 350, 420),
    ("CLN-BLCH",   "Bleach 1L",                  "CLEAN",   "HOUSEKEEPING", "LTR", 18, 30, 15, 150, 120, 150),
    ("CLN-DETSP",  "Surface Disinfectant Spray", "CLEAN",   "HOUSEKEEPING", "PCS", 18, 20, 10, 100, 280, 350),
    ("STAT-A4",    "A4 Paper Ream",              "STAT",    "STATIONERY",   "PCS", 12, 20, 10, 100, 280, 330),
    ("STAT-PEN",   "Ball Pen (Blue)",            "STAT",    "STATIONERY",   "PCS", 12, 100, 50, 500, 8, 12),
    ("LIN-SHT",    "Bed Sheet (White)",          "LINEN",   "LINEN",        "PCS", 5,  20, 10, 100, 350, 450),
    ("LIN-PIL",    "Pillow Cover",               "LINEN",   "LINEN",        "PCS", 5,  30, 15, 150, 80, 100),
]


class Command(BaseCommand):
    help = "Seed inventory module."

    def add_arguments(self, parser):
        parser.add_argument("--reset", action="store_true")
        parser.add_argument("--with-stock", action="store_true",
                            help="Also create sample stock batches.")

    @transaction.atomic
    def handle(self, *args, **options):
        hospital = Hospital.objects.first()
        if not hospital:
            self.stderr.write("No Hospital found.")
            return

        if options["reset"]:
            self.stdout.write("Resetting inventory data...")
            StockTransfer.objects.all().delete()
            IssueLine.objects.all().delete()
            StockIssue.objects.all().delete()
            RequisitionLine.objects.all().delete()
            StockRequisition.objects.all().delete()
            GRNLine.objects.all().delete()
            GRN.objects.all().delete()
            POLine.objects.all().delete()
            PurchaseOrder.objects.all().delete()
            StockBatch.objects.all().delete()
            StockItem.objects.all().delete()
            Supplier.objects.all().delete()
            ItemCategory.objects.all().delete()
            StoreLocation.objects.all().delete()

        # Stores
        store_map = {}
        for code, name, t, loc in STORES:
            obj, _ = StoreLocation.objects.update_or_create(
                hospital=hospital, code=code,
                defaults={"name": name, "store_type": t,
                            "location_description": loc, "is_active": True},
            )
            store_map[code] = obj
            self.stdout.write(f"  ✓ Store: {code}")

        # Categories
        cat_map = {}
        for code, name in CATEGORIES:
            obj, _ = ItemCategory.objects.update_or_create(
                hospital=hospital, code=code,
                defaults={"name": name, "is_active": True},
            )
            cat_map[code] = obj

        # Suppliers
        sup_map = {}
        for (code, name, contact, phone, email, gstin, terms) in SUPPLIERS:
            obj, _ = Supplier.objects.update_or_create(
                hospital=hospital, code=code,
                defaults={
                    "name": name, "contact_person": contact,
                    "phone": phone, "email": email, "gstin": gstin,
                    "payment_terms_days": terms, "rating": Decimal("4.0"),
                    "is_active": True,
                },
            )
            sup_map[code] = obj
            self.stdout.write(f"  ✓ Supplier: {code}")

        # Items
        item_map = {}
        for (code, name, cat_code, item_type, uom, gst, reorder, mn, mx, pp, ir) in ITEMS:
            obj, _ = StockItem.objects.update_or_create(
                hospital=hospital, code=code,
                defaults={
                    "name": name, "category": cat_map[cat_code],
                    "item_type": item_type, "uom": uom,
                    "gst_rate": Decimal(str(gst)),
                    "reorder_level": Decimal(str(reorder)),
                    "minimum_stock": Decimal(str(mn)),
                    "maximum_stock": Decimal(str(mx)),
                    "default_purchase_price": Decimal(str(pp)),
                    "default_issue_rate": Decimal(str(ir)),
                    "hsn_code": "9018", "is_active": True,
                },
            )
            item_map[code] = obj

        # Sample stock batches
        if options["with_stock"]:
            self.stdout.write("\nCreating sample stock batches...")
            today = timezone.localdate()
            main = store_map["MAIN"]
            sup = sup_map["SUP001"]
            for code, item in item_map.items():
                # Random sensible quantity
                qty = item.minimum_stock * Decimal("2.5")
                StockBatch.objects.update_or_create(
                    hospital=hospital, item=item, store=main,
                    batch_number=f"BATCH-{today.strftime('%Y%m%d')}-{item.id:04d}",
                    defaults={
                        "supplier": sup,
                        "received_quantity": qty,
                        "current_quantity": qty,
                        "purchase_rate": item.default_purchase_price,
                        "mrp": item.default_issue_rate * Decimal("1.2"),
                        "issue_rate": item.default_issue_rate,
                        "received_date": today,
                        "expiry_date": today + timedelta(days=365),
                        "is_active": True,
                    },
                )
            self.stdout.write(f"  ✓ Created {len(item_map)} stock batches in MAIN store")

        self.stdout.write(self.style.SUCCESS(
            f"\nDone. {StoreLocation.objects.count()} stores, "
            f"{StockItem.objects.count()} items, "
            f"{StockBatch.objects.count()} batches."
        ))
