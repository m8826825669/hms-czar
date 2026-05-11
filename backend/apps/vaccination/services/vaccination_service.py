"""Vaccination service."""
from __future__ import annotations
from datetime import date, timedelta
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from ..models import VaccinationRecord, VaccinationCertificate


def _gen_certificate_number(hospital):
    today = timezone.now().date()
    prefix = f"VC-{today.strftime('%Y%m%d')}-"
    last = (VaccinationCertificate.objects.filter(certificate_number__startswith=prefix)
            .order_by("-certificate_number").first())
    if last:
        try:
            n = int(last.certificate_number.split("-")[-1]) + 1
        except (ValueError, IndexError):
            n = 1
    else:
        n = 1
    return f"{prefix}{n:04d}"


@transaction.atomic
def administer_vaccine(*, hospital, patient, vaccine, dose_number=1,
                         administered_date=None, **extra):
    administered_date = administered_date or timezone.localdate()

    existing = VaccinationRecord.objects.filter(
        patient=patient, vaccine=vaccine, dose_number=dose_number).first()
    if existing and existing.status == "ADMINISTERED":
        raise ValidationError(f"Already administered ({existing.administered_date}).")

    if existing:
        record = existing
    else:
        record = VaccinationRecord.objects.create(
            hospital=hospital, patient=patient, vaccine=vaccine,
            dose_number=dose_number, status="SCHEDULED",
        )

    record.status = "ADMINISTERED"
    record.administered_date = administered_date
    record.batch_number = extra.get("batch_number", "")
    record.expiry_date = extra.get("expiry_date")
    record.administered_by = extra.get("administered_by")
    record.administrator_name = extra.get("administrator_name", "")
    record.site_of_injection = extra.get("site_of_injection", "")
    record.adverse_reactions = extra.get("adverse_reactions", "")
    record.notes = extra.get("notes", "")

    # Set next dose if multi-dose
    if vaccine.doses_required > dose_number and vaccine.booster_interval_months:
        record.next_dose_date = administered_date + timedelta(
            days=vaccine.booster_interval_months * 30)
    record.save()

    # Auto-create certificate
    VaccinationCertificate.objects.get_or_create(
        record=record,
        defaults={"certificate_number": _gen_certificate_number(hospital)},
    )
    return record


def get_patient_history(patient):
    return VaccinationRecord.objects.filter(
        patient=patient).select_related("vaccine").order_by("-administered_date")


def get_due_vaccinations(patient):
    """Return upcoming/missed vaccinations for a patient."""
    from datetime import date
    from ..models import Vaccine, ImmunizationSchedule
    if not patient.date_of_birth:
        return []

    age_days = (date.today() - patient.date_of_birth).days

    due_list = []
    for vaccine in Vaccine.objects.filter(
        hospital=patient.hospital, is_active=True,
        vaccine_type__in=["PAEDIATRIC", "BOTH"],
    ):
        for sched in vaccine.schedule.all():
            # Convert schedule to days
            if sched.age_unit == "BIRTH":
                target_days = 0
            elif sched.age_unit == "WEEK":
                target_days = sched.age_value * 7
            elif sched.age_unit == "MONTH":
                target_days = sched.age_value * 30
            else:  # YEAR
                target_days = sched.age_value * 365

            if age_days >= target_days - 14:  # 2-week leeway
                existing = VaccinationRecord.objects.filter(
                    patient=patient, vaccine=vaccine,
                    dose_number=sched.dose_number,
                    status="ADMINISTERED",
                ).exists()
                if not existing:
                    due_list.append({
                        "vaccine_code": vaccine.code,
                        "vaccine_name": vaccine.name,
                        "dose_number": sched.dose_number,
                        "due_age": f"{sched.age_value} {sched.get_age_unit_display()}",
                        "overdue_days": age_days - target_days,
                    })
    return due_list
