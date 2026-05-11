"""
Seed Phase 3a OT data:
  • 5 theatres: OT-1 (General), OT-2 (Cardiac), OT-3 (Ortho), OT-MINOR (Day-care), OT-EMERG
  • 20 surgical procedures across categories with realistic Indian pricing
"""
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.db import transaction
from apps.core.models import Hospital
from apps.ot.models import (
    OperationTheatre, SurgicalProcedure, SurgeryBooking,
    SurgeryTeam, OTRegister, OTConsumable,
)


THEATRES = [
    ("OT-1",       "General Surgery OT-1",       "GENERAL",   "2nd"),
    ("OT-2",       "Cardiac OT",                  "CARDIAC",   "3rd"),
    ("OT-3",       "Orthopaedic OT",              "ORTHO",     "2nd"),
    ("OT-MINOR",   "Minor / Day-care OT",         "MINOR",     "1st"),
    ("OT-EMERG",   "Emergency OT",                "EMERGENCY", "Ground"),
]

# (code, name, category, duration_min, price, hsn, gst, requires_anaes, anaes_type, desc)
PROCEDURES = [
    # General
    ("APPY",     "Open Appendectomy",                      "GENERAL", 60,   25000, "9993", 0,  True, "GA",       ""),
    ("LAP_APPY", "Laparoscopic Appendectomy",              "GENERAL", 75,   45000, "9993", 0,  True, "GA",       ""),
    ("LAP_CHOL", "Laparoscopic Cholecystectomy",           "GENERAL", 90,   55000, "9993", 0,  True, "GA",       ""),
    ("HERNIA",   "Inguinal Hernia Repair (Mesh)",          "GENERAL", 60,   30000, "9993", 0,  True, "SA",       ""),
    ("HAEMORR",  "Haemorrhoidectomy",                      "GENERAL", 45,   20000, "9993", 0,  True, "SA",       ""),

    # Ortho
    ("THR",      "Total Hip Replacement",                  "ORTHO",   180, 250000, "9993", 0,  True, "GA",       "Implant cost extra"),
    ("TKR",      "Total Knee Replacement",                 "ORTHO",   150, 220000, "9993", 0,  True, "SA",       "Implant cost extra"),
    ("ORIF",     "ORIF Tibia / Fibula Fracture",           "ORTHO",    90,  60000, "9993", 0,  True, "SA",       ""),
    ("ARTHRO",   "Knee Arthroscopy",                       "ORTHO",    60,  45000, "9993", 0,  True, "SA",       ""),

    # Cardiac
    ("CABG",     "Coronary Artery Bypass Grafting",        "CARDIAC", 360, 350000, "9993", 0,  True, "GA",       ""),
    ("ANGIO",    "Coronary Angiography",                   "CARDIAC",  60,  18000, "9993", 0,  True, "LA",       ""),
    ("PCI",      "Percutaneous Coronary Intervention (PCI)","CARDIAC", 120, 150000, "9993", 0,  True, "LA",       "Stent cost extra"),

    # OBGYN
    ("LSCS",     "Lower Segment Caesarean Section",        "OBGYN",    60,  35000, "9993", 0,  True, "SA",       ""),
    ("HYS",      "Total Abdominal Hysterectomy",           "OBGYN",   120,  55000, "9993", 0,  True, "GA",       ""),
    ("DC",       "Dilatation & Curettage",                 "OBGYN",    30,  10000, "9993", 0,  True, "GA",       ""),

    # ENT / Ophthal
    ("TONS",     "Tonsillectomy",                          "ENT",      45,  20000, "9993", 0,  True, "GA",       ""),
    ("CAT",      "Cataract Phacoemulsification + IOL",     "OPHTHAL",  30,  25000, "9993", 0,  True, "LA",       "IOL cost included"),

    # Minor
    ("LIPOMA",   "Lipoma Excision",                        "MINOR",    20,   5000, "9993", 0,  True, "LA",       ""),
    ("CIRC",     "Circumcision",                           "MINOR",    20,   8000, "9993", 0,  True, "LA",       ""),
    ("ABSCESS",  "Abscess Incision & Drainage",            "MINOR",    15,   3500, "9993", 0,  True, "LA",       ""),
]


class Command(BaseCommand):
    help = "Seed OT theatres and surgical procedures."

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset", action="store_true",
            help="Wipe all OT data before seeding.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        hospital = Hospital.objects.first()
        if not hospital:
            self.stderr.write("No Hospital found. Run earlier seed scripts first.")
            return

        if options["reset"]:
            self.stdout.write("Resetting OT data...")
            OTConsumable.objects.all().delete()
            OTRegister.objects.all().delete()
            SurgeryTeam.objects.all().delete()
            SurgeryBooking.objects.all().delete()
            SurgicalProcedure.objects.all().delete()
            OperationTheatre.objects.all().delete()

        # Theatres
        for code, name, ttype, floor in THEATRES:
            obj, created = OperationTheatre.objects.update_or_create(
                hospital=hospital, code=code,
                defaults={
                    "name": name, "theatre_type": ttype, "floor": floor,
                    "status": "AVAILABLE", "is_active": True,
                },
            )
            self.stdout.write(f"  {'✓ Created' if created else '↻ Updated'} theatre: {code} — {name}")

        # Procedures
        for (code, name, cat, dur, price, hsn, gst, req_anaes, anaes_type, desc) in PROCEDURES:
            obj, created = SurgicalProcedure.objects.update_or_create(
                hospital=hospital, code=code,
                defaults={
                    "name": name, "category": cat,
                    "typical_duration_minutes": dur,
                    "base_price": Decimal(str(price)),
                    "hsn_code": hsn,
                    "gst_rate": Decimal(str(gst)),
                    "requires_anaesthesia": req_anaes,
                    "anaesthesia_type": anaes_type,
                    "is_active": True,
                    "description": desc,
                },
            )
            self.stdout.write(f"  {'✓ Created' if created else '↻ Updated'} procedure: {code} — {name}")

        self.stdout.write(self.style.SUCCESS(
            f"\nDone. {OperationTheatre.objects.count()} theatres, "
            f"{SurgicalProcedure.objects.count()} procedures."
        ))
