"""Seed the internal_comms module with demo messages and bulletins.

Run:    python manage.py seed_internal_comms

Creates:
  - 4 Messages between random staff (assorted priorities)
  - 4 Bulletins (one per category: POLICY, CLINICAL, OPERATIONAL, SAFETY)
  - 1 BulletinAcknowledgment to demonstrate the ack flow

Flags:
  --hospital CODE   Use a specific hospital code
"""
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from apps.core.models import Hospital


class Command(BaseCommand):
    help = "Seed internal_comms with demo messages and bulletins."

    def add_arguments(self, parser):
        parser.add_argument("--hospital", type=str, default=None)

    def handle(self, *args, **opts):
        from apps.accounts.models import User
        from apps.internal_comms.models import (
            Message, Bulletin, BulletinAcknowledgment,
        )

        code = opts["hospital"] or getattr(settings, "HMS_DEFAULT_HOSPITAL_CODE", "HOSP001")
        try:
            hospital = Hospital.objects.get(code=code)
        except Hospital.DoesNotExist:
            raise CommandError(f"Hospital with code {code!r} not found.")

        # Find at least 3 users to play with (sender, recipient, plus author)
        users = list(User.objects.filter(hospital=hospital, is_active=True)[:5])
        if len(users) < 2:
            raise CommandError(
                f"Need at least 2 active users in {code} to seed messages. "
                f"Create users via /admin/ or seed_specialist first."
            )

        # Pick stable senders/recipients (first 3-5 users)
        u1 = users[0]
        u2 = users[1]
        author = users[0]  # Bulletins authored by user 1

        msgs_made = bulletins_made = acks_made = 0

        # ─── Messages ───────────────────────────────────────────────────────
        msg_specs = [
            ("URGENT", "Patient in bed C-04 asking for you",
             "Mrs. Kumari is requesting to see you before her medication round. "
             "She wants to ask about discharge planning. Please drop by when "
             "you have 5 minutes."),
            ("HIGH", "Lab result for Ramesh Kumar back",
             "CBC and LFT are back. Hemoglobin is 8.2 (low). Please review and "
             "advise on transfusion."),
            ("NORMAL", "Tomorrow's OPD coverage",
             "I'm taking the morning off tomorrow for a dental appointment. "
             "Can you cover my 9am-11am slot? Will return the favour."),
            ("LOW", "Coffee in the lounge",
             "Just brewed a fresh pot in the staff lounge if anyone wants some."),
        ]
        for priority, subject, body in msg_specs:
            exists = Message.objects.filter(
                sender=u1, recipient=u2, subject=subject,
            ).exists()
            if not exists:
                Message.objects.create(
                    hospital=hospital, created_by=u1,
                    sender=u1, recipient=u2,
                    subject=subject, body=body, priority=priority,
                )
                msgs_made += 1

        # ─── Bulletins ──────────────────────────────────────────────────────
        bulletin_specs = [
            {
                "title": "Updated Sepsis Protocol — effective Monday",
                "body": (
                    "The new sepsis bundle protocol takes effect on Monday. "
                    "Highlights: lactate measurement within 1 hour of "
                    "suspected sepsis, broad-spectrum antibiotics within 3 "
                    "hours, fluid resuscitation 30ml/kg if hypotensive. Full "
                    "SOP attached in the staff portal. All clinical staff in "
                    "ICU and ED must acknowledge by Friday."
                ),
                "category": "POLICY",
                "priority": "HIGH",
                "audience_type": "HOSPITAL",
                "requires_acknowledgment": True,
                "is_pinned": True,
            },
            {
                "title": "MRSA cluster identified in Surgical Ward",
                "body": (
                    "Three positive MRSA cultures in the past 48 hours among "
                    "post-op patients. Infection control has implemented "
                    "contact precautions for all surgical ward patients "
                    "pending review. Please reinforce hand hygiene and "
                    "double-gloving for all wound dressings."
                ),
                "category": "CLINICAL",
                "priority": "URGENT",
                "audience_type": "HOSPITAL",
                "requires_acknowledgment": True,
            },
            {
                "title": "Lift #2 out of service today",
                "body": (
                    "Maintenance is replacing the lift motor today (06:00 - "
                    "18:00). Please use Lift #1 or the stairs. Patient transfers "
                    "to and from ICU should be routed through Lift #1 only."
                ),
                "category": "OPERATIONAL",
                "priority": "NORMAL",
                "audience_type": "HOSPITAL",
                "requires_acknowledgment": False,
            },
            {
                "title": "Reminder: Annual BLS recertification due",
                "body": (
                    "If you haven't completed your annual Basic Life Support "
                    "recertification, please book a slot by month-end. The "
                    "next batch of trainings is on the 25th and 28th. "
                    "Required for all clinical staff."
                ),
                "category": "TRAINING",
                "priority": "NORMAL",
                "audience_type": "HOSPITAL",
                "requires_acknowledgment": False,
            },
        ]
        for spec in bulletin_specs:
            exists = Bulletin.objects.filter(
                hospital=hospital, title=spec["title"],
            ).exists()
            if not exists:
                Bulletin.objects.create(
                    hospital=hospital, created_by=author, author=author, **spec,
                )
                bulletins_made += 1

        # ─── Demo acknowledgment ────────────────────────────────────────────
        # One user acks the first bulletin (sepsis protocol) to demonstrate
        # the ack flow
        sepsis_bulletin = Bulletin.objects.filter(
            hospital=hospital, title__startswith="Updated Sepsis Protocol",
        ).first()
        if sepsis_bulletin and len(users) >= 2:
            ack, created = BulletinAcknowledgment.objects.get_or_create(
                bulletin=sepsis_bulletin, user=u2,
                defaults={
                    "hospital": hospital, "created_by": u2,
                    "note": "Reviewed and will discuss in tomorrow's team huddle.",
                },
            )
            if created:
                acks_made += 1

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS(
            f"Done. Created {msgs_made} message(s), {bulletins_made} bulletin(s), "
            f"{acks_made} acknowledgment(s)."
        ))
        self.stdout.write(self.style.SUCCESS(
            f"Sample sender: {u1.username}  /  recipient: {u2.username}"
        ))
        self.stdout.write(
            f"Try: GET /api/v1/internal-comms/messages/inbox/ as {u2.username}"
        )
