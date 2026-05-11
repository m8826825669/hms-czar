"""Seed insurance companies + TPAs."""
from django.core.management.base import BaseCommand
from django.db import transaction
from apps.core.models import Hospital
from apps.insurance.models import InsuranceCompany, TPA


INSURANCE_COMPANIES = [
    ("STAR",     "Star Health & Allied Insurance", "Star Health",  "1800-425-2255"),
    ("HDFC",     "HDFC ERGO General Insurance",     "HDFC ERGO",    "022-6234-6234"),
    ("BAJAJ",    "Bajaj Allianz General Insurance", "Bajaj Allianz","1800-209-5858"),
    ("ICICI",    "ICICI Lombard General Insurance", "ICICI Lombard","1800-2666"),
    ("NIVA",     "Niva Bupa Health Insurance",       "Niva Bupa",   "1860-500-8888"),
    ("NEW_INDIA","The New India Assurance",          "New India",   "1800-209-1415"),
    ("RELIANCE", "Reliance General Insurance",       "Reliance",    "1800-3009"),
    ("CGHS",     "CGHS — Central Govt Health Scheme","CGHS",        "1800-208-8444"),
    ("ESI",      "ESIC — Employees' State Insurance","ESIC",        "1800-11-2526"),
    ("AB-PMJAY", "Ayushman Bharat PM-JAY",           "AB PM-JAY",   "14555"),
]

TPAS = [
    ("MEDI",   "Medi Assist Insurance TPA",     "MediAssist", "080-4014-2000"),
    ("PARA",   "Paramount Health Services TPA", "Paramount",  "022-6662-7777"),
    ("HEALTH", "Health India TPA",              "Health India","022-6622-9966"),
    ("MDIND",  "MDIndia Health Insurance TPA",  "MDIndia",    "020-2552-9999"),
    ("FHPL",   "Family Health Plan TPA",         "FHPL",       "040-2335-5454"),
    ("VIDAL",  "Vidal Health TPA",              "Vidal",      "080-4626-2626"),
]


class Command(BaseCommand):
    help = "Seed insurance + TPA module."

    @transaction.atomic
    def handle(self, *args, **options):
        hospital = Hospital.objects.first()
        if not hospital:
            self.stderr.write("No Hospital.")
            return

        for (code, name, short, phone) in INSURANCE_COMPANIES:
            InsuranceCompany.objects.update_or_create(
                hospital=hospital, code=code,
                defaults={"name": name, "short_name": short,
                           "helpline_number": phone,
                           "is_empanelled": True, "is_cashless": True,
                           "is_active": True},
            )
        for (code, name, short, phone) in TPAS:
            TPA.objects.update_or_create(
                hospital=hospital, code=code,
                defaults={"name": name, "short_name": short,
                           "phone": phone, "is_active": True},
            )

        self.stdout.write(self.style.SUCCESS(
            f"Done. {InsuranceCompany.objects.count()} insurers, "
            f"{TPA.objects.count()} TPAs."
        ))
