"""
Seed Phase 4d analytics — a handful of useful pre-saved reports.

Usage:
    python manage.py seed_phase4d_analytics
"""
from django.core.management.base import BaseCommand
from django.apps import apps

from apps.analytics.models import SavedReport


SAMPLE_REPORTS = [
    {
        "name": "Monthly Revenue — Last 6 Months",
        "description": "Tracks invoice revenue trend across the last six months for board review.",
        "report_type": "REVENUE_MONTHLY",
        "parameters": {"months": 6},
        "is_pinned": True,
    },
    {
        "name": "Department-wise Revenue (Current Month)",
        "description": "Compares revenue contribution by department for the current month.",
        "report_type": "REVENUE_DEPT",
        "parameters": {},
        "is_pinned": True,
    },
    {
        "name": "Accounts Receivable Aging",
        "description": "Outstanding invoices split into 0-30 / 31-60 / 61-90 / 90+ buckets.",
        "report_type": "AR_AGING",
        "parameters": {},
        "is_pinned": True,
    },
    {
        "name": "Top 10 Diagnoses (Year-to-Date)",
        "description": "Most-recorded primary diagnoses across all encounters.",
        "report_type": "DIAGNOSES_TOP",
        "parameters": {"limit": 10},
        "is_pinned": False,
    },
    {
        "name": "OPD Volume — Last 30 Days",
        "description": "Daily OPD visit counts to spot weekly demand patterns.",
        "report_type": "OPD_VOLUME",
        "parameters": {"days": 30},
        "is_pinned": False,
    },
    {
        "name": "Asset Depreciation Summary",
        "description": "Acquisition vs current book value by asset category.",
        "report_type": "ASSET_DEPREC",
        "parameters": {},
        "is_pinned": False,
    },
    {
        "name": "Pharmacy Turnover — Last 6 Months",
        "description": "Monthly dispense revenue + transaction count.",
        "report_type": "PHARMACY_TURN",
        "parameters": {"months": 6},
        "is_pinned": False,
    },
    {
        "name": "Lab Test Turnover",
        "description": "Monthly lab order counts.",
        "report_type": "LAB_TURNOVER",
        "parameters": {"months": 6},
        "is_pinned": False,
    },
    {
        "name": "HR Headcount by Department",
        "description": "Active staff strength split by department.",
        "report_type": "HR_HEADCOUNT",
        "parameters": {},
        "is_pinned": False,
    },
    {
        "name": "Insurance Claim Pipeline",
        "description": "Claims by status and by month — flags slow approvals and rejections.",
        "report_type": "INSURANCE_CLAIM",
        "parameters": {"months": 6},
        "is_pinned": False,
    },
    {
        "name": "Complaint SLA Performance",
        "description": "Average resolution time and ticket status distribution.",
        "report_type": "COMPLAINTS_SLA",
        "parameters": {"months": 3},
        "is_pinned": False,
    },
]


class Command(BaseCommand):
    help = "Seeds sample SavedReport entries for the analytics dashboard."

    def handle(self, *args, **options):
        Hospital = None
        try:
            Hospital = apps.get_model("core", "Hospital")
        except LookupError:
            pass

        hospital = Hospital.objects.first() if Hospital else None
        if not hospital:
            self.stdout.write(self.style.ERROR(
                "No Hospital record found. Seed core.Hospital first (typically via Phase 1a seed)."
            ))
            return

        created = 0
        skipped = 0
        for entry in SAMPLE_REPORTS:
            obj, was_created = SavedReport.objects.get_or_create(
                hospital=hospital,
                name=entry["name"],
                defaults={
                    "description": entry["description"],
                    "report_type": entry["report_type"],
                    "parameters":  entry["parameters"],
                    "is_pinned":   entry["is_pinned"],
                },
            )
            if was_created:
                created += 1
                self.stdout.write(f"  + {obj.name}")
            else:
                skipped += 1

        self.stdout.write(self.style.SUCCESS(
            f"Phase 4d analytics seed complete: {created} created, {skipped} already existed."
        ))
