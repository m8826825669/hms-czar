from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from apps.core.views import TenantScopedViewSetMixin
from .models import Department
from .serializers import DepartmentSerializer


class DepartmentViewSet(TenantScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = Department.objects.select_related("head_doctor__user")
    serializer_class = DepartmentSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ["code", "name"]
    filterset_fields = ["type", "is_active"]
