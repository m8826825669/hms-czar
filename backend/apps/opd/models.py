"""OPD (Out-Patient Department) module models.

Vitals               : recorded by nurse before consultation
Consultation         : doctor's encounter, links patient + appointment + queue token + vitals
ConsultationDiagnosis: ICD-10-tagged diagnoses (multiple per consultation)
DrugMaster           : pharmacy master drug catalog
Prescription         : signed prescription header (one per consultation typically)
PrescriptionItem     : individual drug lines
"""
from decimal import Decimal
import uuid
from django.db import models
from django.utils import timezone
from apps.core.models import TenantBaseModel


class Vitals(TenantBaseModel):
    """Patient vitals captured at OPD intake (by nurse) or during ward rounds."""
    patient = models.ForeignKey("core.Patient", on_delete=models.PROTECT,
                                related_name="vitals_records")
    queue_token = models.OneToOneField(
        "reception.QueueToken", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="vitals",
    )
    recorded_at = models.DateTimeField(default=timezone.now, db_index=True)

    # Standard vitals
    temperature_c = models.DecimalField(max_digits=4, decimal_places=1,
                                        null=True, blank=True,
                                        help_text="In °C")
    pulse_bpm = models.PositiveSmallIntegerField(null=True, blank=True)
    bp_systolic = models.PositiveSmallIntegerField(null=True, blank=True)
    bp_diastolic = models.PositiveSmallIntegerField(null=True, blank=True)
    spo2_percent = models.PositiveSmallIntegerField(null=True, blank=True,
        help_text="SpO₂ in percent")
    respiration_rate = models.PositiveSmallIntegerField(null=True, blank=True,
        help_text="Breaths per minute")
    weight_kg = models.DecimalField(max_digits=5, decimal_places=2,
                                    null=True, blank=True)
    height_cm = models.DecimalField(max_digits=5, decimal_places=2,
                                    null=True, blank=True)
    bmi = models.DecimalField(max_digits=5, decimal_places=2,
                              null=True, blank=True,
                              help_text="Auto-computed from weight/height")
    blood_glucose_mgdl = models.PositiveSmallIntegerField(null=True, blank=True,
        help_text="Random/fasting blood glucose mg/dL")
    pain_score = models.PositiveSmallIntegerField(null=True, blank=True,
        help_text="0–10 numeric rating scale")
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-recorded_at"]
        indexes = [models.Index(fields=["patient", "-recorded_at"])]
        verbose_name_plural = "Vitals"

    def __str__(self):
        return f"Vitals {self.patient} @ {self.recorded_at:%Y-%m-%d %H:%M}"

    def save(self, *args, **kwargs):
        # Auto-compute BMI if weight + height given
        if self.weight_kg and self.height_cm and self.height_cm > 0:
            h_m = float(self.height_cm) / 100
            self.bmi = round(Decimal(float(self.weight_kg) / (h_m * h_m)), 2)
        super().save(*args, **kwargs)

    @property
    def bp_text(self):
        if self.bp_systolic and self.bp_diastolic:
            return f"{self.bp_systolic}/{self.bp_diastolic}"
        return ""


class Consultation(TenantBaseModel):
    """A doctor's encounter with a patient. Links upstream (appointment, queue) and
    downstream (diagnoses, prescriptions)."""
    STATUSES = [
        ("DRAFT", "Draft"),
        ("IN_PROGRESS", "In progress"),
        ("COMPLETED", "Completed"),
        ("CANCELLED", "Cancelled"),
    ]

    code = models.CharField(max_length=20, db_index=True,
                            help_text="Auto e.g., CONS-20260507-0001")
    patient = models.ForeignKey("core.Patient", on_delete=models.PROTECT,
                                related_name="consultations")
    doctor = models.ForeignKey("specialist.Doctor", on_delete=models.PROTECT,
                               related_name="consultations")
    appointment = models.ForeignKey(
        "reception.Appointment", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="consultations",
    )
    queue_token = models.OneToOneField(
        "reception.QueueToken", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="consultation",
    )
    vitals = models.ForeignKey(Vitals, on_delete=models.SET_NULL,
                               null=True, blank=True, related_name="consultations")
    consultation_date = models.DateField(default=timezone.now, db_index=True)

    # SOAP-like notes
    chief_complaint = models.TextField(blank=True,
        help_text="Patient's main complaint, in their words")
    history_of_present_illness = models.TextField(blank=True,
        help_text="HPI - timeline, severity, modifying factors")
    past_medical_history = models.TextField(blank=True,
        help_text="Previous illnesses, surgeries, hospitalizations")
    examination_findings = models.TextField(blank=True,
        help_text="Doctor's physical exam findings")
    investigations_advised = models.TextField(blank=True,
        help_text="Lab tests, imaging recommended")
    general_advice = models.TextField(blank=True,
        help_text="Diet, lifestyle, return precautions")
    next_visit_date = models.DateField(null=True, blank=True)

    status = models.CharField(max_length=12, choices=STATUSES, default="DRAFT", db_index=True)
    started_at = models.DateTimeField(null=True, blank=True)
    ended_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = [("hospital", "code")]
        ordering = ["-consultation_date", "-started_at"]
        indexes = [
            models.Index(fields=["patient", "-consultation_date"]),
            models.Index(fields=["doctor", "consultation_date"]),
        ]

    def __str__(self):
        return f"{self.code} - {self.patient} → {self.doctor}"

    @classmethod
    def generate_code(cls, hospital, on_date) -> str:
        prefix = f"CONS-{on_date.strftime('%Y%m%d')}-"
        last = cls.objects.filter(
            hospital=hospital, code__startswith=prefix
        ).order_by("-code").first()
        next_num = 1
        if last:
            try:
                next_num = int(last.code.split("-")[-1]) + 1
            except ValueError:
                pass
        return f"{prefix}{str(next_num).zfill(4)}"


class ConsultationDiagnosis(TenantBaseModel):
    """ICD-10 tagged diagnosis. Multiple allowed per consultation
    (primary + secondary + differential)."""
    DIAGNOSIS_TYPES = [
        ("PROVISIONAL", "Provisional"),
        ("CONFIRMED", "Confirmed"),
        ("DIFFERENTIAL", "Differential"),
        ("FINAL", "Final"),
    ]
    consultation = models.ForeignKey(Consultation, on_delete=models.CASCADE,
                                     related_name="diagnoses")
    icd10_code = models.CharField(max_length=10, blank=True, db_index=True,
        help_text="WHO ICD-10 code, e.g., I10 (essential hypertension)")
    diagnosis_text = models.CharField(max_length=300,
        help_text="Free-text diagnosis name")
    diagnosis_type = models.CharField(max_length=15, choices=DIAGNOSIS_TYPES,
                                      default="PROVISIONAL")
    is_primary = models.BooleanField(default=False)
    notes = models.TextField(blank=True)
    order_index = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["consultation", "-is_primary", "order_index"]
        verbose_name_plural = "Consultation diagnoses"


class DrugMaster(TenantBaseModel):
    """Pharmacy master drug catalog. Used by prescription builder + Phase 1c
    pharmacy module."""
    DOSAGE_FORMS = [
        ("TABLET", "Tablet"),
        ("CAPSULE", "Capsule"),
        ("SYRUP", "Syrup"),
        ("INJECTION", "Injection"),
        ("OINTMENT", "Ointment"),
        ("CREAM", "Cream"),
        ("DROPS", "Drops"),
        ("INHALER", "Inhaler"),
        ("LOTION", "Lotion"),
        ("POWDER", "Powder"),
        ("SUPPOSITORY", "Suppository"),
        ("SPRAY", "Spray"),
        ("OTHER", "Other"),
    ]
    code = models.CharField(max_length=30, db_index=True,
        help_text="Internal SKU code")
    generic_name = models.CharField(max_length=200, db_index=True)
    brand_name = models.CharField(max_length=200, blank=True, db_index=True)
    dosage_form = models.CharField(max_length=15, choices=DOSAGE_FORMS, default="TABLET")
    strength = models.CharField(max_length=50,
        help_text="e.g. 500mg, 5mg/5ml")
    manufacturer = models.CharField(max_length=200, blank=True)
    hsn_code = models.CharField(max_length=8, blank=True,
        help_text="HSN for GST billing")
    gst_rate = models.DecimalField(max_digits=5, decimal_places=2,
                                   default=Decimal("12.00"),
                                   help_text="GST % on this drug")
    is_schedule_h = models.BooleanField(default=False,
        help_text="Schedule H/H1 - controlled substance")
    common_dose = models.CharField(max_length=100, blank=True,
        help_text="Default suggestion, e.g., '1 tab BD after meals'")

    class Meta:
        unique_together = [("hospital", "code")]
        ordering = ["generic_name"]
        indexes = [
            models.Index(fields=["generic_name"]),
            models.Index(fields=["brand_name"]),
        ]

    def __str__(self):
        b = f" ({self.brand_name})" if self.brand_name else ""
        return f"{self.generic_name} {self.strength}{b}"

    @property
    def display_name(self):
        if self.brand_name:
            return f"{self.brand_name} ({self.generic_name})"
        return self.generic_name


class Prescription(TenantBaseModel):
    """Prescription - typically one per consultation. Has a UUID for QR encoding."""
    code = models.CharField(max_length=20, db_index=True,
        help_text="Auto e.g., RX-20260507-0001")
    prescription_uuid = models.UUIDField(default=uuid.uuid4, unique=True, editable=False,
        help_text="Encoded in QR for public patient view")

    consultation = models.ForeignKey(Consultation, on_delete=models.SET_NULL,
                                     null=True, blank=True,
                                     related_name="prescriptions")
    patient = models.ForeignKey("core.Patient", on_delete=models.PROTECT,
                                related_name="prescriptions")
    doctor = models.ForeignKey("specialist.Doctor", on_delete=models.PROTECT,
                               related_name="prescriptions")
    prescribed_at = models.DateTimeField(default=timezone.now, db_index=True)

    general_instructions = models.TextField(blank=True,
        help_text="Diet, follow-up, when to return")
    next_followup_days = models.PositiveSmallIntegerField(null=True, blank=True)

    is_signed = models.BooleanField(default=False,
        help_text="Doctor has signed via PIN (Phase 1c)")
    signed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = [("hospital", "code")]
        ordering = ["-prescribed_at"]
        indexes = [models.Index(fields=["patient", "-prescribed_at"])]

    def __str__(self):
        return f"{self.code} ({self.patient})"

    @classmethod
    def generate_code(cls, hospital, on_date) -> str:
        prefix = f"RX-{on_date.strftime('%Y%m%d')}-"
        last = cls.objects.filter(
            hospital=hospital, code__startswith=prefix
        ).order_by("-code").first()
        next_num = 1
        if last:
            try:
                next_num = int(last.code.split("-")[-1]) + 1
            except ValueError:
                pass
        return f"{prefix}{str(next_num).zfill(4)}"


class PrescriptionItem(TenantBaseModel):
    """Individual drug line in a prescription."""
    ROUTES = [
        ("ORAL", "Oral"),
        ("IV", "Intravenous"),
        ("IM", "Intramuscular"),
        ("SC", "Subcutaneous"),
        ("TOPICAL", "Topical"),
        ("INHALATION", "Inhalation"),
        ("OPHTHALMIC", "Ophthalmic"),
        ("NASAL", "Nasal"),
        ("RECTAL", "Rectal"),
        ("OTHER", "Other"),
    ]

    prescription = models.ForeignKey(Prescription, on_delete=models.CASCADE,
                                     related_name="items")
    drug = models.ForeignKey(DrugMaster, on_delete=models.SET_NULL,
                             null=True, blank=True,
                             help_text="Optional - allows free-text Rx items")
    drug_name = models.CharField(max_length=200,
        help_text="Denormalized name (in case drug master entry is renamed/deleted)")
    dose = models.CharField(max_length=50,
        help_text="e.g., 500mg, 1 tab, 10ml")
    frequency = models.CharField(max_length=30,
        help_text="OD/BD/TDS/QID/HS/SOS/STAT or free text")
    duration_days = models.PositiveSmallIntegerField(default=5)
    route = models.CharField(max_length=12, choices=ROUTES, default="ORAL")
    instructions = models.CharField(max_length=200, blank=True,
        help_text="Before food, with milk, etc.")
    is_continued = models.BooleanField(default=False,
        help_text="Patient is already on this medication")
    order_index = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["prescription", "order_index"]

    def __str__(self):
        return f"{self.drug_name} {self.dose} {self.frequency}"
