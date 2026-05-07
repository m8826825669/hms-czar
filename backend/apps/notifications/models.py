"""Notifications module models.

NotificationLog    : every send attempt is recorded
NotificationTemplate: reusable templates with placeholder substitution
"""
from django.db import models
from apps.core.models import TenantBaseModel


class NotificationTemplate(TenantBaseModel):
    """Reusable templates with {placeholder} substitution.

    Example:
      code = 'APPOINTMENT_REMINDER'
      channel = 'SMS'
      body = 'Hi {patient_name}, reminder for your appointment with Dr. {doctor_name} on {date} at {time}.'
    """
    CHANNELS = [("SMS", "SMS"), ("WHATSAPP", "WhatsApp"),
                ("EMAIL", "Email"), ("IN_APP", "In-App")]
    code = models.CharField(max_length=50)
    name = models.CharField(max_length=100)
    channel = models.CharField(max_length=10, choices=CHANNELS, db_index=True)
    subject = models.CharField(max_length=200, blank=True, help_text="Email only")
    body = models.TextField(help_text="Use {placeholders} for substitution")
    msg91_template_id = models.CharField(max_length=50, blank=True,
                                         help_text="DLT-approved template ID for MSG91")
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = [("hospital", "code", "channel")]

    def __str__(self):
        return f"{self.code} [{self.channel}]"

    def render(self, ctx: dict) -> str:
        try:
            return self.body.format(**ctx)
        except KeyError as e:
            return f"[Template error: missing {e}]"


class NotificationLog(TenantBaseModel):
    """Every send attempt - success or failure - logs here."""
    STATUS_CHOICES = [
        ("PENDING", "Pending"),
        ("SENT", "Sent"),
        ("FAILED", "Failed"),
        ("DELIVERED", "Delivered"),
        ("READ", "Read"),
    ]
    CHANNELS = NotificationTemplate.CHANNELS

    template = models.ForeignKey(NotificationTemplate, on_delete=models.SET_NULL,
                                 null=True, blank=True)
    channel = models.CharField(max_length=10, choices=CHANNELS, db_index=True)
    to_address = models.CharField(max_length=200, db_index=True,
                                  help_text="Phone, email, or user_id")
    subject = models.CharField(max_length=200, blank=True)
    body = models.TextField()
    status = models.CharField(max_length=10, choices=STATUS_CHOICES,
                              default="PENDING", db_index=True)
    provider = models.CharField(max_length=20, blank=True,
                                help_text="msg91 / console / smtp")
    provider_message_id = models.CharField(max_length=100, blank=True)
    error = models.TextField(blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    related_object_type = models.CharField(max_length=50, blank=True,
                                           help_text="appointment, bill, otp, etc.")
    related_object_id = models.CharField(max_length=50, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "channel"]),
            models.Index(fields=["related_object_type", "related_object_id"]),
        ]

    def __str__(self):
        return f"{self.channel} → {self.to_address} [{self.status}]"
