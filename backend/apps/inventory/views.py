from decimal import Decimal
from datetime import date
from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view
from rest_framework.response import Response

from .models import (
    StoreLocation, ItemCategory, Supplier, StockItem, StockBatch,
    PurchaseOrder, POLine, GRN, GRNLine,
    StockRequisition, RequisitionLine, StockIssue, IssueLine, StockTransfer,
)
from .serializers import (
    StoreLocationSerializer, ItemCategorySerializer, SupplierSerializer,
    StockItemSerializer, StockBatchSerializer,
    PurchaseOrderSerializer, POLineSerializer,
    GRNSerializer, StockRequisitionSerializer,
    StockIssueSerializer, StockTransferSerializer,
)
from .services import stock_service


class StoreLocationViewSet(viewsets.ModelViewSet):
    queryset = StoreLocation.objects.all()
    serializer_class = StoreLocationSerializer
    filterset_fields = ["store_type", "is_active"]
    search_fields = ["code", "name"]


class ItemCategoryViewSet(viewsets.ModelViewSet):
    queryset = ItemCategory.objects.all()
    serializer_class = ItemCategorySerializer
    filterset_fields = ["parent", "is_active"]
    search_fields = ["code", "name"]


class SupplierViewSet(viewsets.ModelViewSet):
    queryset = Supplier.objects.all()
    serializer_class = SupplierSerializer
    filterset_fields = ["is_active", "is_blacklisted"]
    search_fields = ["code", "name", "gstin", "phone"]


class StockItemViewSet(viewsets.ModelViewSet):
    queryset = StockItem.objects.select_related("category").all()
    serializer_class = StockItemSerializer
    filterset_fields = ["category", "item_type", "is_active"]
    search_fields = ["code", "name"]


class StockBatchViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = StockBatch.objects.select_related("item", "store", "supplier").all()
    serializer_class = StockBatchSerializer
    filterset_fields = ["item", "store", "supplier", "is_active"]


class PurchaseOrderViewSet(viewsets.ModelViewSet):
    queryset = (PurchaseOrder.objects.select_related("supplier", "store")
                .prefetch_related("lines__item").all())
    serializer_class = PurchaseOrderSerializer
    filterset_fields = ["status", "supplier", "store"]
    search_fields = ["code"]

    def create(self, request, *args, **kwargs):
        from apps.core.models import Hospital
        try:
            hospital = Hospital.objects.first()
            supplier = Supplier.objects.get(id=request.data["supplier"])
            store = StoreLocation.objects.get(id=request.data["store"])

            line_data = request.data.get("lines", [])
            lines = []
            for ld in line_data:
                item = StockItem.objects.get(id=ld["item"])
                lines.append({
                    "item": item,
                    "quantity": ld["quantity"],
                    "unit_price": ld["unit_price"],
                    "discount_pct": ld.get("discount_pct", 0),
                    "gst_rate": ld.get("gst_rate", item.gst_rate),
                    "notes": ld.get("notes", ""),
                })

            po = stock_service.create_purchase_order(
                hospital=hospital, supplier=supplier, store=store, lines=lines,
                expected_delivery_date=request.data.get("expected_delivery_date"),
                payment_terms_days=request.data.get("payment_terms_days", 30),
                notes=request.data.get("notes", ""),
                requested_by=request.user if request.user.is_authenticated else None,
            )
        except KeyError as e:
            return Response({"detail": f"Missing field: {e}"},
                             status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(po).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def submit(self, request, pk=None):
        po = self.get_object()
        if po.status != "DRAFT":
            return Response({"detail": f"Cannot submit in status {po.status}"},
                             status=400)
        po.status = "SUBMITTED"
        po.save(update_fields=["status", "updated_at"])
        return Response(self.get_serializer(po).data)

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        po = self.get_object()
        try:
            stock_service.approve_purchase_order(po,
                approved_by=request.user if request.user.is_authenticated else None)
        except Exception as e:
            return Response({"detail": str(e)}, status=400)
        return Response(self.get_serializer(po).data)


class GRNViewSet(viewsets.ModelViewSet):
    queryset = (GRN.objects.select_related("supplier", "store", "purchase_order")
                .prefetch_related("lines__item").all())
    serializer_class = GRNSerializer
    filterset_fields = ["status", "supplier", "store"]
    search_fields = ["code", "supplier_invoice_number"]

    def create(self, request, *args, **kwargs):
        try:
            po = PurchaseOrder.objects.get(id=request.data["purchase_order"])
            line_data = request.data.get("lines", [])
            lines = []
            for ld in line_data:
                po_line = POLine.objects.get(id=ld["po_line"])
                lines.append({
                    "po_line": po_line,
                    "accepted_quantity": ld["accepted_quantity"],
                    "rejected_quantity": ld.get("rejected_quantity", 0),
                    "batch_number": ld["batch_number"],
                    "unit_price": ld.get("unit_price", po_line.unit_price),
                    "mrp": ld.get("mrp", 0),
                    "expiry_date": ld.get("expiry_date"),
                    "manufacture_date": ld.get("manufacture_date"),
                    "rejection_reason": ld.get("rejection_reason", ""),
                    "notes": ld.get("notes", ""),
                })

            grn = stock_service.create_grn_from_po(po,
                supplier_invoice_number=request.data.get("supplier_invoice_number", ""),
                supplier_invoice_date=request.data.get("supplier_invoice_date"),
                received_by=request.user if request.user.is_authenticated else None,
                lines=lines)
        except KeyError as e:
            return Response({"detail": f"Missing field: {e}"}, status=400)
        except Exception as e:
            return Response({"detail": str(e)}, status=400)
        return Response(self.get_serializer(grn).data, status=status.HTTP_201_CREATED)


class StockRequisitionViewSet(viewsets.ModelViewSet):
    queryset = (StockRequisition.objects
                .select_related("requesting_dept", "source_store")
                .prefetch_related("lines__item").all())
    serializer_class = StockRequisitionSerializer
    filterset_fields = ["status", "urgency", "requesting_dept", "source_store"]
    search_fields = ["code"]

    def create(self, request, *args, **kwargs):
        from apps.core.models import Hospital
        from apps.department.models import Department
        try:
            hospital = Hospital.objects.first()
            dept = Department.objects.get(id=request.data["requesting_dept"])
            store = StoreLocation.objects.get(id=request.data["source_store"])
            lines = []
            for ld in request.data.get("lines", []):
                item = StockItem.objects.get(id=ld["item"])
                lines.append({
                    "item": item,
                    "quantity_requested": ld["quantity_requested"],
                    "notes": ld.get("notes", ""),
                })
            req = stock_service.create_requisition(
                hospital=hospital, requesting_dept=dept, source_store=store,
                lines=lines,
                urgency=request.data.get("urgency", "ROUTINE"),
                purpose=request.data.get("purpose", ""),
                required_by_date=request.data.get("required_by_date"),
                notes=request.data.get("notes", ""),
                requested_by=request.user if request.user.is_authenticated else None,
            )
        except KeyError as e:
            return Response({"detail": f"Missing field: {e}"}, status=400)
        except Exception as e:
            return Response({"detail": str(e)}, status=400)
        return Response(self.get_serializer(req).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        req = self.get_object()
        line_approvals = request.data.get("line_approvals", {})
        try:
            stock_service.approve_requisition(req,
                line_approvals={int(k): v for k, v in line_approvals.items()},
                approved_by=request.user if request.user.is_authenticated else None)
        except Exception as e:
            return Response({"detail": str(e)}, status=400)
        return Response(self.get_serializer(req).data)

    @action(detail=True, methods=["post"])
    def issue(self, request, pk=None):
        req = self.get_object()
        try:
            issue = stock_service.issue_against_requisition(
                req,
                line_issues=request.data.get("line_issues", []),
                received_by_name=request.data.get("received_by_name", ""),
                issued_by=request.user if request.user.is_authenticated else None,
            )
        except Exception as e:
            return Response({"detail": str(e)}, status=400)
        return Response(StockIssueSerializer(issue).data, status=status.HTTP_201_CREATED)


class StockIssueViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = (StockIssue.objects.select_related("issuing_store", "receiving_dept",
                                                      "requisition")
                .prefetch_related("lines__batch__item").all())
    serializer_class = StockIssueSerializer
    filterset_fields = ["issuing_store", "receiving_dept", "requisition"]


class StockTransferViewSet(viewsets.ModelViewSet):
    queryset = StockTransfer.objects.select_related("from_store", "to_store", "item").all()
    serializer_class = StockTransferSerializer
    filterset_fields = ["from_store", "to_store", "status", "item"]

    def create(self, request, *args, **kwargs):
        from apps.core.models import Hospital
        try:
            hospital = Hospital.objects.first()
            transfer = stock_service.create_transfer(
                hospital=hospital,
                from_store=StoreLocation.objects.get(id=request.data["from_store"]),
                to_store=StoreLocation.objects.get(id=request.data["to_store"]),
                item=StockItem.objects.get(id=request.data["item"]),
                quantity=request.data["quantity"],
                batch_number=request.data.get("batch_number", ""),
                notes=request.data.get("notes", ""),
                initiated_by=request.user if request.user.is_authenticated else None,
            )
        except KeyError as e:
            return Response({"detail": f"Missing field: {e}"}, status=400)
        except Exception as e:
            return Response({"detail": str(e)}, status=400)
        return Response(self.get_serializer(transfer).data, status=status.HTTP_201_CREATED)


@api_view(["GET"])
def stock_summary(request):
    from apps.core.models import Hospital
    hospital = Hospital.objects.first()
    if not hospital:
        return Response({"detail": "No hospital."}, status=400)
    store_id = request.query_params.get("store")
    store = StoreLocation.objects.get(id=store_id) if store_id else None
    low = request.query_params.get("low_stock") == "true"
    return Response({
        "summary": stock_service.get_stock_summary(hospital, store=store, low_stock_only=low),
    })


@api_view(["GET"])
def expiring_soon(request):
    from apps.core.models import Hospital
    hospital = Hospital.objects.first()
    days = int(request.query_params.get("days", 30))
    batches = stock_service.get_expiring_batches(hospital, days=days)
    return Response(StockBatchSerializer(batches, many=True).data)
