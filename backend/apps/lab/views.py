"""Lab views.

Endpoints (all under /api/lab/):

  GET    /tests/                        — list catalog
  POST   /tests/                        — admin create
  GET    /tests/<id>/parameters/        — parameters for a test
  POST   /tests/<id>/add-parameter/     — admin add parameter

  GET    /orders/                       — list orders (filters: status, patient, priority)
  POST   /orders/                       — create DRAFT order
  POST   /orders/<id>/add-test/         — append a test (DRAFT only)
  POST   /orders/<id>/remove-test/<iid>/
  POST   /orders/<id>/finalize/         — DRAFT → ORDERED + auto-create Invoice
  POST   /orders/<id>/collect-samples/  — auto-generate samples per sample_type
  POST   /orders/<id>/items/<iid>/results/ — bulk-enter parameter results
  POST   /orders/<id>/release/          — pathologist verifies + releases report
  POST   /orders/<id>/cancel/
  GET    /orders/<id>/report/           — PDF stream
  GET    /orders/today/                 — dashboard rollup
  GET    /orders/abnormal/              — orders with abnormal results last 7d

  GET    /samples/                      — sample queue
  POST   /samples/<id>/reject/          — mark sample unusable

  GET    /results/                      — flat result feed (filters: flag, order)
"""
from datetime import date, timedelta
from decimal import Decimal
from django.db import transaction
from django.db.models import Count, Q
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core.views import TenantScopedViewSetMixin
from .models import (TestCatalog, TestParameter, LabOrder, LabOrderItem,
                     LabSample, LabResult)
from .serializers import (TestCatalogSerializer, TestParameterSerializer,
                          LabOrderSerializer, LabOrderItemSerializer,
                          LabSampleSerializer, LabResultSerializer)
from .services.order_service import (finalize_order, collect_samples,
                                     enter_results_for_item,
                                     verify_and_release_report)
from .services.pdf_report import generate_lab_report


# ─────────────────────────────────── TestCatalog ────────────────────────────────

class TestCatalogViewSet(TenantScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = TestCatalog.objects.prefetch_related("parameters")
    serializer_class = TestCatalogSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ["code", "name"]
    filterset_fields = ["category", "sample_type", "is_active"]
    ordering_fields = ["category", "name", "price"]

    @action(detail=True, methods=["get"])
    def parameters(self, request, pk=None):
        test = self.get_object()
        qs = test.parameters.all().order_by("sort_order", "name")
        return Response(TestParameterSerializer(qs, many=True).data)

    @action(detail=True, methods=["post"], url_path="add-parameter")
    def add_parameter(self, request, pk=None):
        test = self.get_object()
        data = {**request.data, "test": test.id}
        ser = TestParameterSerializer(data=data)
        ser.is_valid(raise_exception=True)
        ser.save(hospital=request.hospital, created_by=request.user)
        return Response(ser.data, status=201)


class TestParameterViewSet(TenantScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = TestParameter.objects.select_related("test")
    serializer_class = TestParameterSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ["code", "name", "test__code", "test__name"]
    filterset_fields = ["test", "is_qualitative"]


# ─────────────────────────────────── LabOrder ───────────────────────────────────

class LabOrderViewSet(TenantScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = LabOrder.objects.select_related(
        "patient", "consultation", "ordered_by", "ordered_by__user",
        "reported_by", "reported_by__user", "invoice",
    ).prefetch_related("items__test", "items__results", "samples")
    serializer_class = LabOrderSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ["code", "patient__mrn", "patient__first_name",
                     "patient__last_name", "patient__phone"]
    filterset_fields = ["status", "priority", "order_date", "patient", "ordered_by"]
    ordering_fields = ["-order_date", "-created_at"]

    def perform_create(self, serializer):
        request = self.request
        on_date = serializer.validated_data.get("order_date") or timezone.localdate()
        code = LabOrder.generate_code(request.hospital, on_date)
        serializer.save(
            hospital=request.hospital,
            created_by=request.user,
            code=code,
            status="DRAFT",
        )

    # ── Test management ─────────────────────────────────────────────────────────
    @action(detail=True, methods=["post"], url_path="add-test")
    def add_test(self, request, pk=None):
        order = self.get_object()
        if order.status not in ("DRAFT",):
            return Response(
                {"detail": f"Cannot modify {order.status} order. "
                           "Add tests only while DRAFT."},
                status=400,
            )
        test_id = request.data.get("test_id")
        if not test_id:
            return Response({"detail": "test_id required"}, status=400)
        try:
            test = TestCatalog.objects.get(id=test_id, hospital=request.hospital)
        except TestCatalog.DoesNotExist:
            return Response({"detail": "Test not found"}, status=404)

        # Idempotent: skip if already in order
        if order.items.filter(test=test).exists():
            return Response(LabOrderSerializer(order).data)

        next_idx = order.items.count()
        item = LabOrderItem.objects.create(
            hospital=request.hospital,
            created_by=request.user,
            order=order,
            test=test,
            test_code=test.code,
            test_name=test.name,
            sample_type=test.sample_type,
            price=test.price,
            gst_rate=test.gst_rate,
            order_index=next_idx,
        )
        order.recalculate_totals()
        # If the test requires fasting, propagate hint
        if test.requires_fasting and not order.requires_fasting:
            order.requires_fasting = True
            order.save(update_fields=["requires_fasting"])
        return Response(LabOrderSerializer(order).data, status=201)

    @action(detail=True, methods=["post"],
            url_path="remove-test/(?P<item_id>[^/.]+)")
    def remove_test(self, request, pk=None, item_id=None):
        order = self.get_object()
        if order.status != "DRAFT":
            return Response(
                {"detail": f"Cannot modify {order.status} order"}, status=400,
            )
        try:
            item = order.items.get(id=item_id)
        except LabOrderItem.DoesNotExist:
            return Response({"detail": "Item not found"}, status=404)
        item.delete()
        order.recalculate_totals()
        return Response(LabOrderSerializer(order).data)

    # ── Workflow transitions ────────────────────────────────────────────────────
    @action(detail=True, methods=["post"])
    def finalize(self, request, pk=None):
        order = self.get_object()
        try:
            finalize_order(order, user=request.user)
        except ValueError as e:
            return Response({"detail": str(e)}, status=400)
        return Response(LabOrderSerializer(order).data)

    @action(detail=True, methods=["post"], url_path="collect-samples")
    def collect_samples_action(self, request, pk=None):
        order = self.get_object()
        sample_specs = request.data.get("samples")  # optional list of dicts
        try:
            samples = collect_samples(order, user=request.user,
                                      sample_specs=sample_specs)
        except ValueError as e:
            return Response({"detail": str(e)}, status=400)
        return Response({
            "samples": LabSampleSerializer(samples, many=True).data,
            "order": LabOrderSerializer(order).data,
        })

    @action(detail=True, methods=["post"],
            url_path="items/(?P<item_id>[^/.]+)/results")
    def enter_results(self, request, pk=None, item_id=None):
        """Body: {"results": [{"parameter_id": 12, "value": "13.4",
                                "interpretation": ""}, ...]}"""
        order = self.get_object()
        try:
            item = order.items.get(id=item_id)
        except LabOrderItem.DoesNotExist:
            return Response({"detail": "Order item not found"}, status=404)

        results_payload = request.data.get("results", [])
        if not isinstance(results_payload, list):
            return Response({"detail": "results must be a list"}, status=400)
        try:
            saved = enter_results_for_item(
                item, user=request.user, results=results_payload,
            )
        except ValueError as e:
            return Response({"detail": str(e)}, status=400)
        return Response({
            "saved": LabResultSerializer(saved, many=True).data,
            "order": LabOrderSerializer(order).data,
        })

    @action(detail=True, methods=["post"])
    def release(self, request, pk=None):
        """Pathologist verifies + releases the report (status → REPORTED)."""
        from apps.specialist.models import Doctor
        order = self.get_object()
        doctor_id = request.data.get("doctor_id")
        doctor = None
        if doctor_id:
            doctor = Doctor.objects.filter(
                id=doctor_id, hospital=request.hospital,
            ).first()
        if not doctor:
            # Default to the linked OPD doctor on user account
            doctor = Doctor.objects.filter(user=request.user).first()
        try:
            verify_and_release_report(order, user=request.user, doctor=doctor)
        except ValueError as e:
            return Response({"detail": str(e)}, status=400)
        return Response(LabOrderSerializer(order).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        order = self.get_object()
        if order.status == "REPORTED":
            return Response(
                {"detail": "Cannot cancel a reported order. Use the invoice "
                           "refund flow instead."},
                status=400,
            )
        order.status = "CANCELLED"
        order.notes = (order.notes + "\n\nCancelled: "
                       + request.data.get("reason", "")).strip()
        order.save(update_fields=["status", "notes"])
        return Response(LabOrderSerializer(order).data)

    # ── PDF report ──────────────────────────────────────────────────────────────
    @action(detail=True, methods=["get"])
    def report(self, request, pk=None):
        order = self.get_object()
        if order.status not in ("IN_PROGRESS", "REPORTED"):
            return Response(
                {"detail": f"Report not available. Order is {order.status}."},
                status=400,
            )
        try:
            pdf_bytes = generate_lab_report(order)
        except Exception as e:
            return Response({"detail": f"PDF generation failed: {e}"}, status=500)
        resp = HttpResponse(pdf_bytes, content_type="application/pdf")
        resp["Content-Disposition"] = f'inline; filename="{order.code}.pdf"'
        return resp

    # ── Dashboard rollups ───────────────────────────────────────────────────────
    @action(detail=False, methods=["get"])
    def today(self, request):
        today = timezone.localdate()
        qs = self.get_queryset().filter(order_date=today)
        by_status = {
            s: qs.filter(status=s).count()
            for s in ["DRAFT", "ORDERED", "COLLECTED", "IN_PROGRESS",
                      "REPORTED", "CANCELLED"]
        }
        revenue = qs.exclude(status="CANCELLED").aggregate(
            total=Count("id")
        )
        return Response({
            "date": today.isoformat(),
            "order_count": qs.count(),
            "by_status": by_status,
            "pending_collection": qs.filter(status="ORDERED").count(),
            "in_progress": qs.filter(status__in=["COLLECTED", "IN_PROGRESS"]).count(),
            "stat_orders": qs.filter(priority="STAT").exclude(status="REPORTED").count(),
            "orders": LabOrderSerializer(
                qs.order_by("-created_at")[:50], many=True,
            ).data,
        })

    @action(detail=False, methods=["get"])
    def abnormal(self, request):
        """Recent orders with at least one abnormal/critical result."""
        cutoff = timezone.localdate() - timedelta(days=7)
        qs = self.get_queryset().filter(
            order_date__gte=cutoff,
            items__results__flag__in=["LOW", "HIGH", "CRITICAL"],
        ).distinct().order_by("-order_date")[:50]
        return Response(LabOrderSerializer(qs, many=True).data)


# ─────────────────────────────────── LabSample ───────────────────────────────────

class LabSampleViewSet(TenantScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = LabSample.objects.select_related("order", "order__patient",
                                                 "collected_by")
    serializer_class = LabSampleSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ["barcode", "order__code", "order__patient__mrn"]
    filterset_fields = ["sample_type", "is_received", "is_rejected", "order"]
    ordering_fields = ["-collected_at"]

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        sample = self.get_object()
        sample.is_rejected = True
        sample.is_received = False
        sample.rejection_reason = request.data.get("reason", "")
        sample.save(update_fields=["is_rejected", "is_received",
                                   "rejection_reason"])
        return Response(LabSampleSerializer(sample).data)


# ─────────────────────────────────── LabResult ───────────────────────────────────

class LabResultViewSet(TenantScopedViewSetMixin, viewsets.ReadOnlyModelViewSet):
    queryset = LabResult.objects.select_related(
        "order_item", "order_item__order", "order_item__order__patient",
        "parameter",
    )
    serializer_class = LabResultSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ["order_item__order__code", "parameter_name",
                     "order_item__order__patient__mrn"]
    filterset_fields = ["flag", "order_item__order"]
    ordering_fields = ["-entered_at"]
