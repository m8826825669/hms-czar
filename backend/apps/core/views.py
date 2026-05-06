"""Core views - hospital info, health check, base CRUD."""
from django.db import connection
from django.core.cache import cache
from rest_framework import status, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .models import Hospital, Department, Location, Patient
from .serializers import HospitalSerializer, DepartmentSerializer, LocationSerializer, PatientSerializer


@api_view(["GET"])
@permission_classes([AllowAny])
def health_check(request):
    """Liveness/readiness probe for k8s/docker/uptime monitors."""
    health = {"status": "ok", "checks": {}}
    # DB
    try:
        with connection.cursor() as c:
            c.execute("SELECT 1")
        health["checks"]["db"] = "ok"
    except Exception as e:
        health["status"] = "degraded"
        health["checks"]["db"] = f"error: {e}"
    # Cache (Redis)
    try:
        cache.set("hms_health_ping", "1", 5)
        cache.get("hms_health_ping")
        health["checks"]["cache"] = "ok"
    except Exception as e:
        health["status"] = "degraded"
        health["checks"]["cache"] = f"error: {e}"
    code = status.HTTP_200_OK if health["status"] == "ok" else status.HTTP_503_SERVICE_UNAVAILABLE
    return Response(health, status=code)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def current_hospital(request):
    """Returns the hospital context for the current user/request."""
    hospital = getattr(request, "hospital", None)
    if not hospital:
        return Response({"detail": "No hospital context."}, status=status.HTTP_404_NOT_FOUND)
    return Response(HospitalSerializer(hospital).data)


class TenantScopedViewSetMixin:
    """Auto-filters queryset by request.hospital and stamps it on create."""
    def get_queryset(self):
        qs = super().get_queryset()
        hospital = getattr(self.request, "hospital", None)
        if hospital is not None:
            qs = qs.filter(hospital=hospital)
        return qs

    def perform_create(self, serializer):
        serializer.save(hospital=self.request.hospital, created_by=self.request.user)


class DepartmentViewSet(TenantScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer
    search_fields = ["code", "name"]
    filterset_fields = ["dept_type", "is_active"]


class LocationViewSet(TenantScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = Location.objects.all()
    serializer_class = LocationSerializer
    search_fields = ["code", "name"]
    filterset_fields = ["location_type", "is_active", "department"]


class PatientViewSet(TenantScopedViewSetMixin, viewsets.ModelViewSet):
    """Patient CRUD - canonical record. Phase 1 will extend with reception flows."""
    queryset = Patient.objects.all()
    serializer_class = PatientSerializer
    search_fields = ["mrn", "first_name", "last_name", "phone", "abha_id"]
    filterset_fields = ["gender", "blood_group", "is_vip", "is_deceased"]

    def perform_create(self, serializer):
        # Auto-generate MRN
        mrn = Patient.generate_mrn(self.request.hospital)
        serializer.save(
            hospital=self.request.hospital,
            created_by=self.request.user,
            mrn=mrn,
        )
