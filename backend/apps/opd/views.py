"""OPD module views."""
from datetime import date
from django.utils import timezone
from django.db import transaction
from rest_framework import viewsets, status, serializers as rf_serializers
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core.views import TenantScopedViewSetMixin
from apps.reception.models import QueueToken
from apps.reception.serializers import QueueTokenSerializer
from .models import (Vitals, Consultation, ConsultationDiagnosis,
                     DrugMaster, Prescription, PrescriptionItem)
from .serializers import (VitalsSerializer, ConsultationSerializer,
                          ConsultationDiagnosisSerializer, DrugMasterSerializer,
                          PrescriptionSerializer, PrescriptionItemSerializer)
from .consumers import broadcast_queue_event


class VitalsViewSet(TenantScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = Vitals.objects.select_related("patient", "queue_token")
    serializer_class = VitalsSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["patient", "queue_token"]
    ordering_fields = ["-recorded_at"]

    def perform_create(self, serializer):
        request = self.request
        vitals = serializer.save(hospital=request.hospital, created_by=request.user)
        # If linked to a queue token, advance its status to IN_VITALS done
        # (next state IN_CONSULT happens when doctor calls)
        if vitals.queue_token:
            qt = vitals.queue_token
            if qt.status == "WAITING":
                qt.status = "IN_VITALS"
                qt.save(update_fields=["status"])
                broadcast_queue_event(
                    hospital_id=request.hospital.id,
                    payload={
                        "type": "TOKEN_UPDATED",
                        "token": QueueTokenSerializer(qt).data,
                    },
                    doctor_id=qt.doctor_id,
                )


class ConsultationViewSet(TenantScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = Consultation.objects.select_related(
        "patient", "doctor__user", "appointment", "queue_token", "vitals"
    ).prefetch_related("diagnoses", "prescriptions__items")
    serializer_class = ConsultationSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ["code", "patient__mrn", "patient__first_name", "patient__last_name"]
    filterset_fields = ["status", "doctor", "consultation_date", "patient"]

    def perform_create(self, serializer):
        request = self.request
        on_date = serializer.validated_data.get("consultation_date") or date.today()
        code = Consultation.generate_code(request.hospital, on_date)
        serializer.save(
            hospital=request.hospital,
            created_by=request.user,
            code=code,
        )

    @action(detail=False, methods=["post"], url_path="start-from-token")
    def start_from_token(self, request):
        """Doctor presses 'Call Next' or 'Start Consultation' on a queue token.
        Creates a Consultation in IN_PROGRESS state, links queue token + appointment,
        and broadcasts the queue update via WebSocket.

        Body: { "queue_token_id": 42 }
        """
        token_id = request.data.get("queue_token_id")
        if not token_id:
            return Response({"detail": "queue_token_id required"},
                            status=status.HTTP_400_BAD_REQUEST)
        try:
            qt = QueueToken.objects.select_related("patient", "doctor", "appointment", "vitals"
                ).get(id=token_id, hospital=request.hospital)
        except QueueToken.DoesNotExist:
            return Response({"detail": "Queue token not found"},
                            status=status.HTTP_404_NOT_FOUND)

        # If a draft consultation already exists for this token, return that
        existing = Consultation.objects.filter(queue_token=qt).first()
        if existing and existing.status in ("DRAFT", "IN_PROGRESS"):
            return Response(ConsultationSerializer(existing).data)

        with transaction.atomic():
            now = timezone.now()
            qt.status = "IN_CONSULT"
            qt.called_at = now
            qt.save(update_fields=["status", "called_at"])

            # Pull vitals if available
            vitals = getattr(qt, "vitals", None)

            cons = Consultation.objects.create(
                hospital=request.hospital,
                code=Consultation.generate_code(request.hospital, date.today()),
                patient=qt.patient,
                doctor=qt.doctor,
                appointment=qt.appointment,
                queue_token=qt,
                vitals=vitals,
                consultation_date=date.today(),
                status="IN_PROGRESS",
                started_at=now,
                created_by=request.user,
            )

            # Sync appointment status if present
            if qt.appointment and qt.appointment.status not in ("COMPLETED", "CANCELLED"):
                qt.appointment.status = "IN_CONSULT"
                qt.appointment.consult_started_at = now
                qt.appointment.save(update_fields=["status", "consult_started_at"])

        broadcast_queue_event(
            hospital_id=request.hospital.id,
            payload={
                "type": "TOKEN_UPDATED",
                "token": QueueTokenSerializer(qt).data,
            },
            doctor_id=qt.doctor_id,
        )
        return Response(ConsultationSerializer(cons).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        """Mark consultation completed. Updates queue token + appointment + broadcasts."""
        cons = self.get_object()
        with transaction.atomic():
            now = timezone.now()
            cons.status = "COMPLETED"
            cons.ended_at = now
            cons.save(update_fields=["status", "ended_at"])

            qt = cons.queue_token
            if qt and qt.status != "DONE":
                qt.status = "DONE"
                qt.completed_at = now
                qt.save(update_fields=["status", "completed_at"])
                broadcast_queue_event(
                    hospital_id=request.hospital.id,
                    payload={"type": "TOKEN_UPDATED",
                             "token": QueueTokenSerializer(qt).data},
                    doctor_id=qt.doctor_id,
                )

            if cons.appointment and cons.appointment.status != "COMPLETED":
                cons.appointment.status = "COMPLETED"
                cons.appointment.consult_ended_at = now
                cons.appointment.save(update_fields=["status", "consult_ended_at"])

        return Response(ConsultationSerializer(cons).data)


class ConsultationDiagnosisViewSet(TenantScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = ConsultationDiagnosis.objects.all()
    serializer_class = ConsultationDiagnosisSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["consultation"]


class DrugMasterViewSet(TenantScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = DrugMaster.objects.all()
    serializer_class = DrugMasterSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ["code", "generic_name", "brand_name", "manufacturer"]
    filterset_fields = ["dosage_form", "is_schedule_h"]


class PrescriptionViewSet(TenantScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = Prescription.objects.select_related(
        "patient", "doctor__user", "consultation"
    ).prefetch_related("items__drug")
    serializer_class = PrescriptionSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ["code", "patient__mrn", "patient__first_name", "patient__last_name"]
    filterset_fields = ["doctor", "consultation", "patient", "is_signed"]

    def perform_create(self, serializer):
        request = self.request
        on_date = date.today()
        code = Prescription.generate_code(request.hospital, on_date)
        serializer.save(hospital=request.hospital, created_by=request.user, code=code)

    @action(detail=True, methods=["post"], url_path="add-item")
    def add_item(self, request, pk=None):
        """Append a drug line to the prescription.

        Body: {drug_id?, drug_name, dose, frequency, duration_days, route?, instructions?}
        """
        rx = self.get_object()
        item_serializer = PrescriptionItemSerializer(data={
            **request.data,
            "prescription": rx.id,
        })
        item_serializer.is_valid(raise_exception=True)
        item_serializer.save(hospital=request.hospital, created_by=request.user)
        return Response(item_serializer.data, status=status.HTTP_201_CREATED)


class PrescriptionItemViewSet(TenantScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = PrescriptionItem.objects.all()
    serializer_class = PrescriptionItemSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["prescription"]
