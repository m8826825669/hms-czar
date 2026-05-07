"""Public (no-auth) endpoints.

Used by:
- /p/rx/<uuid>           - QR-scannable prescription view
- /p/queue/<hospital_id> - TV display in waiting room
"""
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from apps.opd.models import Prescription
from apps.reception.models import QueueToken


@api_view(["GET"])
@permission_classes([AllowAny])
def public_prescription(request, uuid):
    """GET /api/v1/public/rx/<uuid>/

    Returns minimum-PII prescription view by UUID. No auth.
    Designed for QR-scan from a printed Rx.
    """
    rx = get_object_or_404(
        Prescription.objects.select_related("patient", "doctor__user", "consultation")
                            .prefetch_related("items__drug"),
        prescription_uuid=uuid,
    )

    return Response({
        "code": rx.code,
        "prescribed_at": rx.prescribed_at.isoformat(),
        "is_signed": rx.is_signed,
        "patient": {
            "name": rx.patient.full_name,
            "mrn": rx.patient.mrn,
            "age": rx.patient.age,
            "gender": rx.patient.gender,
        },
        "doctor": {
            "name": rx.doctor.full_name,
            "registration_number": rx.doctor.registration_number,
            "qualifications": rx.doctor.qualification_codes,
        },
        "hospital": {
            "name": rx.hospital.name,
            "city": getattr(rx.hospital, "city", ""),
            "phone": getattr(rx.hospital, "phone", ""),
        },
        "consultation": {
            "code": rx.consultation.code if rx.consultation else None,
            "date": rx.consultation.consultation_date.isoformat() if rx.consultation else None,
            "diagnoses": [
                {
                    "text": d.diagnosis_text,
                    "icd10": d.icd10_code,
                    "type": d.diagnosis_type,
                    "is_primary": d.is_primary,
                }
                for d in rx.consultation.diagnoses.all()
            ] if rx.consultation else [],
        },
        "items": [
            {
                "drug_name": item.drug_name,
                "dose": item.dose,
                "frequency": item.frequency,
                "duration_days": item.duration_days,
                "route": item.route,
                "instructions": item.instructions,
                "is_continued": item.is_continued,
            }
            for item in rx.items.all().order_by("order_index")
        ],
        "general_instructions": rx.general_instructions,
        "next_followup_days": rx.next_followup_days,
    })


@api_view(["GET"])
@permission_classes([AllowAny])
def public_queue(request, hospital_id):
    """GET /api/v1/public/queue/<hospital_id>/?location=<id>&doctor=<id>

    Read-only queue view for waiting-room TV. No PII in response - just token
    numbers + status + counts.
    """
    today = timezone.localdate()
    qs = QueueToken.objects.filter(hospital_id=hospital_id, visit_date=today)
    location_id = request.query_params.get("location")
    if location_id:
        qs = qs.filter(location_id=location_id)
    doctor_id = request.query_params.get("doctor")
    if doctor_id:
        qs = qs.filter(doctor_id=doctor_id)

    qs = qs.select_related("doctor__user").order_by("token_no")

    waiting = []
    in_consult = []
    completed_today = 0
    for t in qs:
        if t.status in ("WAITING", "IN_VITALS"):
            waiting.append({
                "token_no": t.token_no,
                "doctor": t.doctor.full_name,
                "status": t.status,
            })
        elif t.status == "IN_CONSULT":
            in_consult.append({
                "token_no": t.token_no,
                "doctor": t.doctor.full_name,
            })
        elif t.status == "DONE":
            completed_today += 1

    return Response({
        "as_of": timezone.now().isoformat(),
        "now_serving": in_consult,
        "waiting": waiting[:20],
        "waiting_count": len(waiting),
        "completed_today": completed_today,
    })
