"""
Blood Bank module — Phase 3a.

Models:
  • BloodDonor          — registered donor with eligibility tracking
  • BloodDonation       — collection event with screening tests
  • BloodBag            — physical bag (whole / PRBC / FFP / platelets / cryo) with lifecycle
  • BloodRequisition    — clinical request for blood units
  • CrossMatch          — compatibility test linking a requisition to candidate bag(s)
  • BloodIssue          — issued bag(s) with billing link
"""
from datetime import timedelta
from decimal import Decimal

from django.db import models
from django.utils import timezone
from django.core.validators import MinValueValidator


BLOOD_GROUPS = [
    ("A_POS",  "A+"), ("A_NEG",  "A-"),
    ("B_POS",  "B+"), ("B_NEG",  "B-"),
    ("AB_POS", "AB+"), ("AB_NEG", "AB-"),
    ("O_POS",  "O+"), ("O_NEG",  "O-"),
]

# Universal donor / recipient compatibility maps for cross-matching
COMPATIBILITY = {
    # recipient: list of compatible donor groups (whole blood / PRBC)
    "A_POS":  ["A_POS",  "A_NEG",  "O_POS",  "O_NEG"],
    "A_NEG":  ["A_NEG",  "O_NEG"],
    "B_POS":  ["B_POS",  "B_NEG",  "O_POS",  "O_NEG"],
    "B_NEG":  ["B_NEG",  "O_NEG"],
    "AB_POS": ["A_POS", "A_NEG", "B_POS", "B_NEG", "AB_POS", "AB_NEG", "O_POS", "O_NEG"],
    "AB_NEG": ["A_NEG", "B_NEG", "AB_NEG", "O_NEG"],
    "O_POS":  ["O_POS",  "O_NEG"],
    "O_NEG":  ["O_NEG"],
}


# ─────────────────────────────────────────────────────────────────────────────
# Donor
# ─────────────────────────────────────────────────────────────────────────────

class BloodDonor(models.Model):
    GENDERS = [("M", "Male"), ("F", "Female"), ("O", "Other")]
    DONOR_TYPES = [
        ("VOLUNTARY", "Voluntary"),
        ("REPLACEMENT", "Replacement (for a patient)"),
        ("AUTOLOGOUS", "Autologous (for self)"),
        ("DIRECTED", "Directed (specific recipient)"),
    ]

    hospital = models.ForeignKey(
        "core.Hospital", on_delete=models.CASCADE, related_name="blood_donors",
    )
    donor_id = models.CharField(max_length=30, unique=True, db_index=True,
        help_text="Auto-generated, e.g. BD-20260508-0001")

    # Demographics
    first_name = models.CharField(max_length=80)
    last_name = models.CharField(max_length=80, blank=True, default="")
    gender = models.CharField(max_length=1, choices=GENDERS)
    dob = models.DateField()
    blood_group = models.CharField(max_length=10, choices=BLOOD_GROUPS, db_index=True)

    phone = models.CharField(max_length=20, db_index=True)
    email = models.EmailField(blank=True, default="")
    address = models.CharField(max_length=300, blank=True, default="")
    aadhaar_last4 = models.CharField(max_length=4, blank=True, default="")

    # Health flags (snapshot from latest screening)
    weight_kg = models.DecimalField(max_digits=5, decimal_places=2,
        default=Decimal("0.00"))
    is_eligible = models.BooleanField(default=True,
        help_text="Cleared for donation by medical officer")
    deferral_until = models.DateField(null=True, blank=True,
        help_text="Temporary deferral end date (e.g. recent illness)")
    deferral_reason = models.CharField(max_length=300, blank=True, default="")

    donor_type = models.CharField(max_length=15, choices=DONOR_TYPES, default="VOLUNTARY")

    last_donation_date = models.DateField(null=True, blank=True)
    total_donations = models.PositiveIntegerField(default=0)

    notes = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["blood_group"]),
            models.Index(fields=["phone"]),
        ]

    def __str__(self):
        return f"{self.donor_id} — {self.full_name} ({self.get_blood_group_display()})"

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}".strip()

    @property
    def age(self):
        if not self.dob:
            return None
        today = timezone.localdate()
        return today.year - self.dob.year - (
            (today.month, today.day) < (self.dob.month, self.dob.day)
        )

    def can_donate_today(self):
        """Returns (eligible: bool, reason: str)."""
        today = timezone.localdate()

        if not self.is_eligible:
            return False, self.deferral_reason or "Permanently deferred"

        if self.deferral_until and today < self.deferral_until:
            return False, f"Deferred until {self.deferral_until.isoformat()}"

        # Age check 18-65
        if self.age is None or self.age < 18 or self.age > 65:
            return False, f"Age {self.age} outside 18-65 range"

        # Weight check
        if self.weight_kg < Decimal("50"):
            return False, f"Weight {self.weight_kg} kg below 50 kg minimum"

        # 90-day gap from last donation (whole blood)
        if self.last_donation_date:
            min_next = self.last_donation_date + timedelta(days=90)
            if today < min_next:
                return False, f"Last donation {self.last_donation_date.isoformat()}; eligible from {min_next.isoformat()}"

        return True, "Eligible"


# ─────────────────────────────────────────────────────────────────────────────
# Donation + screening
# ─────────────────────────────────────────────────────────────────────────────

class BloodDonation(models.Model):
    SCREEN_RESULTS = [
        ("PENDING",  "Pending"),
        ("NEGATIVE", "Negative (Pass)"),
        ("POSITIVE", "Positive (Fail)"),
    ]
    STATUS = [
        ("COLLECTED",   "Collected, awaiting screening"),
        ("SCREENING",   "Screening in progress"),
        ("PASSED",      "Screening passed — bags created"),
        ("FAILED",      "Screening failed — discarded"),
        ("DISCARDED",   "Manually discarded"),
    ]

    hospital = models.ForeignKey(
        "core.Hospital", on_delete=models.CASCADE, related_name="blood_donations",
    )
    donation_id = models.CharField(max_length=30, unique=True, db_index=True,
        help_text="Auto-generated, e.g. DON-20260508-0001")

    donor = models.ForeignKey(
        BloodDonor, on_delete=models.PROTECT, related_name="donations",
    )
    donation_date = models.DateTimeField(default=timezone.now)
    volume_collected_ml = models.PositiveIntegerField(
        default=350,
        help_text="Standard whole blood collection: 350-450 ml",
    )
    blood_group = models.CharField(max_length=10, choices=BLOOD_GROUPS,
        help_text="Should match donor's group; verified at collection")

    # Pre-donation vitals
    pre_hb_g_dl = models.DecimalField(
        max_digits=4, decimal_places=2, default=Decimal("0.00"),
        help_text="Hb level g/dL — must be ≥ 12.5 (M) or ≥ 12.0 (F)",
    )
    pre_bp_systolic = models.PositiveIntegerField(default=0)
    pre_bp_diastolic = models.PositiveIntegerField(default=0)
    pre_pulse = models.PositiveIntegerField(default=0)
    pre_temperature_c = models.DecimalField(
        max_digits=4, decimal_places=1, default=Decimal("0.0"),
    )

    # Screening — 5 mandatory tests for India per NACO/NBTC
    test_hiv = models.CharField(max_length=10, choices=SCREEN_RESULTS, default="PENDING")
    test_hbsag = models.CharField(max_length=10, choices=SCREEN_RESULTS, default="PENDING")
    test_hcv = models.CharField(max_length=10, choices=SCREEN_RESULTS, default="PENDING")
    test_syphilis = models.CharField(max_length=10, choices=SCREEN_RESULTS, default="PENDING")
    test_malaria = models.CharField(max_length=10, choices=SCREEN_RESULTS, default="PENDING")

    screening_completed_at = models.DateTimeField(null=True, blank=True)
    screened_by = models.ForeignKey(
        "accounts.User", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="screened_donations",
    )

    status = models.CharField(max_length=15, choices=STATUS, default="COLLECTED")
    discard_reason = models.CharField(max_length=300, blank=True, default="")

    collected_by = models.ForeignKey(
        "accounts.User", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="collected_donations",
    )
    notes = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-donation_date"]

    def __str__(self):
        return f"{self.donation_id} — {self.donor.full_name}"

    @property
    def all_tests_complete(self):
        tests = [self.test_hiv, self.test_hbsag, self.test_hcv,
                 self.test_syphilis, self.test_malaria]
        return all(t != "PENDING" for t in tests)

    @property
    def all_tests_passed(self):
        tests = [self.test_hiv, self.test_hbsag, self.test_hcv,
                 self.test_syphilis, self.test_malaria]
        return all(t == "NEGATIVE" for t in tests)

    @property
    def any_test_failed(self):
        tests = [self.test_hiv, self.test_hbsag, self.test_hcv,
                 self.test_syphilis, self.test_malaria]
        return any(t == "POSITIVE" for t in tests)


# ─────────────────────────────────────────────────────────────────────────────
# Blood bag inventory
# ─────────────────────────────────────────────────────────────────────────────

class BloodBag(models.Model):
    COMPONENTS = [
        ("WHOLE",     "Whole Blood"),
        ("PRBC",      "Packed Red Blood Cells"),
        ("FFP",       "Fresh Frozen Plasma"),
        ("PLATELETS", "Platelets"),
        ("CRYO",      "Cryoprecipitate"),
    ]
    STATUS = [
        ("QUARANTINE", "Quarantine (awaiting clearance)"),
        ("AVAILABLE",  "Available for issue"),
        ("RESERVED",   "Reserved (cross-matched)"),
        ("ISSUED",     "Issued"),
        ("EXPIRED",    "Expired"),
        ("DISCARDED",  "Discarded"),
    ]

    # Default shelf-life in days per component
    SHELF_LIFE_DAYS = {
        "WHOLE":     35,
        "PRBC":      42,
        "FFP":       365,   # frozen
        "PLATELETS": 5,
        "CRYO":      365,   # frozen
    }

    hospital = models.ForeignKey(
        "core.Hospital", on_delete=models.CASCADE, related_name="blood_bags",
    )
    bag_id = models.CharField(max_length=30, unique=True, db_index=True,
        help_text="Auto-generated, e.g. BB-20260508-0001")

    donation = models.ForeignKey(
        BloodDonation, on_delete=models.PROTECT, related_name="bags",
    )
    component = models.CharField(max_length=15, choices=COMPONENTS, default="WHOLE")
    blood_group = models.CharField(max_length=10, choices=BLOOD_GROUPS, db_index=True)
    volume_ml = models.PositiveIntegerField(default=350)

    collected_at = models.DateTimeField()
    expiry_date = models.DateField(db_index=True)

    status = models.CharField(max_length=15, choices=STATUS, default="QUARANTINE",
                               db_index=True)
    storage_location = models.CharField(
        max_length=80, blank=True, default="",
        help_text="e.g. 'Fridge A1, Shelf 3', 'Freezer B'",
    )

    # Set when issued
    issued_to_requisition = models.ForeignKey(
        "blood_bank.BloodRequisition", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="issued_bags",
    )

    discard_reason = models.CharField(max_length=300, blank=True, default="")
    discarded_at = models.DateTimeField(null=True, blank=True)
    discarded_by = models.ForeignKey(
        "accounts.User", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="discarded_bags",
    )

    notes = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-collected_at"]
        indexes = [
            models.Index(fields=["status", "blood_group", "component"]),
            models.Index(fields=["expiry_date"]),
        ]

    def __str__(self):
        return f"{self.bag_id} — {self.get_component_display()} {self.get_blood_group_display()}"

    @property
    def days_to_expiry(self):
        if not self.expiry_date:
            return None
        return (self.expiry_date - timezone.localdate()).days

    @property
    def is_expired(self):
        return self.expiry_date and self.expiry_date < timezone.localdate()


# ─────────────────────────────────────────────────────────────────────────────
# Requisition + cross-match + issue
# ─────────────────────────────────────────────────────────────────────────────

class BloodRequisition(models.Model):
    URGENCIES = [
        ("ROUTINE",   "Routine"),
        ("URGENT",    "Urgent (within 24h)"),
        ("EMERGENCY", "Emergency (immediate)"),
    ]
    STATUS = [
        ("PENDING",     "Pending review"),
        ("CROSSMATCH",  "Cross-matching in progress"),
        ("RESERVED",    "Bag(s) reserved"),
        ("ISSUED",      "Issued"),
        ("CANCELLED",   "Cancelled"),
        ("REJECTED",    "Rejected"),
    ]

    hospital = models.ForeignKey(
        "core.Hospital", on_delete=models.CASCADE, related_name="blood_requisitions",
    )
    code = models.CharField(max_length=30, unique=True, db_index=True,
        help_text="Auto-generated, e.g. BR-20260508-0001")

    patient = models.ForeignKey(
        "core.Patient", on_delete=models.PROTECT, related_name="blood_requisitions",
    )
    requested_by = models.ForeignKey(
        "specialist.Doctor", on_delete=models.PROTECT,
        related_name="blood_requisitions",
    )
    department = models.ForeignKey(
        "department.Department", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="blood_requisitions",
    )

    # Optional links — IPD admission or OT booking that needed the blood
    admission = models.ForeignKey(
        "ipd.Admission", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="blood_requisitions",
    )

    blood_group = models.CharField(max_length=10, choices=BLOOD_GROUPS,
        help_text="Patient's blood group (to find compatible donor groups)")
    component = models.CharField(max_length=15, choices=BloodBag.COMPONENTS,
                                  default="PRBC")
    units_required = models.PositiveIntegerField(default=1)

    urgency = models.CharField(max_length=12, choices=URGENCIES, default="ROUTINE")
    purpose = models.CharField(max_length=300,
        help_text="Clinical indication, e.g. 'Severe anaemia, Hb 6.2'")

    status = models.CharField(max_length=15, choices=STATUS, default="PENDING")

    # Audit
    rejection_reason = models.CharField(max_length=300, blank=True, default="")
    cancelled_reason = models.CharField(max_length=300, blank=True, default="")

    requested_at = models.DateTimeField(default=timezone.now)
    issued_at = models.DateTimeField(null=True, blank=True)

    notes = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-requested_at"]
        indexes = [
            models.Index(fields=["status", "urgency"]),
        ]

    def __str__(self):
        return f"{self.code} — {self.patient_id} — {self.units_required}u {self.component}"


class CrossMatch(models.Model):
    """Compatibility test between a requisition and a candidate bag."""
    RESULTS = [
        ("PENDING",      "Pending"),
        ("COMPATIBLE",   "Compatible"),
        ("INCOMPATIBLE", "Incompatible"),
    ]

    requisition = models.ForeignKey(
        BloodRequisition, on_delete=models.CASCADE, related_name="crossmatches",
    )
    bag = models.ForeignKey(
        BloodBag, on_delete=models.CASCADE, related_name="crossmatches",
    )
    result = models.CharField(max_length=15, choices=RESULTS, default="PENDING")
    notes = models.CharField(max_length=300, blank=True, default="")

    performed_by = models.ForeignKey(
        "accounts.User", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="crossmatches_performed",
    )
    performed_at = models.DateTimeField(default=timezone.now)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-performed_at"]
        unique_together = [["requisition", "bag"]]

    def __str__(self):
        return f"{self.requisition.code} ↔ {self.bag.bag_id}: {self.result}"


class BloodIssue(models.Model):
    """Record of bag actually issued to ward / OT for transfusion."""

    requisition = models.ForeignKey(
        BloodRequisition, on_delete=models.PROTECT, related_name="issues",
    )
    bag = models.OneToOneField(
        BloodBag, on_delete=models.PROTECT, related_name="issue",
    )

    issued_to_dept = models.CharField(
        max_length=80, blank=True, default="",
        help_text="e.g. 'ICU', 'OT-2', 'Ward 3B'",
    )
    issued_at = models.DateTimeField(default=timezone.now)
    issued_by = models.ForeignKey(
        "accounts.User", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="bags_issued",
    )

    # Recipient acknowledgment
    received_by_name = models.CharField(max_length=120, blank=True, default="",
        help_text="Name of nurse/staff receiving the bag")

    # Optional billing link
    invoice = models.ForeignKey(
        "billing.Invoice", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="blood_issues",
    )

    # Post-transfusion record (filled later)
    transfusion_started_at = models.DateTimeField(null=True, blank=True)
    transfusion_completed_at = models.DateTimeField(null=True, blank=True)
    reactions_observed = models.TextField(blank=True, default="")
    bag_returned = models.BooleanField(default=False,
        help_text="True if bag returned unused / partial")

    notes = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-issued_at"]

    def __str__(self):
        return f"Issue {self.bag.bag_id} → {self.requisition.code}"
