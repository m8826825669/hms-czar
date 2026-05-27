"""Seed protection module with sample safeguarding concerns and notes.

Run:    python manage.py seed_protection

Creates a small set of demo records illustrating the workflow:
  - 1 DRAFT concern (still being authored)
  - 1 OPEN concern with notes (under active investigation)
  - 1 ESCALATED concern with a referral (sent to Childline)
  - 1 CLOSED concern (concluded internally)

Demo records use the first available user(s) as reporter/investigator
and the first registered patient (if any) as subject. Concerns without
patient FK get a subject_description string instead.

Flags:
  --hospital CODE   Use a specific hospital code
"""
from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from apps.core.models import Hospital


class Command(BaseCommand):
    help = "Seed protection with sample safeguarding concerns."

    def add_arguments(self, parser):
        parser.add_argument("--hospital", type=str, default=None)

    def handle(self, *args, **opts):
        from apps.accounts.models import User
        from apps.core.models import Patient
        from apps.protection.models import (
            SafeguardingConcern, ConcernNote, ConcernReferral,
        )

        code = opts["hospital"] or getattr(
            settings, "HMS_DEFAULT_HOSPITAL_CODE", "HOSP001"
        )
        try:
            hospital = Hospital.objects.get(code=code)
        except Hospital.DoesNotExist:
            raise CommandError(f"Hospital with code {code!r} not found.")

        users = list(User.objects.filter(hospital=hospital, is_active=True)[:5])
        if len(users) < 2:
            raise CommandError(
                f"Need at least 2 active users in {code} to seed protection."
            )

        reporter = users[0]
        investigator = users[1]

        # Try to find a patient (optional)
        sample_patient = Patient.objects.filter(hospital=hospital).first()

        concerns_made = notes_made = referrals_made = 0
        now = timezone.now()

        # ─── DRAFT — still being authored ───────────────────────────────────
        if not SafeguardingConcern.objects.filter(
            hospital=hospital, reference_number="SG-DEMO-001",
        ).exists():
            SafeguardingConcern.objects.create(
                hospital=hospital, created_by=reporter, reporter=reporter,
                reference_number="SG-DEMO-001",
                patient=sample_patient,
                subject_description=("Female child ~5yo, accompanying mother "
                                      "at OPD") if not sample_patient else "",
                category="NEGLECT",
                risk_level="MODERATE",
                observations=("Child appeared malnourished and was wearing "
                              "ill-fitting, dirty clothing. Did not speak when "
                              "addressed. Mother dismissive of multiple questions "
                              "about feeding routine."),
                location_of_concern="OPD General Medicine, room 12",
                status="DRAFT",
            )
            concerns_made += 1

        # ─── OPEN — actively investigating ──────────────────────────────────
        if not SafeguardingConcern.objects.filter(
            hospital=hospital, reference_number="SG-DEMO-002",
        ).exists():
            c = SafeguardingConcern.objects.create(
                hospital=hospital, created_by=reporter, reporter=reporter,
                reference_number="SG-DEMO-002",
                patient=sample_patient,
                subject_description=("70yo female, presented with bruising on "
                                      "both upper arms") if not sample_patient else "",
                category="ELDER_ABUSE",
                risk_level="HIGH",
                observations=("Patient presented with bilateral upper arm "
                              "bruising of varying ages. Daughter accompanying "
                              "spoke over patient repeatedly. Patient flinched "
                              "when daughter approached. Daughter became "
                              "agitated when asked to wait outside."),
                location_of_concern="ER triage",
                status="OPEN",
                investigator=investigator,
                raised_at=now - timedelta(days=2),
            )
            ConcernNote.objects.create(
                hospital=hospital, created_by=investigator, author=investigator,
                concern=c, note_type="INTERVIEW",
                body=("Spoke with patient privately. She disclosed that her "
                      "daughter has been managing her finances and 'gets cross' "
                      "when patient asks about her pension. Patient denied any "
                      "deliberate physical harm but said the bruising 'just "
                      "happens' when daughter is 'tired.'"),
            )
            ConcernNote.objects.create(
                hospital=hospital, created_by=investigator, author=investigator,
                concern=c, note_type="ACTION_TAKEN",
                body=("Contacted hospital social worker. Patient consented to "
                      "social services involvement. Bruising photographs taken "
                      "and uploaded to medical record. Daughter informed that "
                      "social services will be in touch."),
            )
            concerns_made += 1
            notes_made += 2

        # ─── ESCALATED — referred to external agency ────────────────────────
        if not SafeguardingConcern.objects.filter(
            hospital=hospital, reference_number="SG-DEMO-003",
        ).exists():
            c = SafeguardingConcern.objects.create(
                hospital=hospital, created_by=reporter, reporter=reporter,
                reference_number="SG-DEMO-003",
                subject_description=("Female minor ~8yo, brought by uncle, "
                                      "presented with injuries inconsistent with "
                                      "stated history"),
                category="CHILD_ABUSE",
                risk_level="CRITICAL",
                observations=("Multiple healing fractures visible on chest "
                              "X-ray ordered for unrelated reasons. Uncle's "
                              "explanation (fell from bed) inconsistent with "
                              "injuries. Child was withdrawn and refused to "
                              "speak in uncle's presence."),
                location_of_concern="Pediatric ER",
                status="ESCALATED",
                investigator=investigator,
                raised_at=now - timedelta(days=5),
                closed_at=now - timedelta(days=4),
                closure_summary=("Referred to Childline (1098) and local CPS. "
                                  "Police informed. Child admitted to "
                                  "pediatric ward pending CPS assessment. "
                                  "Uncle questioned by police on premises."),
            )
            ConcernNote.objects.create(
                hospital=hospital, created_by=investigator, author=investigator,
                concern=c, note_type="OBSERVATION",
                body="Radiologist's report: 3 healing rib fractures, 2 at "
                      "different stages of healing. Recommended skeletal survey.",
            )
            ConcernNote.objects.create(
                hospital=hospital, created_by=investigator, author=investigator,
                concern=c, note_type="DECISION",
                body="In consultation with pediatric consultant and hospital "
                      "safeguarding lead, decision made to immediately escalate "
                      "to Childline + local CPS + police. Child to be admitted "
                      "to pediatric ward for protection.",
            )
            ConcernReferral.objects.create(
                hospital=hospital, created_by=investigator, referred_by=investigator,
                concern=c, agency_type="CHILDLINE", agency_name="Childline India (1098)",
                contact_person="Helpline operator",
                contact_details="1098 (national helpline)",
                referred_at=now - timedelta(days=4, hours=18),
                summary_shared=("Healing rib fractures incompatible with stated "
                                "history. Uncle's behavior raising concern. "
                                "Child currently safe in pediatric ward. "
                                "Requesting case worker assignment."),
                outcome="ACCEPTED",
                outcome_notes="Case worker assigned, will visit hospital today.",
                outcome_updated_at=now - timedelta(days=4, hours=12),
            )
            ConcernReferral.objects.create(
                hospital=hospital, created_by=investigator, referred_by=investigator,
                concern=c, agency_type="POLICE", agency_name="Meerut Police, Civil Lines PS",
                contact_person="ASI Sharma",
                contact_details="0121-2XXXXXX",
                referred_at=now - timedelta(days=4, hours=17),
                reference_id_from_agency="FIR-2026-0234",
                summary_shared="Same as Childline referral. Police informed in parallel.",
                outcome="INVESTIGATING",
                outcome_updated_at=now - timedelta(days=3),
            )
            concerns_made += 1
            notes_made += 2
            referrals_made += 2

        # ─── CLOSED — resolved internally ───────────────────────────────────
        if not SafeguardingConcern.objects.filter(
            hospital=hospital, reference_number="SG-DEMO-004",
        ).exists():
            c = SafeguardingConcern.objects.create(
                hospital=hospital, created_by=reporter, reporter=reporter,
                reference_number="SG-DEMO-004",
                subject_description=("28yo female admitted with paracetamol "
                                      "overdose"),
                category="SELF_HARM",
                risk_level="MODERATE",
                observations=("Patient admitted post-deliberate self-harm via "
                              "paracetamol ingestion (~30 tablets). Discharged "
                              "from medicine after 48 hours observation. "
                              "Refused psychiatric admission."),
                location_of_concern="Medical Ward",
                status="CLOSED",
                investigator=investigator,
                raised_at=now - timedelta(days=14),
                closed_at=now - timedelta(days=10),
                closure_summary=("Patient seen by psychiatry on consult basis. "
                                  "Agreed to outpatient follow-up at hospital "
                                  "psych OPD. Family aware and supportive. "
                                  "Safety plan documented. No external referral "
                                  "indicated at this time."),
            )
            ConcernNote.objects.create(
                hospital=hospital, created_by=investigator, author=investigator,
                concern=c, note_type="FOLLOWUP",
                body="Psych OPD appointment scheduled for next Tuesday. Patient "
                      "to call ward if any concerns before then.",
            )
            concerns_made += 1
            notes_made += 1

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS(
            f"Done. Created {concerns_made} concern(s), {notes_made} note(s), "
            f"{referrals_made} referral(s) in hospital {code}."
        ))
        self.stdout.write(
            f"Try: GET /api/v1/protection/concerns/  (as {reporter.username} or {investigator.username})"
        )
        self.stdout.write(
            "Note: confidentiality filter applies — other users see 0 concerns."
        )
