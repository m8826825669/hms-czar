"""Doctor dashboard endpoint (Phase 2c addition to apps.specialist).

Aggregates:
  - Today's appointments (from reception)
  - Pending consultations (DRAFT in OPD)
  - Pending lab results awaiting verification (LabOrder.IN_PROGRESS where I'm
    the ordering doctor, so I can review my patients' results before sign-off)
  - Recent prescriptions issued by me
  - Active IPD admissions where I'm the attending doctor

Doctor identity resolution: if the request user is linked to a Doctor profile
via Doctor.user FK, that Doctor is "me". Otherwise an admin can pass ?doctor_id=…

Endpoint:
  GET /api/specialist/dashboard/today/  ← attached in apps.specialist.urls
"""
from datetime import date, timedelta
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response


def _resolve_doctor(request):
    """Resolve the current doctor: by request.user → Doctor.user, else
    by ?doctor_id=… for admins."""
    from apps.specialist.models import Doctor
    qid = request.query_params.get("doctor_id")
    if qid:
        try:
            return Doctor.objects.get(id=int(qid), hospital=request.hospital)
        except (Doctor.DoesNotExist, ValueError):
            return None
    return Doctor.objects.filter(
        hospital=request.hospital, user=request.user,
    ).first()


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def doctor_dashboard_today(request):
    doctor = _resolve_doctor(request)
    if not doctor:
        return Response({
            "detail": "No Doctor profile linked to current user. Pass ?doctor_id=… as admin.",
        }, status=400)

    today = timezone.localdate()
    seven_days_ago = today - timedelta(days=7)

    # ── Today's appointments ──────────────────────────────────────────────────
    today_appts = []
    try:
        from apps.reception.models import Appointment
        appts = (Appointment.objects.filter(
            hospital=request.hospital,
            doctor=doctor,
            scheduled_at__date=today,
        )
        .exclude(status__in=["CANCELLED", "NO_SHOW"])
        .select_related("patient")
        .order_by("scheduled_at"))
        for a in appts:
            today_appts.append({
                "id": a.id,
                "code": getattr(a, "code", ""),
                "patient_id": a.patient.id,
                "patient_name": a.patient.full_name,
                "patient_mrn": a.patient.mrn,
                "scheduled_at": a.scheduled_at.isoformat(),
                "status": a.status,
                "status_label": a.get_status_display(),
            })
    except Exception:
        pass

    # ── Pending consultations (DRAFT) ─────────────────────────────────────────
    pending_consults = []
    try:
        from apps.opd.models import Consultation
        cons_qs = (Consultation.objects.filter(
            hospital=request.hospital,
            doctor=doctor,
            status="DRAFT",
        )
        .select_related("patient")
        .order_by("-consultation_date")[:20])
        for c in cons_qs:
            pending_consults.append({
                "id": c.id,
                "code": c.code,
                "patient_id": c.patient.id,
                "patient_name": c.patient.full_name,
                "patient_mrn": c.patient.mrn,
                "consultation_date": str(c.consultation_date),
                "chief_complaint": getattr(c, "chief_complaint", "")[:100],
            })
    except Exception:
        pass

    # ── Pending lab results (orders I placed that are in progress) ────────────
    pending_lab = []
    try:
        from apps.lab.models import LabOrder
        lab_qs = (LabOrder.objects.filter(
            hospital=request.hospital,
            ordered_by=doctor,
            status__in=["ORDERED", "COLLECTED", "IN_PROGRESS"],
        )
        .select_related("patient")
        .order_by("-order_date")[:20])
        for lo in lab_qs:
            ab = sum(1 for it in lo.items.all()
                     for r in it.results.all()
                     if r.flag != "NORMAL")
            pending_lab.append({
                "id": lo.id,
                "code": lo.code,
                "patient_id": lo.patient.id,
                "patient_name": lo.patient.full_name,
                "patient_mrn": lo.patient.mrn,
                "order_date": str(lo.order_date),
                "status": lo.status,
                "status_label": lo.get_status_display(),
                "priority": lo.priority,
                "test_count": lo.items.count(),
                "abnormal_count": ab,
            })
    except Exception:
        pass

    # ── Recent prescriptions ──────────────────────────────────────────────────
    recent_rx = []
    try:
        from apps.opd.models import Prescription
        rx_qs = (Prescription.objects.filter(
            hospital=request.hospital,
            consultation__doctor=doctor,
            consultation__consultation_date__gte=seven_days_ago,
        )
        .select_related("consultation__patient")
        .order_by("-created_at")[:20])
        for rx in rx_qs:
            recent_rx.append({
                "id": rx.id,
                "code": getattr(rx, "code", ""),
                "patient_name": rx.consultation.patient.full_name,
                "patient_mrn": rx.consultation.patient.mrn,
                "consultation_code": rx.consultation.code,
                "issued_at": rx.created_at.isoformat(),
                "item_count": rx.items.count() if hasattr(rx, "items") else 0,
            })
    except Exception:
        pass

    # ── Active IPD admissions (Phase 2c) ──────────────────────────────────────
    active_ipd = []
    try:
        from apps.ipd.models import Admission
        ipd_qs = (Admission.objects.filter(
            hospital=request.hospital,
            attending_doctor=doctor,
            status="ADMITTED",
        )
        .select_related("patient", "bed__room__ward")
        .order_by("-admitted_at"))
        for adm in ipd_qs:
            active_ipd.append({
                "id": adm.id,
                "code": adm.code,
                "patient_name": adm.patient.full_name,
                "patient_mrn": adm.patient.mrn,
                "bed_code": adm.bed.display_code,
                "ward_name": adm.bed.room.ward.name,
                "admitted_at": adm.admitted_at.isoformat(),
                "stay_days": adm.stay_days,
                "admission_type": adm.admission_type,
            })
    except Exception:
        pass

    return Response({
        "as_of": today.isoformat(),
        "doctor": {
            "id": doctor.id,
            "name": (
                "Dr. " + (doctor.user.get_full_name() if doctor.user else "")
            ).strip(),
            "registration_number": getattr(doctor, "registration_number", ""),
            "department": getattr(getattr(doctor, "department", None), "name", ""),
        },
        "counts": {
            "today_appointments": len(today_appts),
            "pending_consultations": len(pending_consults),
            "pending_lab_orders": len(pending_lab),
            "active_ipd_admissions": len(active_ipd),
            "recent_prescriptions": len(recent_rx),
        },
        "today_appointments": today_appts,
        "pending_consultations": pending_consults,
        "pending_lab_orders": pending_lab,
        "active_ipd_admissions": active_ipd,
        "recent_prescriptions": recent_rx,
    })
