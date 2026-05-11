"""
Seed Phase 3a Blood Bank:
  • 10 donors covering all 8 blood groups
  • Optional: 5 sample passed donations with bags created (for inventory population)
"""
from datetime import date, datetime, timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.core.models import Hospital
from apps.blood_bank.models import (
    BloodDonor, BloodDonation, BloodBag,
    BloodRequisition, CrossMatch, BloodIssue,
)
from apps.blood_bank.services import bank_service


# (first_name, last_name, gender, dob, blood_group, phone, weight_kg, donor_type)
DONORS = [
    ("Rajesh",  "Sharma",   "M", date(1985, 3, 15),  "O_POS",  "9810000001", "75",  "VOLUNTARY"),
    ("Priya",   "Patel",    "F", date(1992, 7, 22),  "A_POS",  "9810000002", "62",  "VOLUNTARY"),
    ("Amit",    "Kumar",    "M", date(1980, 11, 5),  "B_POS",  "9810000003", "80",  "VOLUNTARY"),
    ("Sunita",  "Devi",     "F", date(1990, 1, 10),  "AB_POS", "9810000004", "58",  "VOLUNTARY"),
    ("Vikram",  "Singh",    "M", date(1988, 9, 3),   "O_NEG",  "9810000005", "85",  "VOLUNTARY"),
    ("Neha",    "Verma",    "F", date(1995, 5, 28),  "A_NEG",  "9810000006", "55",  "VOLUNTARY"),
    ("Arun",    "Reddy",    "M", date(1978, 12, 14), "B_NEG",  "9810000007", "78",  "VOLUNTARY"),
    ("Meera",   "Iyer",     "F", date(1993, 4, 7),   "AB_NEG", "9810000008", "60",  "VOLUNTARY"),
    ("Sanjay",  "Gupta",    "M", date(1982, 8, 19),  "O_POS",  "9810000009", "82",  "REPLACEMENT"),
    ("Anjali",  "Mishra",   "F", date(1991, 2, 11),  "B_POS",  "9810000010", "65",  "VOLUNTARY"),
]


class Command(BaseCommand):
    help = "Seed blood bank donors, optional donations + bags."

    def add_arguments(self, parser):
        parser.add_argument("--reset", action="store_true",
                            help="Wipe all blood bank data first.")
        parser.add_argument("--with-bags", action="store_true",
                            help="Also create sample donations + screened bags.")

    @transaction.atomic
    def handle(self, *args, **options):
        hospital = Hospital.objects.first()
        if not hospital:
            self.stderr.write("No Hospital found. Run earlier seed scripts first.")
            return

        if options["reset"]:
            self.stdout.write("Resetting blood bank data...")
            BloodIssue.objects.all().delete()
            CrossMatch.objects.all().delete()
            BloodRequisition.objects.all().delete()
            BloodBag.objects.all().delete()
            BloodDonation.objects.all().delete()
            BloodDonor.objects.all().delete()

        # Donors
        donors_created = []
        for (fn, ln, g, dob, bg, phone, wt, dt) in DONORS:
            existing = BloodDonor.objects.filter(
                hospital=hospital, phone=phone,
            ).first()
            if existing:
                self.stdout.write(f"  ↻ Skipping existing donor: {existing.donor_id}")
                donors_created.append(existing)
                continue

            d = bank_service.register_donor(
                hospital=hospital,
                first_name=fn, last_name=ln, gender=g, dob=dob,
                blood_group=bg, phone=phone,
                weight_kg=Decimal(wt), donor_type=dt,
            )
            donors_created.append(d)
            self.stdout.write(f"  ✓ Created donor: {d.donor_id} {d.full_name} ({d.get_blood_group_display()})")

        # Sample donations + bags
        if options["with_bags"]:
            self.stdout.write("\nCreating sample donations + screened bags...")
            # Pick first 6 donors for diversity (skip 2 to leave them eligible)
            sample_donors = donors_created[:6]
            for donor in sample_donors:
                # We need to clear last_donation_date so they're eligible
                donor.last_donation_date = None
                donor.save(update_fields=["last_donation_date"])

                donation = bank_service.record_donation(
                    donor=donor,
                    volume_collected_ml=350,
                    pre_hb_g_dl=Decimal("13.5"),
                    pre_bp_systolic=120, pre_bp_diastolic=80,
                    pre_pulse=72, pre_temperature_c=Decimal("36.8"),
                )
                # Different component splits to populate inventory variety
                if donor.blood_group in ("O_POS", "O_NEG"):
                    components = ["WHOLE", "PRBC"]
                elif donor.blood_group == "AB_POS":
                    components = ["FFP", "PLATELETS"]
                else:
                    components = ["PRBC"]

                bank_service.complete_screening(
                    donation,
                    test_hiv="NEGATIVE", test_hbsag="NEGATIVE",
                    test_hcv="NEGATIVE", test_syphilis="NEGATIVE",
                    test_malaria="NEGATIVE",
                    components=components,
                    storage_location=f"Fridge A, Shelf {donor.id % 4 + 1}",
                )
                bag_count = donation.bags.count()
                self.stdout.write(
                    f"  ✓ Donation {donation.donation_id} from {donor.full_name} "
                    f"→ {bag_count} bag(s) created ({', '.join(components)})"
                )

        self.stdout.write(self.style.SUCCESS(
            f"\nDone. {BloodDonor.objects.count()} donors, "
            f"{BloodDonation.objects.count()} donations, "
            f"{BloodBag.objects.filter(status='AVAILABLE').count()} bags available."
        ))
