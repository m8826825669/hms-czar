"""Seed security guards + sample passes/incidents."""
from datetime import datetime, timedelta
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from apps.core.models import Hospital
from apps.security_module.models import SecurityGuard, VisitorPass, GatePass, Incident
from apps.security_module.services import security_service


GUARDS = [
    ("SEC-01", "Vijay Singh",    "9810060001", False, "Main Gate"),
    ("SEC-02", "Rajbir Yadav",   "9810060002", False, "Main Gate"),
    ("SEC-03", "Suresh Kumar",   "9810060003", True,  "Supervisor"),
    ("SEC-04", "Anil Pal",       "9810060004", False, "Emergency Entrance"),
    ("SEC-05", "Manoj Kumar",    "9810060005", False, "Parking Area"),
    ("SEC-06", "Rakesh Singh",   "9810060006", False, "Night Duty"),
]


class Command(BaseCommand):
    help = "Seed security module."

    @transaction.atomic
    def handle(self, *args, **options):
        hospital = Hospital.objects.first()
        if not hospital:
            self.stderr.write("No Hospital.")
            return

        guard_map = {}
        for (code, name, phone, sup, post) in GUARDS:
            g, _ = SecurityGuard.objects.update_or_create(
                hospital=hospital, employee_code=code,
                defaults={"full_name": name, "phone": phone,
                           "is_supervisor": sup, "posted_at": post,
                           "is_active": True},
            )
            guard_map[code] = g

        # Sample visitor passes (2 active)
        if VisitorPass.objects.filter(hospital=hospital).count() == 0:
            security_service.issue_visitor_pass(
                hospital=hospital,
                visitor_name="Ramesh Kumar",
                visitor_phone="9876543210",
                visit_type="ATTENDANT",
                id_proof_type="Aadhaar",
                id_proof_number="1234-5678-9012",
                visiting_person="Sunita Devi (Patient)",
                relationship="Husband",
                purpose="Visiting wife in ward",
                room_number="W-204",
                expected_exit_time=timezone.now() + timedelta(hours=4),
                issued_by=guard_map["SEC-01"],
            )
            security_service.issue_visitor_pass(
                hospital=hospital,
                visitor_name="Manish Pharma Rep",
                visitor_phone="9876543211",
                visit_type="VENDOR",
                purpose="Demo of new product",
                expected_exit_time=timezone.now() + timedelta(hours=2),
                issued_by=guard_map["SEC-02"],
            )

        # Sample gate pass
        if GatePass.objects.filter(hospital=hospital).count() == 0:
            security_service.issue_gate_pass(
                hospital=hospital,
                pass_type="RETURNABLE",
                items_description="1x ECG Machine for repair",
                purpose="Sent to vendor for calibration",
                issued_to_party="Schiller Calibration Centre",
                issued_to_phone="9876543220",
                vehicle_number="DL-01-AB-1234",
                estimated_value=85000,
                expected_return_at=timezone.now() + timedelta(days=7),
            )

        # Sample incident
        if Incident.objects.filter(hospital=hospital).count() == 0:
            security_service.log_incident(
                hospital=hospital,
                incident_type="LOST_FOUND",
                severity="LOW",
                title="Visitor lost wallet in lobby",
                description="Visitor reported lost wallet near reception desk at 11:30. "
                              "Black leather, no documents inside per visitor's statement.",
                location="Main Lobby — Reception Area",
                persons_involved="Visitor: Amit Verma (Pass VST-...) ",
                handled_by=guard_map["SEC-03"],
            )

        self.stdout.write(self.style.SUCCESS(
            f"Done. {SecurityGuard.objects.count()} guards, "
            f"{VisitorPass.objects.count()} visitor passes, "
            f"{GatePass.objects.count()} gate passes, "
            f"{Incident.objects.count()} incidents."
        ))
