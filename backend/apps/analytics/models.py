"""
Analytics models.

The analytics app is primarily a read-only aggregation layer over other apps.
Two small persistent entities support the custom report builder:

* SavedReport      — a named, parameterised report definition the user can rerun.
* ReportRun        — a log of each execution with parameters, row count and runtime.
* DashboardWidget  — per-user pinned widgets on the analytics dashboard.
"""
from django.conf import settings
from django.db import models


REPORT_TYPES = [
    ("OPD_VOLUME",      "OPD Volume"),
    ("IPD_OCCUPANCY",   "IPD Occupancy"),
    ("OT_UTILIZATION",  "OT Utilization"),
    ("REVENUE_MONTHLY", "Revenue (Monthly)"),
    ("REVENUE_DEPT",    "Revenue (Department)"),
    ("AR_AGING",        "Accounts Receivable Aging"),
    ("PHARMACY_TURN",   "Pharmacy Turnover"),
    ("LAB_TURNOVER",    "Lab Turnover"),
    ("BLOOD_INVENTORY", "Blood Bank Inventory"),
    ("DIAGNOSES_TOP",   "Top Diagnoses"),
    ("ASSET_DEPREC",    "Asset Depreciation"),
    ("HR_HEADCOUNT",    "HR Headcount"),
    ("ATTENDANCE_SUM",  "Attendance Summary"),
    ("INSURANCE_CLAIM", "Insurance Claim Summary"),
    ("COMPLAINTS_SLA",  "Complaints SLA Performance"),
    ("CUSTOM",          "Custom SQL"),
]


class SavedReport(models.Model):
    hospital = models.ForeignKey(
        "core.Hospital", on_delete=models.CASCADE, related_name="saved_reports"
    )
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    report_type = models.CharField(max_length=20, choices=REPORT_TYPES)
    parameters = models.JSONField(default=dict, blank=True)
    is_pinned = models.BooleanField(default=False)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="reports_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-is_pinned", "name"]
        indexes = [models.Index(fields=["hospital", "report_type"])]

    def __str__(self):
        return self.name


class ReportRun(models.Model):
    STATUS_CHOICES = [
        ("RUNNING",   "Running"),
        ("COMPLETED", "Completed"),
        ("FAILED",    "Failed"),
    ]

    report = models.ForeignKey(
        SavedReport,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="runs",
    )
    report_type = models.CharField(max_length=20, choices=REPORT_TYPES)
    parameters = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="RUNNING")
    row_count = models.IntegerField(default=0)
    runtime_ms = models.IntegerField(default=0)
    error_message = models.TextField(blank=True)
    run_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="report_runs",
    )
    started_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-started_at"]

    def __str__(self):
        return f"{self.report_type} @ {self.started_at:%Y-%m-%d %H:%M}"


class DashboardWidget(models.Model):
    WIDGET_TYPES = [
        ("KPI",       "KPI Card"),
        ("LINE",      "Line Chart"),
        ("BAR",       "Bar Chart"),
        ("PIE",       "Pie Chart"),
        ("TABLE",     "Table"),
        ("GAUGE",     "Gauge"),
    ]
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="dashboard_widgets",
    )
    name = models.CharField(max_length=120)
    widget_type = models.CharField(max_length=10, choices=WIDGET_TYPES)
    metric_key = models.CharField(max_length=60)
    parameters = models.JSONField(default=dict, blank=True)
    position = models.IntegerField(default=0)
    is_visible = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["position", "id"]

    def __str__(self):
        return f"{self.user} • {self.name}"
