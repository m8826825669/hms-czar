"""
Ambulance module — Phase 3b.

Models:
  • Ambulance        — vehicle registry (BLS / ALS / mortuary / patient transport)
  • AmbulanceDriver  — drivers + paramedics
  • Dispatch         — call → assign → en-route → on-scene → patient picked → at-hospital → completed
  • DispatchLog      — GPS / status update events for audit trail
"""
from decimal import Decimal
from django.db import models
from django.utils import timezone
from django.core.validators import MinValueValidator


class Ambulance(models.Model):
    AMBULANCE_TYPES = [
        ("BLS",     "Basic Life Support (BLS)"),
        ("ALS",     "Advanced Life Support (ALS)"),
        ("CARDIAC", "Cardiac Care Ambulance"),
        ("MORTUARY","Mortuary / Hearse"),
        ("PT",      "Patient Transport"),
        ("NEONATAL","Neonatal"),
    ]
    STATUSES = [
        ("AVAILABLE",   "Available"),
        ("DISPATCHED",  "Dispatched / On Call"),
        ("MAINTENANCE", "Under Maintenance"),
        ("OUT_OF_SERVICE", "Out of Service"),
    ]

    hospital = models.ForeignKey("core.Hospital", on_delete=models.CASCADE,
                                  related_name="ambulances")
    code = models.CharField(max_length=20, db_index=True,
        help_text="Internal code, e.g. AMB-01, AMB-ALS-A")
    registration_number = models.CharField(max_length=20, unique=True,
        help_text="Vehicle RC number, e.g. UP-14-AB-1234")
    ambulance_type = models.CharField(max_length=15, choices=AMBULANCE_TYPES,
                                       default="BLS")
    make_model = models.CharField(max_length=100, blank=True, default="",
        help_text="e.g. Force Traveller, Tata Winger")
    year = models.PositiveIntegerField(default=2020)

    status = models.CharField(max_length=20, choices=STATUSES, default="AVAILABLE")

    # Equipment manifest (JSON list of items)
    equipment_list = models.TextField(blank=True, default="",
        help_text="Comma-separated list, e.g. 'Defibrillator, Oxygen, ECG monitor'")
    base_location = models.CharField(max_length=120, blank=True, default="")

    # GPS (last known)
    last_lat = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    last_lng = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    last_location_update = models.DateTimeField(null=True, blank=True)

    # Pricing
    base_price = models.DecimalField(
        max_digits=10, decimal_places=2, default=Decimal("500"),
        help_text="Flag-down / call-out fee")
    per_km_rate = models.DecimalField(
        max_digits=10, decimal_places=2, default=Decimal("20"),
        help_text="₹ per kilometre")

    # Insurance / fitness
    insurance_expiry = models.DateField(null=True, blank=True)
    fitness_expiry = models.DateField(null=True, blank=True)
    puc_expiry = models.DateField(null=True, blank=True)

    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["code"]
        unique_together = [["hospital", "code"]]

    def __str__(self):
        return f"{self.code} ({self.registration_number})"


class AmbulanceDriver(models.Model):
    ROLES = [
        ("DRIVER",     "Driver"),
        ("PARAMEDIC",  "Paramedic"),
        ("EMT",        "EMT"),
        ("DRIVER_PARAMEDIC", "Driver-cum-Paramedic"),
    ]
    SHIFTS = [
        ("MORNING",   "Morning (06-14)"),
        ("AFTERNOON", "Afternoon (14-22)"),
        ("NIGHT",     "Night (22-06)"),
        ("FLEXI",     "Flexi"),
    ]

    hospital = models.ForeignKey("core.Hospital", on_delete=models.CASCADE,
                                  related_name="ambulance_drivers")
    employee_code = models.CharField(max_length=30, unique=True)
    full_name = models.CharField(max_length=120)
    phone = models.CharField(max_length=20, db_index=True)
    role = models.CharField(max_length=20, choices=ROLES, default="DRIVER")
    license_number = models.CharField(max_length=30, blank=True, default="")
    license_expiry = models.DateField(null=True, blank=True)

    shift = models.CharField(max_length=10, choices=SHIFTS, default="FLEXI")
    is_on_duty = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)

    notes = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["full_name"]

    def __str__(self):
        return f"{self.employee_code} — {self.full_name} ({self.get_role_display()})"


class Dispatch(models.Model):
    CALL_TYPES = [
        ("EMERGENCY",       "Emergency Pickup"),
        ("INTER_HOSPITAL",  "Inter-hospital Transfer"),
        ("DISCHARGE",       "Discharge Drop-off"),
        ("MORTUARY",        "Mortuary Transport"),
        ("OTHER",           "Other"),
    ]
    PRIORITIES = [
        ("CRITICAL",  "Critical (red)"),
        ("URGENT",    "Urgent (orange)"),
        ("ROUTINE",   "Routine (green)"),
    ]
    STATUSES = [
        ("REQUESTED",   "Requested"),
        ("ASSIGNED",    "Ambulance Assigned"),
        ("EN_ROUTE",    "En-route to Pickup"),
        ("ON_SCENE",    "On Scene"),
        ("PATIENT_PICKED", "Patient Picked Up"),
        ("AT_HOSPITAL", "Arrived at Hospital"),
        ("COMPLETED",   "Completed"),
        ("CANCELLED",   "Cancelled"),
    ]

    hospital = models.ForeignKey("core.Hospital", on_delete=models.CASCADE,
                                  related_name="ambulance_dispatches")
    code = models.CharField(max_length=30, unique=True, db_index=True,
        help_text="Auto-generated, e.g. AMB-20260508-0001")

    call_type = models.CharField(max_length=20, choices=CALL_TYPES, default="EMERGENCY")
    priority = models.CharField(max_length=10, choices=PRIORITIES, default="URGENT")

    # Patient (may be unknown at first)
    patient = models.ForeignKey("core.Patient", on_delete=models.SET_NULL,
                                 null=True, blank=True, related_name="ambulance_dispatches")
    patient_name_temp = models.CharField(max_length=120, blank=True, default="",
        help_text="If patient not yet registered")
    patient_phone_temp = models.CharField(max_length=20, blank=True, default="")

    # Caller
    caller_name = models.CharField(max_length=120, blank=True, default="")
    caller_phone = models.CharField(max_length=20, blank=True, default="")
    caller_relation = models.CharField(max_length=40, blank=True, default="",
        help_text="Family / bystander / police / etc.")

    # Location
    pickup_address = models.TextField()
    pickup_lat = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    pickup_lng = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    pickup_landmark = models.CharField(max_length=200, blank=True, default="")

    drop_address = models.TextField(blank=True, default="",
        help_text="Defaults to hospital address; can be another facility")

    # Clinical info from caller
    chief_complaint = models.CharField(max_length=300, blank=True, default="")
    age_estimate = models.PositiveIntegerField(null=True, blank=True)
    is_conscious = models.BooleanField(null=True, blank=True)
    is_breathing = models.BooleanField(null=True, blank=True)

    # Assignment
    ambulance = models.ForeignKey(Ambulance, on_delete=models.SET_NULL,
                                   null=True, blank=True, related_name="dispatches")
    driver = models.ForeignKey(AmbulanceDriver, on_delete=models.SET_NULL,
                                null=True, blank=True, related_name="driven_dispatches")
    paramedic = models.ForeignKey(AmbulanceDriver, on_delete=models.SET_NULL,
                                   null=True, blank=True, related_name="paramedic_dispatches")

    # Timestamps for SLA
    requested_at = models.DateTimeField(default=timezone.now)
    assigned_at = models.DateTimeField(null=True, blank=True)
    en_route_at = models.DateTimeField(null=True, blank=True)
    on_scene_at = models.DateTimeField(null=True, blank=True)
    patient_picked_at = models.DateTimeField(null=True, blank=True)
    at_hospital_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    status = models.CharField(max_length=15, choices=STATUSES, default="REQUESTED",
                               db_index=True)

    # Distance + billing
    distance_km = models.DecimalField(max_digits=8, decimal_places=2,
                                       null=True, blank=True)
    invoice = models.OneToOneField("billing.Invoice", on_delete=models.SET_NULL,
                                    null=True, blank=True, related_name="ambulance_dispatch")

    # Cancellation
    cancellation_reason = models.CharField(max_length=300, blank=True, default="")

    notes = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-requested_at"]
        indexes = [
            models.Index(fields=["status", "priority"]),
            models.Index(fields=["ambulance", "status"]),
        ]

    def __str__(self):
        return f"{self.code} — {self.get_status_display()}"

    @property
    def response_time_seconds(self):
        if self.en_route_at and self.requested_at:
            return int((self.en_route_at - self.requested_at).total_seconds())
        return None


class DispatchLog(models.Model):
    """Append-only event log for audit + GPS trail."""
    EVENT_TYPES = [
        ("STATUS_CHANGE", "Status Change"),
        ("GPS_UPDATE",    "GPS Update"),
        ("NOTE",          "Note"),
    ]

    dispatch = models.ForeignKey(Dispatch, on_delete=models.CASCADE,
                                  related_name="logs")
    event_type = models.CharField(max_length=20, choices=EVENT_TYPES)
    from_status = models.CharField(max_length=15, blank=True, default="")
    to_status = models.CharField(max_length=15, blank=True, default="")
    lat = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    lng = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    note = models.CharField(max_length=300, blank=True, default="")
    user = models.ForeignKey("accounts.User", on_delete=models.SET_NULL,
                              null=True, blank=True)
    timestamp = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        ordering = ["-timestamp"]
