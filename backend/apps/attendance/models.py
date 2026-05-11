"""
Attendance module — Phase 4b.

Models:
  • Shift                 — shift definition (Morning/Afternoon/Night/Custom)
  • ShiftRoster           — assignment of employee to shift on date
  • AttendanceLog         — in/out punches
  • DailyAttendance       — summarized daily attendance (computed)
  • Overtime              — overtime hours recorded
  • Holiday               — public holidays
"""
from decimal import Decimal
from django.db import models
from django.utils import timezone


class Shift(models.Model):
    hospital = models.ForeignKey("core.Hospital", on_delete=models.CASCADE,
                                  related_name="shifts")
    code = models.CharField(max_length=20, db_index=True)
    name = models.CharField(max_length=80)
    start_time = models.TimeField()
    end_time = models.TimeField()
    break_minutes = models.PositiveIntegerField(default=30)
    work_hours = models.DecimalField(max_digits=4, decimal_places=2, default=Decimal("8"))
    is_night_shift = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["start_time"]
        unique_together = [["hospital", "code"]]

    def __str__(self):
        return f"{self.code} ({self.start_time}-{self.end_time})"


class Holiday(models.Model):
    hospital = models.ForeignKey("core.Hospital", on_delete=models.CASCADE,
                                  related_name="holidays")
    date = models.DateField(db_index=True)
    name = models.CharField(max_length=100)
    is_optional = models.BooleanField(default=False)

    class Meta:
        ordering = ["date"]
        unique_together = [["hospital", "date"]]


class ShiftRoster(models.Model):
    employee = models.ForeignKey("hr.Employee", on_delete=models.CASCADE,
                                    related_name="rosters")
    shift = models.ForeignKey(Shift, on_delete=models.PROTECT, related_name="rosters")
    work_date = models.DateField(db_index=True)
    is_off_day = models.BooleanField(default=False)
    notes = models.CharField(max_length=200, blank=True, default="")

    class Meta:
        ordering = ["work_date"]
        unique_together = [["employee", "work_date"]]


class AttendanceLog(models.Model):
    PUNCH_TYPES = [("IN", "Punch In"), ("OUT", "Punch Out")]
    SOURCES = [
        ("MANUAL",   "Manual Entry"),
        ("BIOMETRIC","Biometric"),
        ("WEB",      "Web App"),
        ("MOBILE",   "Mobile App"),
        ("CARD",     "Access Card"),
    ]
    employee = models.ForeignKey("hr.Employee", on_delete=models.CASCADE,
                                    related_name="attendance_logs")
    punch_time = models.DateTimeField(default=timezone.now, db_index=True)
    punch_type = models.CharField(max_length=3, choices=PUNCH_TYPES)
    source = models.CharField(max_length=10, choices=SOURCES, default="MANUAL")
    location = models.CharField(max_length=200, blank=True, default="")
    notes = models.CharField(max_length=200, blank=True, default="")
    recorded_by = models.ForeignKey("accounts.User", on_delete=models.SET_NULL,
                                       null=True, blank=True,
                                       related_name="attendance_records")

    class Meta:
        ordering = ["-punch_time"]
        indexes = [
            models.Index(fields=["employee", "punch_time"]),
        ]


class DailyAttendance(models.Model):
    STATUSES = [
        ("PRESENT",    "Present"),
        ("ABSENT",     "Absent"),
        ("HALF_DAY",   "Half Day"),
        ("LATE",       "Late"),
        ("ON_LEAVE",   "On Leave"),
        ("HOLIDAY",    "Holiday"),
        ("OFF_DAY",    "Off Day"),
        ("WEEKEND",    "Weekend"),
    ]
    employee = models.ForeignKey("hr.Employee", on_delete=models.CASCADE,
                                    related_name="daily_attendance")
    work_date = models.DateField(db_index=True)
    status = models.CharField(max_length=10, choices=STATUSES, default="ABSENT")

    check_in_time = models.DateTimeField(null=True, blank=True)
    check_out_time = models.DateTimeField(null=True, blank=True)
    hours_worked = models.DecimalField(max_digits=5, decimal_places=2,
                                          default=Decimal("0"))
    overtime_hours = models.DecimalField(max_digits=5, decimal_places=2,
                                            default=Decimal("0"))

    late_minutes = models.PositiveIntegerField(default=0)
    early_leave_minutes = models.PositiveIntegerField(default=0)
    is_remarked = models.BooleanField(default=False)
    notes = models.CharField(max_length=300, blank=True, default="")

    class Meta:
        ordering = ["-work_date"]
        unique_together = [["employee", "work_date"]]
        indexes = [
            models.Index(fields=["status", "work_date"]),
        ]


class Overtime(models.Model):
    STATUSES = [
        ("REQUESTED", "Requested"),
        ("APPROVED",  "Approved"),
        ("REJECTED",  "Rejected"),
    ]
    employee = models.ForeignKey("hr.Employee", on_delete=models.CASCADE,
                                    related_name="overtimes")
    work_date = models.DateField()
    hours = models.DecimalField(max_digits=4, decimal_places=2)
    reason = models.TextField()
    status = models.CharField(max_length=10, choices=STATUSES, default="REQUESTED")
    approved_by = models.ForeignKey("hr.Employee", on_delete=models.SET_NULL,
                                       null=True, blank=True,
                                       related_name="overtime_approvals")
    approved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-work_date"]
