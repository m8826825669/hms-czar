"""
Vaccination module — Phase 4c.

Models:
  • Vaccine                  — vaccine master (BCG, OPV, DPT, MMR, COVID, Flu...)
  • ImmunizationSchedule     — age-based recommendation per vaccine
  • VaccinationRecord        — administered dose record
  • VaccinationCertificate   — auto-generated certificate per dose
"""
from decimal import Decimal
from django.db import models
from django.utils import timezone


class Vaccine(models.Model):
    VACCINE_TYPES = [
        ("PAEDIATRIC", "Paediatric / Child"),
        ("ADULT",      "Adult"),
        ("BOTH",       "Both"),
        ("TRAVEL",     "Travel"),
        ("SEASONAL",   "Seasonal (Flu)"),
        ("PANDEMIC",   "Pandemic (COVID)"),
    ]
    hospital = models.ForeignKey("core.Hospital", on_delete=models.CASCADE,
                                  related_name="vaccines")
    code = models.CharField(max_length=20, db_index=True)
    name = models.CharField(max_length=120)
    full_name = models.CharField(max_length=200, blank=True, default="")
    vaccine_type = models.CharField(max_length=12, choices=VACCINE_TYPES,
                                       default="PAEDIATRIC")
    manufacturer = models.CharField(max_length=120, blank=True, default="")
    doses_required = models.PositiveIntegerField(default=1)
    booster_required = models.BooleanField(default=False)
    booster_interval_months = models.PositiveIntegerField(default=0)

    route_of_administration = models.CharField(max_length=30, blank=True, default="",
        help_text="e.g. IM, SC, Oral, Intranasal")
    standard_dose_ml = models.DecimalField(max_digits=4, decimal_places=2,
                                              default=Decimal("0.5"))
    is_under_uip = models.BooleanField(default=False,
        help_text="Under Universal Immunization Programme (free)")
    standard_price = models.DecimalField(max_digits=10, decimal_places=2,
                                            default=Decimal("0"))
    description = models.TextField(blank=True, default="")
    contraindications = models.TextField(blank=True, default="")
    side_effects = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["code"]
        unique_together = [["hospital", "code"]]

    def __str__(self):
        return f"{self.code} — {self.name}"


class ImmunizationSchedule(models.Model):
    AGE_UNITS = [
        ("BIRTH",  "At Birth"),
        ("WEEK",   "Weeks"),
        ("MONTH",  "Months"),
        ("YEAR",   "Years"),
    ]

    vaccine = models.ForeignKey(Vaccine, on_delete=models.CASCADE,
                                   related_name="schedule")
    dose_number = models.PositiveIntegerField()
    age_value = models.PositiveIntegerField(default=0,
        help_text="0 for birth")
    age_unit = models.CharField(max_length=10, choices=AGE_UNITS, default="MONTH")
    description = models.CharField(max_length=200, blank=True, default="",
        help_text="e.g. 'OPV-0 at birth', 'DPT-1 at 6 weeks'")

    class Meta:
        ordering = ["age_unit", "age_value"]
        unique_together = [["vaccine", "dose_number"]]


class VaccinationRecord(models.Model):
    STATUSES = [
        ("SCHEDULED",  "Scheduled"),
        ("ADMINISTERED","Administered"),
        ("MISSED",     "Missed"),
        ("REFUSED",    "Refused"),
        ("DEFERRED",   "Deferred (Medical)"),
    ]

    hospital = models.ForeignKey("core.Hospital", on_delete=models.CASCADE,
                                  related_name="vaccination_records")
    patient = models.ForeignKey("reception.Patient", on_delete=models.CASCADE,
                                   related_name="vaccinations")
    vaccine = models.ForeignKey(Vaccine, on_delete=models.PROTECT,
                                   related_name="records")
    dose_number = models.PositiveIntegerField(default=1)

    scheduled_date = models.DateField(null=True, blank=True)
    administered_date = models.DateField(null=True, blank=True)
    next_dose_date = models.DateField(null=True, blank=True)

    status = models.CharField(max_length=12, choices=STATUSES, default="SCHEDULED",
                                db_index=True)

    batch_number = models.CharField(max_length=50, blank=True, default="")
    expiry_date = models.DateField(null=True, blank=True)
    administered_by = models.ForeignKey("accounts.User", on_delete=models.SET_NULL,
                                           null=True, blank=True,
                                           related_name="vaccines_administered")
    administrator_name = models.CharField(max_length=120, blank=True, default="")
    site_of_injection = models.CharField(max_length=50, blank=True, default="",
        help_text="e.g. 'Right Deltoid', 'Left Thigh'")

    adverse_reactions = models.TextField(blank=True, default="")
    notes = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-administered_date", "scheduled_date"]
        indexes = [
            models.Index(fields=["patient", "vaccine"]),
            models.Index(fields=["status", "scheduled_date"]),
        ]
        unique_together = [["patient", "vaccine", "dose_number"]]


class VaccinationCertificate(models.Model):
    record = models.OneToOneField(VaccinationRecord, on_delete=models.CASCADE,
                                     related_name="certificate")
    certificate_number = models.CharField(max_length=40, unique=True, db_index=True,
        help_text="Auto-generated, e.g. VC-20260508-0001")
    issued_at = models.DateTimeField(auto_now_add=True)
    certificate_url = models.URLField(blank=True, default="",
        help_text="PDF URL if generated externally")
    verification_code = models.CharField(max_length=20, blank=True, default="")

    class Meta:
        ordering = ["-issued_at"]
