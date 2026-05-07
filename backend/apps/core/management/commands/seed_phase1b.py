"""Seed Phase 1b sample data: drug master with ~50 common Indian drugs.

Run after Phase 1a seed:
    python manage.py seed_phase1b
"""
from decimal import Decimal
from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.core.models import Hospital
from apps.opd.models import DrugMaster


# Common Indian OPD drugs - generic + brand + strength + form + GST
DRUGS = [
    # Analgesics & antipyretics
    ("PCM500", "Paracetamol", "Crocin", "TABLET", "500mg", "GSK", "30049099", "12", "1 tab TDS after meals"),
    ("PCM650", "Paracetamol", "Dolo", "TABLET", "650mg", "Micro Labs", "30049099", "12", "1 tab BD after meals"),
    ("IBU400", "Ibuprofen", "Brufen", "TABLET", "400mg", "Abbott", "30049099", "12", "1 tab BD after meals"),
    ("DCF50", "Diclofenac", "Voveran", "TABLET", "50mg", "Novartis", "30049099", "12", "1 tab BD after meals"),
    ("ACECLO", "Aceclofenac", "Hifenac", "TABLET", "100mg", "Intas", "30049099", "12", "1 tab BD after meals"),
    ("TRA50", "Tramadol", "Tramazac", "TABLET", "50mg", "Zydus", "30049099", "12", "1 tab BD if pain"),

    # Antibiotics
    ("AMX500", "Amoxicillin", "Mox", "CAPSULE", "500mg", "Sun Pharma", "30041020", "12", "1 cap TDS x 5 days"),
    ("AMC625", "Amoxicillin + Clavulanic Acid", "Augmentin", "TABLET", "625mg", "GSK", "30041020", "12", "1 tab BD x 7 days"),
    ("AZI500", "Azithromycin", "Azithral", "TABLET", "500mg", "Alembic", "30041020", "12", "1 tab OD x 3 days"),
    ("CIP500", "Ciprofloxacin", "Cifran", "TABLET", "500mg", "Ranbaxy", "30041020", "12", "1 tab BD x 5 days"),
    ("LEV500", "Levofloxacin", "Levoflox", "TABLET", "500mg", "Cipla", "30041020", "12", "1 tab OD x 5 days"),
    ("DOX100", "Doxycycline", "Doxy-1", "CAPSULE", "100mg", "USV", "30041020", "12", "1 cap BD x 7 days"),
    ("MET400", "Metronidazole", "Flagyl", "TABLET", "400mg", "Abbott", "30041020", "12", "1 tab TDS x 5 days"),

    # Acidity / GI
    ("PAN40", "Pantoprazole", "Pan-40", "TABLET", "40mg", "Alkem", "30049099", "12", "1 tab OD before breakfast"),
    ("OME20", "Omeprazole", "Omez", "CAPSULE", "20mg", "Dr. Reddy's", "30049099", "12", "1 cap OD before breakfast"),
    ("RAB20", "Rabeprazole", "Rabium", "TABLET", "20mg", "Intas", "30049099", "12", "1 tab OD before breakfast"),
    ("RANITIDINE", "Ranitidine", "Aciloc", "TABLET", "150mg", "Cadila", "30049099", "12", "1 tab BD"),
    ("ONDA4", "Ondansetron", "Emeset", "TABLET", "4mg", "Cipla", "30049099", "12", "1 tab SOS for nausea"),
    ("DOMP10", "Domperidone", "Domstal", "TABLET", "10mg", "Torrent", "30049099", "12", "1 tab TDS before meals"),
    ("LOP2", "Loperamide", "Lopamide", "TABLET", "2mg", "Torrent", "30049099", "12", "1 tab after each loose stool"),

    # Allergy / antihistamines
    ("CET10", "Cetirizine", "Cetzine", "TABLET", "10mg", "Cipla", "30049099", "12", "1 tab HS"),
    ("LEV5", "Levocetirizine", "Vozet", "TABLET", "5mg", "Glenmark", "30049099", "12", "1 tab HS"),
    ("FEX120", "Fexofenadine", "Allegra", "TABLET", "120mg", "Sanofi", "30049099", "12", "1 tab BD"),
    ("MON10", "Montelukast", "Montair", "TABLET", "10mg", "Cipla", "30049099", "12", "1 tab HS"),

    # BP / heart
    ("TEL40", "Telmisartan", "Telma", "TABLET", "40mg", "Glenmark", "30049099", "5", "1 tab OD morning"),
    ("AML5", "Amlodipine", "Amlong", "TABLET", "5mg", "Micro Labs", "30049099", "5", "1 tab OD"),
    ("ATN50", "Atenolol", "Tenormin", "TABLET", "50mg", "AstraZeneca", "30049099", "5", "1 tab OD"),
    ("MET25", "Metoprolol", "Met-XL", "TABLET", "25mg", "AstraZeneca", "30049099", "5", "1 tab OD"),
    ("ENA5", "Enalapril", "Envas", "TABLET", "5mg", "Cadila", "30049099", "5", "1 tab BD"),
    ("ROS10", "Rosuvastatin", "Rosulip", "TABLET", "10mg", "Lupin", "30049099", "5", "1 tab HS"),
    ("ATR10", "Atorvastatin", "Lipitor", "TABLET", "10mg", "Pfizer", "30049099", "5", "1 tab HS"),
    ("ASP75", "Aspirin", "Ecosprin", "TABLET", "75mg", "USV", "30049099", "5", "1 tab OD after lunch"),
    ("CLO75", "Clopidogrel", "Clopilet", "TABLET", "75mg", "Sun Pharma", "30049099", "5", "1 tab OD"),

    # Diabetes
    ("MET500", "Metformin", "Glycomet", "TABLET", "500mg", "USV", "30049099", "5", "1 tab BD after meals"),
    ("GLM2", "Glimepiride", "Amaryl", "TABLET", "2mg", "Sanofi", "30049099", "5", "1 tab OD before breakfast"),
    ("SITA50", "Sitagliptin", "Januvia", "TABLET", "50mg", "MSD", "30049099", "5", "1 tab BD"),

    # Respiratory
    ("SAL2", "Salbutamol", "Asthalin", "TABLET", "2mg", "Cipla", "30049099", "12", "1 tab TDS"),
    ("SAL_INH", "Salbutamol", "Asthalin Inhaler", "INHALER", "100mcg/puff", "Cipla", "30049099", "12", "2 puffs SOS"),
    ("BUD_INH", "Budesonide", "Budecort", "INHALER", "200mcg/puff", "Cipla", "30049099", "12", "2 puffs BD"),
    ("AMB30", "Ambroxol", "Mucolite", "TABLET", "30mg", "Cipla", "30049099", "12", "1 tab TDS"),

    # Cough syrups
    ("DEX_SYP", "Dextromethorphan", "Benadryl DR", "SYRUP", "10mg/5ml", "Johnson & Johnson", "30049099", "12", "10ml TDS"),
    ("CHL_SYP", "Chlorpheniramine + Phenylephrine", "CoriCold", "SYRUP", "2mg/5mg per 5ml", "FDC", "30049099", "12", "10ml TDS"),

    # Vitamins & supplements
    ("BCOM", "Vitamin B-Complex", "Becosules", "CAPSULE", "Multi", "Pfizer", "30045090", "12", "1 cap OD"),
    ("VITD", "Cholecalciferol (Vitamin D3)", "Calcirol", "POWDER", "60000 IU", "Cadila", "30045090", "12", "1 sachet weekly"),
    ("CAL500", "Calcium + Vit D3", "Shelcal", "TABLET", "500mg + 250IU", "Torrent", "30045090", "12", "1 tab OD"),
    ("FOL5", "Folic Acid", "Folvite", "TABLET", "5mg", "Pfizer", "30045090", "12", "1 tab OD"),
    ("FE_FOL", "Iron + Folic Acid", "Livogen", "TABLET", "150mg + 1.5mg", "Merck", "30045090", "12", "1 tab OD"),
    ("ZIN20", "Zinc", "Z & D", "TABLET", "20mg", "USV", "30045090", "12", "1 tab OD"),

    # Topicals
    ("MUP_OINT", "Mupirocin", "T-Bact", "OINTMENT", "2%", "GSK", "30049099", "12", "Apply locally TDS"),
    ("CLOTRI_C", "Clotrimazole", "Candid", "CREAM", "1%", "Glenmark", "30049099", "12", "Apply BD x 14 days"),
    ("BETA_OINT", "Betamethasone", "Betnovate", "OINTMENT", "0.1%", "GSK", "30049099", "12", "Apply BD"),

    # Eye drops
    ("MOXI_DR", "Moxifloxacin", "Vigamox", "DROPS", "0.5%", "Alcon", "30049099", "12", "1 drop TDS x 5 days"),
    ("CARB_DR", "Carboxymethylcellulose", "Refresh Tears", "DROPS", "0.5%", "Allergan", "30049099", "12", "1 drop QID"),

    # Sleep / anxiety (Schedule H)
    ("ALP25", "Alprazolam", "Restyl", "TABLET", "0.25mg", "Sun Pharma", "30049099", "12", "1 tab HS", True),
    ("CLZ500", "Clonazepam", "Rivotril", "TABLET", "0.5mg", "Roche", "30049099", "12", "1 tab HS", True),
]


class Command(BaseCommand):
    help = "Seed Phase 1b drug master and sample data."

    def add_arguments(self, parser):
        parser.add_argument("--reset", action="store_true",
            help="Wipe drug master before seeding")

    @transaction.atomic
    def handle(self, *args, **opts):
        hospital = Hospital.objects.filter(
            code=settings.HMS_DEFAULT_HOSPITAL_CODE
        ).first()
        if not hospital:
            self.stdout.write(self.style.ERROR(
                "No default hospital found. Run seed_initial first."
            ))
            return

        if opts["reset"]:
            self.stdout.write(self.style.WARNING("Resetting drug master..."))
            DrugMaster.objects.filter(hospital=hospital).delete()

        created = 0
        updated = 0
        for drug_tuple in DRUGS:
            # Unpack with optional schedule_h flag
            if len(drug_tuple) == 10:
                code, generic, brand, form, strength, mfr, hsn, gst, common, sched_h = drug_tuple
            else:
                code, generic, brand, form, strength, mfr, hsn, gst, common = drug_tuple
                sched_h = False

            obj, was_created = DrugMaster.objects.update_or_create(
                hospital=hospital, code=code,
                defaults={
                    "generic_name": generic,
                    "brand_name": brand,
                    "dosage_form": form,
                    "strength": strength,
                    "manufacturer": mfr,
                    "hsn_code": hsn,
                    "gst_rate": Decimal(gst),
                    "common_dose": common,
                    "is_schedule_h": sched_h,
                },
            )
            if was_created:
                created += 1
            else:
                updated += 1

        self.stdout.write(self.style.SUCCESS(
            f"\n✓ Drug master seed complete. Created: {created}, Updated: {updated}"
        ))
        self.stdout.write(f"  Total drugs in DB: {DrugMaster.objects.filter(hospital=hospital).count()}")
        self.stdout.write("\nSearch examples (in /dashboard/opd or via API):")
        self.stdout.write("  - 'paracetamol' → Crocin, Dolo")
        self.stdout.write("  - 'amox' → Mox, Augmentin")
        self.stdout.write("  - 'pantoprazole' → Pan-40")
        self.stdout.write("  - 'crocin' → Paracetamol 500mg")
