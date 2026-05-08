"""Seed common lab tests with realistic Indian reference ranges.

Run after migrations:  python manage.py seed_phase2b_lab

Tests seeded:
  CBC      Complete Blood Count       (8 parameters)
  LFT      Liver Function Test         (7 parameters)
  KFT      Kidney Function Test        (5 parameters)
  LIPID    Lipid Profile               (5 parameters)
  TFT      Thyroid Function Test       (3 parameters)
  HBA1C    HbA1c (Glycated Hb)         (1 parameter)
  FBS      Fasting Blood Sugar         (1 parameter)
  PPBS     Post-Prandial Blood Sugar   (1 parameter)
  RBS      Random Blood Sugar          (1 parameter)
  URINE    Urine Routine + Microscopy  (10 parameters)
  WIDAL    Widal Test (typhoid)        (4 qualitative)
  DENGUE   Dengue NS1 + IgM/IgG        (3 qualitative)
  XRAY     X-Ray Chest                 (1 qualitative — narrative)
  USG      USG Abdomen                 (1 qualitative — narrative)
  ECG      ECG / 12-Lead               (1 qualitative)

Use --reset to wipe existing Phase 2b lab data first.
"""
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.core.models import Hospital
from apps.lab.models import (TestCatalog, TestParameter, LabOrder, LabOrderItem,
                             LabSample, LabResult)


# ── Catalog data ────────────────────────────────────────────────────────────────
# (code, name, category, sample, sample_volume, price, hsn, gst, tat_h, fasting,
#  instructions, [params...])
# params: (code, name, unit, ref_low, ref_high, crit_low, crit_high, qual, ref_text)

TESTS = [
    ("CBC", "Complete Blood Count (CBC)", "HEMATOLOGY", "BLOOD",
     "3 ml EDTA tube", 350, "9993", 0, 4, False, "", [
        ("HB", "Haemoglobin", "g/dL", 12.0, 17.0, 7.0, 20.0, False, ""),
        ("RBC", "RBC Count", "million/cumm", 4.2, 5.8, None, None, False, ""),
        ("WBC", "Total WBC Count", "cells/cumm", 4000, 11000, 1500, 30000, False, ""),
        ("PLT", "Platelet Count", "lakhs/cumm", 1.5, 4.5, 0.5, 10.0, False, ""),
        ("HCT", "Haematocrit / PCV", "%", 36, 50, None, None, False, ""),
        ("MCV", "MCV", "fL", 80, 100, None, None, False, ""),
        ("MCH", "MCH", "pg", 27, 32, None, None, False, ""),
        ("MCHC", "MCHC", "g/dL", 32, 36, None, None, False, ""),
     ]),
    ("LFT", "Liver Function Test (LFT)", "BIOCHEMISTRY", "BLOOD",
     "5 ml plain tube", 600, "9993", 0, 6, False, "", [
        ("SGOT", "SGOT / AST", "U/L", 5, 40, None, 200, False, ""),
        ("SGPT", "SGPT / ALT", "U/L", 5, 41, None, 200, False, ""),
        ("ALP", "Alkaline Phosphatase", "U/L", 40, 129, None, None, False, ""),
        ("TBIL", "Bilirubin (Total)", "mg/dL", 0.2, 1.2, None, 5.0, False, ""),
        ("DBIL", "Bilirubin (Direct)", "mg/dL", 0.0, 0.3, None, None, False, ""),
        ("TPRO", "Total Protein", "g/dL", 6.4, 8.3, None, None, False, ""),
        ("ALB", "Albumin", "g/dL", 3.5, 5.0, None, None, False, ""),
     ]),
    ("KFT", "Kidney Function Test (KFT)", "BIOCHEMISTRY", "BLOOD",
     "5 ml plain tube", 550, "9993", 0, 6, False, "", [
        ("UREA", "Urea", "mg/dL", 17, 43, None, 150, False, ""),
        ("CREAT", "Creatinine", "mg/dL", 0.6, 1.3, None, 5.0, False, ""),
        ("UA", "Uric Acid", "mg/dL", 3.4, 7.0, None, None, False, ""),
        ("NA", "Sodium", "mEq/L", 136, 145, 120, 160, False, ""),
        ("K", "Potassium", "mEq/L", 3.5, 5.1, 2.5, 6.5, False, ""),
     ]),
    ("LIPID", "Lipid Profile", "BIOCHEMISTRY", "BLOOD",
     "5 ml plain tube (12h fasting)", 650, "9993", 0, 8, True,
     "12-hour fasting required. Water is permitted.", [
        ("CHOL", "Total Cholesterol", "mg/dL", 0, 200, None, None, False, ""),
        ("TG", "Triglycerides", "mg/dL", 0, 150, None, 500, False, ""),
        ("HDL", "HDL Cholesterol", "mg/dL", 40, 100, None, None, False, ""),
        ("LDL", "LDL Cholesterol", "mg/dL", 0, 100, None, None, False, ""),
        ("VLDL", "VLDL Cholesterol", "mg/dL", 0, 30, None, None, False, ""),
     ]),
    ("TFT", "Thyroid Function Test (TFT)", "BIOCHEMISTRY", "BLOOD",
     "5 ml plain tube", 700, "9993", 0, 24, False, "", [
        ("T3", "Triiodothyronine (T3)", "ng/dL", 80, 200, None, None, False, ""),
        ("T4", "Thyroxine (T4)", "µg/dL", 5.1, 14.1, None, None, False, ""),
        ("TSH", "TSH", "µIU/mL", 0.27, 4.2, None, None, False, ""),
     ]),
    ("HBA1C", "HbA1c (Glycated Haemoglobin)", "BIOCHEMISTRY", "BLOOD",
     "3 ml EDTA tube", 500, "9993", 0, 6, False, "", [
        ("HBA1C", "HbA1c", "%", 4.0, 5.6, None, None, False, ""),
     ]),
    ("FBS", "Fasting Blood Sugar (FBS)", "BIOCHEMISTRY", "BLOOD",
     "3 ml fluoride tube (8h fasting)", 100, "9993", 0, 2, True,
     "8-hour fasting required.", [
        ("GLU_F", "Glucose (Fasting)", "mg/dL", 70, 100, 40, 400, False, ""),
     ]),
    ("PPBS", "Post-Prandial Blood Sugar (PPBS)", "BIOCHEMISTRY", "BLOOD",
     "3 ml fluoride tube (2h after meal)", 100, "9993", 0, 2, False,
     "Sample to be collected exactly 2 hours after meal.", [
        ("GLU_PP", "Glucose (PP)", "mg/dL", 70, 140, None, 400, False, ""),
     ]),
    ("RBS", "Random Blood Sugar (RBS)", "BIOCHEMISTRY", "BLOOD",
     "3 ml fluoride tube", 80, "9993", 0, 2, False, "", [
        ("GLU_R", "Glucose (Random)", "mg/dL", 70, 200, None, 400, False, ""),
     ]),
    ("URINE", "Urine Routine + Microscopy", "URINALYSIS", "URINE",
     "10 ml mid-stream urine", 200, "9993", 0, 4, False,
     "Collect mid-stream sample in clean container.", [
        ("COL", "Colour", "", None, None, None, None, True, "Pale yellow"),
        ("APP", "Appearance", "", None, None, None, None, True, "Clear"),
        ("PH", "pH", "", 5.0, 7.5, None, None, False, ""),
        ("SG", "Specific Gravity", "", 1.005, 1.030, None, None, False, ""),
        ("PROT", "Protein", "", None, None, None, None, True, "Negative"),
        ("GLU", "Glucose", "", None, None, None, None, True, "Negative"),
        ("KET", "Ketones", "", None, None, None, None, True, "Negative"),
        ("BLD", "Blood", "", None, None, None, None, True, "Negative"),
        ("RBC", "RBC (microscopy)", "/HPF", 0, 2, None, None, False, ""),
        ("PUS", "Pus Cells", "/HPF", 0, 5, None, None, False, ""),
     ]),
    ("WIDAL", "Widal Test (Typhoid)", "SEROLOGY", "BLOOD",
     "3 ml plain tube", 250, "9993", 0, 24, False, "", [
        ("SO", "S. typhi 'O'", "titre", None, None, None, None, True, "< 1:80"),
        ("SH", "S. typhi 'H'", "titre", None, None, None, None, True, "< 1:80"),
        ("SAH", "S. paratyphi A 'H'", "titre", None, None, None, None, True, "< 1:80"),
        ("SBH", "S. paratyphi B 'H'", "titre", None, None, None, None, True, "< 1:80"),
     ]),
    ("DENGUE", "Dengue NS1 + IgM + IgG", "SEROLOGY", "BLOOD",
     "3 ml plain tube", 800, "9993", 0, 8, False, "", [
        ("NS1", "Dengue NS1 Antigen", "", None, None, None, None, True, "Negative"),
        ("IGM", "Dengue IgM", "", None, None, None, None, True, "Negative"),
        ("IGG", "Dengue IgG", "", None, None, None, None, True, "Negative"),
     ]),
    ("XRAY_CHEST", "X-Ray Chest PA View", "RADIOLOGY", "IMAGE",
     "—", 350, "9993", 0, 2, False, "", [
        ("FINDINGS", "Radiologist's Findings", "", None, None, None, None, True,
         "Normal study"),
     ]),
    ("USG_ABD", "USG Abdomen + Pelvis", "RADIOLOGY", "IMAGE",
     "—", 1200, "9993", 0, 4, True,
     "6-hour fasting. Full bladder for pelvic views.", [
        ("FINDINGS", "Sonologist's Findings", "", None, None, None, None, True,
         "No abnormality detected"),
     ]),
    ("ECG", "ECG (12-Lead)", "OTHER", "OTHER",
     "—", 200, "9993", 0, 1, False, "", [
        ("FINDINGS", "Cardiologist's Reading", "", None, None, None, None, True,
         "Normal sinus rhythm"),
     ]),
]


class Command(BaseCommand):
    help = "Seed Phase 2b lab tests + parameters"

    def add_arguments(self, parser):
        parser.add_argument("--reset", action="store_true",
                            help="Wipe existing lab data first")

    @transaction.atomic
    def handle(self, *args, **opts):
        hospital = Hospital.objects.first()
        if not hospital:
            self.stderr.write(self.style.ERROR("No Hospital found. Run Phase 0 seed first."))
            return

        if opts["reset"]:
            self.stdout.write(self.style.WARNING("Resetting lab data..."))
            LabResult.objects.filter(hospital=hospital).delete()
            LabSample.objects.filter(hospital=hospital).delete()
            LabOrderItem.objects.filter(hospital=hospital).delete()
            LabOrder.objects.filter(hospital=hospital).delete()
            TestParameter.objects.filter(hospital=hospital).delete()
            TestCatalog.objects.filter(hospital=hospital).delete()

        created_tests = 0
        created_params = 0

        for (code, name, cat, sample, vol, price, hsn, gst, tat, fasting,
             instr, params) in TESTS:
            test, was_new = TestCatalog.objects.update_or_create(
                hospital=hospital, code=code,
                defaults={
                    "name": name, "category": cat,
                    "sample_type": sample, "sample_volume": vol,
                    "price": Decimal(str(price)), "hsn_code": hsn,
                    "gst_rate": Decimal(str(gst)),
                    "typical_tat_hours": tat,
                    "requires_fasting": fasting,
                    "instructions": instr,
                    "is_active": True,
                },
            )
            if was_new:
                created_tests += 1
                self.stdout.write(self.style.SUCCESS(f"  ✓ Created test: {code} — {name}"))
            else:
                self.stdout.write(f"  • Updated test: {code} — {name}")

            for idx, (pcode, pname, unit, lo, hi, clo, chi, qual, ref_text) in enumerate(params):
                param, p_new = TestParameter.objects.update_or_create(
                    hospital=hospital, test=test, code=pcode,
                    defaults={
                        "name": pname, "unit": unit,
                        "ref_low": Decimal(str(lo)) if lo is not None else None,
                        "ref_high": Decimal(str(hi)) if hi is not None else None,
                        "critical_low": Decimal(str(clo)) if clo is not None else None,
                        "critical_high": Decimal(str(chi)) if chi is not None else None,
                        "is_qualitative": qual,
                        "ref_text": ref_text,
                        "sort_order": idx,
                    },
                )
                if p_new:
                    created_params += 1

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS(
            f"Done. {created_tests} new tests, {created_params} new parameters seeded."
        ))
        self.stdout.write(self.style.SUCCESS(
            f"Total now: {TestCatalog.objects.filter(hospital=hospital).count()} tests, "
            f"{TestParameter.objects.filter(hospital=hospital).count()} parameters."
        ))
