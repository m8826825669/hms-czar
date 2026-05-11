from decimal import Decimal
from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view
from rest_framework.response import Response

from .models import LinenItem, LinenStock, LaundryBatch, LaundryBatchItem, LinenLoss
from .serializers import (
    LinenItemSerializer, LinenStockSerializer, LaundryBatchSerializer,
    LaundryBatchItemSerializer, LinenLossSerializer,
)
from .services import batch_service


class LinenItemViewSet(viewsets.ModelViewSet):
    queryset = LinenItem.objects.all()
    serializer_class = LinenItemSerializer
    filterset_fields = ["category", "is_active"]
    search_fields = ["code", "name"]


class LinenStockViewSet(viewsets.ModelViewSet):
    queryset = LinenStock.objects.select_related("item", "department").all()
    serializer_class = LinenStockSerializer
    filterset_fields = ["item", "department"]


class LaundryBatchViewSet(viewsets.ModelViewSet):
    queryset = (LaundryBatch.objects
                .select_related("source_department")
                .prefetch_related("items__item")
                .all())
    serializer_class = LaundryBatchSerializer
    filterset_fields = ["status", "batch_type", "source_department"]
    search_fields = ["code", "vendor_name"]

    def create(self, request, *args, **kwargs):
        from apps.core.models import Hospital
        from apps.department.models import Department
        try:
            hospital = (Hospital.objects.first()
                        if "hospital" not in request.data
                        else Hospital.objects.get(id=request.data["hospital"]))
            department = None
            if request.data.get("source_department"):
                department = Department.objects.get(id=request.data["source_department"])

            batch = batch_service.create_batch(
                hospital=hospital,
                batch_type=request.data.get("batch_type", "OUTSOURCED"),
                source_department=department,
                source_ward_label=request.data.get("source_ward_label", ""),
                vendor_name=request.data.get("vendor_name", ""),
                vendor_contact=request.data.get("vendor_contact", ""),
                expected_return_at=request.data.get("expected_return_at"),
                notes=request.data.get("notes", ""),
            )
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(batch).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="add-item")
    def add_item(self, request, pk=None):
        batch = self.get_object()
        try:
            item = LinenItem.objects.get(id=request.data["item_id"])
            cost = (Decimal(str(request.data["cost_per_unit"]))
                    if request.data.get("cost_per_unit") else None)
            batch_service.add_item_to_batch(
                batch, item=item,
                quantity_sent=int(request.data["quantity_sent"]),
                cost_per_unit=cost,
            )
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        batch.refresh_from_db()
        return Response(self.get_serializer(batch).data)

    @action(detail=True, methods=["post"])
    def transition(self, request, pk=None):
        batch = self.get_object()
        try:
            batch_service.transition_batch(
                batch, request.data["new_status"],
                user=request.user if request.user.is_authenticated else None,
            )
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(batch).data)


class LaundryBatchItemViewSet(viewsets.ModelViewSet):
    queryset = LaundryBatchItem.objects.all()
    serializer_class = LaundryBatchItemSerializer
    filterset_fields = ["batch"]

    @action(detail=True, methods=["post"])
    def reconcile(self, request, pk=None):
        item = self.get_object()
        try:
            batch_service.reconcile_batch_item(
                item,
                quantity_received=int(request.data.get("quantity_received", 0)),
                quantity_lost=int(request.data.get("quantity_lost", 0)),
                quantity_damaged=int(request.data.get("quantity_damaged", 0)),
                notes=request.data.get("notes", ""),
            )
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(item).data)


class LinenLossViewSet(viewsets.ModelViewSet):
    queryset = LinenLoss.objects.select_related("item", "department", "batch").all()
    serializer_class = LinenLossSerializer
    filterset_fields = ["loss_type", "item", "department"]


@api_view(["GET"])
def stock_summary_view(request):
    from apps.core.models import Hospital
    hospital = Hospital.objects.first()
    if not hospital:
        return Response({"detail": "No hospital."},
                         status=status.HTTP_400_BAD_REQUEST)
    return Response(batch_service.stock_summary(hospital))
