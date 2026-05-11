"""Seed housekeeping module."""
from django.core.management.base import BaseCommand
from django.db import transaction
from apps.core.models import Hospital
from apps.housekeeping.models import (
    HKZone, HKStaff, HKTaskTemplate, HKTaskAssignment, DeepCleaningSchedule,
)

ZONES = [
    ("WARD-A",  "Ward A — General",      "WARD",      "MEDIUM", "2nd",   2000),
    ("WARD-B",  "Ward B — Surgical",     "WARD",      "MEDIUM", "2nd",   2000),
    ("OT-1",    "Operation Theatre 1",   "OT",        "HIGH",   "3rd",   400),
    ("OT-2",    "Operation Theatre 2",   "OT",        "HIGH",   "3rd",   400),
    ("ICU",     "ICU",                    "ICU",       "HIGH",   "3rd",   600),
    ("OPD",     "OPD Hall",               "OPD",       "MEDIUM", "1st",   1500),
    ("LAB",     "Laboratory",             "LAB",       "MEDIUM", "1st",   500),
    ("LOBBY",   "Main Lobby",             "LOBBY",     "LOW",    "Ground",800),
    ("CAFE",    "Cafeteria",              "CAFETERIA", "MEDIUM", "Ground",600),
    ("TOIL-1F", "Toilets 1st Floor",      "TOILET",    "MEDIUM", "1st",   200),
    ("TOIL-2F", "Toilets 2nd Floor",      "TOILET",    "MEDIUM", "2nd",   200),
    ("KITCHEN", "Kitchen",                "KITCHEN",   "HIGH",   "Ground",400),
]
STAFF = [
    ("HK-01", "Geeta Devi",   "9810050001", "CLEANER",    "MORNING"),
    ("HK-02", "Ramesh Kumar", "9810050002", "CLEANER",    "MORNING"),
    ("HK-03", "Sita Yadav",   "9810050003", "CLEANER",    "AFTERNOON"),
    ("HK-04", "Raj Singh",    "9810050004", "CLEANER",    "AFTERNOON"),
    ("HK-05", "Kamla Devi",   "9810050005", "CLEANER",    "NIGHT"),
    ("HK-06", "Manoj Yadav",  "9810050006", "SUPERVISOR", "MORNING"),
    ("HK-07", "Anil Kumar",   "9810050007", "DEEP_CLEAN", "FLEXI"),
]
# (zone_code, task_code, task_name, type, frequency, duration_min)
TEMPLATES = [
    ("OT-1", "OT1-MOP-PRE",   "OT-1 Pre-op Mopping",      "MOP",      "THRICE", 20),
    ("OT-1", "OT1-SANI-POST", "OT-1 Post-op Sanitization","SANITIZE", "THRICE", 30),
    ("OT-2", "OT2-MOP-PRE",   "OT-2 Pre-op Mopping",      "MOP",      "THRICE", 20),
    ("OT-2", "OT2-SANI-POST", "OT-2 Post-op Sanitization","SANITIZE", "THRICE", 30),
    ("ICU",  "ICU-MOP",       "ICU Floor Mopping",        "MOP",      "EVERY_4H", 15),
    ("ICU",  "ICU-SANI",      "ICU Surface Sanitization", "SANITIZE", "EVERY_4H", 20),
    ("WARD-A","WA-MOP",       "Ward A Mopping",           "MOP",      "TWICE", 30),
    ("WARD-A","WA-WASTE",     "Ward A Waste Removal",     "WASTE",    "THRICE", 15),
    ("WARD-B","WB-MOP",       "Ward B Mopping",           "MOP",      "TWICE", 30),
    ("WARD-B","WB-WASTE",     "Ward B Waste Removal",     "WASTE",    "THRICE", 15),
    ("OPD",   "OPD-MOP",      "OPD Hall Mopping",         "MOP",      "TWICE", 25),
    ("OPD",   "OPD-DUST",     "OPD Dusting",              "DUST",     "DAILY", 20),
    ("LAB",   "LAB-MOP",      "Lab Mopping",              "MOP",      "DAILY", 15),
    ("LAB",   "LAB-SANI",     "Lab Sanitization",         "SANITIZE", "DAILY", 20),
    ("LOBBY", "LOB-MOP",      "Lobby Mopping",            "MOP",      "TWICE", 20),
    ("CAFE",  "CAFE-CLEAN",   "Cafeteria Cleaning",       "MOP",      "THRICE", 25),
    ("TOIL-1F","T1F-SANI",    "1F Toilet Sanitization",   "SANITIZE", "EVERY_2H", 10),
    ("TOIL-2F","T2F-SANI",    "2F Toilet Sanitization",   "SANITIZE", "EVERY_2H", 10),
    ("KITCHEN","KIT-DEEP",    "Kitchen Deep Clean",       "DEEP",     "DAILY",   60),
]


class Command(BaseCommand):
    help = "Seed housekeeping module."

    def add_arguments(self, parser):
        parser.add_argument("--reset", action="store_true")

    @transaction.atomic
    def handle(self, *args, **options):
        hospital = Hospital.objects.first()
        if not hospital:
            self.stderr.write("No Hospital found.")
            return

        if options["reset"]:
            HKTaskAssignment.objects.all().delete()
            DeepCleaningSchedule.objects.all().delete()
            HKTaskTemplate.objects.all().delete()
            HKStaff.objects.all().delete()
            HKZone.objects.all().delete()

        zone_map = {}
        for (code, name, t, crit, floor, area) in ZONES:
            obj, _ = HKZone.objects.update_or_create(
                hospital=hospital, code=code,
                defaults={"name": name, "zone_type": t, "criticality": crit,
                           "floor": floor, "area_sqft": area, "is_active": True},
            )
            zone_map[code] = obj

        for (emp, name, phone, role, shift) in STAFF:
            HKStaff.objects.update_or_create(
                hospital=hospital, employee_code=emp,
                defaults={"full_name": name, "phone": phone, "role": role,
                           "shift": shift, "is_on_duty": True, "is_active": True},
            )

        for (zone_code, code, name, t, freq, dur) in TEMPLATES:
            HKTaskTemplate.objects.update_or_create(
                hospital=hospital, code=code,
                defaults={
                    "name": name, "zone": zone_map[zone_code],
                    "task_type": t, "frequency": freq,
                    "duration_minutes": dur, "is_active": True,
                },
            )

        self.stdout.write(self.style.SUCCESS(
            f"\nDone. {HKZone.objects.count()} zones, "
            f"{HKStaff.objects.count()} staff, "
            f"{HKTaskTemplate.objects.count()} task templates."
        ))
