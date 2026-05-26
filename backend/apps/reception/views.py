"""Reception module views - Phase 1b adds WebSocket broadcasts on queue events."""
from datetime import datetime, timedelta
from django.utils import timezone
from django.db import transaction
from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db.models import Count, Q

from apps.core.views import TenantScopedViewSetMixin
from apps.notifications.tasks import send_template_notification
from .models import Appointment, QueueToken, VisitorPass
from .serializers import AppointmentSerializer, QueueTokenSerializer, VisitorPassSerializer

# Phase 1b: WebSocket broadcasts for queue events
try:
    from apps.opd.consumers import broadcast_queue_event
except ImportError:
    # During migration / before opd app is wired up
    def broadcast_queue_event(*, hospital_id, payload, doctor_id=None):
        pass

from .models import Appointment


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def reception_stats(request):
    """
    GET /api/v1/reception/stats/

    Snapshot of today's reception counters. Used by the reception
    dashboard's stat cards.
    """
    today = timezone.localdate()
    hospital = getattr(request, "hospital", None)

    qs = Appointment.objects.filter(scheduled_date=today)
    if hospital:
        qs = qs.filter(hospital=hospital)

    counts = qs.aggregate(
        appointments_today = Count("id"),
        pending_checkin    = Count("id", filter=Q(status="scheduled")),
        in_queue           = Count("id", filter=Q(status="checked_in")),
        in_consultation    = Count("id", filter=Q(status="in_consultation")),
        completed          = Count("id", filter=Q(status="completed")),
        cancelled          = Count("id", filter=Q(status="cancelled")),
    )
    return Response(counts)

class AppointmentViewSet(TenantScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = Appointment.objects.select_related(
        "patient", "doctor__user", "location"
    )
    serializer_class = AppointmentSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ["code", "patient__first_name", "patient__last_name",
                     "patient__mrn", "patient__phone"]
    filterset_fields = ["status", "doctor", "scheduled_date", "visit_type", "source"]
    ordering_fields = ["scheduled_date", "scheduled_time", "created_at"]

    def perform_create(self, serializer):
        request = self.request
        scheduled_date = serializer.validated_data.get("scheduled_date")
        code = Appointment.generate_code(request.hospital, scheduled_date)
        appt = serializer.save(
            hospital=request.hospital,
            created_by=request.user,
            code=code,
        )
        if appt.patient.phone:
            send_template_notification.delay(
                code="APPOINTMENT_BOOKED",
                channel="SMS",
                ctx={
                    "patient_name": appt.patient.full_name,
                    "doctor_name": appt.doctor.full_name,
                    "date": appt.scheduled_date.strftime("%d %b %Y"),
                    "time": appt.scheduled_time.strftime("%I:%M %p"),
                    "code": appt.code,
                },
                to=appt.patient.phone,
                hospital_id=request.hospital.id,
                related_object_type="appointment",
                related_object_id=str(appt.id),
            )

    @action(detail=False, methods=["get"])
    def today(self, request):
        today = timezone.localdate()
        qs = self.get_queryset().filter(scheduled_date=today)
        if doctor_id := request.query_params.get("doctor"):
            qs = qs.filter(doctor_id=doctor_id)
        if status_param := request.query_params.get("status"):
            qs = qs.filter(status=status_param)
        return Response(self.get_serializer(qs, many=True).data)

    @action(detail=True, methods=["post"], url_path="check-in")
    def check_in(self, request, pk=None):
        appt = self.get_object()
        if appt.status not in ("BOOKED", "CONFIRMED"):
            return Response(
                {"detail": f"Cannot check in from status {appt.status}"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        with transaction.atomic():
            appt.status = "CHECKED_IN"
            appt.checked_in_at = timezone.now()
            appt.save(update_fields=["status", "checked_in_at"])
            today = timezone.localdate()
            token_no = QueueToken.generate_token(
                request.hospital, appt.doctor, today, "APPOINTMENT"
            )
            qt = QueueToken.objects.create(
                hospital=request.hospital,
                token_no=token_no,
                patient=appt.patient,
                doctor=appt.doctor,
                location=appt.location,
                appointment=appt,
                visit_date=today,
                priority="APPOINTMENT",
                status="WAITING",
                created_by=request.user,
            )
        # Broadcast new token to live queue subscribers
        broadcast_queue_event(
            hospital_id=request.hospital.id,
            payload={"type": "TOKEN_CREATED", "token": QueueTokenSerializer(qt).data},
            doctor_id=qt.doctor_id,
        )
        return Response({
            "appointment": AppointmentSerializer(appt).data,
            "queue_token": QueueTokenSerializer(qt).data,
        })

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        appt = self.get_object()
        if appt.status in ("COMPLETED", "CANCELLED"):
            return Response({"detail": "Already finalized"},
                            status=status.HTTP_400_BAD_REQUEST)
        appt.status = "CANCELLED"
        appt.cancelled_reason = request.data.get("reason", "")
        appt.save(update_fields=["status", "cancelled_reason"])
        return Response(AppointmentSerializer(appt).data)


# Inside AppointmentViewSet, alongside the existing `today` action:

    @action(detail=False, methods=["get"], url_path="stats")
    def stats(self, request):
        """
        GET /api/v1/reception/stats/

        Returns a snapshot of today's reception counters.
        """
        today = timezone.localdate()
        hospital = getattr(request, "hospital", None)
        qs = Appointment.objects.filter(scheduled_date=today)
        if hospital:
            qs = qs.filter(hospital=hospital)

        counts = qs.aggregate(
            appointments_today = Count("id"),
            pending_checkin    = Count("id", filter=Q(status="scheduled")),
            in_queue           = Count("id", filter=Q(status="checked_in")),
            in_consultation    = Count("id", filter=Q(status="in_consultation")),
            completed          = Count("id", filter=Q(status="completed")),
            cancelled          = Count("id", filter=Q(status="cancelled")),
        )
        return Response(counts)

class QueueTokenViewSet(TenantScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = QueueToken.objects.select_related(
        "patient", "doctor__user", "location", "appointment",
    )
    serializer_class = QueueTokenSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ["token_no", "patient__first_name", "patient__last_name",
                     "patient__mrn", "patient__phone"]
    filterset_fields = ["status", "doctor", "visit_date", "priority"]

    def perform_create(self, serializer):
        request = self.request
        visit_date = serializer.validated_data.get("visit_date") or timezone.localdate()
        priority = serializer.validated_data.get("priority", "NORMAL")
        doctor = serializer.validated_data["doctor"]
        token_no = QueueToken.generate_token(
            request.hospital, doctor, visit_date, priority
        )
        qt = serializer.save(
            hospital=request.hospital,
            created_by=request.user,
            token_no=token_no,
            visit_date=visit_date,
        )
        broadcast_queue_event(
            hospital_id=request.hospital.id,
            payload={"type": "TOKEN_CREATED", "token": QueueTokenSerializer(qt).data},
            doctor_id=qt.doctor_id,
        )

    @action(detail=False, methods=["get"])
    def today(self, request):
        today = timezone.localdate()
        qs = self.get_queryset().filter(visit_date=today)
        if doctor_id := request.query_params.get("doctor"):
            qs = qs.filter(doctor_id=doctor_id)
        if status_param := request.query_params.get("status"):
            qs = qs.filter(status=status_param)
        return Response(self.get_serializer(qs, many=True).data)

    @action(detail=True, methods=["post"])
    def call_next(self, request, pk=None):
        qt = self.get_object()
        qt.status = "IN_CONSULT"
        qt.called_at = timezone.now()
        qt.save(update_fields=["status", "called_at"])
        broadcast_queue_event(
            hospital_id=request.hospital.id,
            payload={"type": "TOKEN_UPDATED", "token": QueueTokenSerializer(qt).data},
            doctor_id=qt.doctor_id,
        )
        return Response(QueueTokenSerializer(qt).data)

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        qt = self.get_object()
        qt.status = "DONE"
        qt.completed_at = timezone.now()
        qt.save(update_fields=["status", "completed_at"])
        if qt.appointment:
            qt.appointment.status = "COMPLETED"
            qt.appointment.consult_ended_at = timezone.now()
            qt.appointment.save(update_fields=["status", "consult_ended_at"])
        broadcast_queue_event(
            hospital_id=request.hospital.id,
            payload={"type": "TOKEN_UPDATED", "token": QueueTokenSerializer(qt).data},
            doctor_id=qt.doctor_id,
        )
        return Response(QueueTokenSerializer(qt).data)


class VisitorPassViewSet(TenantScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = VisitorPass.objects.select_related("visiting_patient")
    serializer_class = VisitorPassSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ["pass_no", "visitor_name", "visitor_phone"]
    filterset_fields = ["purpose", "is_revoked"]

    def perform_create(self, serializer):
        request = self.request
        today = timezone.localdate()
        pass_no = VisitorPass.generate_pass_no(request.hospital, today)
        valid_until = serializer.validated_data.get(
            "valid_until", timezone.now() + timedelta(hours=12)
        )
        serializer.save(
            hospital=request.hospital,
            created_by=request.user,
            pass_no=pass_no,
            valid_until=valid_until,
        )

    @action(detail=True, methods=["post"])
    def mark_entry(self, request, pk=None):
        vp = self.get_object()
        vp.entered_at = timezone.now()
        vp.save(update_fields=["entered_at"])
        return Response(VisitorPassSerializer(vp).data)

    @action(detail=True, methods=["post"])
    def mark_exit(self, request, pk=None):
        vp = self.get_object()
        vp.exited_at = timezone.now()
        vp.save(update_fields=["exited_at"])
        return Response(VisitorPassSerializer(vp).data)

    @action(detail=True, methods=["post"])
    def revoke(self, request, pk=None):
        vp = self.get_object()
        vp.is_revoked = True
        vp.save(update_fields=["is_revoked"])
        return Response(VisitorPassSerializer(vp).data)
