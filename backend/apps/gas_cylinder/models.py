"""
Medical Gas Cylinder tracking — Phase 3b.

Models:
  • CylinderType    — catalog (O2 / N2O / Med Air / CO2 / Vacuum) by size
  • Cylinder        — individual physical cylinder with serial + lifecycle
  • CylinderUsage   — usage event (issued to ward, returned, refilled, etc.)
  • RefillRecord    — vendor refill / purchase log
  • CylinderInspection — periodic safety check log
"""
from decimal import Decimal
from django.db import models
from django.utils import timezone
from datetime import timedelta


class CylinderType(models.Model):
    GAS_TYPES = [
        ("O2",      "Medical Oxygen"),
        ("N2O",     "Nitrous Oxide"),
        ("MED_AIR", "Medical Air"),
        ("CO2",     "Carbon Dioxide"),
        ("HELIUM",  "Helium"),
        ("ENTONOX", "Entonox (N2O+O2)"),
        ("VACUUM",  "Vacuum / Suction"),
    ]
    SIZES = [
        ("A",   "Size A (Small portable, ~150L)"),
        ("D",   "Size D (Portable, ~415L)"),
        ("E",   "Size E (Tank, ~680L)"),
        ("M",   "Size M (3000L)"),
        ("H",   "Size H (Jumbo, ~7000L)"),
        ("J",   "Size J (Huge, ~12000L)"),
        ("LIQ", "Liquid bulk tank"),
    ]

    hospital = models.ForeignKey("core.Hospital", on_delete=models.CASCADE,
                                  related_name="cylinder_types")
    code = models.CharField(max_length=20, db_index=True,
        help_text="Internal code, e.g. O2-D, N2O-E")
    gas_type = models.CharField(max_length=10, choices=GAS_TYPES)
    size = models.CharField(max_length=5, choices=SIZES)

    capacity_litres = models.PositiveIntegerField(default=0)
    typical_pressure_kpa = models.PositiveIntegerField(default=0,
        help_text="Working pressure in kPa, e.g. 13700 (137 bar)")

    # Cost / refill
    refill_cost = models.DecimalField(max_digits=10, decimal_places=2,
                                        default=Decimal("0"))
    deposit_amount = models.DecimalField(max_digits=10, decimal_places=2,
                                           default=Decimal("0"))

    is_active = models.BooleanField(default=True)
    notes = models.CharField(max_length=300, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["gas_type", "size"]
        unique_together = [["hospital", "code"]]

    def __str__(self):
        return f"{self.code} ({self.get_gas_type_display()} {self.size})"


class Cylinder(models.Model):
    STATUSES = [
        ("AVAILABLE",    "Available (Full)"),
        ("PARTIAL",      "Partial"),
        ("EMPTY",        "Empty (Awaiting Refill)"),
        ("AT_VENDOR",    "At Vendor (Refilling)"),
        ("IN_USE",       "In Use"),
        ("MAINTENANCE",  "Under Maintenance"),
        ("RETIRED",      "Retired / Condemned"),
    ]

    hospital = models.ForeignKey("core.Hospital", on_delete=models.CASCADE,
                                  related_name="cylinders")
    cylinder_type = models.ForeignKey(CylinderType, on_delete=models.PROTECT,
                                        related_name="cylinders")

    serial_number = models.CharField(max_length=40, unique=True, db_index=True,
        help_text="Manufacturer serial number")
    barcode = models.CharField(max_length=60, blank=True, default="",
        help_text="QR/barcode label for scanner workflow")

    status = models.CharField(max_length=15, choices=STATUSES, default="AVAILABLE",
                               db_index=True)
    fill_percentage = models.PositiveIntegerField(default=100,
        help_text="0-100, current fill level")

    # Current location
    current_location = models.CharField(max_length=120, blank=True, default="",
        help_text="e.g. 'OT-1', 'ICU-A', 'Storage Bay 2'")
    current_department = models.ForeignKey(
        "department.Department", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="cylinders",
    )

    # Manufacture / safety
    manufacture_date = models.DateField(null=True, blank=True)
    manufacturer = models.CharField(max_length=120, blank=True, default="")
    last_hydro_test = models.DateField(null=True, blank=True,
        help_text="Last hydrostatic test date")
    next_hydro_test_due = models.DateField(null=True, blank=True)

    # Last refill
    last_refilled_at = models.DateTimeField(null=True, blank=True)
    refill_count = models.PositiveIntegerField(default=0)

    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["cylinder_type__gas_type", "serial_number"]
        indexes = [
            models.Index(fields=["status", "cylinder_type"]),
        ]

    def __str__(self):
        return f"{self.serial_number} ({self.cylinder_type.code})"

    @property
    def is_hydro_test_due(self):
        if not self.next_hydro_test_due:
            return False
        return self.next_hydro_test_due <= timezone.localdate()


class CylinderUsage(models.Model):
    EVENT_TYPES = [
        ("ISSUED",     "Issued to Ward / Department"),
        ("RETURNED",   "Returned to Storage"),
        ("CONNECTED",  "Connected to Patient / Manifold"),
        ("DISCONNECTED","Disconnected"),
        ("REFILL_OUT", "Sent for Refill"),
        ("REFILL_IN",  "Received from Refill"),
        ("INSPECTION", "Routine Inspection"),
        ("DISCARDED",  "Discarded"),
    ]

    cylinder = models.ForeignKey(Cylinder, on_delete=models.CASCADE,
                                  related_name="usage_log")
    event_type = models.CharField(max_length=15, choices=EVENT_TYPES)
    department = models.ForeignKey(
        "department.Department", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="cylinder_usage",
    )
    location = models.CharField(max_length=120, blank=True, default="")
    fill_at_event = models.PositiveIntegerField(default=0,
        help_text="Fill % at time of event")

    handled_by = models.ForeignKey("accounts.User", on_delete=models.SET_NULL,
                                     null=True, blank=True)
    received_by = models.CharField(max_length=120, blank=True, default="",
        help_text="Free-text staff name receiving the cylinder")

    notes = models.CharField(max_length=300, blank=True, default="")
    timestamp = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        ordering = ["-timestamp"]


class RefillRecord(models.Model):
    """Vendor refill / purchase order history."""
    hospital = models.ForeignKey("core.Hospital", on_delete=models.CASCADE,
                                  related_name="cylinder_refills")
    code = models.CharField(max_length=30, unique=True, db_index=True,
        help_text="Auto-generated, e.g. RF-20260508-0001")

    vendor_name = models.CharField(max_length=120)
    vendor_contact = models.CharField(max_length=80, blank=True, default="")

    sent_at = models.DateTimeField(default=timezone.now)
    expected_return_at = models.DateTimeField(null=True, blank=True)
    received_at = models.DateTimeField(null=True, blank=True)

    cylinders_sent = models.PositiveIntegerField(default=0)
    cylinders_received = models.PositiveIntegerField(default=0)
    total_cost = models.DecimalField(max_digits=10, decimal_places=2,
                                       default=Decimal("0"))
    invoice_reference = models.CharField(max_length=80, blank=True, default="")

    is_completed = models.BooleanField(default=False)
    notes = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["-sent_at"]


class CylinderInspection(models.Model):
    """Periodic safety / hydro-test record."""
    INSPECTION_TYPES = [
        ("VISUAL",  "Visual Inspection"),
        ("PRESSURE","Pressure Test"),
        ("HYDRO",   "Hydrostatic Test"),
        ("VALVE",   "Valve Inspection"),
        ("PURITY",  "Gas Purity Test"),
    ]
    OUTCOMES = [
        ("PASSED",     "Passed"),
        ("FAILED",     "Failed"),
        ("CONDITIONAL","Conditional Pass (recheck recommended)"),
    ]

    cylinder = models.ForeignKey(Cylinder, on_delete=models.CASCADE,
                                   related_name="inspections")
    inspection_type = models.CharField(max_length=15, choices=INSPECTION_TYPES)
    outcome = models.CharField(max_length=15, choices=OUTCOMES, default="PASSED")
    inspected_by = models.CharField(max_length=120, blank=True, default="")
    inspection_date = models.DateField(default=timezone.now)
    next_due_date = models.DateField(null=True, blank=True)
    findings = models.TextField(blank=True, default="")
    certificate_ref = models.CharField(max_length=80, blank=True, default="")

    class Meta:
        ordering = ["-inspection_date"]
