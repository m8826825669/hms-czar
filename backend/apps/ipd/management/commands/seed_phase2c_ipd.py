"""Seed Phase 2c IPD ward/room/bed structure.

Creates a realistic small-hospital layout:
  - General Ward (GEN)        — 3 rooms × 4 beds = 12 beds @ ₹500/day
  - Semi-Private (SEMI)       — 4 rooms × 2 beds = 8 beds @ ₹1,200/day
  - Private (PRIV)            — 4 rooms × 1 bed  = 4 beds @ ₹2,500/day (5% GST)
  - ICU                       — 1 room × 6 beds  = 6 beds @ ₹4,000/day (5% GST)
  - Maternity (MAT)           — 2 rooms × 2 beds = 4 beds @ ₹1,500/day (5% GST)
  - Paediatric (PAED)         — 2 rooms × 3 beds = 6 beds @ ₹600/day

Total: 40 beds across 6 wards / 16 rooms.

Run: python manage.py seed_phase2c_ipd
     python manage.py seed_phase2c_ipd --reset   # wipes existing IPD data
"""
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.core.models import Hospital
from apps.ipd.models import (Ward, Room, Bed, Admission, DailyCharge,
                              AdmissionService, DischargeSummary)


# (ward_code, name, type, floor, bed_rent, nursing, gst, room_layout)
# room_layout: list of (room_number, num_beds, is_ac)
WARDS = [
    ("GEN", "General Ward — Block A", "GENERAL", "Ground floor",
     500, 200, 0, [
        ("101", 4, False),
        ("102", 4, False),
        ("103", 4, False),
     ]),
    ("SEMI", "Semi-Private Ward — Block B", "SEMI_PRIVATE", "1st floor",
     1200, 300, 0, [
        ("201", 2, True),
        ("202", 2, True),
        ("203", 2, True),
        ("204", 2, True),
     ]),
    ("PRIV", "Private Rooms — Block C", "PRIVATE", "2nd floor",
     2500, 500, 5, [
        ("301", 1, True),
        ("302", 1, True),
        ("303", 1, True),
        ("304", 1, True),
     ]),
    ("ICU", "Intensive Care Unit", "ICU", "1st floor",
     4000, 1000, 5, [
        ("ICU-A", 6, True),
     ]),
    ("MAT", "Maternity Ward", "MATERNITY", "Ground floor",
     1500, 400, 5, [
        ("M1", 2, True),
        ("M2", 2, True),
     ]),
    ("PAED", "Paediatric Ward", "PAEDIATRIC", "Ground floor",
     600, 250, 0, [
        ("P1", 3, False),
        ("P2", 3, False),
     ]),
]


class Command(BaseCommand):
    help = "Seed Phase 2c IPD ward / room / bed structure"

    def add_arguments(self, parser):
        parser.add_argument("--reset", action="store_true",
                            help="Wipe existing IPD data first")

    @transaction.atomic
    def handle(self, *args, **opts):
        hospital = Hospital.objects.first()
        if not hospital:
            self.stderr.write(self.style.ERROR("No Hospital found."))
            return

        if opts["reset"]:
            self.stdout.write(self.style.WARNING("Resetting IPD data..."))
            DischargeSummary.objects.filter(hospital=hospital).delete()
            DailyCharge.objects.filter(hospital=hospital).delete()
            AdmissionService.objects.filter(hospital=hospital).delete()
            Admission.objects.filter(hospital=hospital).delete()
            Bed.objects.filter(hospital=hospital).delete()
            Room.objects.filter(hospital=hospital).delete()
            Ward.objects.filter(hospital=hospital).delete()

        wards_created = 0
        rooms_created = 0
        beds_created = 0

        for (wcode, wname, wtype, floor, rent, nursing, gst, room_layout) in WARDS:
            ward, w_new = Ward.objects.update_or_create(
                hospital=hospital, code=wcode,
                defaults={
                    "name": wname, "ward_type": wtype, "floor": floor,
                    "default_bed_rent": Decimal(str(rent)),
                    "default_nursing_charge": Decimal(str(nursing)),
                    "default_gst_rate": Decimal(str(gst)),
                    "is_active": True,
                },
            )
            if w_new:
                wards_created += 1
                self.stdout.write(self.style.SUCCESS(
                    f"  ✓ Ward: {wcode} — {wname} (₹{rent}/day, {gst}% GST)"
                ))

            for (rnum, nbeds, is_ac) in room_layout:
                room, r_new = Room.objects.update_or_create(
                    hospital=hospital, ward=ward, number=rnum,
                    defaults={"is_ac": is_ac, "has_attached_bath": True},
                )
                if r_new:
                    rooms_created += 1

                for i in range(nbeds):
                    label = chr(65 + i)  # A, B, C, ...
                    _, b_new = Bed.objects.update_or_create(
                        hospital=hospital, room=room, label=label,
                        defaults={
                            "bed_rent": Decimal(str(rent)),
                            "nursing_charge": Decimal(str(nursing)),
                            "gst_rate": Decimal(str(gst)),
                            "status": "AVAILABLE",
                        },
                    )
                    if b_new:
                        beds_created += 1

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS(
            f"Done. {wards_created} wards, {rooms_created} rooms, "
            f"{beds_created} beds seeded."
        ))
        total_beds = Bed.objects.filter(hospital=hospital).count()
        avail = Bed.objects.filter(hospital=hospital, status="AVAILABLE").count()
        self.stdout.write(self.style.SUCCESS(
            f"Total now: {total_beds} beds ({avail} available)."
        ))
