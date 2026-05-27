"""Seed crisis module with standard codes + a few demo activations/drills.

Run:    python manage.py seed_crisis

Creates:
  - 10 standard emergency codes (Blue, Red, Pink, Yellow, Orange, Black,
    Silver, Green, White, Gray) matching common Indian hospital convention
  - 2 demo code activations (one resolved, one live)
  - 2 demo drills (one completed, one scheduled in the future)

Flags:
  --hospital CODE   Use a specific hospital code
"""
from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from apps.core.models import Hospital


CODES = [
    {"code": "CODE_BLUE",   "name": "Code Blue",
     "description": "Medical emergency / cardiac arrest. Adult patient requires immediate resuscitation.",
     "color": "blue",   "default_response_minutes": 3, "requires_evacuation": False},
    {"code": "CODE_RED",    "name": "Code Red",
     "description": "Fire detected in the facility. Activate fire response and evacuation plan.",
     "color": "red",    "default_response_minutes": 2, "requires_evacuation": True},
    {"code": "CODE_PINK",   "name": "Code Pink",
     "description": "Infant or pediatric abduction. Lock down maternity and pediatric units.",
     "color": "pink",   "default_response_minutes": 2, "requires_evacuation": False},
    {"code": "CODE_YELLOW", "name": "Code Yellow",
     "description": "Mass casualty / disaster. Activate disaster management protocol.",
     "color": "yellow", "default_response_minutes": 10, "requires_evacuation": False},
    {"code": "CODE_ORANGE", "name": "Code Orange",
     "description": "Hazmat / chemical spill. Contain area and don PPE.",
     "color": "orange", "default_response_minutes": 5, "requires_evacuation": False},
    {"code": "CODE_BLACK",  "name": "Code Black",
     "description": "Bomb threat. Contact security and prepare for selective evacuation.",
     "color": "black",  "default_response_minutes": 3, "requires_evacuation": True},
    {"code": "CODE_SILVER", "name": "Code Silver",
     "description": "Active shooter or person with weapon. Lockdown protocol.",
     "color": "silver", "default_response_minutes": 1, "requires_evacuation": False},
    {"code": "CODE_GREEN",  "name": "Code Green",
     "description": "Full or partial facility evacuation required.",
     "color": "green",  "default_response_minutes": 5, "requires_evacuation": True},
    {"code": "CODE_WHITE",  "name": "Code White",
     "description": "Violent patient or visitor threatening staff. Security response.",
     "color": "white",  "default_response_minutes": 3, "requires_evacuation": False},
    {"code": "CODE_GRAY",   "name": "Code Gray",
     "description": "Combative or aggressive non-armed person. De-escalation team needed.",
     "color": "gray",   "default_response_minutes": 3, "requires_evacuation": False},
]


class Command(BaseCommand):
    help = "Seed crisis with standard codes + demo activations and drills."

    def add_arguments(self, parser):
        parser.add_argument("--hospital", type=str, default=None)

    def handle(self, *args, **opts):
        from apps.accounts.models import User
        from apps.crisis.models import EmergencyCode, CodeActivation, Drill

        code_name = opts["hospital"] or getattr(
            settings, "HMS_DEFAULT_HOSPITAL_CODE", "HOSP001"
        )
        try:
            hospital = Hospital.objects.get(code=code_name)
        except Hospital.DoesNotExist:
            raise CommandError(f"Hospital with code {code_name!r} not found.")

        user = User.objects.filter(hospital=hospital, is_active=True).first()
        if not user:
            raise CommandError(
                f"Need at least 1 active user in {code_name} to seed crisis."
            )

        codes_made = activations_made = drills_made = 0

        # ─── Codes ─────────────────────────────────────────────────────────
        by_code = {}
        for spec in CODES:
            obj, created = EmergencyCode.objects.get_or_create(
                hospital=hospital, code=spec["code"],
                defaults={
                    "created_by": user,
                    **{k: v for k, v in spec.items() if k != "code"},
                    "is_active": True,
                },
            )
            by_code[spec["code"]] = obj
            if created:
                codes_made += 1

        # ─── Activations ───────────────────────────────────────────────────
        # Resolved one — yesterday afternoon, Code Blue in ICU
        now = timezone.now()
        if not CodeActivation.objects.filter(
            hospital=hospital, code=by_code["CODE_BLUE"],
            location="ICU bed C-04",
        ).exists():
            called_at = now - timedelta(days=1, hours=4)
            responded_at = called_at + timedelta(seconds=180)  # 3 min
            resolved_at = called_at + timedelta(minutes=22)
            a = CodeActivation.objects.create(
                hospital=hospital, created_by=user, called_by=user,
                code=by_code["CODE_BLUE"],
                called_at=called_at,
                responded_at=responded_at,
                resolved_at=resolved_at,
                location="ICU bed C-04",
                notes="62yo male, post-CABG day 2, sudden VT arrest. CPR initiated.",
                outcome="RESOLVED",
                outcome_notes="ROSC achieved at minute 6, patient transferred to "
                              "CCU. Crash cart was 30s late — review storage location.",
            )
            activations_made += 1

        # Live one — happening right now, Code Yellow at OPD entrance
        if not CodeActivation.objects.filter(
            hospital=hospital, code=by_code["CODE_YELLOW"],
            location="OPD entrance",
        ).exists():
            CodeActivation.objects.create(
                hospital=hospital, created_by=user, called_by=user,
                code=by_code["CODE_YELLOW"],
                called_at=now - timedelta(minutes=8),
                responded_at=now - timedelta(minutes=5),
                location="OPD entrance",
                notes="3-vehicle accident on highway, ~12 casualties expected. "
                      "Triage tent being set up.",
            )
            activations_made += 1

        # ─── Drills ─────────────────────────────────────────────────────────
        # Completed drill — last week, Code Red, satisfactory
        if not Drill.objects.filter(
            hospital=hospital, code=by_code["CODE_RED"],
            location="Surgical Ward 2nd floor",
        ).exists():
            scheduled = now - timedelta(days=7)
            d = Drill.objects.create(
                hospital=hospital, created_by=user, organizer=user,
                code=by_code["CODE_RED"],
                scheduled_at=scheduled,
                started_at=scheduled + timedelta(minutes=2),
                completed_at=scheduled + timedelta(minutes=45),
                status="COMPLETED",
                rating="SATISFACTORY",
                location="Surgical Ward 2nd floor",
                expected_response_seconds=120,
                actual_response_seconds=145,
                notes="Annual fire drill. Evacuation completed in 18 minutes "
                      "(target 15). Two staff failed to use stairs near lift "
                      "lobby — retraining scheduled.",
            )
            drills_made += 1

        # Upcoming drill — tomorrow at 10am, Code Blue
        if not Drill.objects.filter(
            hospital=hospital, code=by_code["CODE_BLUE"],
            location="ICU",
        ).exists():
            Drill.objects.create(
                hospital=hospital, created_by=user, organizer=user,
                code=by_code["CODE_BLUE"],
                scheduled_at=(now + timedelta(days=1)).replace(
                    hour=10, minute=0, second=0, microsecond=0,
                ),
                status="SCHEDULED",
                location="ICU",
                expected_response_seconds=180,
                notes="Quarterly Code Blue drill. Scenario: VT arrest at "
                      "bedside C-02. Crash cart deployment + CPR + defibrillation.",
            )
            drills_made += 1

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS(
            f"Done. Created {codes_made} code(s), {activations_made} "
            f"activation(s), {drills_made} drill(s)."
        ))
        self.stdout.write(
            "Try: GET /api/v1/crisis/activations/live/   (1 live)"
        )
        self.stdout.write(
            "Try: GET /api/v1/crisis/activations/stats/  (response time + breakdown)"
        )
