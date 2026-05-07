"""Reception module models.

Appointment   : pre-booked patient visit with a doctor on a specific date+time
QueueToken    : walk-in or appointment-converted token for today's OPD queue
VisitorPass   : non-patient visitor entry tracking with QR
"""
import uuid
from django.db import models
from django.utils import timezone
from apps.core.models import TenantBaseModel


class Appointment(TenantBaseModel):
    STATUSES = [
        ("BOOKED", "Booked"),
        ("CONFIRMED", "Confirmed"),
        ("CHECKED_IN", "Checked-in"),
        ("IN_CONSULT", "In consultation"),
        ("COMPLETED", "Completed"),
        ("NO_SHOW", "No-show"),
        ("CANCELLED", "Cancelled"),
    ]
    VISIT_TYPES = [
        ("NEW", "New Patient"),
        ("FOLLOWUP", "Follow-up"),
        ("EMERGENCY", "Emergency"),
        ("TELE", "Tele-consultation"),
    ]
    SOURCES = [("WALK_IN", "Walk-in"), ("PHONE", "Phone"),
               ("ONLINE", "Online"), ("REFERRAL", "Referral")]

    code = models.CharField(max_length=20, db_index=True,
                            help_text="Auto-generated, e.g., APT-20260507-0001")
    patient = models.ForeignKey("core.Patient", on_delete=models.PROTECT,
                                related_name="appointments")
    doctor = models.ForeignKey("specialist.Doctor", on_delete=models.PROTECT,
                               related_name="appointments")
    location = models.ForeignKey("core.Location", on_delete=models.SET_NULL,
                                 null=True, blank=True)
    scheduled_date = models.DateField(db_index=True)
    scheduled_time = models.TimeField()
    duration_minutes = models.PositiveSmallIntegerField(default=15)
    visit_type = models.CharField(max_length=10, choices=VISIT_TYPES, default="NEW")
    source = models.CharField(max_length=10, choices=SOURCES, default="WALK_IN")
    reason = models.CharField(max_length=300, blank=True)
    status = models.CharField(max_length=12, choices=STATUSES,
                              default="BOOKED", db_index=True)
    checked_in_at = models.DateTimeField(null=True, blank=True)
    consult_started_at = models.DateTimeField(null=True, blank=True)
    consult_ended_at = models.DateTimeField(null=True, blank=True)
    cancelled_reason = models.CharField(max_length=200, blank=True)

    class Meta:
        unique_together = [("hospital", "code")]
        indexes = [
            models.Index(fields=["scheduled_date", "doctor"]),
            models.Index(fields=["patient", "-scheduled_date"]),
        ]
        ordering = ["-scheduled_date", "scheduled_time"]

    def __str__(self):
        return f"{self.code} - {self.patient} → {self.doctor} on {self.scheduled_date}"

    @classmethod
    def generate_code(cls, hospital, on_date) -> str:
        prefix = f"APT-{on_date.strftime('%Y%m%d')}-"
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


class QueueToken(TenantBaseModel):
    """Today's OPD queue. May be walk-in (no appointment) or auto-generated
    when an appointment is checked in."""
    STATUSES = [
        ("WAITING", "Waiting"),
        ("IN_VITALS", "Vitals being taken"),
        ("IN_CONSULT", "In consultation"),
        ("DONE", "Done"),
        ("SKIPPED", "Skipped"),
    ]
    PRIORITIES = [
        ("EMERGENCY", "Emergency"),
        ("URGENT", "Urgent"),
        ("NORMAL", "Normal"),
        ("APPOINTMENT", "Appointment"),
    ]
    token_no = models.CharField(max_length=20, db_index=True,
                                help_text="e.g. A-001, EM-005, APT-042")
    patient = models.ForeignKey("core.Patient", on_delete=models.PROTECT,
                                related_name="queue_tokens")
    doctor = models.ForeignKey("specialist.Doctor", on_delete=models.PROTECT,
                               related_name="queue_tokens")
    location = models.ForeignKey("core.Location", on_delete=models.SET_NULL,
                                 null=True, blank=True)
    appointment = models.OneToOneField(Appointment, on_delete=models.SET_NULL,
                                       null=True, blank=True, related_name="queue_token")
    visit_date = models.DateField(default=timezone.now, db_index=True)
    priority = models.CharField(max_length=12, choices=PRIORITIES, default="NORMAL")
    status = models.CharField(max_length=12, choices=STATUSES, default="WAITING", db_index=True)
    issued_at = models.DateTimeField(auto_now_add=True)
    called_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    notes = models.CharField(max_length=200, blank=True)

    class Meta:
        unique_together = [("hospital", "visit_date", "token_no")]
        ordering = ["-visit_date", "-priority", "issued_at"]
        indexes = [
            models.Index(fields=["visit_date", "doctor", "status"]),
        ]

    def __str__(self):
        return f"{self.token_no} ({self.patient}) → {self.doctor}"

    @classmethod
    def generate_token(cls, hospital, doctor, on_date, priority="NORMAL") -> str:
        prefix_map = {"EMERGENCY": "EM", "URGENT": "U",
                      "APPOINTMENT": "APT", "NORMAL": "N"}
        prefix = prefix_map.get(priority, "N")
        # Doctor-scoped daily counter
        last = cls.objects.filter(
            hospital=hospital, doctor=doctor, visit_date=on_date,
            token_no__startswith=f"{prefix}-",
        ).order_by("-token_no").first()
        next_num = 1
        if last:
            try:
                next_num = int(last.token_no.split("-")[-1]) + 1
            except ValueError:
                pass
        return f"{prefix}-{str(next_num).zfill(3)}"


class VisitorPass(TenantBaseModel):
    """Non-patient visitor (relative, attendant) entry pass with QR.
    Used by Reception + Security guards (Phase 5)."""
    PURPOSES = [
        ("ATTENDANT", "Patient Attendant"),
        ("VISITOR", "General Visitor"),
        ("VENDOR", "Vendor/Delivery"),
        ("CONTRACTOR", "Contractor"),
        ("OFFICIAL", "Official Visit"),
    ]
    pass_uuid = models.UUIDField(default=uuid.uuid4, unique=True, editable=False,
                                 help_text="Encoded in QR")
    pass_no = models.CharField(max_length=20, db_index=True,
                               help_text="Human-readable, e.g. VP-20260507-0042")
    visitor_name = models.CharField(max_length=100)
    visitor_phone = models.CharField(max_length=15, blank=True)
    purpose = models.CharField(max_length=15, choices=PURPOSES)
    visiting_patient = models.ForeignKey(
        "core.Patient", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="visitor_passes",
    )
    relationship = models.CharField(max_length=30, blank=True,
        help_text="Father, Spouse, Friend, etc.")
    issued_at = models.DateTimeField(auto_now_add=True)
    valid_until = models.DateTimeField()
    entered_at = models.DateTimeField(null=True, blank=True)
    exited_at = models.DateTimeField(null=True, blank=True)
    is_revoked = models.BooleanField(default=False)
    photo = models.ImageField(upload_to="visitor_passes/", blank=True, null=True)
    id_proof_type = models.CharField(max_length=20, blank=True,
        help_text="AADHAAR / VOTER / DL / PASSPORT / OTHER")
    id_proof_last4 = models.CharField(max_length=4, blank=True)

    class Meta:
        unique_together = [("hospital", "pass_no")]
        ordering = ["-issued_at"]

    def __str__(self):
        return f"{self.pass_no} - {self.visitor_name}"

    @classmethod
    def generate_pass_no(cls, hospital, on_date) -> str:
        prefix = f"VP-{on_date.strftime('%Y%m%d')}-"
        last = cls.objects.filter(
            hospital=hospital, pass_no__startswith=prefix,
        ).order_by("-pass_no").first()
        next_num = 1
        if last:
            try:
                next_num = int(last.pass_no.split("-")[-1]) + 1
            except ValueError:
                pass
        return f"{prefix}{str(next_num).zfill(4)}"

    @property
    def is_active(self):
        if self.is_revoked or self.exited_at:
            return False
        return self.valid_until > timezone.now()
