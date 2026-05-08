"""Department module — used by pharmacy, lab, IPD, OPD service grouping."""
from django.db import models
from apps.core.models import TenantBaseModel


class Department(TenantBaseModel):
    """Hospital organizational unit — Cardiology, Pharmacy, Radiology, ICU etc."""
    TYPES = [
        ("CLINICAL", "Clinical (sees patients)"),
        ("DIAGNOSTIC", "Diagnostic (lab, imaging)"),
        ("PHARMACY", "Pharmacy"),
        ("WARD", "Ward / IPD"),
        ("OT", "Operation Theatre"),
        ("ADMIN", "Administrative"),
        ("SUPPORT", "Support (housekeeping, security, etc.)"),
    ]

    code = models.CharField(max_length=20, db_index=True,
        help_text="Unique short code, e.g. CARDIO, PHARM, RADIO")
    name = models.CharField(max_length=120)
    type = models.CharField(max_length=12, choices=TYPES, default="CLINICAL")
    description = models.TextField(blank=True)
    head_doctor = models.ForeignKey(
        "specialist.Doctor", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="headed_departments",
    )
    location_hint = models.CharField(max_length=100, blank=True,
        help_text="e.g. 2nd floor, Block-A")
    phone_extn = models.CharField(max_length=10, blank=True)
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        unique_together = [("hospital", "code")]
        ordering = ["sort_order", "name"]
        indexes = [models.Index(fields=["type", "is_active"])]

    def __str__(self):
        return f"{self.code} — {self.name}"
