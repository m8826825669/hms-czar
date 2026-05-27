"""Nursing module - lite implementation.

Covers three gaps that adjacent modules don't fill:

  NursingNote              — progress notes for admitted patients, per shift
                              (IPD has DischargeSummary but no shift-by-shift notes)
  MedicationAdministration — records when a nurse actually gave a dose
                              (PrescriptionItem says WHAT to give, never WHEN it was given)
  ShiftHandover            — structured handover at shift change
                              (No formal capture exists anywhere)

Design notes:
  • All hospital-scoped via TenantBaseModel
  • Notes attach to apps.ipd.Admission (not Patient directly) so an admission's
    notes don't blur with a previous admission's notes
  • MAR (MedicationAdministration) attaches to opd.PrescriptionItem to track
    per-item administration. The same prescription has multiple items, each
    administered separately.
  • Handover is per-patient (one row = one patient being handed over) — simpler
    than a ward-level handover with M2M patients
"""
from django.conf import settings
from django.db import models

from apps.core.models import TenantBaseModel


class NursingNote(TenantBaseModel):
    """A nursing entry for an admitted patient.

    Examples:
      - "Patient resting comfortably. BP stable at 130/80. Pain score 3/10."
        (type=PROGRESS, shift=MORNING)
      - "Wound dressing changed. Site clean and dry. No discharge."
        (type=INTERVENTION)
      - "Patient fell from bed at 14:20. No injury. Side rails reinforced."
        (type=INCIDENT)
    """
    NOTE_TYPES = [
        ("PROGRESS",     "Progress Note"),
        ("ASSESSMENT",   "Nursing Assessment"),
        ("INTERVENTION", "Nursing Intervention"),
        ("EVALUATION",   "Evaluation / Patient Response"),
        ("INCIDENT",     "Incident / Adverse Event"),
        ("EDUCATION",    "Patient/Family Education"),
        ("OTHER",        "Other"),
    ]
    SHIFTS = [
        ("MORNING", "Morning (07:00-15:00)"),
        ("EVENING", "Evening (15:00-23:00)"),
        ("NIGHT",   "Night (23:00-07:00)"),
    ]

    admission = models.ForeignKey(
        "ipd.Admission", on_delete=models.CASCADE,
        related_name="nursing_notes",
        help_text="The admission this note belongs to. Required.",
    )
    note_type = models.CharField(max_length=15, choices=NOTE_TYPES, default="PROGRESS",
                                  db_index=True)
    shift = models.CharField(max_length=10, choices=SHIFTS, db_index=True,
                              help_text="Which shift this note was written on.")
    nurse = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        related_name="nursing_notes_authored",
        help_text="The nurse who wrote this note. Should match request.user normally.",
    )
    content = models.TextField(
        help_text="The note text. SOAPIE / SBAR style encouraged but not enforced."
    )
    # Auto-set on save; for sorting and audit
    noted_at = models.DateTimeField(auto_now_add=True, db_index=True,
        help_text="When this note was recorded in HMS (not the bedside time, which is "
                  "in the content if needed).")

    # Some notes amend earlier ones — addendum chain
    parent_note = models.ForeignKey(
        "self", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="addenda",
        help_text="Set if this note is an addendum to an earlier note. "
                  "Addenda cannot be deleted; original cannot be edited.",
    )

    class Meta:
        ordering = ["-noted_at"]
        indexes = [
            models.Index(fields=["admission", "-noted_at"]),
            models.Index(fields=["shift", "-noted_at"]),
        ]

    def __str__(self):
        return f"{self.get_note_type_display()} — {self.admission} @ {self.noted_at:%Y-%m-%d %H:%M}"


class MedicationAdministration(TenantBaseModel):
    """A single medication administration event.

    Records that a nurse gave (or did NOT give) a specific dose of a specific
    prescription item to a patient at a specific time. This is the MAR
    (Medication Administration Record) — a clinical-legal document.

    Lifecycle for a typical Amoxicillin 500mg TDS prescription on day 1:

      Three MAR rows are created when the prescription is acknowledged:
        - scheduled_at=08:00, status=SCHEDULED
        - scheduled_at=14:00, status=SCHEDULED
        - scheduled_at=20:00, status=SCHEDULED

      At 08:05 the nurse marks the first row GIVEN with administered_at=08:05.
      At 14:00 the doctor decides to HOLD (e.g., LFT pending) — nurse marks HELD.
      At 20:00 patient refuses — nurse marks REFUSED with refusal_reason.

      Each row is auditable: who marked it, when, and the delay.
    """
    STATUSES = [
        ("SCHEDULED", "Scheduled (not yet due / not yet administered)"),
        ("GIVEN",     "Given"),
        ("REFUSED",   "Refused by patient"),
        ("MISSED",    "Missed (not administered, no specific reason)"),
        ("HELD",      "Held (per doctor's order)"),
        ("NPO",       "Patient NPO (nil per os — cannot take orally)"),
        ("OMITTED",   "Omitted (intentionally skipped)"),
    ]

    admission = models.ForeignKey(
        "ipd.Admission", on_delete=models.CASCADE,
        related_name="medication_administrations",
    )
    prescription_item = models.ForeignKey(
        "opd.PrescriptionItem", on_delete=models.PROTECT,
        related_name="administrations",
        help_text="The specific prescription line being administered.",
    )

    # Two timestamps: when it SHOULD have happened vs when it DID
    scheduled_at = models.DateTimeField(db_index=True,
        help_text="When this dose was due, per the prescription frequency.")
    administered_at = models.DateTimeField(null=True, blank=True,
        help_text="When the dose was actually given. Null until status moves "
                  "from SCHEDULED to GIVEN.")

    status = models.CharField(max_length=12, choices=STATUSES, default="SCHEDULED",
                               db_index=True)
    administered_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        null=True, blank=True,
        related_name="administered_doses",
        help_text="The nurse who administered (or marked the status). "
                  "Null while scheduled, populated when the status moves off SCHEDULED.",
    )

    # Override of the dose actually given (a different concentration was used,
    # patient could only tolerate half, etc.)
    actual_dose = models.CharField(max_length=50, blank=True, default="",
        help_text="If the actual dose differed from prescription, record here.")
    site = models.CharField(max_length=50, blank=True, default="",
        help_text="For injections: left deltoid, right gluteal, etc.")

    # When status is REFUSED / HELD / NPO / OMITTED — required free-text
    reason = models.CharField(max_length=300, blank=True, default="",
        help_text="Required when status != GIVEN.")

    # Patient response after administration
    response_note = models.CharField(max_length=300, blank=True, default="",
        help_text="Optional: 'tolerated well', 'mild nausea after dose', etc.")

    class Meta:
        ordering = ["-scheduled_at"]
        indexes = [
            models.Index(fields=["admission", "-scheduled_at"]),
            models.Index(fields=["status", "-scheduled_at"]),
        ]

    def __str__(self):
        return (f"MAR: {self.prescription_item.drug_name} @ {self.scheduled_at:%Y-%m-%d %H:%M} "
                f"[{self.get_status_display()}]")

    @property
    def delay_minutes(self):
        """How late (positive) or early (negative) the administration was.
        Returns None if not yet administered."""
        if not self.administered_at:
            return None
        delta = self.administered_at - self.scheduled_at
        return round(delta.total_seconds() / 60)


class ShiftHandover(TenantBaseModel):
    """Structured handover for one patient at shift change.

    One row per (admission, shift change). The outgoing nurse fills in the
    summary at end of shift; the incoming nurse acknowledges receipt.

    For a 25-patient ward at 7am shift change, expect 25 of these (one per
    admission). The Nursing Home page filters them by ward + date + shift.
    """
    SHIFTS = [
        ("MORNING", "Morning"),
        ("EVENING", "Evening"),
        ("NIGHT",   "Night"),
    ]
    PRIORITIES = [
        ("ROUTINE", "Routine"),
        ("WATCH",   "Watch closely"),
        ("CRITICAL","Critical — check immediately"),
    ]

    admission = models.ForeignKey(
        "ipd.Admission", on_delete=models.CASCADE,
        related_name="handovers",
    )
    shift_date = models.DateField(db_index=True,
        help_text="The date this handover happened.")
    outgoing_shift = models.CharField(max_length=10, choices=SHIFTS, db_index=True,
        help_text="The shift that's ENDING.")

    outgoing_nurse = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        related_name="handovers_given",
    )
    incoming_nurse = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        related_name="handovers_received",
        null=True, blank=True,
        help_text="Null until the incoming nurse acknowledges. Acknowledgment "
                  "is via the /acknowledge/ action.",
    )

    priority = models.CharField(max_length=10, choices=PRIORITIES, default="ROUTINE",
                                 db_index=True)

    # Free-text content. Could be parsed structurally but lite version keeps it simple.
    summary = models.TextField(
        help_text="Narrative summary: condition, pending tasks, watch-for items.")

    pending_tasks = models.TextField(blank=True, default="",
        help_text="Bullet list of things the incoming shift must do (med due, "
                  "dressing change, etc.).")

    acknowledged_at = models.DateTimeField(null=True, blank=True,
        help_text="When the incoming nurse acknowledged this handover. "
                  "Null until acknowledged.")

    class Meta:
        ordering = ["-shift_date", "-created_at"]
        # One handover per (admission, date, outgoing_shift) — prevents duplicates
        unique_together = [("admission", "shift_date", "outgoing_shift")]
        indexes = [
            models.Index(fields=["shift_date", "outgoing_shift"]),
            models.Index(fields=["priority", "shift_date"]),
        ]

    def __str__(self):
        return f"Handover: {self.admission} on {self.shift_date} ({self.outgoing_shift})"
