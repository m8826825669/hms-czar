"""Seed Phase 2a sample data:
- 8 sample departments (Cardiology, Pharmacy, Radiology, etc.)
- 1-2 batches per drug in DrugMaster (varied expiry, typical Indian MRP)

Run after Phase 1c seed:
    python manage.py seed_phase2a
"""
import random
from datetime import date, timedelta
from decimal import Decimal

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.core.models import Hospital
from apps.opd.models import DrugMaster
from apps.department.models import Department
from apps.pharmacy.models import DrugBatch, StockMovement


DEPARTMENTS = [
    ("CARDIO",  "Cardiology",          "CLINICAL",   "2nd floor, Block B"),
    ("ORTHO",   "Orthopaedics",        "CLINICAL",   "Ground floor, Block A"),
    ("PEDIA",   "Paediatrics",         "CLINICAL",   "1st floor, Block A"),
    ("DERMA",   "Dermatology",         "CLINICAL",   "1st floor, Block B"),
    ("RADIO",   "Radiology",           "DIAGNOSTIC", "Basement, Block C"),
    ("PATH",    "Pathology Lab",       "DIAGNOSTIC", "Basement, Block C"),
    ("PHARM",   "Pharmacy",            "PHARMACY",   "Ground floor, Reception"),
    ("ICU",     "Intensive Care Unit", "WARD",       "3rd floor, Block A"),
    ("OT",      "Operation Theatre",   "OT",         "2nd floor, Block A"),
    ("ADMIN",   "Administration",      "ADMIN",      "1st floor, Reception"),
]


# Realistic MRP ranges for common Indian drugs
# Format: (cost_factor, mrp_range)
# MRP for a strip of 10 tabs typically = ₹X; per-unit MRP = X/10
DRUG_PRICE_HINTS = {
    "PCM500":   {"mrp_range": (1.5, 3),   "cost_factor": 0.5},   # Crocin per tab
    "PCM650":   {"mrp_range": (2, 4),     "cost_factor": 0.5},
    "IBU400":   {"mrp_range": (1.5, 3),   "cost_factor": 0.4},
    "DCF50":    {"mrp_range": (1, 2.5),   "cost_factor": 0.4},
    "ACECLO":   {"mrp_range": (3, 6),     "cost_factor": 0.45},
    "TRA50":    {"mrp_range": (5, 10),    "cost_factor": 0.4},
    "AMX500":   {"mrp_range": (5, 8),     "cost_factor": 0.4},
    "AMC625":   {"mrp_range": (15, 25),   "cost_factor": 0.5},
    "AZI500":   {"mrp_range": (25, 40),   "cost_factor": 0.4},
    "CIP500":   {"mrp_range": (4, 8),     "cost_factor": 0.4},
    "LEV500":   {"mrp_range": (8, 14),    "cost_factor": 0.4},
    "DOX100":   {"mrp_range": (3, 5),     "cost_factor": 0.4},
    "MET400":   {"mrp_range": (2, 4),     "cost_factor": 0.4},
    "PAN40":    {"mrp_range": (8, 14),    "cost_factor": 0.35},
    "OME20":    {"mrp_range": (2, 5),     "cost_factor": 0.4},
    "RAB20":    {"mrp_range": (10, 18),   "cost_factor": 0.4},
    "RANITIDINE": {"mrp_range": (1, 3),   "cost_factor": 0.4},
    "ONDA4":    {"mrp_range": (3, 6),     "cost_factor": 0.4},
    "DOMP10":   {"mrp_range": (1.5, 3),   "cost_factor": 0.5},
    "LOP2":     {"mrp_range": (2, 5),     "cost_factor": 0.4},
    "CET10":    {"mrp_range": (1, 3),     "cost_factor": 0.4},
    "LEV5":     {"mrp_range": (3, 6),     "cost_factor": 0.5},
    "FEX120":   {"mrp_range": (15, 25),   "cost_factor": 0.4},
    "MON10":    {"mrp_range": (12, 20),   "cost_factor": 0.4},
    "TEL40":    {"mrp_range": (10, 18),   "cost_factor": 0.4},
    "AML5":     {"mrp_range": (3, 6),     "cost_factor": 0.4},
    "ATN50":    {"mrp_range": (2, 4),     "cost_factor": 0.4},
    "MET25":    {"mrp_range": (3, 6),     "cost_factor": 0.4},
    "ENA5":     {"mrp_range": (2, 4),     "cost_factor": 0.4},
    "ROS10":    {"mrp_range": (15, 25),   "cost_factor": 0.4},
    "ATR10":    {"mrp_range": (8, 14),    "cost_factor": 0.4},
    "ASP75":    {"mrp_range": (1, 3),     "cost_factor": 0.4},
    "CLO75":    {"mrp_range": (10, 18),   "cost_factor": 0.4},
    "MET500":   {"mrp_range": (1.5, 3),   "cost_factor": 0.4},
    "GLM2":     {"mrp_range": (8, 14),    "cost_factor": 0.4},
    "SITA50":   {"mrp_range": (25, 40),   "cost_factor": 0.4},
    "SAL2":     {"mrp_range": (1, 3),     "cost_factor": 0.4},
    "SAL_INH":  {"mrp_range": (90, 150),  "cost_factor": 0.5},
    "BUD_INH":  {"mrp_range": (180, 280), "cost_factor": 0.5},
    "AMB30":    {"mrp_range": (4, 8),     "cost_factor": 0.4},
    "DEX_SYP":  {"mrp_range": (60, 100),  "cost_factor": 0.5},
    "CHL_SYP":  {"mrp_range": (50, 90),   "cost_factor": 0.5},
    "BCOM":     {"mrp_range": (4, 8),     "cost_factor": 0.4},
    "VITD":     {"mrp_range": (50, 90),   "cost_factor": 0.4},
    "CAL500":   {"mrp_range": (7, 12),    "cost_factor": 0.4},
    "FOL5":     {"mrp_range": (1, 3),     "cost_factor": 0.4},
    "FE_FOL":   {"mrp_range": (3, 6),     "cost_factor": 0.4},
    "ZIN20":    {"mrp_range": (4, 8),     "cost_factor": 0.4},
    "MUP_OINT": {"mrp_range": (140, 220), "cost_factor": 0.5},
    "CLOTRI_C": {"mrp_range": (50, 90),   "cost_factor": 0.5},
    "BETA_OINT":{"mrp_range": (40, 70),   "cost_factor": 0.5},
    "MOXI_DR":  {"mrp_range": (80, 150),  "cost_factor": 0.5},
    "CARB_DR":  {"mrp_range": (250, 400), "cost_factor": 0.5},
    "ALP25":    {"mrp_range": (10, 18),   "cost_factor": 0.3},
    "CLZ500":   {"mrp_range": (15, 25),   "cost_factor": 0.3},
}

SUPPLIERS = [
    "MedPlus Distributors",
    "Apollo Pharmacy Wholesale",
    "Cipla Direct",
    "Sun Pharma Distribution",
    "Generic Aadhaar",
    "Local Wholesale Pharma",
]


class Command(BaseCommand):
    help = "Seed Phase 2a: departments + drug batches."

    def add_arguments(self, parser):
        parser.add_argument("--reset", action="store_true",
            help="Wipe Phase 2a data before seeding (departments + batches)")

    @transaction.atomic
    def handle(self, *args, **opts):
        hospital = Hospital.objects.filter(
            code=settings.HMS_DEFAULT_HOSPITAL_CODE,
        ).first()
        if not hospital:
            self.stdout.write(self.style.ERROR("Default hospital not found."))
            return

        if opts["reset"]:
            self.stdout.write(self.style.WARNING("Resetting Phase 2a data..."))
            DrugBatch.objects.filter(hospital=hospital).delete()
            StockMovement.objects.filter(hospital=hospital).delete()
            Department.objects.filter(hospital=hospital).delete()

        # 1. Departments
        self.stdout.write("Seeding departments...")
        d_created = 0
        for idx, (code, name, dtype, location) in enumerate(DEPARTMENTS):
            obj, created = Department.objects.update_or_create(
                hospital=hospital, code=code,
                defaults={
                    "name": name,
                    "type": dtype,
                    "location_hint": location,
                    "sort_order": idx,
                    "is_active": True,
                },
            )
            if created: d_created += 1
        self.stdout.write(self.style.SUCCESS(
            f"  ✓ {d_created} departments created (total: {Department.objects.filter(hospital=hospital).count()})"
        ))

        # 2. Drug batches
        self.stdout.write("Seeding drug batches...")
        rng = random.Random(7)
        today = date.today()
        drugs = list(DrugMaster.objects.filter(hospital=hospital))
        if not drugs:
            self.stdout.write(self.style.WARNING(
                "  No drugs in DrugMaster. Run `seed_phase1b` first."
            ))
            return

        b_count = 0
        m_count = 0
        for drug in drugs:
            hint = DRUG_PRICE_HINTS.get(drug.code, {"mrp_range": (5, 15), "cost_factor": 0.4})
            mrp_lo, mrp_hi = hint["mrp_range"]

            # Most drugs get 2 batches with different expiries
            num_batches = rng.choice([1, 2, 2, 2])
            for batch_idx in range(num_batches):
                # Expiry: 6–24 months out, sometimes nearer for variety
                if batch_idx == 0:
                    expiry = today + timedelta(days=rng.randint(180, 540))
                else:
                    # Second batch — newer / longer expiry
                    expiry = today + timedelta(days=rng.randint(540, 900))

                # Mfg ~12-18 months before expiry
                mfg = expiry - timedelta(days=rng.randint(540, 720))

                # Quantity: chunky integers
                qty = rng.choice([100, 200, 200, 300, 500, 500, 1000])
                mrp = round(rng.uniform(mrp_lo, mrp_hi), 2)
                cost = round(mrp * hint["cost_factor"], 2)

                batch_no = (
                    f"{drug.code[:4]}{rng.choice(['A','B','C','D'])}"
                    f"{rng.randint(100, 999)}"
                )

                # Avoid duplicates
                existing = DrugBatch.objects.filter(
                    hospital=hospital, drug=drug, batch_no=batch_no,
                ).first()
                if existing:
                    continue

                batch = DrugBatch.objects.create(
                    hospital=hospital,
                    drug=drug,
                    batch_no=batch_no,
                    mfg_date=mfg,
                    expiry_date=expiry,
                    qty_purchased=qty,
                    qty_in_stock=qty,
                    purchase_price=Decimal(str(cost)),
                    mrp=Decimal(str(mrp)),
                    supplier_name=rng.choice(SUPPLIERS),
                    supplier_invoice_no=f"INV-{rng.randint(10000, 99999)}",
                    received_at=today - timedelta(days=rng.randint(0, 30)),
                    hsn_code=drug.hsn_code or "",
                    gst_rate=drug.gst_rate,
                )
                StockMovement.objects.create(
                    hospital=hospital,
                    drug=drug,
                    batch=batch,
                    movement_type="PURCHASE_IN",
                    quantity=qty,
                    moved_at=batch.received_at,
                    reference_type="purchase",
                    reference_id=batch.supplier_invoice_no,
                    notes=f"Initial seed - {batch.supplier_name}",
                )
                b_count += 1
                m_count += 1

        self.stdout.write(self.style.SUCCESS(
            f"  ✓ {b_count} batches + {m_count} movements created"
        ))

        self.stdout.write(self.style.SUCCESS("\n✅ Phase 2a seed complete!"))
        self.stdout.write("\nVerify in admin / API:")
        self.stdout.write("  - Departments:    /api/v1/department/departments/")
        self.stdout.write("  - Batches:        /api/v1/pharmacy/batches/")
        self.stdout.write("  - Low stock:      /api/v1/pharmacy/reports/low-stock/?threshold=50")
        self.stdout.write("  - Near expiry:    /api/v1/pharmacy/reports/near-expiry/?days=180")
