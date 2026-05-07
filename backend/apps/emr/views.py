"""EMR module - read-only aggregator for patient 360° view.

The EMR module owns no DB tables of its own (Phase 1b). It composes a unified view
from:
  - core.Patient (demographics, allergies, conditions, current meds)
  - reception.Appointment (history + upcoming)
  - opd.Consultation (visits with diagnoses)
  - opd.Vitals (recent measurements)
  - opd.Prescription (prescribed meds with items)

Phase 2+ will add EMR-owned tables: ProgressNote, LabResult, ImagingResult,
ConsentForm, ClinicalDocument.
"""
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core.models import Patient
from apps.core.serializers import PatientSerializer
from apps.reception.models import Appointment
from apps.reception.serializers import AppointmentSerializer
from apps.opd.models import Consultation, Vitals, Prescription
from apps.opd.serializers import (ConsultationSerializer, VitalsSerializer,
                                   PrescriptionSerializer)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def patient_360(request, patient_id):
    """GET /api/v1/emr/patient/<id>/360/

    Returns a unified clinical snapshot for a single patient.
    """
    hospital = getattr(request, "hospital", None)
    qs = Patient.objects.all()
    if hospital:
        qs = qs.filter(hospital=hospital)
    patient = get_object_or_404(qs, id=patient_id)

    # Recent visits (consultations) - last 10
    consultations = (
        Consultation.objects
        .filter(patient=patient)
        .select_related("doctor__user", "vitals")
        .prefetch_related("diagnoses", "prescriptions__items")
        .order_by("-consultation_date", "-started_at")[:10]
    )

    # Recent vitals - last 5
    vitals = (
        Vitals.objects
        .filter(patient=patient)
        .order_by("-recorded_at")[:5]
    )

    # Most recent prescription (current medications)
    latest_rx = (
        Prescription.objects
        .filter(patient=patient)
        .prefetch_related("items__drug")
        .order_by("-prescribed_at")
        .first()
    )

    # Upcoming appointments
    upcoming = (
        Appointment.objects
        .filter(
            patient=patient,
            scheduled_date__gte=timezone.localdate(),
            status__in=["BOOKED", "CONFIRMED"],
        )
        .select_related("doctor__user")
        .order_by("scheduled_date", "scheduled_time")[:5]
    )

    # Past appointments - last 5
    past_appts = (
        Appointment.objects
        .filter(patient=patient)
        .exclude(status__in=["BOOKED", "CONFIRMED"])
        .select_related("doctor__user")
        .order_by("-scheduled_date", "-scheduled_time")[:5]
    )

    return Response({
        "patient": PatientSerializer(patient).data,
        "summary": {
            "total_visits": Consultation.objects.filter(patient=patient).count(),
            "total_prescriptions": Prescription.objects.filter(patient=patient).count(),
            "active_allergies_count": len(patient.allergies or []),
            "chronic_conditions_count": len(patient.chronic_conditions or []),
            "upcoming_appointments_count": upcoming.count(),
        },
        "recent_visits": ConsultationSerializer(consultations, many=True).data,
        "recent_vitals": VitalsSerializer(vitals, many=True).data,
        "latest_prescription": PrescriptionSerializer(latest_rx).data if latest_rx else None,
        "upcoming_appointments": AppointmentSerializer(upcoming, many=True).data,
        "past_appointments": AppointmentSerializer(past_appts, many=True).data,
    })
