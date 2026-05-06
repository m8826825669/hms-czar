"""Core models - the foundation everything else builds on.

Hospital      : tenant root (multi-tenant ready, single hospital deployed initially)
Department    : org unit (Cardiology, Pediatrics, etc.)
Location      : physical location (room/ward/OT/store)
Patient       : single source of truth for patient identity across all modules
AuditLog      : structured audit trail for sensitive actions
"""
from __future__ import annotations
import uuid
from django.conf import settings
from django.db import models
from django.utils import timezone
from simple_history.models import HistoricalRecords


# ─── Base mixins ────────────────────────────────────────────

class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class TenantBaseModel(TimeStampedModel):
    """All hospital-scoped models inherit from this.
    Auto-filtered by hospital via middleware + manager.
    """
    hospital = models.ForeignKey(
        "core.Hospital",
        on_delete=models.PROTECT,
        related_name="+",
        db_index=True,
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True, blank=True,
        related_name="+",
    )
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        abstract = True


# ─── Hospital ───────────────────────────────────────────────

class Hospital(TimeStampedModel):
    code = models.CharField(max_length=20, unique=True)
    name = models.CharField(max_length=200)
    legal_name = models.CharField(max_length=200, blank=True)
    address_line1 = models.CharField(max_length=200)
    address_line2 = models.CharField(max_length=200, blank=True)
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=100)
    pincode = models.CharField(max_length=10)
    country = models.CharField(max_length=100, default="India")
    phone = models.CharField(max_length=20)
    email = models.EmailField()
    gst_number = models.CharField(max_length=15, blank=True, help_text="15-char GSTIN")
    pan_number = models.CharField(max_length=10, blank=True)
    registration_number = models.CharField(max_length=50, blank=True, help_text="Hospital licence/registration number")
    nabh_accredited = models.BooleanField(default=False)
    timezone = models.CharField(max_length=50, default="Asia/Kolkata")
    currency = models.CharField(max_length=3, default="INR")
    logo = models.ImageField(upload_to="hospital_logos/", blank=True, null=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.code})"


# ─── Department ─────────────────────────────────────────────

class Department(TenantBaseModel):
    DEPT_TYPES = [
        ("CLINICAL", "Clinical"),
        ("DIAGNOSTIC", "Diagnostic"),
        ("SUPPORT", "Support"),
        ("ADMIN", "Administrative"),
    ]
    code = models.CharField(max_length=20)
    name = models.CharField(max_length=100)
    dept_type = models.CharField(max_length=20, choices=DEPT_TYPES, default="CLINICAL")
    parent = models.ForeignKey("self", on_delete=models.SET_NULL, null=True, blank=True, related_name="children")
    head_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="headed_departments",
    )

    class Meta:
        unique_together = [("hospital", "code")]
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.code})"


# ─── Location ───────────────────────────────────────────────

class Location(TenantBaseModel):
    """Generic physical location. Wards/OTs/Stores etc. extend or reference this."""
    LOCATION_TYPES = [
        ("WARD", "Ward"),
        ("ROOM", "Room"),
        ("OT", "Operation Theatre"),
        ("ICU", "ICU"),
        ("LAB", "Laboratory"),
        ("PHARMACY", "Pharmacy"),
        ("STORE", "Store"),
        ("OPD", "OPD Cabin"),
        ("RECEPTION", "Reception"),
        ("OFFICE", "Office"),
        ("KITCHEN", "Kitchen"),
        ("LAUNDRY", "Laundry"),
        ("OTHER", "Other"),
    ]
    code = models.CharField(max_length=30)
    name = models.CharField(max_length=100)
    location_type = models.CharField(max_length=20, choices=LOCATION_TYPES, db_index=True)
    department = models.ForeignKey(Department, on_delete=models.SET_NULL, null=True, blank=True)
    floor = models.CharField(max_length=20, blank=True)
    block = models.CharField(max_length=20, blank=True)
    capacity = models.PositiveIntegerField(default=0, help_text="Beds, seats, or 0 if not applicable")

    class Meta:
        unique_together = [("hospital", "code")]
        ordering = ["location_type", "name"]

    def __str__(self):
        return f"{self.name} [{self.get_location_type_display()}]"


# ─── Patient ────────────────────────────────────────────────

class Patient(TenantBaseModel):
    """Single source of truth for patient identity. All clinical modules FK to this."""
    GENDER_CHOICES = [("M", "Male"), ("F", "Female"), ("O", "Other")]
    BLOOD_GROUPS = [(g, g) for g in ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "UNK"]]
    MARITAL_STATUS = [
        ("SINGLE", "Single"), ("MARRIED", "Married"),
        ("DIVORCED", "Divorced"), ("WIDOWED", "Widowed"),
    ]

    uuid = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    mrn = models.CharField(max_length=30, unique=True, db_index=True,
                           help_text="Medical Record Number, auto-generated")
    abha_id = models.CharField(max_length=20, blank=True, db_index=True,
                               help_text="ABDM Health ID (14-digit)")

    first_name = models.CharField(max_length=100)
    middle_name = models.CharField(max_length=100, blank=True)
    last_name = models.CharField(max_length=100, blank=True)
    dob = models.DateField()
    age_estimated = models.BooleanField(default=False, help_text="True if DOB is approximate")
    gender = models.CharField(max_length=1, choices=GENDER_CHOICES)
    blood_group = models.CharField(max_length=5, choices=BLOOD_GROUPS, default="UNK")
    marital_status = models.CharField(max_length=10, choices=MARITAL_STATUS, blank=True)

    phone = models.CharField(max_length=15, db_index=True)
    alt_phone = models.CharField(max_length=15, blank=True)
    email = models.EmailField(blank=True)

    aadhaar_last4 = models.CharField(max_length=4, blank=True,
                                     help_text="Last 4 digits only (DPDP compliance)")
    pan_number = models.CharField(max_length=10, blank=True)

    address_line1 = models.CharField(max_length=200, blank=True)
    address_line2 = models.CharField(max_length=200, blank=True)
    city = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=100, blank=True)
    pincode = models.CharField(max_length=10, blank=True)
    country = models.CharField(max_length=100, default="India")

    emergency_contact_name = models.CharField(max_length=100, blank=True)
    emergency_contact_phone = models.CharField(max_length=15, blank=True)
    emergency_contact_relation = models.CharField(max_length=50, blank=True)

    occupation = models.CharField(max_length=100, blank=True)
    nationality = models.CharField(max_length=50, default="Indian")

    allergies = models.JSONField(default=list, blank=True,
                                 help_text='List of dicts: [{"substance":"Penicillin","severity":"high"}]')
    chronic_conditions = models.JSONField(default=list, blank=True)
    current_medications = models.JSONField(default=list, blank=True)

    photo = models.ImageField(upload_to="patients/photos/", blank=True, null=True)
    is_vip = models.BooleanField(default=False)
    is_deceased = models.BooleanField(default=False)
    deceased_at = models.DateTimeField(null=True, blank=True)

    history = HistoricalRecords(table_name="core_patient_history")

    class Meta:
        indexes = [
            models.Index(fields=["hospital", "phone"]),
            models.Index(fields=["hospital", "first_name", "last_name"]),
        ]
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.full_name} ({self.mrn})"

    @property
    def full_name(self) -> str:
        parts = [self.first_name, self.middle_name, self.last_name]
        return " ".join(p for p in parts if p)

    @property
    def age(self) -> int:
        today = timezone.now().date()
        return today.year - self.dob.year - ((today.month, today.day) < (self.dob.month, self.dob.day))

    @classmethod
    def generate_mrn(cls, hospital: Hospital) -> str:
        from django.conf import settings
        prefix = getattr(settings, "HMS_MRN_PREFIX", "MRN")
        padding = getattr(settings, "HMS_MRN_PADDING", 8)
        last = cls.objects.filter(hospital=hospital).order_by("-id").first()
        next_num = (last.id + 1) if last else 1
        return f"{prefix}{str(next_num).zfill(padding)}"


# ─── Audit log ──────────────────────────────────────────────

class AuditLog(models.Model):
    """Catch-all audit log for non-model events (login, exports, break-glass, etc.)."""
    ACTIONS = [
        ("LOGIN", "Login"),
        ("LOGOUT", "Logout"),
        ("LOGIN_FAILED", "Login Failed"),
        ("PASSWORD_CHANGE", "Password Change"),
        ("PERM_CHANGE", "Permission Change"),
        ("DATA_EXPORT", "Data Export"),
        ("BREAK_GLASS", "Break-glass Access"),
        ("REPORT_GEN", "Report Generated"),
        ("BULK_IMPORT", "Bulk Import"),
        ("OTHER", "Other"),
    ]

    hospital = models.ForeignKey(Hospital, on_delete=models.PROTECT, null=True, blank=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    action = models.CharField(max_length=20, choices=ACTIONS, db_index=True)
    target_type = models.CharField(max_length=100, blank=True)
    target_id = models.CharField(max_length=100, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=500, blank=True)
    detail = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["action", "created_at"])]

    def __str__(self):
        return f"{self.action} by {self.user} @ {self.created_at:%Y-%m-%d %H:%M}"
