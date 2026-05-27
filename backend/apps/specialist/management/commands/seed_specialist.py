"""Seed specialist module with realistic sample data.

Run after migrations:  python manage.py seed_specialist

Creates (idempotent — safe to re-run):

  Specialties     : 10 common Indian hospital specialties
  Qualifications  : 8 standard medical qualifications (MBBS, MD, MS, DM, MCh…)
  Locations       : OPD cabins for each specialty (under default hospital)
  Doctors         : 10 sample doctors, each with:
                     - A linked User (login = first name lowercase, password = 'doctor123')
                     - 1-2 specialties
                     - 1-3 qualifications
                     - is_consulting = True (visible in booking dropdowns)
                     - on_call = False initially (toggle from Specialist Mgmt UI)
                     - OPD slots Mon-Fri 09:00-13:00 + 17:00-20:00
                     - Consultation fees: NEW ₹500, FOLLOWUP ₹300, EMERGENCY ₹1000

Why this seed exists:
  The Specialist module didn't have a seed command, so a fresh install showed
  an empty "doctors" dropdown on the Book Appointment page. This makes the
  app usable end-to-end immediately after migrations.

Flags:
  --reset           Wipe existing specialist data first (DESTRUCTIVE)
  --hospital CODE   Use a specific hospital code (default: HMS_DEFAULT_HOSPITAL_CODE)
  --count N         Create N doctors instead of the default 10
"""
from datetime import date, time
from decimal import Decimal

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.core.models import Hospital, Department, Location


SPECIALTIES = [
    # (code, name, icon)
    ("GEN_MED",  "General Medicine",        "stethoscope"),
    ("GEN_SURG", "General Surgery",         "scissors"),
    ("CARDIO",   "Cardiology",              "heart-pulse"),
    ("ORTHO",    "Orthopaedics",            "bone"),
    ("PAED",     "Paediatrics",             "baby"),
    ("GYNAEC",   "Gynaecology & Obstetrics","stethoscope"),
    ("DERMA",    "Dermatology",             "user"),
    ("ENT",      "ENT (Ear, Nose, Throat)", "ear"),
    ("OPHTHAL",  "Ophthalmology",           "eye"),
    ("PSYCH",    "Psychiatry",              "brain"),
]


QUALIFICATIONS = [
    # (code, name, rank — higher = more senior)
    ("MBBS",  "Bachelor of Medicine, Bachelor of Surgery", 1),
    ("MD",    "Doctor of Medicine",                        2),
    ("MS",    "Master of Surgery",                         2),
    ("DM",    "Doctorate of Medicine (Super-specialty)",   3),
    ("MCh",   "Master of Chirurgiae (Super-surgical)",     3),
    ("DNB",   "Diplomate of National Board",               2),
    ("FRCS",  "Fellow of the Royal College of Surgeons",   3),
    ("MRCP",  "Member of the Royal College of Physicians", 2),
]


# (username_seed, first_name, last_name, registration_no, [specialty_codes], [qual_codes], gender, experience_years)
DOCTORS = [
    ("asharma",   "Arvind",  "Sharma",  "MCI-2010-12001", ["GEN_MED"],         ["MBBS", "MD"],         "M", 14),
    ("rgupta",    "Rajesh",  "Gupta",   "MCI-2008-08742", ["CARDIO"],          ["MBBS", "MD", "DM"],   "M", 17),
    ("smehta",    "Sneha",   "Mehta",   "MCI-2012-04219", ["GYNAEC"],          ["MBBS", "MS"],         "F", 13),
    ("sarora",    "Sunil",   "Arora",   "MCI-2005-09812", ["GEN_SURG"],        ["MBBS", "MS", "FRCS"], "M", 20),
    ("vkumar",    "Vinay",   "Kumar",   "MCI-2014-02384", ["PAED"],            ["MBBS", "MD"],         "M", 11),
    ("ppatel",    "Priya",   "Patel",   "MCI-2011-07654", ["ORTHO"],           ["MBBS", "MS"],         "F", 14),
    ("kjoshi",    "Kavita",  "Joshi",   "MCI-2015-01198", ["DERMA"],           ["MBBS", "MD"],         "F", 10),
    ("mnair",     "Mohan",   "Nair",    "MCI-2009-06677", ["ENT"],             ["MBBS", "MS"],         "M", 16),
    ("dverma",    "Deepak",  "Verma",   "MCI-2013-03445", ["OPHTHAL"],         ["MBBS", "MS"],         "M", 12),
    ("rmitra",    "Radhika", "Mitra",   "MCI-2016-05521", ["PSYCH"],           ["MBBS", "MD"],         "F",  9),
]


# Standard OPD schedule per doctor (day_of_week, start, end)
# day_of_week: 0=Mon … 6=Sun
DEFAULT_SLOTS = [
    (0, time(9, 0),  time(13, 0)),
    (1, time(9, 0),  time(13, 0)),
    (2, time(9, 0),  time(13, 0)),
    (3, time(9, 0),  time(13, 0)),
    (4, time(9, 0),  time(13, 0)),
    (5, time(9, 0),  time(13, 0)),
    (0, time(17, 0), time(20, 0)),
    (2, time(17, 0), time(20, 0)),
    (4, time(17, 0), time(20, 0)),
]


# Consultation fees, applied to every doctor created
FEES = [
    ("NEW",       Decimal("500")),
    ("FOLLOWUP",  Decimal("300")),
    ("EMERGENCY", Decimal("1000")),
    ("TELE",      Decimal("400")),
]


class Command(BaseCommand):
    help = "Seed the specialist module with sample doctors, specialties, and OPD slots."

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset", action="store_true",
            help="Wipe existing specialist data first (DESTRUCTIVE).",
        )
        parser.add_argument(
            "--hospital", type=str, default=None,
            help="Hospital code to seed under. Defaults to HMS_DEFAULT_HOSPITAL_CODE.",
        )
        parser.add_argument(
            "--count", type=int, default=len(DOCTORS),
            help=f"How many doctors to create (max {len(DOCTORS)}). Default {len(DOCTORS)}.",
        )

    def handle(self, *args, **opts):
        # Lazy imports so this module loads even if specialist app isn't installed
        from apps.accounts.models import User
        from apps.specialist.models import (
            Specialty, Qualification, Doctor, OPDSlot, ConsultationFee,
        )

        hospital_code = opts["hospital"] or getattr(
            settings, "HMS_DEFAULT_HOSPITAL_CODE", "HOSP001"
        )
        try:
            hospital = Hospital.objects.get(code=hospital_code)
        except Hospital.DoesNotExist:
            raise CommandError(
                f"Hospital with code '{hospital_code}' not found. "
                f"Create it first (or pass --hospital <existing_code>)."
            )

        count = max(1, min(opts["count"], len(DOCTORS)))

        if opts["reset"]:
            self.stdout.write(self.style.WARNING(
                f"Wiping existing specialist data for hospital {hospital_code}…"
            ))
            ConsultationFee.objects.filter(hospital=hospital).delete()
            OPDSlot.objects.filter(hospital=hospital).delete()
            # Don't delete Doctor by hospital because the Doctor's hospital field
            # comes from TenantBaseModel; also delete the linked User accounts so
            # next seed can recreate them cleanly.
            doctor_user_ids = list(
                Doctor.objects.filter(hospital=hospital).values_list("user_id", flat=True)
            )
            Doctor.objects.filter(hospital=hospital).delete()
            User.objects.filter(id__in=doctor_user_ids, hospital=hospital).delete()
            Qualification.objects.filter(hospital=hospital).delete()
            Specialty.objects.filter(hospital=hospital).delete()

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS(
            f"Seeding specialist data under hospital '{hospital_code}'…"
        ))

        with transaction.atomic():
            # 1) Specialties
            spec_by_code = {}
            for code, name, icon in SPECIALTIES:
                obj, created = Specialty.objects.update_or_create(
                    hospital=hospital, code=code,
                    defaults={"name": name, "icon": icon, "is_active": True},
                )
                spec_by_code[code] = obj
                if created:
                    self.stdout.write(self.style.SUCCESS(f"  ✓ Specialty: {code} — {name}"))

            # 2) Qualifications
            qual_by_code = {}
            for code, name, rank in QUALIFICATIONS:
                obj, created = Qualification.objects.update_or_create(
                    hospital=hospital, code=code,
                    defaults={"name": name, "rank": rank, "is_active": True},
                )
                qual_by_code[code] = obj
                if created:
                    self.stdout.write(self.style.SUCCESS(f"  ✓ Qualification: {code} — {name}"))

            # 3) Default department + OPD locations
            # We need at least one OPD-type Location to attach OPDSlots to.
            opd_dept, _ = Department.objects.update_or_create(
                hospital=hospital, code="OPD",
                defaults={"name": "Out-Patient Department", "dept_type": "CLINICAL", "is_active": True},
            )
            opd_loc, _ = Location.objects.update_or_create(
                hospital=hospital, code="OPD-MAIN",
                defaults={
                    "name": "OPD — Main Block",
                    "location_type": "OPD",
                    "department": opd_dept,
                    "floor": "Ground",
                    "block": "Main",
                    "capacity": 0,
                    "is_active": True,
                },
            )
            self.stdout.write(self.style.SUCCESS(f"  ✓ OPD Location: {opd_loc.code}"))

            # 4) Doctors
            created_doctors = 0
            updated_doctors = 0
            for (username, fn, ln, regno, sp_codes, q_codes, gender, exp) in DOCTORS[:count]:
                # User account (login)
                user, user_new = User.objects.update_or_create(
                    username=username,
                    defaults={
                        "first_name": fn,
                        "last_name": ln,
                        "hospital": hospital,
                        "designation": "Doctor",
                        "is_active": True,
                    },
                )
                if user_new:
                    # Set a known default password so demo logins work
                    user.set_password("doctor123")
                    user.save(update_fields=["password"])

                # Doctor profile — preserve `on_call` on re-runs (it's a runtime
                # toggle, not a seed value). Use get_or_create for the doctor,
                # then patch the static fields explicitly so we don't clobber it.
                doctor, doc_new = Doctor.objects.get_or_create(
                    hospital=hospital, user=user,
                    defaults={
                        "registration_number": regno,
                        "primary_department": opd_dept,
                        "bio": f"{fn} {ln} — {sp_codes[0] if sp_codes else ''} specialist.",
                        "years_of_experience": exp,
                        "languages": ["English", "Hindi"],
                        "is_consulting": True,
                        "on_call": False,
                        "is_active": True,
                    },
                )
                if not doc_new:
                    # Update everything EXCEPT on_call (runtime toggle)
                    doctor.registration_number = regno
                    doctor.primary_department = opd_dept
                    doctor.bio = f"{fn} {ln} — {sp_codes[0] if sp_codes else ''} specialist."
                    doctor.years_of_experience = exp
                    doctor.languages = ["English", "Hindi"]
                    doctor.is_consulting = True
                    doctor.is_active = True
                    doctor.save()
                doctor.specialties.set([spec_by_code[c] for c in sp_codes if c in spec_by_code])
                doctor.qualifications.set([qual_by_code[c] for c in q_codes if c in qual_by_code])

                # 5) OPD slots
                for day, start_t, end_t in DEFAULT_SLOTS:
                    OPDSlot.objects.update_or_create(
                        hospital=hospital, doctor=doctor,
                        day_of_week=day, start_time=start_t, location=opd_loc,
                        defaults={
                            "end_time": end_t,
                            "slot_duration_minutes": 15,
                            "max_patients": 20,
                            "is_active": True,
                        },
                    )

                # 6) Consultation fees
                for visit_type, amount in FEES:
                    ConsultationFee.objects.update_or_create(
                        hospital=hospital, doctor=doctor, visit_type=visit_type,
                        valid_from=date.today().replace(day=1),
                        defaults={
                            "amount": amount,
                            "follow_up_window_days": 7,
                            "is_active": True,
                        },
                    )

                if doc_new:
                    created_doctors += 1
                    self.stdout.write(self.style.SUCCESS(
                        f"  ✓ Doctor: Dr. {fn} {ln} ({regno}) — login: {username}"
                    ))
                else:
                    updated_doctors += 1
                    self.stdout.write(
                        f"  • Doctor updated: Dr. {fn} {ln} ({regno})"
                    )

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS(
            f"Done. {created_doctors} new doctors, {updated_doctors} updated.  "
            f"Total under {hospital_code}: {Doctor.objects.filter(hospital=hospital).count()} doctors, "
            f"{Specialty.objects.filter(hospital=hospital).count()} specialties."
        ))
        self.stdout.write(self.style.SUCCESS(
            "Doctor logins (password: doctor123): "
            + ", ".join(d[0] for d in DOCTORS[:count])
        ))
        self.stdout.write(self.style.WARNING(
            "⚠ doctor123 is a DEMO password. Reset before any real deployment."
        ))
