"""Add billing-related notification templates (does NOT touch existing templates).

This preserves the manually-fixed APPOINTMENT_BOOKED / APPOINTMENT_REMINDER /
PRESCRIPTION_READY templates from the prior session.

Run after Phase 1b is in place:
    python manage.py seed_billing_templates
"""
from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.core.models import Hospital
from apps.notifications.models import NotificationTemplate


TEMPLATES = [
    {
        "code": "INVOICE_GENERATED",
        "channel": "SMS",
        "subject": "",
        "body": ("Dear {patient_name}, your invoice {code} for ₹{amount} is ready. "
                 "Please pay at the cash counter or via the link sent to you. "
                 "- Team"),
        "is_active": True,
    },
    {
        "code": "PAYMENT_RECEIVED",
        "channel": "SMS",
        "subject": "",
        "body": ("Dear {patient_name}, we have received ₹{amount} against bill {code}. "
                 "Thank you. Your payment confirmation is on its way. "
                 "Get well soon!"),
        "is_active": True,
    },
]


class Command(BaseCommand):
    help = "Seed billing-related notification templates (idempotent, additive)."

    @transaction.atomic
    def handle(self, *args, **opts):
        hospital = Hospital.objects.filter(
            code=settings.HMS_DEFAULT_HOSPITAL_CODE
        ).first()
        if not hospital:
            self.stdout.write(self.style.ERROR("No default hospital found."))
            return

        created, updated = 0, 0
        for t in TEMPLATES:
            obj, was_created = NotificationTemplate.objects.update_or_create(
                hospital=hospital, code=t["code"], channel=t["channel"],
                defaults={
                    "subject": t["subject"],
                    "body": t["body"],
                    "is_active": t["is_active"],
                },
            )
            if was_created:
                created += 1
            else:
                updated += 1

        self.stdout.write(self.style.SUCCESS(
            f"\n✓ Templates seeded. Created: {created}, Updated: {updated}"
        ))
