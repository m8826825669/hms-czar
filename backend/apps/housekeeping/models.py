"""
Housekeeping module — Phase 4a.

Models:
  • HKZone               — physical zone (ward / OT / lobby / toilet block)
  • HKStaff              — housekeeping staff with shifts
  • HKTaskTemplate       — recurring task definition (e.g. mopping x 4 daily)
  • HKTaskAssignment     — specific task instance assigned to staff
  • DeepCleaningSchedule — periodic deep clean / fumigation log
"""
from decimal import Decimal
from django.db import models
from django.utils import timezone


class HKZone(models.Model):
    ZONE_TYPES = [
        ("WARD",       "Ward / Patient Room"),
        ("OT",         "Operation Theatre"),
        ("ICU",        "ICU"),
        ("OPD",        "OPD / Consultation"),
        ("LAB",        "Laboratory"),
        ("LOBBY",      "Lobby / Public Area"),
        ("TOILET",     "Toilet / Restroom"),
        ("KITCHEN",    "Kitchen"),
        ("CORRIDOR",   "Corridor"),
        ("CAFETERIA",  "Cafeteria"),
        ("OFFICE",     "Office"),
        ("STORE",      "Store"),
        ("OTHER",      "Other"),
    ]
    CRITICALITY = [
        ("HIGH",   "High (OT, ICU, isolation)"),
        ("MEDIUM", "Medium (wards, labs)"),
        ("LOW",    "Low (offices, corridors)"),
    ]

    hospital = models.ForeignKey("core.Hospital", on_delete=models.CASCADE,
                                  related_name="hk_zones")
    code = models.CharField(max_length=20, db_index=True)
    name = models.CharField(max_length=120)
    zone_type = models.CharField(max_length=15, choices=ZONE_TYPES)
    criticality = models.CharField(max_length=10, choices=CRITICALITY,
                                     default="MEDIUM")

    floor = models.CharField(max_length=20, blank=True, default="")
    area_sqft = models.PositiveIntegerField(default=0)
    department = models.ForeignKey(
        "department.Department", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="hk_zones",
    )
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["floor", "code"]
        unique_together = [["hospital", "code"]]

    def __str__(self):
        return f"{self.code} — {self.name}"


class HKStaff(models.Model):
    ROLES = [
        ("CLEANER",     "Cleaner"),
        ("SUPERVISOR",  "Supervisor"),
        ("DEEP_CLEAN",  "Deep Cleaning Specialist"),
        ("PEST",        "Pest Control"),
    ]
    SHIFTS = [
        ("MORNING",   "Morning (06-14)"),
        ("AFTERNOON", "Afternoon (14-22)"),
        ("NIGHT",     "Night (22-06)"),
        ("FLEXI",     "Flexi"),
    ]

    hospital = models.ForeignKey("core.Hospital", on_delete=models.CASCADE,
                                  related_name="hk_staff")
    employee_code = models.CharField(max_length=20, unique=True, db_index=True)
    full_name = models.CharField(max_length=120)
    phone = models.CharField(max_length=20, blank=True, default="")
    role = models.CharField(max_length=12, choices=ROLES, default="CLEANER")
    shift = models.CharField(max_length=10, choices=SHIFTS, default="FLEXI")
    is_on_duty = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["full_name"]
        verbose_name = "Housekeeping Staff"
        verbose_name_plural = "Housekeeping Staff"


class HKTaskTemplate(models.Model):
    """Defines what should be done, how often, in which zone."""
    FREQUENCIES = [
        ("HOURLY",   "Hourly"),
        ("EVERY_2H", "Every 2 hours"),
        ("EVERY_4H", "Every 4 hours"),
        ("DAILY",    "Once Daily"),
        ("TWICE",    "Twice Daily"),
        ("THRICE",   "Thrice Daily"),
        ("WEEKLY",   "Weekly"),
        ("MONTHLY",  "Monthly"),
    ]
    TASK_TYPES = [
        ("MOP",     "Floor Mopping"),
        ("SWEEP",   "Sweeping"),
        ("DUST",    "Dusting"),
        ("SANITIZE","Sanitization"),
        ("WASTE",   "Waste Collection"),
        ("LINEN",   "Linen Change"),
        ("DEEP",    "Deep Cleaning"),
        ("FUMIGATE","Fumigation"),
        ("OTHER",   "Other"),
    ]

    hospital = models.ForeignKey("core.Hospital", on_delete=models.CASCADE,
                                  related_name="hk_task_templates")
    code = models.CharField(max_length=20, db_index=True)
    name = models.CharField(max_length=120)
    task_type = models.CharField(max_length=10, choices=TASK_TYPES)
    zone = models.ForeignKey(HKZone, on_delete=models.CASCADE,
                                related_name="task_templates")
    frequency = models.CharField(max_length=10, choices=FREQUENCIES, default="DAILY")
    duration_minutes = models.PositiveIntegerField(default=15)
    instructions = models.TextField(blank=True, default="")
    chemicals_required = models.CharField(max_length=300, blank=True, default="")
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["zone", "task_type"]
        unique_together = [["hospital", "code"]]


class HKTaskAssignment(models.Model):
    """A specific task instance assigned to staff for a date+slot."""
    STATUSES = [
        ("PENDING",   "Pending"),
        ("IN_PROGRESS", "In Progress"),
        ("COMPLETED", "Completed"),
        ("MISSED",    "Missed"),
        ("REJECTED",  "Rejected (Quality Check)"),
        ("CANCELLED", "Cancelled"),
    ]

    template = models.ForeignKey(HKTaskTemplate, on_delete=models.CASCADE,
                                    related_name="assignments")
    zone = models.ForeignKey(HKZone, on_delete=models.CASCADE,
                                related_name="task_assignments")
    assigned_to = models.ForeignKey(HKStaff, on_delete=models.SET_NULL,
                                       null=True, blank=True,
                                       related_name="assigned_tasks")
    scheduled_date = models.DateField(db_index=True)
    scheduled_time = models.TimeField(null=True, blank=True)

    status = models.CharField(max_length=12, choices=STATUSES, default="PENDING",
                                db_index=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    # Quality check
    inspected_by = models.ForeignKey(HKStaff, on_delete=models.SET_NULL,
                                        null=True, blank=True,
                                        related_name="inspected_tasks")
    quality_rating = models.PositiveIntegerField(
        null=True, blank=True,
        help_text="1-5 stars from supervisor check")
    quality_notes = models.CharField(max_length=300, blank=True, default="")

    notes = models.CharField(max_length=300, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["scheduled_date", "scheduled_time"]
        indexes = [
            models.Index(fields=["status", "scheduled_date"]),
            models.Index(fields=["assigned_to", "scheduled_date"]),
        ]


class DeepCleaningSchedule(models.Model):
    """Periodic deep cleaning / fumigation log."""
    EVENT_TYPES = [
        ("DEEP_CLEAN", "Deep Cleaning"),
        ("FUMIGATION", "Fumigation"),
        ("PEST",       "Pest Control"),
        ("DISINFECT",  "Terminal Disinfection"),
    ]
    STATUSES = [
        ("SCHEDULED", "Scheduled"),
        ("IN_PROGRESS","In Progress"),
        ("COMPLETED", "Completed"),
        ("CANCELLED", "Cancelled"),
    ]

    hospital = models.ForeignKey("core.Hospital", on_delete=models.CASCADE,
                                  related_name="deep_cleanings")
    zone = models.ForeignKey(HKZone, on_delete=models.CASCADE,
                                related_name="deep_cleanings")
    event_type = models.CharField(max_length=12, choices=EVENT_TYPES)

    scheduled_date = models.DateField()
    completed_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=12, choices=STATUSES, default="SCHEDULED")

    vendor_name = models.CharField(max_length=200, blank=True, default="",
        help_text="External vendor if outsourced")
    chemicals_used = models.TextField(blank=True, default="")
    cost = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0"))

    next_due_date = models.DateField(null=True, blank=True)
    certificate_reference = models.CharField(max_length=80, blank=True, default="")
    notes = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-scheduled_date"]
