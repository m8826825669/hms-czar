"""Seed Phase 1a sample data: specialties, qualifications, doctors, slots,
fees, on-call entries, notification templates, sample patients & appointments.

Run after seed_initial:
    python manage.py seed_phase1
"""
from datetime import date, time, timedelta
import random
from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.core.models import Hospital, Department, Location, Patient
from apps.accounts.models import User, Role, UserRole
from apps.specialist.models import (Doctor, Specialty, Qualification, OPDSlot,
                                     ConsultationFee, OnCallRoster)
from apps.reception.models import Appointment
from apps.notifications.models import NotificationTemplate


SPECIALTIES = [
    ("CARDIO", "Cardiology", "Heart"),
    ("ORTHO", "Orthopaedics", "Bone"),
    ("PEDIA", "Paediatrics", "Baby"),
    ("OBGY", "Obstetrics & Gynaecology", "Heart"),
    ("DERM", "Dermatology", "Sparkles"),
    ("NEURO", "Neurology", "Brain"),
    ("GENMED", "General Medicine", "Stethoscope"),
    ("ENT", "ENT (Ear/Nose/Throat)", "Ear"),
]

QUALIFICATIONS = [
    ("MBBS", "Bachelor of Medicine", 1),
    ("MD", "Doctor of Medicine", 2),
    ("MS", "Master of Surgery", 2),
    ("DM", "Doctorate of Medicine", 3),
    ("MCh", "Master of Chirurgiae", 3),
    ("DNB", "Diplomate of National Board", 2),
    ("FRCS", "Fellow Royal College Surgeons", 3),
]

DOCTORS = [
    ("drshahid", "Shahid", "Khan", "MCI/2008/12345", ["CARDIO"], ["MBBS", "MD", "DM"], "CARDIO", 18, ["English", "Hindi", "Urdu"]),
    ("drpriya", "Priya", "Sharma", "MCI/2010/22341", ["PEDIA"], ["MBBS", "MD"], "PEDIATRIC", 14, ["English", "Hindi"]),
    ("drrohan", "Rohan", "Verma", "MCI/2005/19023", ["ORTHO"], ["MBBS", "MS"], "ORTHO", 22, ["English", "Hindi", "Punjabi"]),
    ("drmeera", "Meera", "Iyer", "MCI/2012/45678", ["OBGY"], ["MBBS", "MD"], "OBGY", 12, ["English", "Hindi", "Tamil"]),
    ("drasif", "Asif", "Hussain", "MCI/2015/77891", ["GENMED"], ["MBBS", "MD"], "OPD", 9, ["English", "Hindi", "Urdu"]),
]

# Notification templates - DLT-approved style placeholders
TEMPLATES = [
    {
        "code": "APPOINTMENT_BOOKED",
        "name": "Appointment Booked Confirmation",
        "channel": "SMS",
        "body": ("Dear {patient_name}, your appointment with Dr. {doctor_name} "
                 "is booked for {date} at {time}. Ref: {code}. - City General Hospital"),
    },
    {
        "code": "APPOINTMENT_REMINDER",
        "name": "Appointment Reminder",
        "channel": "SMS",
        "body": ("Reminder: {patient_name}, your appointment with Dr. {doctor_name} "
                 "is tomorrow at {time}. Please arrive 15 min early. - City General Hospital"),
    },
    {
        "code": "OTP_VERIFY",
        "name": "OTP for Patient Portal",
        "channel": "SMS",
        "body": "Your OTP is {otp}. Valid for 5 minutes. Do not share. - City General Hospital",
    },
    {
        "code": "PAYMENT_RECEIVED",
        "name": "Payment Receipt",
        "channel": "SMS",
        "body": ("Payment of ₹{amount} received for {service}. Bill: {bill_no}. "
                 "Thank you. - City General Hospital"),
    },
    {
        "code": "PRESCRIPTION_READY",
        "name": "Prescription Ready",
        "channel": "SMS",
        "body": ("{patient_name}, your prescription from Dr. {doctor_name} is ready. "
                 "View at: {url} - City General Hospital"),
    },
]

SAMPLE_PATIENTS = [
    ("Ramesh", "Kumar", "1985-03-12", "M", "B+", "+919876500001", "Ghaziabad", "Penicillin"),
    ("Sunita", "Devi", "1972-07-25", "F", "O+", "+919876500002", "Delhi", ""),
    ("Aarav", "Mehta", "2018-11-30", "M", "A+", "+919876500003", "Noida", "Peanuts"),
    ("Fatima", "Begum", "1991-05-18", "F", "AB+", "+919876500004", "Ghaziabad", ""),
    ("Vikram", "Singh", "1968-01-09", "M", "O-", "+919876500005", "Modinagar", "Sulfa"),
    ("Priyanka", "Gupta", "1995-09-14", "F", "B+", "+919876500006", "Ghaziabad", ""),
    ("Mohammed", "Akhtar", "1980-12-03", "M", "A-", "+919876500007", "Delhi", ""),
    ("Lakshmi", "Iyer", "1956-04-22", "F", "B-", "+919876500008", "Faridabad", "Aspirin"),
    ("Karan", "Bhatia", "2002-08-17", "M", "O+", "+919876500009", "Ghaziabad", ""),
    ("Neha", "Reddy", "1988-06-05", "F", "A+", "+919876500010", "Noida", ""),
]


class Command(BaseCommand):
    help = "Seed Phase 1a sample data."

    def add_arguments(self, parser):
        parser.add_argument("--reset", action="store_true",
            help="Wipe Phase 1 data (specialties, doctors, appointments, etc.) first")

    @transaction.atomic
    def handle(self, *args, **opts):
        hospital = Hospital.objects.filter(
            code=settings.HMS_DEFAULT_HOSPITAL_CODE
        ).first()
        if not hospital:
            self.stdout.write(self.style.ERROR(
                "No default hospital found. Run seed_initial first."
            ))
            return

        if opts["reset"]:
            self.stdout.write(self.style.WARNING("Resetting Phase 1a data..."))
            Appointment.objects.filter(hospital=hospital).delete()
            ConsultationFee.objects.filter(hospital=hospital).delete()
            OPDSlot.objects.filter(hospital=hospital).delete()
            OnCallRoster.objects.filter(hospital=hospital).delete()
            Doctor.objects.filter(hospital=hospital).delete()
            User.objects.filter(
                hospital=hospital, designation="Doctor"
            ).delete()
            Specialty.objects.filter(hospital=hospital).delete()
            Qualification.objects.filter(hospital=hospital).delete()
            NotificationTemplate.objects.filter(hospital=hospital).delete()

        # 1. Specialties
        spec_map = {}
        for code, name, icon in SPECIALTIES:
            s, _ = Specialty.objects.get_or_create(
                hospital=hospital, code=code,
                defaults={"name": name, "icon": icon},
            )
            spec_map[code] = s
        self.stdout.write(self.style.SUCCESS(f"Specialties: {len(spec_map)}"))

        # 2. Qualifications
        qual_map = {}
        for code, name, rank in QUALIFICATIONS:
            q, _ = Qualification.objects.get_or_create(
                hospital=hospital, code=code,
                defaults={"name": name, "rank": rank},
            )
            qual_map[code] = q
        self.stdout.write(self.style.SUCCESS(f"Qualifications: {len(qual_map)}"))

        # 3. Doctors (with User + slots + fees + role)
        doctor_role = Role.objects.filter(code="DOCTOR").first()
        for username, fn, ln, regno, specs, quals, dept_code, exp, langs in DOCTORS:
            user, created = User.objects.get_or_create(
                username=username,
                defaults={
                    "first_name": fn, "last_name": ln,
                    "email": f"{username}@hospital.local",
                    "phone": "+91987600" + str(random.randint(1000, 9999)),
                    "employee_code": f"EMP-{username[2:].upper()}",
                    "designation": "Doctor",
                    "hospital": hospital,
                    "must_change_password": True,
                },
            )
            if created:
                user.set_password("Password@123")
                user.save()
                if doctor_role:
                    UserRole.objects.create(user=user, role=doctor_role)

            dept = Department.objects.filter(hospital=hospital, code=dept_code).first()
            doctor, _ = Doctor.objects.get_or_create(
                user=user,
                defaults={
                    "hospital": hospital,
                    "registration_number": regno,
                    "primary_department": dept,
                    "years_of_experience": exp,
                    "languages": langs,
                    "bio": f"Dr. {fn} {ln}, {exp}+ years experience.",
                },
            )
            doctor.specialties.set([spec_map[s] for s in specs])
            doctor.qualifications.set([qual_map[q] for q in quals])

            # Weekly OPD slots: Mon, Wed, Fri 9-1, Tue & Thu 4-8
            opd_loc = Location.objects.filter(
                hospital=hospital, location_type="OPD"
            ).first()
            slot_config = [
                (0, time(9, 0), time(13, 0)),
                (2, time(9, 0), time(13, 0)),
                (4, time(9, 0), time(13, 0)),
                (1, time(16, 0), time(20, 0)),
                (3, time(16, 0), time(20, 0)),
            ]
            for dow, start, end in slot_config:
                OPDSlot.objects.get_or_create(
                    hospital=hospital, doctor=doctor,
                    day_of_week=dow, start_time=start,
                    location=opd_loc,
                    defaults={
                        "end_time": end, "slot_duration_minutes": 15,
                        "max_patients": 16,
                    },
                )

            # Fees - new vs follow-up
            base_fee = 500 + (exp * 25)
            ConsultationFee.objects.get_or_create(
                hospital=hospital, doctor=doctor, visit_type="NEW",
                valid_from=date.today(),
                defaults={"amount": base_fee, "follow_up_window_days": 7},
            )
            ConsultationFee.objects.get_or_create(
                hospital=hospital, doctor=doctor, visit_type="FOLLOWUP",
                valid_from=date.today(),
                defaults={"amount": base_fee // 2, "follow_up_window_days": 7},
            )
            ConsultationFee.objects.get_or_create(
                hospital=hospital, doctor=doctor, visit_type="EMERGENCY",
                valid_from=date.today(),
                defaults={"amount": base_fee * 2, "follow_up_window_days": 0},
            )
        self.stdout.write(self.style.SUCCESS(f"Doctors: {Doctor.objects.filter(hospital=hospital).count()}"))

        # 4. Notification templates
        for tpl in TEMPLATES:
            NotificationTemplate.objects.get_or_create(
                hospital=hospital, code=tpl["code"], channel=tpl["channel"],
                defaults={
                    "name": tpl["name"], "body": tpl["body"],
                    "subject": tpl.get("subject", ""), "is_active": True,
                },
            )
        self.stdout.write(self.style.SUCCESS(
            f"Notification templates: {NotificationTemplate.objects.filter(hospital=hospital).count()}"
        ))

        # 5. Sample patients
        for fn, ln, dob, gender, blood, phone, city, allergies in SAMPLE_PATIENTS:
            if Patient.objects.filter(hospital=hospital, phone=phone).exists():
                continue
            allergy_list = ([{"substance": allergies, "severity": "high"}]
                            if allergies else [])
            p = Patient(
                hospital=hospital, first_name=fn, last_name=ln,
                dob=date.fromisoformat(dob), gender=gender, blood_group=blood,
                phone=phone, city=city, state="Uttar Pradesh", country="India",
                allergies=allergy_list,
            )
            p.mrn = Patient.generate_mrn(hospital)
            p.save()
        self.stdout.write(self.style.SUCCESS(
            f"Patients (total): {Patient.objects.filter(hospital=hospital).count()}"
        ))

        # 6. Sample appointments for the next 3 days
        doctors = list(Doctor.objects.filter(hospital=hospital))
        patients = list(Patient.objects.filter(hospital=hospital)[:10])
        if doctors and patients:
            for offset in range(3):
                target = date.today() + timedelta(days=offset)
                # Skip if past 1 PM today
                if offset == 0 and timezone.localtime().hour >= 13:
                    continue
                for i, p in enumerate(patients[:5]):
                    doc = doctors[i % len(doctors)]
                    appt_time = time(10 + (i % 3), 0)
                    code = Appointment.generate_code(hospital, target)
                    Appointment.objects.get_or_create(
                        hospital=hospital, code=code,
                        defaults={
                            "patient": p, "doctor": doc,
                            "scheduled_date": target, "scheduled_time": appt_time,
                            "visit_type": "NEW",
                            "source": random.choice(["WALK_IN", "PHONE", "ONLINE"]),
                            "reason": "General check-up",
                            "status": "BOOKED",
                        },
                    )
        self.stdout.write(self.style.SUCCESS(
            f"Appointments (total): {Appointment.objects.filter(hospital=hospital).count()}"
        ))

        # 7. On-call: today + tomorrow
        if doctors:
            for offset in range(2):
                target = date.today() + timedelta(days=offset)
                doc = doctors[offset % len(doctors)]
                OnCallRoster.objects.get_or_create(
                    hospital=hospital, doctor=doc, date=target, shift="NIGHT",
                    defaults={"notes": "Auto-seeded"},
                )

        self.stdout.write(self.style.SUCCESS("\n✓ Phase 1a seed complete."))
        self.stdout.write("  Doctor logins: drshahid / drpriya / drrohan / drmeera / drasif")
        self.stdout.write("  Password (all): Password@123")
