"""Seed ambulances + drivers."""
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.db import transaction
from apps.core.models import Hospital
from apps.ambulance.models import Ambulance, AmbulanceDriver, Dispatch, DispatchLog


AMBULANCES = [
    # (code, reg_no, type, make_model, year, base_price, per_km)
    ("AMB-01",      "UP-14-AB-1234", "BLS",     "Force Traveller",  2022,  500, 20),
    ("AMB-02",      "UP-14-AB-1235", "BLS",     "Tata Winger",      2021,  500, 20),
    ("AMB-ALS-01",  "UP-14-AB-2001", "ALS",     "Force Toofan",     2023,  800, 30),
    ("AMB-CARDIAC", "UP-14-AB-3001", "CARDIAC", "Force Traveller",  2023, 1500, 50),
    ("AMB-MORT",    "UP-14-AB-4001", "MORTUARY","Tata Winger",      2020,  300, 15),
]
DRIVERS = [
    # (employee_code, name, phone, role, shift)
    ("DRV-01", "Ramesh Kumar",    "9810010001", "DRIVER",           "MORNING"),
    ("DRV-02", "Suresh Yadav",    "9810010002", "DRIVER",           "AFTERNOON"),
    ("DRV-03", "Mahesh Singh",    "9810010003", "DRIVER",           "NIGHT"),
    ("PAR-01", "Dr. Anil Verma",  "9810020001", "PARAMEDIC",        "MORNING"),
    ("PAR-02", "Sunita Rao",      "9810020002", "PARAMEDIC",        "AFTERNOON"),
    ("EMT-01", "Vikas Gupta",     "9810030001", "EMT",              "FLEXI"),
    ("DPM-01", "Mohan Lal",       "9810040001", "DRIVER_PARAMEDIC", "FLEXI"),
]


class Command(BaseCommand):
    help = "Seed ambulances + drivers."

    def add_arguments(self, parser):
        parser.add_argument("--reset", action="store_true")

    @transaction.atomic
    def handle(self, *args, **options):
        hospital = Hospital.objects.first()
        if not hospital:
            self.stderr.write("No Hospital found. Run earlier seed scripts first.")
            return

        if options["reset"]:
            Dispatch.objects.all().delete()
            DispatchLog.objects.all().delete()
            Ambulance.objects.all().delete()
            AmbulanceDriver.objects.all().delete()

        for (code, reg, t, make, year, base, per_km) in AMBULANCES:
            obj, created = Ambulance.objects.update_or_create(
                hospital=hospital, code=code,
                defaults={
                    "registration_number": reg,
                    "ambulance_type": t, "make_model": make, "year": year,
                    "base_price": Decimal(str(base)),
                    "per_km_rate": Decimal(str(per_km)),
                    "status": "AVAILABLE", "is_active": True,
                    "equipment_list": (
                        "Defibrillator, Oxygen, Suction, Stretcher, BP cuff"
                        if t in ("ALS", "CARDIAC") else
                        "Oxygen, Stretcher, First-aid kit, BP cuff"
                    ),
                },
            )
            self.stdout.write(f"  {'✓' if created else '↻'} {code} ({reg})")

        for (emp, name, phone, role, shift) in DRIVERS:
            obj, created = AmbulanceDriver.objects.update_or_create(
                hospital=hospital, employee_code=emp,
                defaults={
                    "full_name": name, "phone": phone,
                    "role": role, "shift": shift,
                    "is_on_duty": True, "is_active": True,
                },
            )
            self.stdout.write(f"  {'✓' if created else '↻'} {emp} {name}")

        self.stdout.write(self.style.SUCCESS(
            f"\nDone. {Ambulance.objects.count()} ambulances, "
            f"{AmbulanceDriver.objects.count()} drivers."
        ))
