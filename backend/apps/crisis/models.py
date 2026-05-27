"""Crisis & emergency-code management — lite implementation.

Covers emergency code activation tracking (Code Blue, Code Red, etc.)
plus periodic drill scheduling for staff readiness.

Three models:

  EmergencyCode  — Master list of code definitions. "CODE_BLUE / Cardiac
                    arrest / Adult". Hospital-configurable.

  CodeActivation — One row per live activation. Timestamps for called /
                    responded / resolved. Outcome. Responders (M2M).
                    Sealed once resolved (PUT/DELETE → 409).

  Drill          — Scheduled or completed practice. Expected vs actual
                    response time. Observer rating, lessons learned.

Design decisions:
  • Activations are immutable after resolve — medico-legal evidence.
  • No nested response-team table; responders is a flat ManyToMany.
  • No automatic paging/SMS — that's the notifications module's job.
    This module only records what happened, for retrospective review.
  • Drills are independent of activations, not a status flag on the
    same model.
"""
from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.core.models import TenantBaseModel


# ─── Master: Emergency Code Definitions ─────────────────────────────────────

class EmergencyCode(TenantBaseModel):
    """A hospital's roster of named emergency codes.

    Standard Indian hospital convention (configurable):
      CODE_BLUE   — Medical emergency / Cardiac arrest
      CODE_RED    — Fire
      CODE_PINK   — Infant / pediatric abduction
      CODE_YELLOW — Mass casualty / disaster
      CODE_ORANGE — Hazmat / chemical spill
      CODE_BLACK  — Bomb threat
      CODE_SILVER — Active shooter / violent person with weapon
      CODE_GREEN  — Evacuation
      CODE_WHITE  — Violent patient / staff under threat
      CODE_GRAY   — Combative / aggressive non-armed person
    """
    code = models.CharField(max_length=30,
        help_text="Code identifier (e.g. 'CODE_BLUE'). Unique per hospital.")
    name = models.CharField(max_length=80,
        help_text="Short display name (e.g. 'Code Blue').")
    description = models.TextField(
        help_text="What this code means and when to activate.")

    # Visual cue for the UI
    color = models.CharField(max_length=20, blank=True, default="",
        help_text="Display color hint (e.g. 'blue', 'red', '#0066cc').")

    # Operational
    is_active = models.BooleanField(default=True, db_index=True,
        help_text="False = retired code; existing activations stay valid.")
    requires_evacuation = models.BooleanField(default=False,
        help_text="If True, UI should prominently show evacuation guidance.")
    default_response_minutes = models.PositiveIntegerField(default=5,
        help_text="Expected response time SLA for drills (minutes).")

    class Meta:
        ordering = ["code"]
        unique_together = [("hospital", "code")]
        indexes = [
            models.Index(fields=["is_active", "code"]),
        ]

    def __str__(self):
        return f"{self.code} — {self.name}"


# ─── Live Activations ───────────────────────────────────────────────────────

class CodeActivation(TenantBaseModel):
    """A single emergency code activation event.

    State machine via timestamps:
      called_at        always set (creation time)
      responded_at     set when first responder arrives on scene
      resolved_at      set when code is stood down — entry becomes immutable

    Outcome captured on resolve. False alarms are tracked — important
    quality metric.
    """
    OUTCOMES = [
        ("RESOLVED",     "Resolved successfully"),
        ("FALSE_ALARM",  "False alarm / no incident"),
        ("ESCALATED",    "Escalated to external services (police/fire/EMS)"),
        ("FATALITY",     "Patient fatality"),
        ("OTHER",        "Other outcome"),
    ]

    code = models.ForeignKey(
        EmergencyCode, on_delete=models.PROTECT,
        related_name="activations",
    )

    # When + Where
    called_at = models.DateTimeField(default=timezone.now, db_index=True)
    responded_at = models.DateTimeField(null=True, blank=True, db_index=True,
        help_text="When the first responder arrived on scene.")
    resolved_at = models.DateTimeField(null=True, blank=True, db_index=True,
        help_text="When the code was stood down. Once set, entry is immutable.")

    location = models.CharField(max_length=200,
        help_text="Where in the hospital (free text: 'ICU bed C-04', 'Lift lobby 3F', etc.).")
    department = models.ForeignKey(
        "department.Department", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="code_activations",
        help_text="Department / area, if applicable.",
    )

    # Who triggered it
    called_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        related_name="codes_called",
        help_text="Staff member who activated the code.",
    )

    # Patient context (optional — codes like fire/evacuation aren't patient-specific)
    patient = models.ForeignKey(
        "core.Patient", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="code_activations",
    )

    # Free-text incident description
    notes = models.TextField(blank=True, default="",
        help_text="What happened, what was done, anything notable.")

    # Resolution
    outcome = models.CharField(max_length=12, choices=OUTCOMES, blank=True, default="",
        help_text="Set on resolve. Empty while activation is live.")
    outcome_notes = models.TextField(blank=True, default="",
        help_text="Detailed outcome notes (lessons learned, follow-up needed).")

    # Responders — flat M2M, no separate join table with metadata
    responders = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name="codes_responded_to",
        blank=True,
        help_text="Staff who responded. Add via /add-responder/ action.",
    )

    class Meta:
        ordering = ["-called_at"]
        indexes = [
            models.Index(fields=["-called_at", "code"]),
            models.Index(fields=["resolved_at"]),
        ]

    def __str__(self):
        return f"{self.code.code} @ {self.location} ({self.called_at:%Y-%m-%d %H:%M})"

    @property
    def is_resolved(self):
        return self.resolved_at is not None

    @property
    def response_seconds(self):
        """Seconds from called_at to responded_at. None if not yet responded."""
        if not self.responded_at:
            return None
        return int((self.responded_at - self.called_at).total_seconds())

    @property
    def total_duration_seconds(self):
        """Seconds from called_at to resolved_at. None if still live."""
        if not self.resolved_at:
            return None
        return int((self.resolved_at - self.called_at).total_seconds())


# ─── Drills ─────────────────────────────────────────────────────────────────

class Drill(TenantBaseModel):
    """A scheduled or completed emergency drill.

    State machine via timestamps:
      scheduled_at      always set (creation time, the planned date/time)
      started_at        set when drill actually begins
      completed_at      set when drill ends — entry becomes immutable

    A drill is independent of CodeActivation. Same code type, but a separate
    record because the medico-legal and quality semantics differ.
    """
    STATUSES = [
        ("SCHEDULED",  "Scheduled"),
        ("IN_PROGRESS", "In progress"),
        ("COMPLETED",  "Completed"),
        ("CANCELLED",  "Cancelled"),
    ]

    RATINGS = [
        ("EXCELLENT",      "Excellent"),
        ("SATISFACTORY",   "Satisfactory"),
        ("NEEDS_IMPROVEMENT", "Needs improvement"),
        ("FAILED",         "Failed — major issues"),
    ]

    code = models.ForeignKey(
        EmergencyCode, on_delete=models.PROTECT,
        related_name="drills",
    )

    scheduled_at = models.DateTimeField(db_index=True,
        help_text="Planned date/time of the drill.")
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True, db_index=True,
        help_text="When the drill ended. Once set, entry is immutable.")

    status = models.CharField(max_length=12, choices=STATUSES,
                               default="SCHEDULED", db_index=True)

    location = models.CharField(max_length=200,
        help_text="Where the drill is/was conducted.")
    organizer = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        related_name="drills_organized",
    )

    # Participation
    participants = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name="drills_participated",
        blank=True,
    )
    observers = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name="drills_observed",
        blank=True,
    )

    # Outcome
    rating = models.CharField(max_length=20, choices=RATINGS, blank=True, default="",
        help_text="Observer's rating after drill completion.")
    expected_response_seconds = models.PositiveIntegerField(null=True, blank=True,
        help_text="Target response time for this drill type.")
    actual_response_seconds = models.PositiveIntegerField(null=True, blank=True,
        help_text="Observed response time.")

    notes = models.TextField(blank=True, default="",
        help_text="Drill objectives, scenario description, lessons learned.")

    class Meta:
        ordering = ["-scheduled_at"]
        indexes = [
            models.Index(fields=["status", "-scheduled_at"]),
            models.Index(fields=["-scheduled_at", "code"]),
        ]

    def __str__(self):
        return f"{self.code.code} drill @ {self.scheduled_at:%Y-%m-%d %H:%M}"
