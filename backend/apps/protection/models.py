"""Safeguarding & protection — lite implementation.

Distinct from `crisis` (operational emergencies). This module tracks
ongoing patient-welfare concerns: child abuse, elder abuse, domestic
violence, neglect, sexual assault, self-harm, mental-health crises,
financial exploitation, trafficking.

Three models:

  SafeguardingConcern — Intake record: subject, category, risk level,
                        observations, status lifecycle. Highly
                        confidential — only the reporter, investigator,
                        and explicitly-granted viewers can see it.

  ConcernNote         — Append-only investigation log. PUT/DELETE → 405.

  ConcernReferral     — External referral to police / CPS / social
                        services. Append-only legal evidence.

Confidentiality design:
  • Concerns are NOT visible to general staff. The viewset filters to
    where request.user is the reporter, investigator, or in
    additional_viewers.
  • Superusers see everything (for audit/admin purposes).
  • Notes and referrals can never be edited or deleted.
  • The concern itself becomes immutable on CLOSED / ESCALATED / CANCELLED.
  • Soft-archive via status=CANCELLED, never hard delete via API.
"""
from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.core.models import TenantBaseModel


class SafeguardingConcern(TenantBaseModel):
    """A safeguarding/protection concern record.

    Lifecycle:
      DRAFT      → being authored, fully editable
      OPEN       → under active investigation, limited edits
      ESCALATED  → external referral made (police/CPS/social services), immutable
      CLOSED     → concluded with internal action only, immutable
      CANCELLED  → withdrawn or duplicate — soft archive, immutable

    Once in a terminal state, the concern body is sealed. Notes can still
    be appended (the investigation log continues even after closure for
    follow-up references).
    """
    CATEGORIES = [
        ("CHILD_ABUSE",            "Child abuse"),
        ("ELDER_ABUSE",            "Elder abuse"),
        ("DOMESTIC_VIOLENCE",      "Domestic violence"),
        ("NEGLECT",                "Neglect"),
        ("SEXUAL_ASSAULT",         "Sexual assault"),
        ("SELF_HARM",              "Self-harm / suicide risk"),
        ("MENTAL_HEALTH",          "Mental health crisis"),
        ("FINANCIAL_EXPLOITATION", "Financial exploitation"),
        ("TRAFFICKING",            "Human trafficking"),
        ("OTHER",                  "Other"),
    ]

    RISK_LEVELS = [
        ("LOW",      "Low"),
        ("MODERATE", "Moderate"),
        ("HIGH",     "High"),
        ("CRITICAL", "Critical — immediate action"),
    ]

    STATUSES = [
        ("DRAFT",     "Draft"),
        ("OPEN",      "Open / investigating"),
        ("ESCALATED", "Escalated to external agency"),
        ("CLOSED",    "Closed — internal action only"),
        ("CANCELLED", "Cancelled / withdrawn"),
    ]

    # Reference number — human-readable, hospital-unique
    reference_number = models.CharField(max_length=30,
        help_text="Human-readable reference (e.g. 'SG-2026-0001'). Unique per hospital.")

    # Subject — who is at risk
    patient = models.ForeignKey(
        "core.Patient", on_delete=models.PROTECT,
        null=True, blank=True, related_name="safeguarding_concerns",
        help_text="The patient at risk. Null only if subject is not a "
                  "registered patient (visitor's child, accompanying spouse).",
    )
    subject_description = models.CharField(max_length=300, blank=True, default="",
        help_text="Description of the subject if no patient FK "
                  "(e.g. 'Female child ~5yo, accompanying patient MRN1234').")

    # The concern itself
    category = models.CharField(max_length=24, choices=CATEGORIES, db_index=True)
    risk_level = models.CharField(max_length=10, choices=RISK_LEVELS,
                                    default="MODERATE", db_index=True)
    observations = models.TextField(
        help_text="What was observed / disclosed / suspected. Be specific "
                  "but stick to facts, not opinions.")
    location_of_concern = models.CharField(max_length=200, blank=True, default="",
        help_text="Where the concern was observed (department, ward, home).")

    # Workflow
    status = models.CharField(max_length=10, choices=STATUSES,
                                default="DRAFT", db_index=True)
    reporter = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        related_name="safeguarding_reported",
        help_text="Staff member who raised the concern.",
    )
    investigator = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        null=True, blank=True, related_name="safeguarding_investigating",
        help_text="Designated safeguarding lead assigned to investigate.",
    )
    additional_viewers = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name="safeguarding_viewable",
        blank=True,
        help_text="Other staff explicitly granted view access (e.g. ward "
                  "manager, senior physician). Without inclusion here, "
                  "the concern is invisible to them.",
    )

    # Timeline
    raised_at = models.DateTimeField(default=timezone.now, db_index=True)
    closed_at = models.DateTimeField(null=True, blank=True, db_index=True,
        help_text="When the concern reached a terminal status. Once set, "
                  "the concern body is sealed.")

    # Closure
    closure_summary = models.TextField(blank=True, default="",
        help_text="Brief summary of why the concern was closed/escalated. "
                  "Set on transition to terminal status.")

    class Meta:
        ordering = ["-raised_at"]
        unique_together = [("hospital", "reference_number")]
        indexes = [
            models.Index(fields=["status", "-raised_at"]),
            models.Index(fields=["risk_level", "status"]),
            models.Index(fields=["category", "-raised_at"]),
        ]

    def __str__(self):
        return f"{self.reference_number} [{self.category}/{self.risk_level}]"

    @property
    def is_sealed(self):
        """True when concern body is immutable (terminal status)."""
        return self.status in ("ESCALATED", "CLOSED", "CANCELLED")

    @property
    def days_open(self):
        """Days from raised_at to now (or closed_at if closed)."""
        end = self.closed_at or timezone.now()
        return max(0, (end - self.raised_at).days)


class ConcernNote(TenantBaseModel):
    """Append-only investigation note on a SafeguardingConcern.

    Once created, CANNOT be edited or deleted. The investigation log
    preserves the timeline as legal evidence. Corrections require a new
    note that references the prior one.
    """
    NOTE_TYPES = [
        ("OBSERVATION",   "Observation"),
        ("INTERVIEW",     "Interview"),
        ("ACTION_TAKEN",  "Action taken"),
        ("DECISION",      "Decision / determination"),
        ("FOLLOWUP",      "Follow-up required"),
        ("OTHER",         "Other"),
    ]

    concern = models.ForeignKey(
        SafeguardingConcern, on_delete=models.PROTECT,
        related_name="notes",
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        related_name="safeguarding_notes",
    )
    note_type = models.CharField(max_length=14, choices=NOTE_TYPES,
                                   default="OBSERVATION", db_index=True)
    body = models.TextField()

    # Optional FK for "this note corrects an earlier mistake"
    addendum_to = models.ForeignKey(
        "self", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="addenda",
        help_text="If this note is an addendum/correction to an earlier "
                  "note, link to it here. The original stays in the record.",
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["concern", "-created_at"]),
        ]

    def __str__(self):
        return f"Note {self.id} on {self.concern.reference_number} ({self.note_type})"


class ConcernReferral(TenantBaseModel):
    """External referral made to police, CPS, social services, etc.

    Append-only. Once recorded, cannot be edited or deleted — referral
    records are legal evidence and the chain of custody must be preserved.
    """
    AGENCY_TYPES = [
        ("POLICE",          "Police"),
        ("CPS",             "Child Protective Services"),
        ("SOCIAL_SERVICES", "Social Services / Welfare Dept"),
        ("MENTAL_HEALTH",   "Mental Health Authority"),
        ("ELDER_SERVICES",  "Elder Services"),
        ("WOMENS_HELPLINE", "Women's Helpline / Cell"),
        ("CHILDLINE",       "Childline (1098)"),
        ("NCPCR",           "National Commission for Protection of Child Rights"),
        ("OTHER",           "Other agency"),
    ]

    OUTCOMES = [
        ("PENDING",     "Pending response"),
        ("ACCEPTED",    "Accepted for action"),
        ("DECLINED",    "Declined / outside remit"),
        ("INVESTIGATING", "Under investigation by agency"),
        ("RESOLVED",    "Resolved by agency"),
        ("UNKNOWN",     "Outcome unknown / no follow-up"),
    ]

    concern = models.ForeignKey(
        SafeguardingConcern, on_delete=models.PROTECT,
        related_name="referrals",
    )

    agency_type = models.CharField(max_length=18, choices=AGENCY_TYPES, db_index=True)
    agency_name = models.CharField(max_length=200,
        help_text="Specific agency name (e.g. 'Meerut Police, Civil Lines PS').")
    contact_person = models.CharField(max_length=200, blank=True, default="",
        help_text="Officer / case worker contacted, if known.")
    contact_details = models.CharField(max_length=300, blank=True, default="",
        help_text="Phone / email / address.")

    referred_at = models.DateTimeField(default=timezone.now, db_index=True)
    referred_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        related_name="safeguarding_referrals_made",
    )

    reference_id_from_agency = models.CharField(max_length=80, blank=True, default="",
        help_text="FIR number, case number, etc. — issued by the agency.")

    summary_shared = models.TextField(
        help_text="What information was shared with the agency. Critical "
                  "for chain of custody / disclosure tracking.")

    outcome = models.CharField(max_length=14, choices=OUTCOMES,
                                 default="PENDING", db_index=True,
        help_text="Outcome reported back from the agency. Updatable via "
                  "/update-outcome/ action, not via PUT.")
    outcome_notes = models.TextField(blank=True, default="")
    outcome_updated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-referred_at"]
        indexes = [
            models.Index(fields=["concern", "-referred_at"]),
            models.Index(fields=["agency_type", "outcome"]),
        ]

    def __str__(self):
        return f"{self.agency_type} referral on {self.concern.reference_number}"
