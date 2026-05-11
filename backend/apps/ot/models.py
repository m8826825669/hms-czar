"""
Operation Theatre module — Phase 3a.

Models:
  • OperationTheatre        — physical OT room with status tracking
  • SurgicalProcedure       — catalog of bookable procedures with pricing
  • SurgeryBooking          — scheduled or in-progress operation
  • SurgeryTeam             — team members assigned to a booking
  • OTRegister              — formal surgical record (1:1 with booking)
  • OTConsumable            — line items consumed during surgery (drugs, sutures, etc.)
"""
from decimal import Decimal
from django.db import models
from django.utils import timezone
from django.core.validators import MinValueValidator


# ─────────────────────────────────────────────────────────────────────────────
# Theatre + procedure catalog
# ─────────────────────────────────────────────────────────────────────────────

class OperationTheatre(models.Model):
    THEATRE_TYPES = [
        ("GENERAL", "General Surgery"),
        ("CARDIAC", "Cardiac"),
        ("NEURO", "Neurosurgery"),
        ("OBGYN", "OB/GYN"),
        ("ORTHO", "Orthopaedics"),
        ("MINOR", "Minor OT / Day-Care"),
        ("EMERGENCY", "Emergency"),
    ]
    STATUS = [
        ("AVAILABLE", "Available"),
        ("OCCUPIED", "Occupied"),
        ("CLEANING", "Cleaning / Turnover"),
        ("MAINTENANCE", "Under Maintenance"),
    ]

    hospital = models.ForeignKey(
        "core.Hospital", on_delete=models.CASCADE, related_name="theatres",
    )
    code = models.CharField(max_length=20, db_index=True,
        help_text="Short code, e.g. OT-1, OT-CARDIAC-A")
    name = models.CharField(max_length=120)
    theatre_type = models.CharField(max_length=15, choices=THEATRE_TYPES,
                                     default="GENERAL")
    floor = models.CharField(max_length=20, blank=True, default="")
    status = models.CharField(max_length=15, choices=STATUS, default="AVAILABLE")
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["theatre_type", "code"]
        unique_together = [["hospital", "code"]]
        verbose_name = "Operation Theatre"

    def __str__(self):
        return f"{self.code} — {self.name}"


class SurgicalProcedure(models.Model):
    """Catalog of bookable procedures (e.g. Appendectomy, LSCS, Coronary bypass)."""
    CATEGORIES = [
        ("GENERAL", "General Surgery"),
        ("CARDIAC", "Cardiac"),
        ("NEURO", "Neurosurgery"),
        ("OBGYN", "OB/GYN"),
        ("ORTHO", "Orthopaedics"),
        ("ENT", "ENT"),
        ("OPHTHAL", "Ophthalmology"),
        ("UROLOGY", "Urology"),
        ("GASTRO", "Gastrointestinal"),
        ("ONCO", "Oncology"),
        ("PLASTIC", "Plastic / Reconstructive"),
        ("MINOR", "Minor"),
    ]

    hospital = models.ForeignKey(
        "core.Hospital", on_delete=models.CASCADE, related_name="surgical_procedures",
    )
    code = models.CharField(max_length=20, db_index=True)
    name = models.CharField(max_length=200)
    category = models.CharField(max_length=15, choices=CATEGORIES, default="GENERAL")

    typical_duration_minutes = models.PositiveIntegerField(
        default=60, help_text="Estimated theatre booking duration",
    )
    base_price = models.DecimalField(max_digits=12, decimal_places=2,
        validators=[MinValueValidator(Decimal("0.00"))])
    hsn_code = models.CharField(max_length=8, blank=True, default="9993")
    gst_rate = models.DecimalField(
        max_digits=5, decimal_places=2, default=Decimal("0.00"),
        help_text="Most healthcare procedures are GST-exempt; cosmetic/aesthetic = 18%",
    )
    requires_anaesthesia = models.BooleanField(default=True)
    anaesthesia_type = models.CharField(
        max_length=20, blank=True, default="",
        help_text="GA / SA / LA / EPIDURAL / NONE",
    )

    is_active = models.BooleanField(default=True)
    description = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["category", "name"]
        unique_together = [["hospital", "code"]]

    def __str__(self):
        return f"{self.code} — {self.name}"


# ─────────────────────────────────────────────────────────────────────────────
# Booking + execution
# ─────────────────────────────────────────────────────────────────────────────

class SurgeryBooking(models.Model):
    STATUS = [
        ("SCHEDULED", "Scheduled"),
        ("CHECKED_IN", "Patient Checked-In"),
        ("IN_PROGRESS", "In Progress"),
        ("COMPLETED", "Completed"),
        ("CANCELLED", "Cancelled"),
        ("POSTPONED", "Postponed"),
    ]
    URGENCIES = [
        ("ELECTIVE", "Elective"),
        ("URGENT", "Urgent (within 24h)"),
        ("EMERGENCY", "Emergency"),
    ]

    hospital = models.ForeignKey(
        "core.Hospital", on_delete=models.CASCADE, related_name="surgery_bookings",
    )
    code = models.CharField(max_length=30, unique=True, db_index=True,
        help_text="Auto-generated, e.g. OT-20260508-0001")

    patient = models.ForeignKey(
        "core.Patient", on_delete=models.PROTECT, related_name="surgery_bookings",
    )
    theatre = models.ForeignKey(
        OperationTheatre, on_delete=models.PROTECT, related_name="bookings",
    )
    procedure = models.ForeignKey(
        SurgicalProcedure, on_delete=models.PROTECT, related_name="bookings",
    )

    primary_surgeon = models.ForeignKey(
        "specialist.Doctor", on_delete=models.PROTECT,
        related_name="surgeries_as_primary",
    )
    anaesthetist = models.ForeignKey(
        "specialist.Doctor", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="surgeries_as_anaesthetist",
    )

    # Optional link to admission (for IPD surgeries — discharges roll these up)
    admission = models.ForeignKey(
        "ipd.Admission", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="surgeries",
    )

    urgency = models.CharField(max_length=12, choices=URGENCIES, default="ELECTIVE")
    status = models.CharField(max_length=15, choices=STATUS, default="SCHEDULED")

    scheduled_start = models.DateTimeField()
    scheduled_end = models.DateTimeField()
    actual_start = models.DateTimeField(null=True, blank=True)
    actual_end = models.DateTimeField(null=True, blank=True)

    # Pre-op
    pre_op_diagnosis = models.CharField(max_length=300, blank=True, default="")
    pre_op_assessment = models.TextField(blank=True, default="")
    consent_obtained = models.BooleanField(default=False)
    consent_witness = models.CharField(max_length=120, blank=True, default="")

    # Pricing locked at booking
    locked_procedure_price = models.DecimalField(
        max_digits=12, decimal_places=2, default=Decimal("0.00"),
    )
    locked_gst_rate = models.DecimalField(
        max_digits=5, decimal_places=2, default=Decimal("0.00"),
    )

    # Cancellation / postponement
    cancellation_reason = models.CharField(max_length=300, blank=True, default="")
    cancelled_at = models.DateTimeField(null=True, blank=True)
    cancelled_by = models.ForeignKey(
        "accounts.User", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="cancelled_surgeries",
    )

    # Billing — for non-IPD (day-care / OPD) surgeries
    invoice = models.OneToOneField(
        "billing.Invoice", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="surgery_booking",
    )

    booked_by = models.ForeignKey(
        "accounts.User", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="booked_surgeries",
    )
    notes = models.TextField(blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-scheduled_start"]
        indexes = [
            models.Index(fields=["status", "scheduled_start"]),
            models.Index(fields=["theatre", "scheduled_start"]),
        ]

    def __str__(self):
        return f"{self.code} — {self.patient_id} — {self.procedure_id}"

    @property
    def duration_minutes(self):
        if self.actual_start and self.actual_end:
            delta = self.actual_end - self.actual_start
        else:
            delta = self.scheduled_end - self.scheduled_start
        return int(delta.total_seconds() // 60)

    def lock_pricing(self):
        """Snapshot procedure price + gst at booking creation."""
        self.locked_procedure_price = self.procedure.base_price
        self.locked_gst_rate = self.procedure.gst_rate


class SurgeryTeam(models.Model):
    """Members assigned to a surgery booking — surgeons, assistants, anaesthetists, nurses."""
    ROLES = [
        ("SURGEON", "Primary Surgeon"),
        ("ASSISTANT", "Assistant Surgeon"),
        ("ANAESTHETIST", "Anaesthetist"),
        ("NURSE_SCRUB", "Scrub Nurse"),
        ("NURSE_CIRCULATING", "Circulating Nurse"),
        ("TECHNICIAN", "OT Technician"),
        ("PERFUSIONIST", "Perfusionist"),
        ("OBSERVER", "Observer"),
    ]

    booking = models.ForeignKey(
        SurgeryBooking, on_delete=models.CASCADE, related_name="team",
    )
    # Either a doctor reference OR a free-text member (for nurses/techs not in Doctor table)
    doctor = models.ForeignKey(
        "specialist.Doctor", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="surgery_team_assignments",
    )
    member_name = models.CharField(
        max_length=120, blank=True, default="",
        help_text="Free-text name when team member is not in Doctor table",
    )
    role = models.CharField(max_length=20, choices=ROLES)
    notes = models.CharField(max_length=200, blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["role"]

    @property
    def display_name(self):
        if self.doctor:
            return f"Dr. {self.doctor.user.get_full_name() or self.doctor.user.username}"
        return self.member_name or "Unknown"


class OTRegister(models.Model):
    """Formal surgical record — clinical narrative of what happened during the operation."""
    booking = models.OneToOneField(
        SurgeryBooking, on_delete=models.CASCADE, related_name="ot_register",
    )

    pre_op_findings = models.TextField(blank=True, default="")
    surgical_steps = models.TextField(blank=True, default="",
        help_text="Step-by-step narrative of the procedure")
    intra_op_findings = models.TextField(blank=True, default="")
    complications = models.TextField(blank=True, default="")
    blood_loss_ml = models.PositiveIntegerField(default=0)
    blood_transfused_units = models.PositiveIntegerField(default=0)

    instruments_used = models.TextField(blank=True, default="")
    implants_used = models.TextField(blank=True, default="",
        help_text="Implants, prostheses, mesh, etc. with batch numbers")
    specimens_sent = models.TextField(blank=True, default="",
        help_text="Histopathology / culture specimens dispatched")

    anaesthesia_type = models.CharField(max_length=30, blank=True, default="")
    anaesthesia_notes = models.TextField(blank=True, default="")

    post_op_orders = models.TextField(blank=True, default="")
    condition_on_shifting = models.CharField(max_length=120, blank=True, default="",
        help_text="Patient condition while shifting to recovery / ward")

    prepared_by = models.ForeignKey(
        "specialist.Doctor", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="prepared_ot_registers",
    )
    prepared_at = models.DateTimeField(default=timezone.now)
    finalized_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "OT Register"
        verbose_name_plural = "OT Registers"

    @property
    def is_finalized(self):
        return self.finalized_at is not None


class OTConsumable(models.Model):
    """Line items consumed during the surgery (drugs, sutures, gloves, etc.).

    Aggregated into the surgery's invoice or admission services on completion.
    """
    booking = models.ForeignKey(
        SurgeryBooking, on_delete=models.CASCADE, related_name="consumables",
    )
    item_name = models.CharField(max_length=200)
    quantity = models.DecimalField(
        max_digits=10, decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
    )
    unit = models.CharField(max_length=20, default="pcs")
    unit_price = models.DecimalField(
        max_digits=10, decimal_places=2,
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    gst_rate = models.DecimalField(
        max_digits=5, decimal_places=2, default=Decimal("0.00"),
    )

    # auto-computed
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    gst_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    total = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))

    notes = models.CharField(max_length=200, blank=True, default="")
    added_at = models.DateTimeField(auto_now_add=True)
    added_by = models.ForeignKey(
        "accounts.User", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="added_ot_consumables",
    )

    class Meta:
        ordering = ["added_at"]

    def save(self, *args, **kwargs):
        self.subtotal = (self.quantity * self.unit_price).quantize(Decimal("0.01"))
        self.gst_amount = (self.subtotal * self.gst_rate / Decimal("100")).quantize(Decimal("0.01"))
        self.total = (self.subtotal + self.gst_amount).quantize(Decimal("0.01"))
        super().save(*args, **kwargs)
