"""Internal communications — lite implementation.

Covers staff-to-staff communication inside the hospital. Specifically NOT
the same as apps.notifications (which is outbound channeled comms to
patients — SMS reminders, email summaries via templates).

Three models:

  Message                  — direct staff-to-staff (sender → one recipient)
  Bulletin                 — broadcast post by senior staff to an audience
                              (hospital-wide / a department / a ward)
  BulletinAcknowledgment   — per-recipient ack receipt when a bulletin
                              has requires_acknowledgment=True

Design constraints:
  • No group chat. 1:1 messages + broadcast bulletins cover ~95% of needs.
  • Recipients are single Users. To message multiple people, create
    multiple Message rows.
  • Bulletins use audience_type to scope: HOSPITAL (all), DEPARTMENT, WARD.
  • Message threading via parent_message FK (one level of replies).
  • No file attachments yet (Phase 5+).
  • No @-mentions, reactions, presence, typing indicators.
"""
from django.conf import settings
from django.db import models

from apps.core.models import TenantBaseModel


class Message(TenantBaseModel):
    """A direct message from one staff member to another.

    Use cases:
      - "Can you cover my 4pm OPD slot? Daughter is sick."
      - "Lab result for Mr. Kumar is back, please review."
      - "Patient in bed C-04 is asking for you."

    Reply chains use parent_message. Only one level of reply tracked — for
    multi-turn conversations, recipients send fresh messages.
    """
    PRIORITIES = [
        ("LOW",    "Low"),
        ("NORMAL", "Normal"),
        ("HIGH",   "High"),
        ("URGENT", "Urgent"),
    ]

    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        related_name="messages_sent",
    )
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        related_name="messages_received",
    )

    subject = models.CharField(max_length=200, blank=True, default="",
        help_text="Optional subject line. Empty for quick replies.")
    body = models.TextField()
    priority = models.CharField(max_length=8, choices=PRIORITIES, default="NORMAL",
                                 db_index=True)

    # Threading: one level of reply
    parent_message = models.ForeignKey(
        "self", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="replies",
        help_text="Set if this message is a reply to an earlier one.",
    )

    # Read state — per-message because each is one-to-one
    read_at = models.DateTimeField(null=True, blank=True, db_index=True,
        help_text="When the recipient marked this as read. Null = unread.")

    # Soft archive — hidden from inbox views but still queryable
    is_archived_by_sender = models.BooleanField(default=False, db_index=True)
    is_archived_by_recipient = models.BooleanField(default=False, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["recipient", "read_at", "-created_at"]),
            models.Index(fields=["sender", "-created_at"]),
        ]

    def __str__(self):
        subj = self.subject or self.body[:40]
        return f"{self.sender} → {self.recipient}: {subj}"

    @property
    def is_read(self):
        return self.read_at is not None


class Bulletin(TenantBaseModel):
    """A broadcast post to an audience.

    Use cases:
      - "New sepsis protocol effective Monday. ICU + ER must acknowledge."
        (audience_type=DEPARTMENT, dept=ICU, requires_acknowledgment=True)
      - "Lift #2 out of service today. Use lift #1 or stairs."
        (audience_type=HOSPITAL, requires_acknowledgment=False)
      - "Mandatory training on hand hygiene this Saturday 10am."
        (audience_type=HOSPITAL, requires_acknowledgment=True)
    """
    AUDIENCE_TYPES = [
        ("HOSPITAL",   "Hospital-wide — all staff"),
        ("DEPARTMENT", "Department"),
        ("WARD",       "Ward"),
    ]
    CATEGORIES = [
        ("POLICY",       "Policy / SOP update"),
        ("CLINICAL",     "Clinical alert"),
        ("OPERATIONAL",  "Operational / logistics"),
        ("TRAINING",     "Training / education"),
        ("HR",           "HR announcement"),
        ("SAFETY",       "Safety / incident"),
        ("OTHER",        "Other"),
    ]
    PRIORITIES = [
        ("LOW",    "Low"),
        ("NORMAL", "Normal"),
        ("HIGH",   "High"),
        ("URGENT", "Urgent"),
    ]

    title = models.CharField(max_length=200)
    body = models.TextField()

    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        related_name="bulletins_authored",
    )

    category = models.CharField(max_length=12, choices=CATEGORIES,
                                 default="OPERATIONAL", db_index=True)
    priority = models.CharField(max_length=8, choices=PRIORITIES,
                                 default="NORMAL", db_index=True)

    # Audience scoping
    audience_type = models.CharField(max_length=10, choices=AUDIENCE_TYPES,
                                      default="HOSPITAL", db_index=True)
    audience_department = models.ForeignKey(
        "department.Department", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="bulletins",
        help_text="Required when audience_type=DEPARTMENT.",
    )
    audience_ward = models.ForeignKey(
        "ipd.Ward", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="bulletins",
        help_text="Required when audience_type=WARD.",
    )

    # Compliance: when True, every recipient must explicitly ack
    requires_acknowledgment = models.BooleanField(default=False, db_index=True)

    # Optional expiry — when set, bulletin disappears from the active list
    # after this date (still queryable in archive)
    expires_at = models.DateTimeField(null=True, blank=True,
        help_text="Optional: bulletin auto-hides from inbox after this time.")

    # Pinned bulletins float to the top of the list
    is_pinned = models.BooleanField(default=False, db_index=True)

    class Meta:
        ordering = ["-is_pinned", "-created_at"]
        indexes = [
            models.Index(fields=["audience_type", "-created_at"]),
            models.Index(fields=["priority", "-created_at"]),
        ]

    def __str__(self):
        return f"[{self.audience_type}] {self.title}"


class BulletinAcknowledgment(TenantBaseModel):
    """One row per (bulletin, recipient) when the bulletin requires ack.

    Created on demand when a recipient acknowledges (not pre-seeded for
    every staff member, which would be wasteful and unreliable). The
    compliance report instead counts acks vs the size of the target
    audience.
    """
    bulletin = models.ForeignKey(
        Bulletin, on_delete=models.CASCADE, related_name="acknowledgments",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        related_name="bulletin_acks",
    )
    acknowledged_at = models.DateTimeField(auto_now_add=True, db_index=True)
    note = models.CharField(max_length=300, blank=True, default="",
        help_text="Optional comment on the ack (e.g. 'will discuss in team meeting').")

    class Meta:
        ordering = ["-acknowledged_at"]
        # One ack per (bulletin, user)
        unique_together = [("bulletin", "user")]
        indexes = [
            models.Index(fields=["bulletin", "-acknowledged_at"]),
            models.Index(fields=["user", "-acknowledged_at"]),
        ]

    def __str__(self):
        return f"{self.user} ack'd {self.bulletin} @ {self.acknowledged_at:%Y-%m-%d %H:%M}"
