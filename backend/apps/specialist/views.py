from datetime import date as dt_date, datetime
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from apps.core.views import TenantScopedViewSetMixin
from .models import (Doctor, Specialty, Qualification, OPDSlot,
                     OPDSlotException, ConsultationFee, OnCallRoster)
from .serializers import (DoctorSerializer, CreateDoctorSerializer,
                          SpecialtySerializer, QualificationSerializer,
                          OPDSlotSerializer, OPDSlotExceptionSerializer,
                          ConsultationFeeSerializer, OnCallRosterSerializer)
from .services import get_doctor_availability, get_consultation_fee


class SpecialtyViewSet(TenantScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = Specialty.objects.all()
    serializer_class = SpecialtySerializer
    permission_classes = [IsAuthenticated]
    search_fields = ["code", "name"]


class QualificationViewSet(TenantScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = Qualification.objects.all()
    serializer_class = QualificationSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ["code", "name"]


class DoctorViewSet(TenantScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = Doctor.objects.select_related("user", "primary_department").prefetch_related(
        "specialties", "qualifications", "fees"
    )
    serializer_class = DoctorSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ["user__first_name", "user__last_name", "registration_number"]
    filterset_fields = ["primary_department", "is_consulting", "is_active"]

    def get_serializer_class(self):
        if self.action == "create":
            return CreateDoctorSerializer
        return DoctorSerializer

    @action(detail=True, methods=["get"])
    def availability(self, request, pk=None):
        """GET /specialist/doctors/{id}/availability/?date=2026-05-08"""
        doctor = self.get_object()
        date_str = request.query_params.get("date")
        try:
            target = (datetime.strptime(date_str, "%Y-%m-%d").date()
                      if date_str else dt_date.today())
        except ValueError:
            return Response({"detail": "Invalid date (YYYY-MM-DD)"},
                            status=status.HTTP_400_BAD_REQUEST)
        return Response(get_doctor_availability(doctor, target))

    @action(detail=True, methods=["get"])
    def fee(self, request, pk=None):
        doctor = self.get_object()
        visit_type = request.query_params.get("visit_type", "NEW")
        return Response({
            "doctor_id": doctor.id, "visit_type": visit_type,
            "fee": get_consultation_fee(doctor, visit_type),
        })

    @action(detail=True, methods=["get"])
    def slots(self, request, pk=None):
        """List the doctor's weekly slots."""
        doctor = self.get_object()
        slots = OPDSlot.objects.filter(doctor=doctor, is_active=True)
        return Response(OPDSlotSerializer(slots, many=True).data)


class OPDSlotViewSet(TenantScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = OPDSlot.objects.select_related("doctor__user", "location")
    serializer_class = OPDSlotSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["doctor", "day_of_week", "is_active"]


class OPDSlotExceptionViewSet(TenantScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = OPDSlotException.objects.all()
    serializer_class = OPDSlotExceptionSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["doctor", "exception_type", "date"]


class ConsultationFeeViewSet(TenantScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = ConsultationFee.objects.all()
    serializer_class = ConsultationFeeSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["doctor", "visit_type"]


class OnCallRosterViewSet(TenantScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = OnCallRoster.objects.select_related("doctor__user", "department")
    serializer_class = OnCallRosterSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["doctor", "department", "shift", "date"]
