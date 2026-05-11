"""
Security module — Phase 4b.

Models:
  • VisitorPass     — visitor entry record with photo
  • GatePass        — material/equipment exit authorization
  • Incident        — security/safety incident log
  • SecurityGuard   — guard roster
"""
from decimal import Decimal
from django.db import models
from django.utils import timezone


class SecurityGuard(models.Model):
    hospital = models.ForeignKey("core.Hospital", on_delete=models.CASCADE,
                                  related_name="security_guards")
    employee_code = models.CharField(max_length=20, unique=True, db_index=True)
    full_name = models.CharField(max_length=120)
    phone = models.CharField(max_length=20, blank=True, default="")
    is_supervisor = models.BooleanField(default=False)
    posted_at = models.CharField(max_length=100, blank=True, default="",
        help_text="Gate / area assigned")
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["full_name"]


class VisitorPass(models.Model):
    STATUSES = [
        ("ACTIVE",   "Active (Inside)"),
        ("EXITED",   "Exited"),
        ("EXPIRED",  "Expired (Auto)"),
        ("CANCELLED","Cancelled"),
    ]
    VISIT_TYPES = [
        ("PATIENT",  "Patient Visit"),
        ("ATTENDANT","Patient Attendant"),
        ("VENDOR",   "Vendor / Supplier"),
        ("OFFICIAL", "Official"),
        ("DELIVERY", "Delivery / Courier"),
        ("OTHER",    "Other"),
    ]

    hospital = models.ForeignKey("core.Hospital", on_delete=models.CASCADE,
                                  related_name="visitor_passes")
    pass_number = models.CharField(max_length=30, unique=True, db_index=True,
        help_text="Auto-generated, e.g. VST-20260508-0001")

    # Visitor info
    visitor_name = models.CharField(max_length=120)
    visitor_phone = models.CharField(max_length=20, db_index=True)
    id_proof_type = models.CharField(max_length=30, blank=True, default="",
        help_text="Aadhaar/PAN/Driving License/Voter ID")
    id_proof_number = models.CharField(max_length=30, blank=True, default="")
    photo_url = models.URLField(blank=True, default="")

    # Visit details
    visit_type = models.CharField(max_length=12, choices=VISIT_TYPES,
                                     default="PATIENT")
    purpose = models.CharField(max_length=300, blank=True, default="")
    visiting_patient = models.ForeignKey(
        "reception.Patient", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="visitor_passes",
    )
    visiting_person = models.CharField(max_length=120, blank=True, default="",
        help_text="If not visiting a registered patient")
    relationship = models.CharField(max_length=50, blank=True, default="")

    # Locations
    department_to_visit = models.ForeignKey(
        "department.Department", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="visitor_passes",
    )
    room_number = models.CharField(max_length=20, blank=True, default="")

    # Timing
    entry_time = models.DateTimeField(default=timezone.now)
    expected_exit_time = models.DateTimeField(null=True, blank=True)
    actual_exit_time = models.DateTimeField(null=True, blank=True)

    status = models.CharField(max_length=10, choices=STATUSES, default="ACTIVE",
                                db_index=True)

    issued_by = models.ForeignKey(SecurityGuard, on_delete=models.SET_NULL,
                                     null=True, blank=True,
                                     related_name="issued_passes")
    exit_logged_by = models.ForeignKey(SecurityGuard, on_delete=models.SET_NULL,
                                          null=True, blank=True,
                                          related_name="exit_logged_passes")
    notes = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-entry_time"]
        indexes = [
            models.Index(fields=["status", "entry_time"]),
        ]


class GatePass(models.Model):
    PASS_TYPES = [
        ("RETURNABLE",     "Returnable"),
        ("NON_RETURNABLE", "Non-returnable"),
    ]
    STATUSES = [
        ("ISSUED",     "Issued (Out)"),
        ("RETURNED",   "Returned"),
        ("OVERDUE",    "Overdue"),
        ("CLOSED",     "Closed"),
        ("CANCELLED",  "Cancelled"),
    ]

    hospital = models.ForeignKey("core.Hospital", on_delete=models.CASCADE,
                                  related_name="gate_passes")
    pass_number = models.CharField(max_length=30, unique=True, db_index=True,
        help_text="Auto-generated, e.g. GP-20260508-0001")

    pass_type = models.CharField(max_length=15, choices=PASS_TYPES,
                                    default="RETURNABLE")
    items_description = models.TextField(
        help_text="Itemized list of goods/equipment going out")
    purpose = models.TextField()

    sender_department = models.ForeignKey(
        "department.Department", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="sent_gate_passes",
    )
    issued_to_party = models.CharField(max_length=200,
        help_text="Person/company taking material out")
    issued_to_phone = models.CharField(max_length=20, blank=True, default="")
    vehicle_number = models.CharField(max_length=20, blank=True, default="")

    issued_at = models.DateTimeField(default=timezone.now)
    expected_return_at = models.DateTimeField(null=True, blank=True)
    actual_return_at = models.DateTimeField(null=True, blank=True)

    estimated_value = models.DecimalField(max_digits=12, decimal_places=2,
                                            default=Decimal("0"))
    status = models.CharField(max_length=12, choices=STATUSES, default="ISSUED")

    issued_by = models.ForeignKey("accounts.User", on_delete=models.SET_NULL,
                                     null=True, blank=True,
                                     related_name="issued_gate_passes")
    approved_by = models.ForeignKey("accounts.User", on_delete=models.SET_NULL,
                                       null=True, blank=True,
                                       related_name="approved_gate_passes")
    received_at_gate_by = models.ForeignKey(
        SecurityGuard, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="gate_passes_received",
    )
    notes = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-issued_at"]


class Incident(models.Model):
    INCIDENT_TYPES = [
        ("THEFT",      "Theft / Burglary"),
        ("VIOLENCE",   "Violence / Assault"),
        ("VANDALISM",  "Vandalism"),
        ("FIRE",       "Fire / Smoke"),
        ("MEDICAL",    "Medical Emergency"),
        ("UNAUTH",     "Unauthorized Entry"),
        ("LOST_FOUND", "Lost & Found"),
        ("ACCIDENT",   "Accident"),
        ("OTHER",      "Other"),
    ]
    SEVERITY = [
        ("LOW",      "Low"),
        ("MEDIUM",   "Medium"),
        ("HIGH",     "High"),
        ("CRITICAL", "Critical"),
    ]
    STATUSES = [
        ("REPORTED",     "Reported"),
        ("UNDER_REVIEW", "Under Review"),
        ("RESOLVED",     "Resolved"),
        ("ESCALATED",    "Escalated to Police"),
        ("CLOSED",       "Closed"),
    ]

    hospital = models.ForeignKey("core.Hospital", on_delete=models.CASCADE,
                                  related_name="incidents")
    incident_number = models.CharField(max_length=30, unique=True, db_index=True,
        help_text="Auto-generated, e.g. INC-20260508-0001")

    incident_type = models.CharField(max_length=12, choices=INCIDENT_TYPES)
    severity = models.CharField(max_length=10, choices=SEVERITY, default="LOW")
    status = models.CharField(max_length=12, choices=STATUSES, default="REPORTED")

    occurred_at = models.DateTimeField(default=timezone.now)
    location = models.CharField(max_length=200)
    department = models.ForeignKey(
        "department.Department", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="incidents",
    )

    title = models.CharField(max_length=200)
    description = models.TextField()
    persons_involved = models.TextField(blank=True, default="")
    witnesses = models.TextField(blank=True, default="")

    reported_by = models.ForeignKey("accounts.User", on_delete=models.SET_NULL,
                                       null=True, blank=True,
                                       related_name="reported_incidents")
    handled_by = models.ForeignKey(SecurityGuard, on_delete=models.SET_NULL,
                                      null=True, blank=True,
                                      related_name="handled_incidents")

    police_involved = models.BooleanField(default=False)
    fir_number = models.CharField(max_length=50, blank=True, default="")
    estimated_loss = models.DecimalField(max_digits=12, decimal_places=2,
                                            default=Decimal("0"))

    actions_taken = models.TextField(blank=True, default="")
    resolution = models.TextField(blank=True, default="")
    resolved_at = models.DateTimeField(null=True, blank=True)

    notes = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-occurred_at"]
