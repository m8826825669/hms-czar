"""IPD module models.

Hierarchy:
    Ward → Room → Bed → Admission → DailyCharge / DischargeSummary

Ward              : top-level grouping (General, ICU, Maternity, Paediatric)
Room              : within a ward (e.g. "201", "ICU-3"), holds beds
Bed               : individual bed (e.g. "A", "B"), trackable status
Admission         : patient occupies a bed (IPD-YYYYMMDD-NNNN), with attending
                    doctor, admission diagnosis, expected discharge.
DailyCharge       : accrues per night-of-stay — bed rent + nursing care +
                    monitoring. Generated lazily on demand or by a daily cron.
AdmissionService  : ad-hoc service line charged during the stay (procedures,
                    visits, special equipment). Pharmacy + Lab orders are
                    separate models linked via patient/admission.
DischargeSummary  : final document with course of stay, diagnosis, treatment
                    given, advice, follow-up. Written at discharge.
"""
from decimal import Decimal
from django.db import models
from django.utils import timezone
from apps.core.models import TenantBaseModel


def _q(amount):
    return Decimal(amount).quantize(Decimal("0.01"))


# ─────────────────────────────────── Ward / Room / Bed ──────────────────────────

class Ward(TenantBaseModel):
    """Top-level groupings of beds. Each ward can have a different default
    daily rate which beds inherit unless overridden."""
    WARD_TYPES = [
        ("GENERAL", "General Ward"),
        ("PRIVATE", "Private / Deluxe"),
        ("SEMI_PRIVATE", "Semi-Private"),
        ("ICU", "Intensive Care Unit"),
        ("HDU", "High Dependency Unit"),
        ("MATERNITY", "Maternity Ward"),
        ("PAEDIATRIC", "Paediatric Ward"),
        ("ISOLATION", "Isolation"),
        ("DAY_CARE", "Day Care"),
    ]

    code = models.CharField(max_length=20, db_index=True,
        help_text="Short code, e.g. 'GEN', 'ICU', 'MAT'")
    name = models.CharField(max_length=80,
        help_text="Display name, e.g. 'General Ward — Block A'")
    ward_type = models.CharField(max_length=15, choices=WARD_TYPES, default="GENERAL")
    floor = models.CharField(max_length=20, blank=True,
        help_text="e.g. 'Ground floor', '2nd floor'")

    # Default daily rates that newly-created beds inherit.
    # All amounts are GST-inclusive (room rent above ₹1000/day attracts 12% GST).
    default_bed_rent = models.DecimalField(max_digits=10, decimal_places=2,
                                            default=Decimal("500.00"),
        help_text="Per-day bed rent (₹) — default for beds in this ward")
    default_nursing_charge = models.DecimalField(max_digits=10, decimal_places=2,
                                                  default=Decimal("200.00"),
        help_text="Per-day nursing care charge")
    default_gst_rate = models.DecimalField(max_digits=5, decimal_places=2,
                                            default=Decimal("0.00"),
        help_text="GST on bed rent. India: 0% if rate ≤ ₹1000/day, "
                  "5% if ≤ ₹7500, 12% if higher")

    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True)

    class Meta:
        unique_together = [("hospital", "code")]
        ordering = ["ward_type", "name"]
        indexes = [models.Index(fields=["ward_type", "is_active"])]

    def __str__(self):
        return f"{self.name} ({self.code})"


class Room(TenantBaseModel):
    """A room within a ward. Rooms can hold one or more beds."""
    ward = models.ForeignKey(Ward, on_delete=models.CASCADE, related_name="rooms")
    number = models.CharField(max_length=20,
        help_text="Room number, e.g. '201', 'ICU-3'")
    is_ac = models.BooleanField(default=False, help_text="Air-conditioned")
    has_attached_bath = models.BooleanField(default=True)
    notes = models.CharField(max_length=200, blank=True)

    class Meta:
        unique_together = [("hospital", "ward", "number")]
        ordering = ["ward", "number"]

    def __str__(self):
        return f"{self.ward.code}-{self.number}"


class Bed(TenantBaseModel):
    """An individual bed. The unit of allocation."""
    STATUSES = [
        ("AVAILABLE", "Available"),
        ("OCCUPIED", "Occupied"),
        ("RESERVED", "Reserved (cleaning/admission pending)"),
        ("MAINTENANCE", "Maintenance / out of service"),
    ]

    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name="beds")
    label = models.CharField(max_length=10,
        help_text="Bed label within the room, e.g. 'A', 'B', '1', '2'")
    bed_rent = models.DecimalField(max_digits=10, decimal_places=2,
        help_text="Per-day bed rent (₹). Defaults from ward.default_bed_rent.")
    nursing_charge = models.DecimalField(max_digits=10, decimal_places=2,
        help_text="Per-day nursing care charge.")
    gst_rate = models.DecimalField(max_digits=5, decimal_places=2,
                                   default=Decimal("0.00"))
    status = models.CharField(max_length=12, choices=STATUSES, default="AVAILABLE",
                              db_index=True)
    notes = models.CharField(max_length=200, blank=True)

    class Meta:
        unique_together = [("hospital", "room", "label")]
        ordering = ["room", "label"]
        indexes = [
            models.Index(fields=["status"]),
            models.Index(fields=["room", "status"]),
        ]

    def __str__(self):
        return f"{self.room} / Bed {self.label}"

    @property
    def display_code(self):
        """Short identifier for badges, e.g. 'GEN-201-A'."""
        return f"{self.room.ward.code}-{self.room.number}-{self.label}"

    def save(self, *args, **kwargs):
        # Inherit defaults from ward if blank
        if self.room_id and not self.bed_rent:
            self.bed_rent = self.room.ward.default_bed_rent
        if self.room_id and not self.nursing_charge:
            self.nursing_charge = self.room.ward.default_nursing_charge
        if self.room_id and not self.gst_rate:
            self.gst_rate = self.room.ward.default_gst_rate
        super().save(*args, **kwargs)


# ─────────────────────────────────── Admission ──────────────────────────────────

class Admission(TenantBaseModel):
    """A patient admitted to a bed. Lives until discharge.

    The bed is locked for the duration of the admission (Bed.status = OCCUPIED).
    On discharge: bed flips to AVAILABLE, daily charges are finalized and
    rolled into a single Invoice.
    """
    STATUSES = [
        ("ADMITTED", "Admitted (in-patient)"),
        ("DISCHARGED", "Discharged"),
        ("ABSCONDED", "Absconded"),
        ("DAMA", "DAMA (discharge against medical advice)"),
        ("EXPIRED", "Expired"),
        ("TRANSFERRED", "Transferred out"),
        ("CANCELLED", "Cancelled (admission void)"),
    ]
    ADMISSION_TYPES = [
        ("PLANNED", "Planned"),
        ("EMERGENCY", "Emergency"),
        ("REFERRAL", "Referral"),
        ("MATERNITY", "Maternity"),
    ]

    code = models.CharField(max_length=20, db_index=True,
        help_text="Auto e.g. IPD-20260507-0001")
    patient = models.ForeignKey("core.Patient", on_delete=models.PROTECT,
                                related_name="admissions")
    bed = models.ForeignKey(Bed, on_delete=models.PROTECT,
                            related_name="admissions")
    attending_doctor = models.ForeignKey(
        "specialist.Doctor", on_delete=models.PROTECT,
        related_name="ipd_admissions",
    )
    department = models.ForeignKey(
        "department.Department", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="ipd_admissions",
    )

    admission_type = models.CharField(max_length=12, choices=ADMISSION_TYPES,
                                      default="PLANNED")
    admission_diagnosis = models.TextField(
        help_text="Provisional diagnosis at admission. Will be refined at discharge.",
    )
    admission_notes = models.TextField(blank=True)
    chief_complaint = models.CharField(max_length=300, blank=True)

    admitted_at = models.DateTimeField(default=timezone.now)
    expected_discharge_date = models.DateField(null=True, blank=True)
    discharged_at = models.DateTimeField(null=True, blank=True)
    discharge_type = models.CharField(max_length=15, blank=True,
        help_text="ROUTINE / DAMA / TRANSFER / EXPIRED — set at discharge")

    # Snapshot rates at admission (in case bed rates change mid-stay)
    locked_bed_rent = models.DecimalField(max_digits=10, decimal_places=2,
                                          default=Decimal("0.00"),
        help_text="Bed rent at time of admission. Charges accrue at this rate.")
    locked_nursing_charge = models.DecimalField(max_digits=10, decimal_places=2,
                                                default=Decimal("0.00"))
    locked_gst_rate = models.DecimalField(max_digits=5, decimal_places=2,
                                          default=Decimal("0.00"))

    status = models.CharField(max_length=12, choices=STATUSES, default="ADMITTED",
                              db_index=True)

    # Final invoice rolled up at discharge
    invoice = models.OneToOneField(
        "billing.Invoice", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="ipd_admission",
    )

    notes = models.TextField(blank=True)

    class Meta:
        unique_together = [("hospital", "code")]
        ordering = ["-admitted_at"]
        indexes = [
            models.Index(fields=["patient", "-admitted_at"]),
            models.Index(fields=["status", "-admitted_at"]),
            models.Index(fields=["attending_doctor", "-admitted_at"]),
        ]

    def __str__(self):
        return f"{self.code} — {self.patient} ({self.bed.display_code})"

    @classmethod
    def generate_code(cls, hospital, on_date):
        prefix = f"IPD-{on_date.strftime('%Y%m%d')}-"
        last = cls.objects.filter(
            hospital=hospital, code__startswith=prefix,
        ).order_by("-code").first()
        next_num = 1
        if last:
            try:
                next_num = int(last.code.split("-")[-1]) + 1
            except ValueError:
                pass
        return f"{prefix}{str(next_num).zfill(4)}"

    @property
    def is_active(self):
        return self.status == "ADMITTED"

    @property
    def stay_days(self):
        """Number of days (inclusive of admission, exclusive of discharge).

        Indian hospital billing typically charges per night-of-stay:
        admit Mon evening, discharge Tue morning = 1 day charge.
        We use ceil((discharge - admission) / 1 day), with a minimum of 1.
        """
        end = self.discharged_at or timezone.now()
        delta_seconds = (end - self.admitted_at).total_seconds()
        if delta_seconds <= 0:
            return 1
        days = int(delta_seconds // 86400)
        # Partial day → round up if any time elapsed in the next calendar day
        if delta_seconds % 86400 > 0:
            days += 1
        return max(1, days)


class DailyCharge(TenantBaseModel):
    """A single day's charge for an admission.

    Created lazily by the accrual service: when called, it generates DailyCharge
    rows for every day from admission_date up to today (or discharge date) that
    isn't already covered. Each row has bed_rent + nursing + GST = total.

    These rows are then rolled up into the final Invoice at discharge.
    """
    admission = models.ForeignKey(Admission, on_delete=models.CASCADE,
                                  related_name="daily_charges")
    charge_date = models.DateField(db_index=True,
        help_text="Calendar date this charge represents (one row per stay-day)")

    bed_rent = models.DecimalField(max_digits=10, decimal_places=2,
                                   default=Decimal("0.00"))
    nursing_charge = models.DecimalField(max_digits=10, decimal_places=2,
                                         default=Decimal("0.00"))
    other_charge = models.DecimalField(max_digits=10, decimal_places=2,
                                       default=Decimal("0.00"),
        help_text="Equipment / monitoring / oxygen / other per-day line items")
    other_description = models.CharField(max_length=200, blank=True)

    gst_rate = models.DecimalField(max_digits=5, decimal_places=2,
                                   default=Decimal("0.00"))
    gst_amount = models.DecimalField(max_digits=10, decimal_places=2,
                                     default=Decimal("0.00"))
    total = models.DecimalField(max_digits=10, decimal_places=2,
                                default=Decimal("0.00"))

    class Meta:
        unique_together = [("admission", "charge_date")]
        ordering = ["admission", "charge_date"]

    def __str__(self):
        return f"{self.admission.code} {self.charge_date} = ₹{self.total}"

    def compute(self):
        sub = (Decimal(self.bed_rent) + Decimal(self.nursing_charge)
               + Decimal(self.other_charge))
        self.gst_amount = _q(sub * Decimal(self.gst_rate) / Decimal("100"))
        self.total = _q(sub + self.gst_amount)
        return self

    def save(self, *args, **kwargs):
        self.compute()
        super().save(*args, **kwargs)


class AdmissionService(TenantBaseModel):
    """An ad-hoc service charged during the IPD stay.

    Use cases:
      - Surgical/procedure charge (₹15,000 for laparoscopic appendectomy)
      - Specialist consultation visit (₹500 for cardiology consult)
      - Equipment use (ventilator/day, dialysis session)
      - Investigation done at bedside (portable X-ray)

    Pharmacy and Lab orders are NOT modelled here — they have their own models
    (PharmacyOrder, LabOrder) and link to the patient. At discharge time, the
    billing service can sweep up unbilled pharmacy/lab orders for the patient
    that fall within the admission window and add them to the final invoice.
    """
    admission = models.ForeignKey(Admission, on_delete=models.CASCADE,
                                  related_name="services")
    service = models.ForeignKey(
        "billing.ServiceCatalog", on_delete=models.SET_NULL,
        null=True, blank=True,
    )
    description = models.CharField(max_length=200,
        help_text="Free-text description if no catalog entry")
    quantity = models.DecimalField(max_digits=8, decimal_places=2,
                                   default=Decimal("1"))
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    gst_rate = models.DecimalField(max_digits=5, decimal_places=2,
                                   default=Decimal("18.00"))
    subtotal = models.DecimalField(max_digits=12, decimal_places=2,
                                   default=Decimal("0.00"))
    gst_amount = models.DecimalField(max_digits=10, decimal_places=2,
                                     default=Decimal("0.00"))
    total = models.DecimalField(max_digits=12, decimal_places=2,
                                default=Decimal("0.00"))
    service_date = models.DateField(default=timezone.localdate, db_index=True)
    notes = models.CharField(max_length=300, blank=True)

    class Meta:
        ordering = ["admission", "service_date"]

    def __str__(self):
        return f"{self.admission.code}: {self.description} (₹{self.total})"

    def compute(self):
        gross = _q(Decimal(self.quantity) * Decimal(self.unit_price))
        self.subtotal = gross
        self.gst_amount = _q(gross * Decimal(self.gst_rate) / Decimal("100"))
        self.total = _q(gross + self.gst_amount)
        return self

    def save(self, *args, **kwargs):
        if self.service and not self.description:
            self.description = self.service.name
        if self.service and not self.unit_price:
            self.unit_price = self.service.price
        if self.service and not self.gst_rate:
            self.gst_rate = self.service.gst_rate
        self.compute()
        super().save(*args, **kwargs)


# ─────────────────────────────────── Discharge ──────────────────────────────────

class DischargeSummary(TenantBaseModel):
    """The final clinical document for an admission.

    Filled in by the attending doctor at discharge. Rendered as PDF
    for the patient + referring physician.
    """
    admission = models.OneToOneField(
        Admission, on_delete=models.CASCADE, related_name="discharge_summary",
    )
    final_diagnosis = models.TextField(
        help_text="Confirmed/refined diagnosis at discharge",
    )
    course_in_hospital = models.TextField(
        help_text="Narrative of investigations, treatment, response",
    )
    procedures_done = models.TextField(blank=True,
        help_text="Surgeries / procedures performed during the stay")
    treatment_given = models.TextField(blank=True,
        help_text="Major medications / IV / interventions during the stay")
    investigations_summary = models.TextField(blank=True,
        help_text="Key lab/imaging findings to highlight on discharge")
    condition_at_discharge = models.CharField(max_length=300, blank=True,
        help_text="Vitals + general condition at discharge")

    discharge_advice = models.TextField(blank=True,
        help_text="Wound care, lifestyle, diet, activity restrictions")
    medications_on_discharge = models.TextField(blank=True,
        help_text="Drugs to continue at home, with frequency + duration")
    follow_up_advice = models.CharField(max_length=300, blank=True,
        help_text="When/where to follow up (e.g. 'OPD after 7 days')")

    prepared_by = models.ForeignKey(
        "specialist.Doctor", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="prepared_discharge_summaries",
    )
    prepared_at = models.DateTimeField(default=timezone.now)
    finalized_at = models.DateTimeField(null=True, blank=True,
        help_text="Set when the doctor signs off — locks the document")

    class Meta:
        ordering = ["-prepared_at"]

    def __str__(self):
        return f"DC summary for {self.admission.code}"

    @property
    def is_finalized(self):
        return self.finalized_at is not None
