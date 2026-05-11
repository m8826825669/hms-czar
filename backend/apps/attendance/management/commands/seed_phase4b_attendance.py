"""Seed attendance shifts + holidays."""
from datetime import date, time, timedelta
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.db import transaction
from apps.core.models import Hospital
from apps.attendance.models import Shift, Holiday


SHIFTS = [
    ("MORN",  "Morning Shift",   time(8, 0),  time(16, 0), 30, 8, False),
    ("EVE",   "Evening Shift",   time(14, 0), time(22, 0), 30, 8, False),
    ("NIGHT", "Night Shift",     time(22, 0), time(6, 0),  60, 8, True),
    ("GEN",   "General Shift",   time(9, 0),  time(18, 0), 60, 8, False),
    ("OPD",   "OPD Shift",       time(9, 0),  time(14, 0), 0,  5, False),
]

HOLIDAYS_2026 = [
    (date(2026, 1, 26),  "Republic Day"),
    (date(2026, 3, 14),  "Holi"),
    (date(2026, 4, 14),  "Ambedkar Jayanti"),
    (date(2026, 5, 1),   "Labour Day"),
    (date(2026, 8, 15),  "Independence Day"),
    (date(2026, 10, 2),  "Gandhi Jayanti"),
    (date(2026, 10, 22), "Diwali"),
    (date(2026, 12, 25), "Christmas"),
]


class Command(BaseCommand):
    help = "Seed attendance shifts + holidays."

    @transaction.atomic
    def handle(self, *args, **options):
        hospital = Hospital.objects.first()
        if not hospital:
            self.stderr.write("No Hospital.")
            return

        for (code, name, st, end, brk, hrs, night) in SHIFTS:
            Shift.objects.update_or_create(
                hospital=hospital, code=code,
                defaults={
                    "name": name, "start_time": st, "end_time": end,
                    "break_minutes": brk, "work_hours": Decimal(str(hrs)),
                    "is_night_shift": night, "is_active": True,
                },
            )

        for (d, name) in HOLIDAYS_2026:
            Holiday.objects.update_or_create(
                hospital=hospital, date=d,
                defaults={"name": name, "is_optional": False},
            )

        self.stdout.write(self.style.SUCCESS(
            f"Done. {Shift.objects.count()} shifts, "
            f"{Holiday.objects.count()} holidays."
        ))
