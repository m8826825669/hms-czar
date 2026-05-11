from decimal import Decimal
from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view
from rest_framework.response import Response

from .models import (
    CylinderType, Cylinder, CylinderUsage,
    RefillRecord, CylinderInspection,
)
from .serializers import (
    CylinderTypeSerializer, CylinderSerializer, CylinderUsageSerializer,
    CylinderInspectionSerializer, RefillRecordSerializer,
)
from .services import cylinder_service


class CylinderTypeViewSet(viewsets.ModelViewSet):
    queryset = CylinderType.objects.all()
    serializer_class = CylinderTypeSerializer
    filterset_fields = ["gas_type", "size", "is_active"]
    search_fields = ["code"]


class CylinderViewSet(viewsets.ModelViewSet):
    queryset = (Cylinder.objects
                .select_related("cylinder_type", "current_department")
                .prefetch_related("usage_log", "inspections")
                .all())
    serializer_class = CylinderSerializer
    filterset_fields = ["status", "cylinder_type", "is_active"]
    search_fields = ["serial_number", "barcode"]

    @action(detail=True, methods=["post"])
    def issue(self, request, pk=None):
        cyl = self.get_object()
        from apps.department.models import Department
        dept = None
        if request.data.get("department_id"):
            dept = Department.objects.get(id=request.data["department_id"])
        try:
            cylinder_service.issue_cylinder(
                cyl, department=dept,
                location=request.data.get("location", ""),
                received_by=request.data.get("received_by", ""),
                user=request.user if request.user.is_authenticated else None,
            )
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(cyl).data)

    @action(detail=True, methods=["post"], url_path="return")
    def return_cyl(self, request, pk=None):
        cyl = self.get_object()
        try:
            cylinder_service.return_cylinder(
                cyl,
                fill_percentage=int(request.data.get("fill_percentage", 50)),
                user=request.user if request.user.is_authenticated else None,
                notes=request.data.get("notes", ""),
            )
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(cyl).data)

    @action(detail=True, methods=["post"], url_path="add-inspection")
    def add_inspection(self, request, pk=None):
        cyl = self.get_object()
        try:
            insp = cylinder_service.record_inspection(
                cyl,
                inspection_type=request.data["inspection_type"],
                outcome=request.data["outcome"],
                inspected_by=request.data.get("inspected_by", ""),
                findings=request.data.get("findings", ""),
                certificate_ref=request.data.get("certificate_ref", ""),
                next_due_in_days=request.data.get("next_due_in_days"),
            )
        except KeyError as e:
            return Response({"detail": f"Missing field: {e}"},
                             status=status.HTTP_400_BAD_REQUEST)
        return Response(CylinderInspectionSerializer(insp).data,
                         status=status.HTTP_201_CREATED)


class CylinderUsageViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = CylinderUsage.objects.all()
    serializer_class = CylinderUsageSerializer
    filterset_fields = ["cylinder", "event_type"]


class RefillRecordViewSet(viewsets.ModelViewSet):
    queryset = RefillRecord.objects.all()
    serializer_class = RefillRecordSerializer
    filterset_fields = ["is_completed", "vendor_name"]

    @action(detail=False, methods=["post"], url_path="send-batch")
    def send_batch(self, request):
        from apps.core.models import Hospital
        hospital = Hospital.objects.first()
        cyl_ids = request.data.get("cylinder_ids", [])
        cylinders = list(Cylinder.objects.filter(id__in=cyl_ids))
        try:
            rec = cylinder_service.send_for_refill(
                hospital, cylinders,
                vendor_name=request.data["vendor_name"],
                expected_return_at=request.data.get("expected_return_at"),
                user=request.user if request.user.is_authenticated else None,
            )
        except KeyError as e:
            return Response({"detail": f"Missing field: {e}"},
                             status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(rec).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="receive")
    def receive(self, request, pk=None):
        rec = self.get_object()
        try:
            cylinder_service.receive_from_refill(
                rec,
                cylinder_ids=request.data.get("cylinder_ids", []),
                total_cost=Decimal(str(request.data.get("total_cost", "0"))),
                invoice_ref=request.data.get("invoice_reference", ""),
                user=request.user if request.user.is_authenticated else None,
            )
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(rec).data)


@api_view(["GET"])
def cylinder_inventory(request):
    from apps.core.models import Hospital
    hospital = Hospital.objects.first()
    if not hospital:
        return Response({"detail": "No hospital."},
                         status=status.HTTP_400_BAD_REQUEST)
    return Response(cylinder_service.inventory_summary(hospital))
