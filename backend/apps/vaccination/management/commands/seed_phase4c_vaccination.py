"""Seed vaccines + IAP 2026 paediatric immunization schedule + adult vaccines."""
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.db import transaction
from apps.core.models import Hospital
from apps.vaccination.models import Vaccine, ImmunizationSchedule


# (code, name, full_name, type, manufacturer, doses, booster, booster_months,
#  route, dose_ml, is_under_uip, price)
VACCINES = [
    ("BCG",       "BCG",            "Bacillus Calmette-Guérin",        "PAEDIATRIC", "BCG India", 1, False, 0,  "ID",      "0.05", True,  0),
    ("OPV",       "OPV",            "Oral Polio Vaccine",               "PAEDIATRIC", "Bio-Med",   5, False, 0,  "Oral",    "2.0",  True,  0),
    ("HEP-B",     "Hepatitis B",    "Hepatitis B Vaccine",              "BOTH",        "GSK",       4, False, 0,  "IM",      "0.5",  True,  150),
    ("DPT",       "DPT",            "Diphtheria-Pertussis-Tetanus",     "PAEDIATRIC", "SII",       3, True,  60, "IM",      "0.5",  True,  0),
    ("DT",        "DT",             "Diphtheria-Tetanus",               "PAEDIATRIC", "SII",       1, False, 0,  "IM",      "0.5",  True,  0),
    ("HIB",       "Hib",            "Haemophilus Influenzae B",         "PAEDIATRIC", "SII",       3, False, 0,  "IM",      "0.5",  False, 250),
    ("MEASLES",   "Measles",        "Measles Vaccine",                  "PAEDIATRIC", "SII",       1, False, 0,  "SC",      "0.5",  True,  0),
    ("MMR",       "MMR",            "Measles-Mumps-Rubella",            "PAEDIATRIC", "SII",       2, False, 0,  "SC",      "0.5",  False, 350),
    ("ROTA",      "Rotavirus",      "Rotavirus Vaccine",                "PAEDIATRIC", "Bharat",    3, False, 0,  "Oral",    "1.5",  True,  0),
    ("IPV",       "IPV",            "Inactivated Polio Vaccine",        "PAEDIATRIC", "Bilthoven", 3, False, 0,  "IM",      "0.5",  True,  0),
    ("PCV",       "PCV",            "Pneumococcal Conjugate Vaccine",   "PAEDIATRIC", "Pfizer",    3, False, 0,  "IM",      "0.5",  False, 3500),
    ("VARI",      "Varicella",      "Chicken Pox Vaccine",              "PAEDIATRIC", "GSK",       2, False, 0,  "SC",      "0.5",  False, 1800),
    ("TYPHOID",   "Typhoid",        "Typhoid Conjugate Vaccine",        "BOTH",        "Bharat",    1, True,  36, "IM",      "0.5",  False, 1500),
    ("HEP-A",     "Hepatitis A",    "Hepatitis A Vaccine",              "BOTH",        "GSK",       2, False, 0,  "IM",      "0.5",  False, 1200),
    ("HPV",       "HPV",            "Human Papillomavirus Vaccine",     "BOTH",        "MSD",       2, False, 0,  "IM",      "0.5",  False, 3500),
    ("TT",        "TT",             "Tetanus Toxoid",                   "ADULT",       "SII",       1, True,  120,"IM",      "0.5",  True,  0),
    ("FLU",       "Influenza",      "Seasonal Influenza",               "SEASONAL",    "Sanofi",    1, True,  12, "IM",      "0.5",  False, 1200),
    ("COVID",     "COVID-19",       "COVID-19 Vaccine (Covishield)",    "PANDEMIC",    "SII",       2, True,  6,  "IM",      "0.5",  True,  0),
]

# (vaccine_code, dose_number, age_value, age_unit, description)
SCHEDULE = [
    # Birth
    ("BCG",     1, 0, "BIRTH", "At birth"),
    ("OPV",     1, 0, "BIRTH", "OPV-0 at birth"),
    ("HEP-B",   1, 0, "BIRTH", "Hep B birth dose"),
    # 6 weeks
    ("OPV",     2, 6, "WEEK", "OPV-1 at 6 weeks"),
    ("DPT",     1, 6, "WEEK", "DPT-1 at 6 weeks"),
    ("HIB",     1, 6, "WEEK", "Hib-1 at 6 weeks"),
    ("HEP-B",   2, 6, "WEEK", "Hep B-1 at 6 weeks"),
    ("ROTA",    1, 6, "WEEK", "Rotavirus-1 at 6 weeks"),
    ("IPV",     1, 6, "WEEK", "IPV-1 at 6 weeks"),
    ("PCV",     1, 6, "WEEK", "PCV-1 at 6 weeks"),
    # 10 weeks
    ("OPV",     3, 10, "WEEK", "OPV-2 at 10 weeks"),
    ("DPT",     2, 10, "WEEK", "DPT-2 at 10 weeks"),
    ("HIB",     2, 10, "WEEK", "Hib-2 at 10 weeks"),
    ("ROTA",    2, 10, "WEEK", "Rotavirus-2 at 10 weeks"),
    ("IPV",     2, 10, "WEEK", "IPV-2 at 10 weeks"),
    ("PCV",     2, 10, "WEEK", "PCV-2 at 10 weeks"),
    # 14 weeks
    ("OPV",     4, 14, "WEEK", "OPV-3 at 14 weeks"),
    ("DPT",     3, 14, "WEEK", "DPT-3 at 14 weeks"),
    ("HIB",     3, 14, "WEEK", "Hib-3 at 14 weeks"),
    ("ROTA",    3, 14, "WEEK", "Rotavirus-3 at 14 weeks"),
    ("IPV",     3, 14, "WEEK", "IPV-3 at 14 weeks"),
    ("PCV",     3, 14, "WEEK", "PCV-3 at 14 weeks"),
    # 9 months
    ("MEASLES", 1, 9, "MONTH", "Measles at 9 months"),
    ("HEP-B",   3, 6, "MONTH", "Hep B-2 at 6 months"),
    # 12 months
    ("HEP-A",   1, 12, "MONTH", "Hep A-1 at 12 months"),
    ("VARI",    1, 15, "MONTH", "Varicella at 15 months"),
    ("MMR",     1, 15, "MONTH", "MMR-1 at 15 months"),
    # 18 months
    ("DPT",     4, 18, "MONTH", "DPT booster at 18 months (booster_required)"),
    ("OPV",     5, 18, "MONTH", "OPV booster at 18 months"),
    ("HEP-B",   4, 18, "MONTH", "Hep B-3 at 18 months"),
    # 2 years
    ("TYPHOID", 1, 2, "YEAR", "Typhoid at 2 years"),
    # 5 years
    ("DT",      1, 5, "YEAR", "DT booster at 5 years"),
    ("MMR",     2, 5, "YEAR", "MMR-2 at 5 years"),
    # 10 years (adolescent)
    ("TT",      1, 10, "YEAR", "Tetanus booster at 10 years"),
    ("HPV",     1, 9, "YEAR", "HPV-1 at 9-14 years (girls)"),
    ("HPV",     2, 10, "YEAR", "HPV-2 at 9-14 years (6 months later)"),
]


class Command(BaseCommand):
    help = "Seed vaccines + IAP immunization schedule."

    @transaction.atomic
    def handle(self, *args, **options):
        hospital = Hospital.objects.first()
        if not hospital:
            self.stderr.write("No Hospital.")
            return

        vac_map = {}
        for (code, name, full_name, vt, mfr, doses, booster, booster_m,
             route, dose_ml, uip, price) in VACCINES:
            v, _ = Vaccine.objects.update_or_create(
                hospital=hospital, code=code,
                defaults={
                    "name": name, "full_name": full_name,
                    "vaccine_type": vt, "manufacturer": mfr,
                    "doses_required": doses, "booster_required": booster,
                    "booster_interval_months": booster_m,
                    "route_of_administration": route,
                    "standard_dose_ml": Decimal(dose_ml),
                    "is_under_uip": uip,
                    "standard_price": Decimal(str(price)),
                    "is_active": True,
                },
            )
            vac_map[code] = v

        for (vac_code, dose, age, unit, desc) in SCHEDULE:
            ImmunizationSchedule.objects.update_or_create(
                vaccine=vac_map[vac_code], dose_number=dose,
                defaults={"age_value": age, "age_unit": unit,
                           "description": desc},
            )

        self.stdout.write(self.style.SUCCESS(
            f"Done. {Vaccine.objects.count()} vaccines, "
            f"{ImmunizationSchedule.objects.count()} schedule entries."
        ))
