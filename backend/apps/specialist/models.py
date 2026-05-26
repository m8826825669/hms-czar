"""Specialist (Doctor) module models."""
from django.conf import settings
from django.db import models
from apps.core.models import TenantBaseModel


class Specialty(TenantBaseModel):
    code = models.CharField(max_length=20)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    icon = models.CharField(max_length=50, blank=True, help_text="Lucide icon name")

    class Meta:
        unique_together = [("hospital", "code")]
        ordering = ["name"]
        verbose_name_plural = "Specialties"

    def __str__(self):
        return self.name


class Qualification(TenantBaseModel):
    code = models.CharField(max_length=30)
    name = models.CharField(max_length=100)
    rank = models.PositiveSmallIntegerField(default=0,
        help_text="Higher = senior. MBBS=1, MD=2, DM/MCh=3, FRCS=3")

    class Meta:
        unique_together = [("hospital", "code")]
        ordering = ["-rank", "name"]

    def __str__(self):
        return self.code


class Doctor(TenantBaseModel):
    """One doctor record per User. Extends User with clinical metadata."""
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                                related_name="doctor_profile")
    registration_number = models.CharField(max_length=50, db_index=True,
        help_text="MCI / NMC registration number")
    specialties = models.ManyToManyField(Specialty, related_name="doctors", blank=True)
    qualifications = models.ManyToManyField(Qualification, related_name="doctors", blank=True)
    primary_department = models.ForeignKey("core.Department", on_delete=models.SET_NULL,
                                            null=True, blank=True, related_name="primary_doctors")
    bio = models.TextField(blank=True)
    years_of_experience = models.PositiveSmallIntegerField(default=0)
    languages = models.JSONField(default=list, blank=True,
                                 help_text='["Hindi", "English", "Punjabi"]')
    signature = models.ImageField(upload_to="doctors/signatures/", blank=True, null=True)
    digital_signature_pin = models.CharField(max_length=255, blank=True,
        help_text="Hashed PIN for prescription sign-off (set via separate endpoint)")
    is_consulting = models.BooleanField(default=True,
        help_text="Currently accepting patients")
    on_call = models.BooleanField(default=False, db_index=True,
        help_text="Available for after-hours / emergency calls. Toggled "
                  "from the Specialist roster UI; orthogonal to is_consulting "
                  "which is about routine OPD availability.")

    class Meta:
        ordering = ["user__first_name", "user__last_name"]

    def __str__(self):
        return f"Dr. {self.user.get_full_name()} ({self.registration_number})"

    @property
    def full_name(self):
        return f"Dr. {self.user.get_full_name()}"


class OPDSlot(TenantBaseModel):
    """Weekly recurring OPD slot. Doctor available on day_of_week, start_time-end_time,
    seeing patients in slots of `slot_duration_minutes` each.
    """
    DAYS = [(0, "Mon"), (1, "Tue"), (2, "Wed"), (3, "Thu"),
            (4, "Fri"), (5, "Sat"), (6, "Sun")]

    doctor = models.ForeignKey(Doctor, on_delete=models.CASCADE, related_name="opd_slots")
    location = models.ForeignKey("core.Location", on_delete=models.PROTECT,
                                 limit_choices_to={"location_type__in": ["OPD", "ROOM"]})
    day_of_week = models.PositiveSmallIntegerField(choices=DAYS, db_index=True)
    start_time = models.TimeField()
    end_time = models.TimeField()
    slot_duration_minutes = models.PositiveSmallIntegerField(default=15)
    max_patients = models.PositiveSmallIntegerField(default=20)
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = [("doctor", "day_of_week", "start_time", "location")]
        ordering = ["day_of_week", "start_time"]

    def __str__(self):
        return f"{self.doctor} - {self.get_day_of_week_display()} {self.start_time}-{self.end_time}"


class OPDSlotException(TenantBaseModel):
    """Override regular slot for a specific date - holiday, leave, extra clinic."""
    EXCEPTION_TYPES = [
        ("LEAVE", "Doctor on leave"),
        ("HOLIDAY", "Hospital holiday"),
        ("EXTRA", "Extra clinic"),
        ("MODIFIED", "Modified hours"),
    ]
    doctor = models.ForeignKey(Doctor, on_delete=models.CASCADE, related_name="slot_exceptions")
    date = models.DateField(db_index=True)
    exception_type = models.CharField(max_length=10, choices=EXCEPTION_TYPES)
    start_time = models.TimeField(null=True, blank=True, help_text="For EXTRA/MODIFIED")
    end_time = models.TimeField(null=True, blank=True)
    location = models.ForeignKey("core.Location", on_delete=models.SET_NULL, null=True, blank=True)
    reason = models.CharField(max_length=200, blank=True)

    class Meta:
        unique_together = [("doctor", "date", "exception_type")]
        ordering = ["-date"]


class ConsultationFee(TenantBaseModel):
    """Doctor's consultation fees, per visit type."""
    VISIT_TYPES = [
        ("NEW", "New Patient"),
        ("FOLLOWUP", "Follow-up"),
        ("EMERGENCY", "Emergency"),
        ("TELE", "Tele-consultation"),
    ]
    doctor = models.ForeignKey(Doctor, on_delete=models.CASCADE, related_name="fees")
    visit_type = models.CharField(max_length=10, choices=VISIT_TYPES)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    follow_up_window_days = models.PositiveSmallIntegerField(default=7,
        help_text="Days after a NEW visit during which follow-up applies")
    valid_from = models.DateField()
    valid_to = models.DateField(null=True, blank=True)

    class Meta:
        unique_together = [("doctor", "visit_type", "valid_from")]
        ordering = ["doctor", "visit_type"]

    def __str__(self):
        return f"{self.doctor} - {self.get_visit_type_display()} ₹{self.amount}"


class OnCallRoster(TenantBaseModel):
    """Daily on-call doctor assignments."""
    SHIFTS = [("MORNING", "Morning"), ("EVENING", "Evening"),
              ("NIGHT", "Night"), ("FULL_DAY", "Full Day")]
    doctor = models.ForeignKey(Doctor, on_delete=models.PROTECT, related_name="on_call_assignments")
    department = models.ForeignKey("core.Department", on_delete=models.SET_NULL, null=True, blank=True)
    date = models.DateField(db_index=True)
    shift = models.CharField(max_length=10, choices=SHIFTS, default="FULL_DAY")
    notes = models.CharField(max_length=200, blank=True)

    class Meta:
        unique_together = [("doctor", "date", "shift")]
        ordering = ["-date", "shift"]
