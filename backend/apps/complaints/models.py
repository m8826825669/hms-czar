"""
Complaints & Feedback module — Phase 4c.

Models:
  • TicketCategory   — complaint category taxonomy
  • Ticket           — complaint/feedback ticket
  • TicketComment    — communication thread
  • NPSResponse      — Net Promoter Score feedback
  • FeedbackForm     — feedback collection record
"""
from decimal import Decimal
from django.db import models
from django.utils import timezone


class TicketCategory(models.Model):
    hospital = models.ForeignKey("core.Hospital", on_delete=models.CASCADE,
                                  related_name="ticket_categories")
    code = models.CharField(max_length=20, db_index=True)
    name = models.CharField(max_length=100)
    description = models.CharField(max_length=300, blank=True, default="")
    default_priority = models.CharField(max_length=10, default="MEDIUM",
        choices=[("LOW","Low"),("MEDIUM","Medium"),("HIGH","High"),("URGENT","Urgent")])
    target_resolution_hours = models.PositiveIntegerField(default=48,
        help_text="SLA in hours")
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["code"]
        unique_together = [["hospital", "code"]]
        verbose_name_plural = "Ticket Categories"


class Ticket(models.Model):
    STATUSES = [
        ("OPEN",       "Open"),
        ("IN_PROGRESS","In Progress"),
        ("WAITING",    "Waiting on User"),
        ("RESOLVED",   "Resolved"),
        ("CLOSED",     "Closed"),
        ("REOPENED",   "Reopened"),
        ("CANCELLED",  "Cancelled"),
    ]
    PRIORITIES = [
        ("LOW",    "Low"),
        ("MEDIUM", "Medium"),
        ("HIGH",   "High"),
        ("URGENT", "Urgent"),
    ]
    SOURCES = [
        ("PATIENT",   "Patient"),
        ("ATTENDANT", "Attendant"),
        ("STAFF",     "Internal Staff"),
        ("VENDOR",    "Vendor"),
        ("ONLINE",    "Online Form"),
        ("PHONE",     "Phone Call"),
        ("WALK_IN",   "Walk-in"),
    ]

    hospital = models.ForeignKey("core.Hospital", on_delete=models.CASCADE,
                                  related_name="tickets")
    code = models.CharField(max_length=30, unique=True, db_index=True,
        help_text="Auto-generated, e.g. TKT-20260508-0001")

    category = models.ForeignKey(TicketCategory, on_delete=models.PROTECT,
                                    related_name="tickets")
    title = models.CharField(max_length=200)
    description = models.TextField()

    # Reporter
    source = models.CharField(max_length=10, choices=SOURCES, default="PATIENT")
    reporter_name = models.CharField(max_length=120)
    reporter_phone = models.CharField(max_length=20, blank=True, default="")
    reporter_email = models.EmailField(blank=True, default="")
    related_patient = models.ForeignKey(
        "core.Patient", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="tickets",
    )

    # Routing
    related_department = models.ForeignKey(
        "department.Department", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="tickets",
    )
    related_staff_name = models.CharField(max_length=200, blank=True, default="",
        help_text="Person being complained about, if any")

    # Status
    priority = models.CharField(max_length=10, choices=PRIORITIES, default="MEDIUM")
    status = models.CharField(max_length=12, choices=STATUSES, default="OPEN",
                                db_index=True)

    # Assignment
    assigned_to = models.ForeignKey("accounts.User", on_delete=models.SET_NULL,
                                       null=True, blank=True,
                                       related_name="assigned_tickets")
    assigned_at = models.DateTimeField(null=True, blank=True)

    # SLA
    target_resolution_at = models.DateTimeField(null=True, blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    is_sla_breached = models.BooleanField(default=False)

    # Resolution
    resolution = models.TextField(blank=True, default="")
    customer_satisfaction = models.PositiveIntegerField(null=True, blank=True,
        help_text="1-5 stars after resolution")

    notes = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "priority"]),
            models.Index(fields=["assigned_to", "status"]),
        ]


class TicketComment(models.Model):
    ticket = models.ForeignKey(Ticket, on_delete=models.CASCADE,
                                  related_name="comments")
    author = models.ForeignKey("accounts.User", on_delete=models.SET_NULL,
                                  null=True, blank=True, related_name="ticket_comments")
    author_name = models.CharField(max_length=120, blank=True, default="")
    comment = models.TextField()
    is_internal = models.BooleanField(default=False,
        help_text="Internal notes not visible to reporter")
    is_status_change = models.BooleanField(default=False)
    attachment_url = models.URLField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]


class NPSResponse(models.Model):
    hospital = models.ForeignKey("core.Hospital", on_delete=models.CASCADE,
                                  related_name="nps_responses")
    patient = models.ForeignKey("core.Patient", on_delete=models.SET_NULL,
                                   null=True, blank=True, related_name="nps_responses")
    reporter_name = models.CharField(max_length=120)
    reporter_phone = models.CharField(max_length=20, blank=True, default="")

    score = models.PositiveIntegerField(
        help_text="0-10 NPS score")
    feedback = models.TextField(blank=True, default="")
    related_visit_date = models.DateField(null=True, blank=True)
    related_department = models.ForeignKey(
        "department.Department", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="nps_responses",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    @property
    def category(self):
        if self.score >= 9: return "PROMOTER"
        if self.score >= 7: return "PASSIVE"
        return "DETRACTOR"
