from decimal import Decimal
from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view
from rest_framework.response import Response

from .models import AssetCategory, Asset, AssetMaintenanceLog, AMC, AssetDisposal
from .serializers import (
    AssetCategorySerializer, AssetSerializer,
    AssetMaintenanceLogSerializer, AMCSerializer, AssetDisposalSerializer,
)
from .services import asset_service


class AssetCategoryViewSet(viewsets.ModelViewSet):
    queryset = AssetCategory.objects.all()
    serializer_class = AssetCategorySerializer
    filterset_fields = ["category_type", "is_active"]


class AssetViewSet(viewsets.ModelViewSet):
    queryset = (Asset.objects.select_related("category", "department", "custodian")
                .prefetch_related("maintenance_logs", "amcs").all())
    serializer_class = AssetSerializer
    filterset_fields = ["status", "condition", "category", "department"]
    search_fields = ["asset_code", "name", "serial_number", "barcode"]

    def create(self, request, *args, **kwargs):
        from apps.core.models import Hospital
        from apps.department.models import Department
        try:
            hospital = Hospital.objects.first()
            category = AssetCategory.objects.get(id=request.data["category"])
            dept = (Department.objects.get(id=request.data["department"])
                    if request.data.get("department") else None)
            asset = asset_service.register_asset(
                hospital=hospital, name=request.data["name"], category=category,
                description=request.data.get("description", ""),
                serial_number=request.data.get("serial_number", ""),
                model_number=request.data.get("model_number", ""),
                manufacturer=request.data.get("manufacturer", ""),
                purchase_date=request.data.get("purchase_date"),
                purchase_cost=request.data.get("purchase_cost", 0),
                invoice_number=request.data.get("invoice_number", ""),
                supplier_name=request.data.get("supplier_name", ""),
                depreciation_pct=request.data.get("depreciation_pct",
                                                     category.default_depreciation_pct),
                warranty_start_date=request.data.get("warranty_start_date"),
                warranty_end_date=request.data.get("warranty_end_date"),
                department=dept,
                location=request.data.get("location", ""),
                notes=request.data.get("notes", ""),
            )
        except KeyError as e:
            return Response({"detail": f"Missing field: {e}"}, status=400)
        except Exception as e:
            return Response({"detail": str(e)}, status=400)
        return Response(self.get_serializer(asset).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="schedule-maintenance")
    def schedule_maintenance(self, request, pk=None):
        asset = self.get_object()
        try:
            log = asset_service.schedule_maintenance(
                asset,
                scheduled_date=request.data["scheduled_date"],
                maintenance_type=request.data.get("maintenance_type", "PREVENTIVE"),
                description=request.data["description"],
                cost=request.data.get("cost", 0),
                vendor_name=request.data.get("vendor_name", ""),
                technician_name=request.data.get("technician_name", ""),
                is_under_amc=request.data.get("is_under_amc", False),
                performed_by=request.user if request.user.is_authenticated else None,
            )
        except KeyError as e:
            return Response({"detail": f"Missing field: {e}"}, status=400)
        except Exception as e:
            return Response({"detail": str(e)}, status=400)
        return Response(AssetMaintenanceLogSerializer(log).data,
                          status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def dispose(self, request, pk=None):
        asset = self.get_object()
        try:
            disposal = asset_service.dispose_asset(
                asset,
                disposal_date=request.data["disposal_date"],
                disposal_type=request.data["disposal_type"],
                reason=request.data["reason"],
                sale_value=Decimal(str(request.data.get("sale_value", 0))),
                recipient=request.data.get("recipient", ""),
                approved_by=request.user if request.user.is_authenticated else None,
                certificate_reference=request.data.get("certificate_reference", ""),
            )
        except KeyError as e:
            return Response({"detail": f"Missing field: {e}"}, status=400)
        except Exception as e:
            return Response({"detail": str(e)}, status=400)
        return Response(AssetDisposalSerializer(disposal).data,
                          status=status.HTTP_201_CREATED)


class AssetMaintenanceLogViewSet(viewsets.ModelViewSet):
    queryset = AssetMaintenanceLog.objects.select_related("asset").all()
    serializer_class = AssetMaintenanceLogSerializer
    filterset_fields = ["asset", "status", "maintenance_type"]

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        log = self.get_object()
        try:
            asset_service.complete_maintenance(
                log,
                work_performed=request.data.get("work_performed", ""),
                parts_replaced=request.data.get("parts_replaced", ""),
                cost=Decimal(str(request.data["cost"])) if request.data.get("cost") else None,
                next_due_date=request.data.get("next_due_date"),
            )
        except Exception as e:
            return Response({"detail": str(e)}, status=400)
        return Response(self.get_serializer(log).data)


class AMCViewSet(viewsets.ModelViewSet):
    queryset = AMC.objects.select_related("asset").all()
    serializer_class = AMCSerializer
    filterset_fields = ["asset", "status", "vendor_name"]


class AssetDisposalViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AssetDisposal.objects.select_related("asset", "approved_by").all()
    serializer_class = AssetDisposalSerializer


@api_view(["GET"])
def asset_metrics(request):
    from apps.core.models import Hospital
    hospital = Hospital.objects.first()
    if not hospital:
        return Response({"detail": "No hospital."}, status=400)
    return Response(asset_service.get_dashboard_metrics(hospital))
