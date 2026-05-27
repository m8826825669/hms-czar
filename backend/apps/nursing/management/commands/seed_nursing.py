"""Seed nursing module with realistic demo data.

Requires an existing IPD admission. If none exists, the seed will pick
the most recent admission for the default hospital. Use this after
`python manage.py seed_phaseN_ipd` or after creating an admission via UI.

Run:    python manage.py seed_nursing

Creates (per recent admission, idempotent):
  - 3 NursingNote entries (1 per shift today: morning, evening, night)
  - 6 MedicationAdministration entries (2 prescriptions × 3 doses)
  - 1 ShiftHandover entry (yesterday morning → evening)

Flags:
  --hospital CODE     Use a specific hospital code
  --admission ID      Seed only for this admission ID
  --count N           Seed for N most-recent admissions (default 1)
"""
from datetime import time as time_t, timedelta

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from apps.core.models import Hospital


class Command(BaseCommand):
    help = "Seed nursing module with demo notes, MAR entries, and a handover."

    def add_arguments(self, parser):
        parser.add_argument("--hospital", type=str, default=None)
        parser.add_argument("--admission", type=int, default=None)
        parser.add_argument("--count", type=int, default=1)

    def handle(self, *args, **opts):
        # Lazy imports so this command stays importable even when other apps
        # are reorganised
        from apps.accounts.models import User
        from apps.ipd.models import Admission
        from apps.opd.models import Prescription, PrescriptionItem
        from apps.nursing.models import (
            NursingNote, MedicationAdministration, ShiftHandover,
        )

        code = opts["hospital"] or getattr(settings, "HMS_DEFAULT_HOSPITAL_CODE", "HOSP001")
        try:
            hospital = Hospital.objects.get(code=code)
        except Hospital.DoesNotExist:
            raise CommandError(f"Hospital with code {code!r} not found.")

        # Pick a nurse user (any active user with hospital matching).
        # Falls back to a superuser if no employee is found.
        nurse = (
            User.objects.filter(hospital=hospital, is_active=True)
            .exclude(username__in=["admin"])
            .order_by("?")
            .first()
        )
        if not nurse:
            nurse = User.objects.filter(hospital=hospital).first()
        if not nurse:
            raise CommandError("No user found to act as nurse. Create one first.")

        # Pick admission(s) to seed for
        if opts["admission"]:
            admissions = Admission.objects.filter(id=opts["admission"], hospital=hospital)
            if not admissions.exists():
                raise CommandError(f"Admission {opts['admission']} not found for {code}.")
        else:
            admissions = (
                Admission.objects.filter(hospital=hospital, status="ADMITTED")
                .order_by("-created_at")[:opts["count"]]
            )

        if not admissions:
            raise CommandError(
                f"No active admissions in {code}. Admit a patient first "
                f"(via /dashboard/ipd/admissions/new or seed_ipd command).")

        self.stdout.write(self.style.SUCCESS(
            f"Seeding nursing data for {len(admissions)} admission(s) in {code}…"
        ))

        notes_made = mars_made = handovers_made = 0

        for admission in admissions:
            self.stdout.write(f"  • Admission #{admission.id} — {admission.patient}")

            # 1) Three nursing notes — one per shift today
            now = timezone.now()
            today_morning = now.replace(hour=9,  minute=0, second=0, microsecond=0)
            today_evening = now.replace(hour=17, minute=0, second=0, microsecond=0)
            today_night   = now.replace(hour=23, minute=0, second=0, microsecond=0)
            note_specs = [
                ("MORNING", "PROGRESS",
                 "Patient resting comfortably. Vitals stable. "
                 "Pain score 3/10, controlled with current analgesia."),
                ("EVENING", "INTERVENTION",
                 "IV cannula re-sited (left forearm). Old site showed mild "
                 "phlebitis. Warm compress applied. Monitor."),
                ("NIGHT", "PROGRESS",
                 "Patient slept well. No complaints overnight. "
                 "Catheter draining clear urine, 400ml in last 8 hours."),
            ]
            for shift, ntype, content in note_specs:
                # Idempotent: don't add a duplicate if a note for this shift
                # already exists for this admission today (regardless of which
                # nurse — re-running the seed shouldn't depend on user choice)
                exists = NursingNote.objects.filter(
                    admission=admission, shift=shift,
                    noted_at__date=now.date(),
                ).exists()
                if not exists:
                    NursingNote.objects.create(
                        hospital=hospital, created_by=nurse, nurse=nurse,
                        admission=admission, shift=shift, note_type=ntype,
                        content=content,
                    )
                    notes_made += 1

            # 2) MAR entries — only if the admission has prescriptions linked
            # Look up the admission's prescriptions via the patient
            recent_rx = (
                Prescription.objects.filter(patient=admission.patient)
                .order_by("-created_at").first()
            )
            if recent_rx:
                items = PrescriptionItem.objects.filter(prescription=recent_rx)[:2]
                for item in items:
                    base = today_morning
                    for offset_hours in (0, 8, 16):
                        sched = base + timedelta(hours=offset_hours)
                        # Idempotent on (admission, item, scheduled_at)
                        if not MedicationAdministration.objects.filter(
                            admission=admission, prescription_item=item,
                            scheduled_at=sched,
                        ).exists():
                            MedicationAdministration.objects.create(
                                hospital=hospital, created_by=nurse,
                                admission=admission, prescription_item=item,
                                scheduled_at=sched, status="SCHEDULED",
                            )
                            mars_made += 1
            else:
                self.stdout.write(self.style.WARNING(
                    "    (skipping MAR — no prescription found for this patient)"
                ))

            # 3) One handover — yesterday's morning shift
            ho_date = (now - timedelta(days=1)).date()
            if not ShiftHandover.objects.filter(
                admission=admission, shift_date=ho_date, outgoing_shift="MORNING",
            ).exists():
                ShiftHandover.objects.create(
                    hospital=hospital, created_by=nurse, outgoing_nurse=nurse,
                    admission=admission, shift_date=ho_date,
                    outgoing_shift="MORNING",
                    priority="WATCH",
                    summary=(
                        "Patient stable post-op day 1. Foley catheter in place. "
                        "Eating soft diet. No fever last 24h."
                    ),
                    pending_tasks=(
                        "- 14:00 dose of Cefuroxime due\n"
                        "- Surgical site dressing change at 16:00\n"
                        "- Family briefing scheduled at 17:30"
                    ),
                )
                handovers_made += 1

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS(
            f"Done. Created {notes_made} note(s), {mars_made} MAR entries, "
            f"{handovers_made} handover(s)."
        ))
        self.stdout.write(self.style.SUCCESS(
            f"Acting nurse: {nurse.username} ({nurse.get_full_name() or '—'})"
        ))
