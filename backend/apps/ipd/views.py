"""IPD module views.

Endpoints (all under /api/ipd/):

  GET    /wards/                          — list wards (with bed counts)
  POST   /wards/                          — create ward
  GET    /rooms/                          — list rooms
  POST   /rooms/                          — create room

  GET    /beds/                           — list beds (filters: status, ward)
  GET    /beds/availability/              — bed-board summary by ward
  POST   /beds/<id>/mark/                 — set status (RESERVED / MAINTENANCE)

  GET    /admissions/                     — list admissions
  POST   /admissions/                     — admit a patient (allocates bed)
  GET    /admissions/active/              — currently-admitted patients only
  GET    /admissions/<id>/                — detail (with daily charges + services)
  POST   /admissions/<id>/transfer/       — move to different bed
  POST   /admissions/<id>/accrue-charges/ — refresh daily charges through today
  POST   /admissions/<id>/add-service/    — add ad-hoc procedure / consultation
  POST   /admissions/<id>/discharge/      — discharge + auto-invoice
  GET    /admissions/<id>/discharge-summary/    — fetch summary
  POST   /admissions/<id>/discharge-summary/    — upsert summary fields
  POST   /admissions/<id>/discharge-summary/finalize/ — lock the summary
  GET    /admissions/<id>/discharge-pdf/  — PDF stream
  GET    /admissions/dashboard/           — IPD dashboard rollup
"""
from datetime import date, timedelta
from decimal import Decimal
from django.db import transaction
from django.db.models import Count, Q
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core.views import TenantScopedViewSetMixin
from .models import (Ward, Room, Bed, Admission, DailyCharge,
                     AdmissionService, DischargeSummary)
from .serializers import (WardSerializer, RoomSerializer, BedSerializer,
                          AdmissionSerializer, DailyChargeSerializer,
                          AdmissionServiceSerializer,
                          DischargeSummarySerializer)
from .services.admission_service import (admit_patient, transfer_to_bed,
                                         accrue_daily_charges,
                                         add_admission_service,
                                         discharge_patient,
                                         upsert_discharge_summary)
from .services.discharge_pdf import generate_discharge_summary_pdf


class WardViewSet(TenantScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = Ward.objects.prefetch_related("rooms__beds")
    serializer_class = WardSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ["code", "name"]
    filterset_fields = ["ward_type", "is_active"]


class RoomViewSet(TenantScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = Room.objects.select_related("ward").prefetch_related("beds")
    serializer_class = RoomSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ["number"]
    filterset_fields = ["ward"]


class BedViewSet(TenantScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = Bed.objects.select_related("room__ward").prefetch_related("admissions")
    serializer_class = BedSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ["label", "room__number", "room__ward__code"]
    filterset_fields = ["status", "room", "room__ward", "room__ward__ward_type"]

    @action(detail=False, methods=["get"])
    def availability(self, request):
        """Bed-board view: per-ward summary of available/occupied/reserved/maintenance."""
        wards = Ward.objects.filter(
            hospital=request.hospital, is_active=True,
        ).prefetch_related("rooms__beds__admissions")

        result = []
        for w in wards:
            beds_qs = Bed.objects.filter(room__ward=w)
            data = {
                "ward_id": w.id,
                "ward_code": w.code,
                "ward_name": w.name,
                "ward_type": w.ward_type,
                "ward_type_label": w.get_ward_type_display(),
                "available": beds_qs.filter(status="AVAILABLE").count(),
                "occupied": beds_qs.filter(status="OCCUPIED").count(),
                "reserved": beds_qs.filter(status="RESERVED").count(),
                "maintenance": beds_qs.filter(status="MAINTENANCE").count(),
                "total": beds_qs.count(),
                "beds": BedSerializer(
                    beds_qs.order_by("room__number", "label"), many=True,
                ).data,
            }
            result.append(data)
        return Response({"wards": result})

    @action(detail=True, methods=["post"])
    def mark(self, request, pk=None):
        """Manually change bed status (RESERVED / MAINTENANCE / AVAILABLE).

        Cannot mark OCCUPIED directly — that happens via admit_patient.
        Cannot move away from OCCUPIED unless admission is discharged.
        """
        bed = self.get_object()
        new_status = request.data.get("status", "").upper()
        if new_status not in ("AVAILABLE", "RESERVED", "MAINTENANCE"):
            return Response(
                {"detail": "status must be AVAILABLE / RESERVED / MAINTENANCE"},
                status=400,
            )
        if bed.status == "OCCUPIED":
            return Response(
                {"detail": "Cannot change status while bed is OCCUPIED. "
                           "Discharge the patient first."},
                status=400,
            )
        bed.status = new_status
        bed.notes = request.data.get("notes", bed.notes)
        bed.save(update_fields=["status", "notes"])
        return Response(BedSerializer(bed).data)


class AdmissionViewSet(TenantScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = Admission.objects.select_related(
        "patient", "bed__room__ward", "attending_doctor__user",
        "department", "invoice",
    ).prefetch_related("daily_charges", "services", "discharge_summary")
    serializer_class = AdmissionSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ["code", "patient__mrn", "patient__first_name",
                     "patient__last_name", "patient__phone"]
    filterset_fields = ["status", "admission_type", "attending_doctor",
                        "bed__room__ward"]
    ordering_fields = ["-admitted_at"]

    def create(self, request, *args, **kwargs):
        """Override to call admit_patient service for proper bed locking."""
        from apps.core.models import Patient
        from apps.specialist.models import Doctor

        try:
            patient = Patient.objects.get(
                id=request.data["patient"], hospital=request.hospital,
            )
            bed = Bed.objects.get(
                id=request.data["bed"], hospital=request.hospital,
            )
            doctor = Doctor.objects.get(
                id=request.data["attending_doctor"], hospital=request.hospital,
            )
        except (KeyError, Patient.DoesNotExist, Bed.DoesNotExist,
                Doctor.DoesNotExist) as e:
            return Response({"detail": f"Invalid reference: {e}"}, status=400)

        department = None
        if request.data.get("department"):
            try:
                from apps.department.models import Department
                department = Department.objects.get(
                    id=request.data["department"], hospital=request.hospital,
                )
            except Department.DoesNotExist:
                pass

        try:
            adm = admit_patient(
                hospital=request.hospital,
                user=request.user,
                patient=patient,
                bed=bed,
                attending_doctor=doctor,
                department=department,
                admission_diagnosis=request.data.get("admission_diagnosis", ""),
                admission_type=request.data.get("admission_type", "PLANNED"),
                chief_complaint=request.data.get("chief_complaint", ""),
                admission_notes=request.data.get("admission_notes", ""),
                expected_discharge_date=request.data.get("expected_discharge_date"),
            )
        except ValueError as e:
            return Response({"detail": str(e)}, status=400)
        return Response(AdmissionSerializer(adm).data, status=201)

    @action(detail=False, methods=["get"])
    def active(self, request):
        qs = self.get_queryset().filter(status="ADMITTED").order_by("-admitted_at")
        return Response(AdmissionSerializer(qs, many=True).data)

    @action(detail=True, methods=["post"])
    def transfer(self, request, pk=None):
        admission = self.get_object()
        try:
            new_bed = Bed.objects.get(id=request.data["new_bed_id"],
                                       hospital=request.hospital)
        except (KeyError, Bed.DoesNotExist):
            return Response({"detail": "new_bed_id required"}, status=400)
        try:
            transfer_to_bed(
                admission=admission, new_bed=new_bed, user=request.user,
                reason=request.data.get("reason", ""),
            )
        except ValueError as e:
            return Response({"detail": str(e)}, status=400)
        return Response(AdmissionSerializer(admission).data)

    @action(detail=True, methods=["post"], url_path="accrue-charges")
    def accrue_charges(self, request, pk=None):
        admission = self.get_object()
        rows = accrue_daily_charges(admission)
        return Response({
            "created": len(rows),
            "admission": AdmissionSerializer(admission).data,
        })

    @action(detail=True, methods=["post"], url_path="add-service")
    def add_service_action(self, request, pk=None):
        admission = self.get_object()
        try:
            svc = add_admission_service(
                admission=admission,
                user=request.user,
                description=request.data.get("description", ""),
                unit_price=request.data.get("unit_price"),
                quantity=request.data.get("quantity", "1"),
                gst_rate=request.data.get("gst_rate", "18"),
                service_date=request.data.get("service_date"),
                notes=request.data.get("notes", ""),
            )
        except ValueError as e:
            return Response({"detail": str(e)}, status=400)
        return Response(AdmissionServiceSerializer(svc).data, status=201)

    @action(detail=True, methods=["post"])
    def discharge(self, request, pk=None):
        """Discharge with auto-invoice generation."""
        admission = self.get_object()
        discharge_type = request.data.get("discharge_type", "ROUTINE").upper()
        try:
            discharge_patient(
                admission, user=request.user,
                discharge_type=discharge_type,
                include_pharmacy=request.data.get("include_pharmacy", True),
                include_lab=request.data.get("include_lab", True),
            )
        except ValueError as e:
            return Response({"detail": str(e)}, status=400)
        return Response(AdmissionSerializer(admission).data)

    @action(detail=True, methods=["get", "post"], url_path="discharge-summary")
    def discharge_summary(self, request, pk=None):
        admission = self.get_object()
        if request.method == "GET":
            try:
                summary = admission.discharge_summary
                return Response(DischargeSummarySerializer(summary).data)
            except DischargeSummary.DoesNotExist:
                return Response({"detail": "No discharge summary yet"}, status=404)

        # POST: upsert
        from apps.specialist.models import Doctor
        doctor = None
        if request.data.get("doctor_id"):
            doctor = Doctor.objects.filter(
                id=request.data["doctor_id"], hospital=request.hospital,
            ).first()
        elif admission.attending_doctor:
            doctor = admission.attending_doctor

        finalize = bool(request.data.get("finalize"))
        fields = {k: v for k, v in request.data.items() if k in (
            "final_diagnosis", "course_in_hospital", "procedures_done",
            "treatment_given", "investigations_summary",
            "condition_at_discharge", "discharge_advice",
            "medications_on_discharge", "follow_up_advice",
        )}
        try:
            summary = upsert_discharge_summary(
                admission, user=request.user, doctor=doctor,
                finalize=finalize, **fields,
            )
        except ValueError as e:
            return Response({"detail": str(e)}, status=400)
        return Response(DischargeSummarySerializer(summary).data)

    @action(detail=True, methods=["post"],
            url_path="discharge-summary/finalize")
    def finalize_summary(self, request, pk=None):
        admission = self.get_object()
        try:
            summary = admission.discharge_summary
        except DischargeSummary.DoesNotExist:
            return Response({"detail": "No summary to finalize"}, status=404)
        if summary.is_finalized:
            return Response({"detail": "Already finalized"}, status=400)
        if not summary.final_diagnosis or not summary.course_in_hospital:
            return Response(
                {"detail": "final_diagnosis and course_in_hospital required"},
                status=400,
            )
        summary.finalized_at = timezone.now()
        summary.save(update_fields=["finalized_at"])
        return Response(DischargeSummarySerializer(summary).data)

    @action(detail=True, methods=["get"], url_path="discharge-pdf")
    def discharge_pdf(self, request, pk=None):
        admission = self.get_object()
        try:
            _ = admission.discharge_summary
        except DischargeSummary.DoesNotExist:
            return Response({"detail": "No discharge summary yet"}, status=400)
        try:
            pdf_bytes = generate_discharge_summary_pdf(admission)
        except Exception as e:
            return Response({"detail": f"PDF generation failed: {e}"},
                            status=500)
        resp = HttpResponse(pdf_bytes, content_type="application/pdf")
        resp["Content-Disposition"] = (
            f'inline; filename="DC-{admission.code}.pdf"'
        )
        return resp

    @action(detail=False, methods=["get"])
    def dashboard(self, request):
        """IPD dashboard: occupancy + active admissions + recent discharges."""
        all_beds = Bed.objects.filter(hospital=request.hospital)
        active = self.get_queryset().filter(status="ADMITTED")
        recent_discharges = self.get_queryset().filter(
            status__in=["DISCHARGED", "DAMA", "EXPIRED", "TRANSFERRED"],
            discharged_at__gte=timezone.now() - timedelta(days=7),
        ).order_by("-discharged_at")[:20]

        # Today's admissions
        today = timezone.localdate()
        today_adm = self.get_queryset().filter(admitted_at__date=today)

        return Response({
            "as_of": timezone.localdate().isoformat(),
            "total_beds": all_beds.count(),
            "occupied": all_beds.filter(status="OCCUPIED").count(),
            "available": all_beds.filter(status="AVAILABLE").count(),
            "reserved": all_beds.filter(status="RESERVED").count(),
            "maintenance": all_beds.filter(status="MAINTENANCE").count(),
            "active_admissions": active.count(),
            "today_admissions": today_adm.count(),
            "active": AdmissionSerializer(
                active.order_by("-admitted_at")[:50], many=True,
            ).data,
            "recent_discharges": AdmissionSerializer(
                recent_discharges, many=True,
            ).data,
        })


class DailyChargeViewSet(TenantScopedViewSetMixin, viewsets.ReadOnlyModelViewSet):
    queryset = DailyCharge.objects.select_related("admission__patient")
    serializer_class = DailyChargeSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["admission", "charge_date"]


class AdmissionServiceViewSet(TenantScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = AdmissionService.objects.select_related("admission", "service")
    serializer_class = AdmissionServiceSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["admission", "service_date"]
