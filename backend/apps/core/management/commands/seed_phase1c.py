"""Seed Phase 1c sample data:
- 30 services in the catalog (consultations, labs, procedures, room rents)
- 50 patients with realistic Indian names + mixed allergies/chronic conditions
- ~30 appointments spread across past/today/future
- Sample completed consultations with diagnoses + prescriptions
- Sample invoices in various statuses

Run after Phase 1b seed:
    python manage.py seed_phase1c
"""
import random
from datetime import date, datetime, time, timedelta
from decimal import Decimal

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.core.models import Hospital, Patient
from apps.specialist.models import Doctor
from apps.reception.models import Appointment, QueueToken
from apps.opd.models import (Vitals, Consultation, ConsultationDiagnosis,
                             DrugMaster, Prescription, PrescriptionItem)
from apps.billing.models import ServiceCatalog, Invoice, InvoiceItem, Payment


# ─── 30 Services for an Indian OPD/IPD ─────────────────
SERVICES = [
    # Consultations
    ("CONS-GEN", "General Physician Consultation", "CONSULTATION", 500, "998311", "0", False),
    ("CONS-CARDIO", "Cardiologist Consultation", "CONSULTATION", 1200, "998311", "0", False),
    ("CONS-ORTHO", "Orthopaedic Consultation", "CONSULTATION", 800, "998311", "0", False),
    ("CONS-PEDIA", "Pediatrician Consultation", "CONSULTATION", 700, "998311", "0", False),
    ("CONS-DERMA", "Dermatologist Consultation", "CONSULTATION", 800, "998311", "0", False),
    ("CONS-FOLLOWUP", "Follow-up Consultation", "CONSULTATION", 200, "998311", "0", False),

    # Investigations / Labs
    ("CBC", "Complete Blood Count (CBC)", "INVESTIGATION", 300, "9993", "5", True),
    ("LFT", "Liver Function Test (LFT)", "INVESTIGATION", 600, "9993", "5", True),
    ("KFT", "Kidney Function Test (KFT)", "INVESTIGATION", 500, "9993", "5", True),
    ("LIPID", "Lipid Profile", "INVESTIGATION", 700, "9993", "5", True),
    ("FBS", "Fasting Blood Sugar", "INVESTIGATION", 80, "9993", "5", True),
    ("HBA1C", "HbA1c (Glycated Haemoglobin)", "INVESTIGATION", 450, "9993", "5", True),
    ("URINE-RE", "Urine Routine Examination", "INVESTIGATION", 150, "9993", "5", True),
    ("TFT", "Thyroid Function Test (T3/T4/TSH)", "INVESTIGATION", 600, "9993", "5", True),
    ("VIT-D", "Vitamin D 25-OH", "INVESTIGATION", 1200, "9993", "5", True),

    # Imaging
    ("XRAY-CHEST", "X-Ray Chest PA View", "INVESTIGATION", 350, "9993", "5", True),
    ("XRAY-KNEE", "X-Ray Knee AP/Lat", "INVESTIGATION", 400, "9993", "5", True),
    ("USG-ABD", "Ultrasound Abdomen", "INVESTIGATION", 1500, "9993", "5", True),
    ("ECG", "ECG (12-lead)", "INVESTIGATION", 250, "9993", "5", True),
    ("ECHO", "Echocardiography (2D)", "INVESTIGATION", 2200, "9993", "5", True),
    ("MRI-BRAIN", "MRI Brain (Plain)", "INVESTIGATION", 6500, "9993", "5", True),

    # Procedures
    ("DRESSING", "Wound Dressing", "PROCEDURE", 200, "9993", "5", True),
    ("SUTURE", "Suturing (Minor)", "PROCEDURE", 800, "9993", "5", True),
    ("INJ-IM", "IM Injection (Service Charge)", "PROCEDURE", 100, "9993", "5", True),
    ("INJ-IV", "IV Injection / Cannulation", "PROCEDURE", 150, "9993", "5", True),
    ("NEBULIZATION", "Nebulization (per session)", "PROCEDURE", 200, "9993", "5", True),
    ("VACCINATION", "Vaccination (Service)", "PROCEDURE", 100, "9993", "5", True),

    # Rooms
    ("ROOM-GEN", "General Ward (per day)", "ROOM", 1500, "9963", "0", False),
    ("ROOM-PVT", "Private Room (per day)", "ROOM", 4500, "9963", "12", True),
    ("ROOM-ICU", "ICU (per day)", "ROOM", 12000, "9963", "12", True),
]

# ─── 50 Indian patients ─────────────────────────────────
FIRST_NAMES_M = [
    "Aarav", "Arjun", "Vihaan", "Vivaan", "Aditya", "Reyansh", "Kabir", "Krishna",
    "Ishaan", "Rohan", "Pranav", "Yash", "Aryan", "Karan", "Rahul", "Nikhil",
    "Ankit", "Vikram", "Suresh", "Ramesh", "Mohammad", "Imran", "Asif",
]
FIRST_NAMES_F = [
    "Saanvi", "Aanya", "Aadhya", "Anika", "Pari", "Kavya", "Diya", "Riya",
    "Priya", "Pooja", "Sneha", "Neha", "Anjali", "Meera", "Sunita", "Rekha",
    "Lakshmi", "Geeta", "Fatima", "Aisha", "Zoya", "Tara", "Ishita",
]
LAST_NAMES = [
    "Sharma", "Verma", "Singh", "Kumar", "Gupta", "Mishra", "Pandey", "Yadav",
    "Tiwari", "Agarwal", "Jain", "Patel", "Mehta", "Shah", "Reddy", "Iyer",
    "Nair", "Pillai", "Khan", "Ahmed", "Ali", "Hussain", "Das", "Banerjee",
    "Chatterjee", "Mukherjee", "Roy",
]
CITIES = [
    ("Ghaziabad", "Uttar Pradesh", "201001"),
    ("Noida", "Uttar Pradesh", "201301"),
    ("Delhi", "Delhi", "110001"),
    ("Gurgaon", "Haryana", "122001"),
    ("Faridabad", "Haryana", "121001"),
    ("Meerut", "Uttar Pradesh", "250001"),
    ("Lucknow", "Uttar Pradesh", "226001"),
]
ALLERGY_OPTIONS = [
    {"substance": "Penicillin", "severity": "moderate"},
    {"substance": "Sulfa drugs", "severity": "mild"},
    {"substance": "Peanuts", "severity": "severe"},
    {"substance": "Dust mites", "severity": "mild"},
    {"substance": "Aspirin", "severity": "moderate"},
]
CHRONIC_OPTIONS = [
    "Hypertension", "Type 2 Diabetes", "Asthma", "Hypothyroidism",
    "Hyperlipidemia", "GERD", "Osteoarthritis",
]
BLOOD_GROUPS = ["A+", "B+", "O+", "AB+", "A-", "B-", "O-", "AB-"]


# ─── Common diagnoses for sample consults ────────────────
SAMPLE_DIAGNOSES = [
    {"text": "Acute pharyngitis", "icd": "J02.9"},
    {"text": "Viral fever", "icd": "B34.9"},
    {"text": "Essential hypertension", "icd": "I10"},
    {"text": "Type 2 Diabetes Mellitus", "icd": "E11.9"},
    {"text": "Acute gastroenteritis", "icd": "K59.1"},
    {"text": "Migraine, unspecified", "icd": "G43.9"},
    {"text": "Acute upper respiratory infection", "icd": "J06.9"},
    {"text": "Allergic rhinitis", "icd": "J30.9"},
    {"text": "Lumbago (Lower back pain)", "icd": "M54.5"},
    {"text": "Anxiety disorder", "icd": "F41.9"},
]


class Command(BaseCommand):
    help = "Seed Phase 1c: services + 50 patients + sample appointments/consults/invoices."

    def add_arguments(self, parser):
        parser.add_argument("--reset", action="store_true",
            help="Clear sample patients/appts/invoices before seeding")

    @transaction.atomic
    def handle(self, *args, **opts):
        hospital = Hospital.objects.filter(
            code=settings.HMS_DEFAULT_HOSPITAL_CODE
        ).first()
        if not hospital:
            self.stdout.write(self.style.ERROR("Default hospital not found. Run seed_initial first."))
            return

        if opts["reset"]:
            self.stdout.write(self.style.WARNING("Resetting Phase 1c sample data..."))
            # Be careful - only nuke things tagged "phase1c" via notes
            Invoice.objects.filter(notes__contains="[seed1c]").delete()
            Patient.objects.filter(notes__contains="[seed1c]").delete()

        # 1. Services
        self.stdout.write("Seeding services...")
        svc_count = 0
        for code, name, cat, price, hsn, gst, taxable in SERVICES:
            obj, created = ServiceCatalog.objects.update_or_create(
                hospital=hospital, code=code,
                defaults={
                    "name": name, "category": cat, "price": Decimal(price),
                    "hsn_code": hsn, "gst_rate": Decimal(gst),
                    "is_taxable": taxable, "is_active": True,
                },
            )
            if created: svc_count += 1
        self.stdout.write(self.style.SUCCESS(f"  ✓ {svc_count} services created/updated"))

        # 2. Patients
        self.stdout.write("Seeding 50 patients...")
        rng = random.Random(42)  # Reproducible
        existing_patient_count = Patient.objects.filter(hospital=hospital).count()
        target = 50
        new_patients = []

        for i in range(target):
            gender = rng.choice(["M", "F", "M", "F", "F"])  # Slightly more F (typical OPD)
            first = rng.choice(FIRST_NAMES_M if gender == "M" else FIRST_NAMES_F)
            last = rng.choice(LAST_NAMES)
            age = rng.randint(2, 85)
            dob = date.today() - timedelta(days=age * 365 + rng.randint(0, 364))
            city, state, pin = rng.choice(CITIES)
            allergies = rng.sample(ALLERGY_OPTIONS, k=rng.choices([0,0,0,1,1,2], k=1)[0])
            chronic = rng.sample(CHRONIC_OPTIONS, k=rng.choices([0,0,0,1,1,2,3], k=1)[0])
            phone_prefix = rng.choice(["98", "99", "97", "70", "80", "63"])
            phone = f"+91{phone_prefix}{rng.randint(10000000, 99999999)}"
            mrn_suffix = existing_patient_count + i + 1
            mrn = f"MRN{date.today().strftime('%y')}{str(mrn_suffix).zfill(5)}"

            try:
                p = Patient.objects.create(
                    hospital=hospital,
                    mrn=mrn,
                    first_name=first, last_name=last,
                    dob=dob, gender=gender,
                    blood_group=rng.choice(BLOOD_GROUPS),
                    phone=phone,
                    email=f"{first.lower()}.{last.lower()}{i}@example.com" if i % 3 == 0 else "",
                    address_line1=f"H.No. {rng.randint(1, 999)}, Sector {rng.randint(1, 80)}",
                    city=city, state=state, pincode=pin,
                    allergies=allergies, chronic_conditions=chronic,
                    notes="[seed1c] Sample patient",
                )
                new_patients.append(p)
            except Exception:
                continue

        self.stdout.write(self.style.SUCCESS(f"  ✓ {len(new_patients)} patients created"))

        # 3. Appointments + sample consultations
        doctors = list(Doctor.objects.filter(hospital=hospital, is_active=True))
        if not doctors:
            self.stdout.write(self.style.WARNING("No active doctors found. Skipping appts."))
        else:
            self.stdout.write("Creating sample appointments + consults + invoices...")
            today = date.today()
            sample_drugs = list(DrugMaster.objects.filter(hospital=hospital)[:30])
            cons_services = list(ServiceCatalog.objects.filter(
                hospital=hospital, category="CONSULTATION"
            )[:5])
            lab_services = list(ServiceCatalog.objects.filter(
                hospital=hospital, category="INVESTIGATION"
            )[:8])

            appt_count = 0
            cons_count = 0
            inv_count = 0
            for patient in rng.sample(new_patients, min(30, len(new_patients))):
                doctor = rng.choice(doctors)
                # Random offset: -14 to +7 days
                day_offset = rng.randint(-14, 7)
                appt_date = today + timedelta(days=day_offset)
                appt_time = time(rng.randint(9, 17), rng.choice([0, 15, 30, 45]))

                # Determine status by time
                if day_offset < 0:
                    statuses = ["COMPLETED", "COMPLETED", "COMPLETED", "NO_SHOW"]
                    appt_status = rng.choice(statuses)
                elif day_offset == 0:
                    appt_status = rng.choice(["BOOKED", "CHECKED_IN", "COMPLETED"])
                else:
                    appt_status = "BOOKED"

                code = Appointment.generate_code(hospital, appt_date)
                appt = Appointment.objects.create(
                    hospital=hospital,
                    code=code,
                    patient=patient, doctor=doctor,
                    scheduled_date=appt_date, scheduled_time=appt_time,
                    visit_type=rng.choice(["NEW", "FOLLOWUP", "NEW"]),
                    source=rng.choice(["WALK_IN", "PHONE", "ONLINE"]),
                    reason=rng.choice([
                        "Fever and body ache",
                        "Headache, dizziness",
                        "Routine BP/sugar check",
                        "Cough and cold",
                        "Joint pain",
                        "Follow-up visit",
                        "Stomach ache",
                    ]),
                    status=appt_status,
                )
                appt_count += 1

                # If COMPLETED, create a consultation + invoice
                if appt_status == "COMPLETED":
                    started = datetime.combine(appt_date, appt_time)
                    started = timezone.make_aware(started) if timezone.is_naive(started) else started
                    ended = started + timedelta(minutes=rng.randint(10, 25))

                    cons_code = Consultation.generate_code(hospital, appt_date)
                    cons = Consultation.objects.create(
                        hospital=hospital,
                        code=cons_code,
                        patient=patient, doctor=doctor,
                        appointment=appt,
                        consultation_date=appt_date,
                        chief_complaint=appt.reason,
                        history_of_present_illness=rng.choice([
                            "Symptoms started 2-3 days ago, gradually worsening.",
                            "Patient reports onset 1 week back, intermittent.",
                            "Acute onset since morning, getting worse.",
                            "Long-standing complaint, came for review.",
                        ]),
                        examination_findings=rng.choice([
                            "Vitals stable. No acute distress. Systemic exam unremarkable.",
                            "Mild pallor present. Throat congested. Chest clear.",
                            "BP elevated. Heart sounds normal. No edema.",
                            "Patient comfortable. Oriented. Vitals WNL.",
                        ]),
                        general_advice="Plenty of fluids, light diet, rest. Return if symptoms worsen.",
                        status="COMPLETED",
                        started_at=started,
                        ended_at=ended,
                    )
                    cons_count += 1

                    # Add 1-2 diagnoses
                    for j in range(rng.randint(1, 2)):
                        dx = rng.choice(SAMPLE_DIAGNOSES)
                        ConsultationDiagnosis.objects.create(
                            hospital=hospital,
                            consultation=cons,
                            diagnosis_text=dx["text"],
                            icd10_code=dx["icd"],
                            diagnosis_type=rng.choice(["PROVISIONAL", "CONFIRMED"]),
                            is_primary=(j == 0),
                            order_index=j,
                        )

                    # Create prescription
                    rx_code = Prescription.generate_code(hospital, appt_date)
                    rx = Prescription.objects.create(
                        hospital=hospital,
                        code=rx_code,
                        consultation=cons,
                        patient=patient, doctor=doctor,
                        prescribed_at=ended,
                        general_instructions="Take medicines as prescribed. Follow up in 5 days if no improvement.",
                        next_followup_days=rng.choice([5, 7, 14, None, None]),
                    )
                    if sample_drugs:
                        for k, drug in enumerate(rng.sample(sample_drugs, k=rng.randint(2, 4))):
                            PrescriptionItem.objects.create(
                                hospital=hospital,
                                prescription=rx,
                                drug=drug,
                                drug_name=drug.display_name,
                                dose="1 tab" if drug.dosage_form == "TABLET" else "10ml",
                                frequency=rng.choice(["OD", "BD", "TDS", "HS"]),
                                duration_days=rng.choice([3, 5, 7, 10]),
                                route="ORAL",
                                instructions=rng.choice([
                                    "After meals", "Before meals", "With water",
                                    "At bedtime", "",
                                ]),
                                order_index=k,
                            )

                    # Create invoice
                    inv_code = Invoice.generate_code(hospital, appt_date)
                    invoice = Invoice.objects.create(
                        hospital=hospital,
                        code=inv_code,
                        bill_date=appt_date,
                        patient=patient,
                        consultation=cons,
                        appointment=appt,
                        patient_state=patient.state or "",
                        hospital_state=getattr(hospital, "state", ""),
                        gst_split="INTRA",
                        status="DRAFT",
                        notes="[seed1c] Sample invoice",
                    )

                    # Always add a consultation fee
                    if cons_services:
                        svc = cons_services[0]
                        InvoiceItem.objects.create(
                            hospital=hospital,
                            invoice=invoice,
                            service=svc, service_name=svc.name,
                            hsn_code=svc.hsn_code,
                            quantity=Decimal("1"), unit_price=svc.price,
                            gst_rate=svc.gst_rate, order_index=0,
                        )
                    # 30% chance: add an investigation
                    if lab_services and rng.random() < 0.3:
                        svc = rng.choice(lab_services)
                        InvoiceItem.objects.create(
                            hospital=hospital,
                            invoice=invoice,
                            service=svc, service_name=svc.name,
                            hsn_code=svc.hsn_code,
                            quantity=Decimal("1"), unit_price=svc.price,
                            gst_rate=svc.gst_rate, order_index=1,
                        )

                    invoice.recalculate_totals()
                    invoice.status = "PENDING"
                    invoice.save(update_fields=["status"])
                    inv_count += 1

                    # 70% chance: payment recorded (cash)
                    if rng.random() < 0.7:
                        Payment.objects.create(
                            hospital=hospital,
                            invoice=invoice,
                            amount=invoice.total_amount,
                            method=rng.choice(["CASH", "UPI", "CARD"]),
                            status="SUCCESS",
                            received_at=ended + timedelta(minutes=rng.randint(5, 20)),
                            reference="",
                        )
                        invoice.amount_paid = invoice.total_amount
                        invoice.update_payment_status()

            self.stdout.write(self.style.SUCCESS(
                f"  ✓ {appt_count} appointments, {cons_count} consults, {inv_count} invoices"
            ))

        self.stdout.write(self.style.SUCCESS("\n✅ Phase 1c seed complete!"))
        self.stdout.write("\nVerify in admin or UI:")
        self.stdout.write(f"  - Patients:     /api/v1/core/patients/")
        self.stdout.write(f"  - Services:     /api/v1/billing/services/")
        self.stdout.write(f"  - Invoices:     /api/v1/billing/invoices/")
        self.stdout.write(f"  - Today bill:   /api/v1/billing/invoices/today/")
