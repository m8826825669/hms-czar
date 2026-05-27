"""Nursing views — CRUD plus a few custom actions:

  POST /nursing/medications/{id}/administer/    → mark a MAR row as GIVEN now
  POST /nursing/medications/{id}/refuse/        → mark as REFUSED with reason
  POST /nursing/medications/{id}/hold/          → mark as HELD with reason
  POST /nursing/handovers/{id}/acknowledge/     → incoming nurse acknowledges
  GET  /nursing/handovers/inbox/?date=YYYY-MM-DD&shift=MORNING
                                                → handovers waiting for me
"""
from datetime import date as date_t

from django.db import transaction
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError

from apps.core.views import TenantScopedViewSetMixin
from .models import NursingNote, MedicationAdministration, ShiftHandover
from .serializers import (
    NursingNoteSerializer,
    MedicationAdministrationSerializer,
    ShiftHandoverSerializer,
)


class NursingNoteViewSet(TenantScopedViewSetMixin, viewsets.ModelViewSet):
    """CRUD for nursing notes. Notes cannot be deleted once saved — that's a
    medico-legal requirement. The destroy method is overridden to refuse."""
    queryset = NursingNote.objects.select_related(
        "admission__patient", "nurse",
    ).prefetch_related("addenda")
    serializer_class = NursingNoteSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["admission", "note_type", "shift", "nurse"]
    search_fields = ["content", "admission__patient__first_name",
                     "admission__patient__last_name", "admission__patient__mrn"]
    ordering_fields = ["noted_at", "created_at"]
    ordering = ["-noted_at"]

    def perform_create(self, serializer):
        # nurse is the request.user by default; admins can override via kwargs
        # but the default behaviour signs the note in the user's name
        serializer.save(
            hospital=self.request.hospital,
            created_by=self.request.user,
            nurse=self.request.user,
        )

    def destroy(self, request, *args, **kwargs):
        return Response(
            {"detail": "Nursing notes cannot be deleted. Add an addendum instead "
                       "(POST to /nursing/notes/ with parent_note set)."},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    def update(self, request, *args, **kwargs):
        # Block updates to keep the audit trail clean
        return Response(
            {"detail": "Nursing notes cannot be edited. Add an addendum instead "
                       "(POST to /nursing/notes/ with parent_note set)."},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    def partial_update(self, request, *args, **kwargs):
        return self.update(request, *args, **kwargs)


class MedicationAdministrationViewSet(TenantScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = MedicationAdministration.objects.select_related(
        "admission__patient", "prescription_item", "administered_by",
    )
    serializer_class = MedicationAdministrationSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["admission", "status", "prescription_item"]
    search_fields = ["admission__patient__first_name", "admission__patient__last_name",
                     "admission__patient__mrn", "prescription_item__drug_name"]
    ordering_fields = ["scheduled_at", "administered_at"]
    ordering = ["-scheduled_at"]

    @action(detail=True, methods=["post"])
    def administer(self, request, pk=None):
        """Mark this dose as GIVEN. Stamps administered_at=now, administered_by=user.
        Body (optional): { actual_dose, site, response_note }
        """
        mar = self.get_object()
        if mar.status == "GIVEN":
            return Response({"detail": "This dose is already marked as given."},
                            status=status.HTTP_400_BAD_REQUEST)
        mar.status = "GIVEN"
        mar.administered_at = timezone.now()
        mar.administered_by = request.user
        for f in ("actual_dose", "site", "response_note"):
            if f in request.data:
                setattr(mar, f, request.data[f])
        mar.save(update_fields=["status", "administered_at", "administered_by",
                                 "actual_dose", "site", "response_note", "updated_at"])
        return Response(self.get_serializer(mar).data)

    @action(detail=True, methods=["post"])
    def refuse(self, request, pk=None):
        """Mark this dose as REFUSED by the patient. Reason required."""
        mar = self.get_object()
        reason = request.data.get("reason", "").strip()
        if not reason:
            raise ValidationError({"reason": "A reason is required when refusing a dose."})
        mar.status = "REFUSED"
        mar.administered_at = timezone.now()
        mar.administered_by = request.user
        mar.reason = reason
        mar.save(update_fields=["status", "administered_at", "administered_by",
                                 "reason", "updated_at"])
        return Response(self.get_serializer(mar).data)

    @action(detail=True, methods=["post"])
    def hold(self, request, pk=None):
        """Mark this dose as HELD per doctor's order. Reason required."""
        mar = self.get_object()
        reason = request.data.get("reason", "").strip()
        if not reason:
            raise ValidationError({"reason": "A reason is required when holding a dose."})
        mar.status = "HELD"
        mar.administered_at = timezone.now()
        mar.administered_by = request.user
        mar.reason = reason
        mar.save(update_fields=["status", "administered_at", "administered_by",
                                 "reason", "updated_at"])
        return Response(self.get_serializer(mar).data)

    @action(detail=False, methods=["get"], url_path="due-now")
    def due_now(self, request):
        """Return scheduled doses within the last hour and next hour for the
        nurse's current ward filter. Driven by the Nursing home page."""
        now = timezone.now()
        one_hour_ago = now - timezone.timedelta(hours=1)
        one_hour_ahead = now + timezone.timedelta(hours=1)
        qs = self.get_queryset().filter(
            status="SCHEDULED",
            scheduled_at__gte=one_hour_ago,
            scheduled_at__lte=one_hour_ahead,
        )
        if admission_id := request.query_params.get("admission"):
            qs = qs.filter(admission_id=admission_id)
        return Response(self.get_serializer(qs, many=True).data)


class ShiftHandoverViewSet(TenantScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = ShiftHandover.objects.select_related(
        "admission__patient", "admission__bed__room__ward",
        "outgoing_nurse", "incoming_nurse",
    )
    serializer_class = ShiftHandoverSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["admission", "shift_date", "outgoing_shift", "priority"]
    ordering_fields = ["shift_date", "created_at"]
    ordering = ["-shift_date", "-created_at"]

    def perform_create(self, serializer):
        # outgoing_nurse defaults to request.user but can be overridden (e.g.,
        # a shift in-charge filling in for someone)
        outgoing = self.request.data.get("outgoing_nurse") or self.request.user.id
        serializer.save(
            hospital=self.request.hospital,
            created_by=self.request.user,
            outgoing_nurse_id=outgoing,
        )

    @action(detail=True, methods=["post"])
    def acknowledge(self, request, pk=None):
        """Incoming nurse acknowledges this handover. Stamps acknowledged_at=now
        and incoming_nurse=request.user. Cannot be reversed."""
        ho = self.get_object()
        if ho.acknowledged_at is not None:
            return Response({"detail": "This handover has already been acknowledged."},
                            status=status.HTTP_400_BAD_REQUEST)
        ho.incoming_nurse = request.user
        ho.acknowledged_at = timezone.now()
        ho.save(update_fields=["incoming_nurse", "acknowledged_at", "updated_at"])
        return Response(self.get_serializer(ho).data)

    @action(detail=False, methods=["get"])
    def inbox(self, request):
        """Handovers waiting for me to acknowledge. Filters by today + my shift
        unless date/shift query params override."""
        d = request.query_params.get("date") or date_t.today().isoformat()
        qs = self.get_queryset().filter(
            shift_date=d,
            acknowledged_at__isnull=True,
        )
        if shift := request.query_params.get("shift"):
            qs = qs.filter(outgoing_shift=shift)
        return Response(self.get_serializer(qs, many=True).data)
