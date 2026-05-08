"""Pharmacy module views.

API surface (matched to frontend pharmacy.ts):

  ViewSets:
    /pharmacy/batches/                          GET, POST   list / create batch
    /pharmacy/batches/{id}/                      GET, PATCH  detail
    /pharmacy/batches/{id}/write-off/            POST        zero out
    /pharmacy/batches/expiring/                  GET         convenience filter

    /pharmacy/movements/                         GET         audit log

    /pharmacy/orders/                            GET, POST   list / create order
    /pharmacy/orders/{id}/                        GET, PATCH  detail
    /pharmacy/orders/start-from-prescription/    POST        create from Rx (class-level)
    /pharmacy/orders/{id}/add-item/               POST        add item via FEFO
    /pharmacy/orders/{id}/remove-item/{itemId}/   POST        remove item from DRAFT
    /pharmacy/orders/{id}/preview/                GET         FEFO preview per item
    /pharmacy/orders/{id}/dispense/               POST        finalize: stock + invoice
    /pharmacy/orders/{id}/cancel/                 POST        cancel DRAFT

  Standalone:
    /pharmacy/dashboard/                         GET         summary stats
    /pharmacy/receive-stock/                      POST        convenience wrapper
    /pharmacy/drugs/{drug_id}/availability/       GET         per-drug breakdown
    /pharmacy/allocate-preview/                   POST        FEFO preview
    /pharmacy/reports/low-stock/                  GET         low-stock drugs
    /pharmacy/reports/near-expiry/                GET         expiring batches
"""
from datetime import timedelta
from decimal import Decimal

from django.db import transaction
from django.db.models import Sum, Q
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core.views import TenantScopedViewSetMixin
from apps.opd.models import DrugMaster, Prescription

from .models import DrugBatch, StockMovement, PharmacyOrder, PharmacyOrderItem
from .serializers import (DrugBatchSerializer, StockMovementSerializer,
                          PharmacyOrderSerializer, PharmacyOrderItemSerializer)
from .services.inventory import (allocate_fefo, preview_allocation,
                                 InsufficientStockError)
from .services.dispense import dispense_order


def _denormalize_from_drug(drug):
    """Pull HSN + GST onto a batch from its DrugMaster."""
    return {
        "hsn_code": drug.hsn_code or "",
        "gst_rate": drug.gst_rate,
    }


def _create_purchase_movement(*, hospital, user, drug, batch):
    StockMovement.objects.create(
        hospital=hospital,
        created_by=user,
        drug=drug, batch=batch,
        movement_type="PURCHASE_IN",
        quantity=batch.qty_purchased,
        reference_type="supplier_invoice" if batch.supplier_invoice_no else "manual",
        reference_id=batch.supplier_invoice_no,
        notes=(f"Received from {batch.supplier_name}"
               if batch.supplier_name else "Stock received"),
    )


# ─────────────────────────── Drug Batches ───────────────────────────

class DrugBatchViewSet(TenantScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = DrugBatch.objects.select_related("drug")
    serializer_class = DrugBatchSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ["batch_no", "drug__brand_name", "drug__generic_name",
                     "supplier_name", "supplier_invoice_no"]
    filterset_fields = ["drug", "supplier_name"]
    ordering_fields = ["expiry_date", "received_at", "qty_in_stock"]

    def perform_create(self, serializer):
        request = self.request
        drug = serializer.validated_data["drug"]
        qty_purchased = serializer.validated_data.get("qty_purchased", 0)

        with transaction.atomic():
            batch = serializer.save(
                hospital=request.hospital,
                created_by=request.user,
                qty_in_stock=qty_purchased,
                **_denormalize_from_drug(drug),
            )
            _create_purchase_movement(
                hospital=request.hospital, user=request.user,
                drug=drug, batch=batch,
            )

    @action(detail=True, methods=["post"], url_path="write-off")
    def write_off(self, request, pk=None):
        batch = self.get_object()
        if batch.qty_in_stock == 0:
            return Response({"detail": "Already empty"}, status=400)

        movement_type = request.data.get("movement_type", "EXPIRED_OUT")
        if movement_type not in ("EXPIRED_OUT", "DAMAGED_OUT", "ADJUSTMENT_OUT"):
            return Response({"detail": "Invalid movement_type"}, status=400)

        with transaction.atomic():
            qty_lost = batch.qty_in_stock
            StockMovement.objects.create(
                hospital=request.hospital, created_by=request.user,
                drug=batch.drug, batch=batch,
                movement_type=movement_type,
                quantity=qty_lost,
                reference_type="manual",
                notes=(request.data.get("notes") or "")[:200],
            )
            batch.qty_in_stock = 0
            batch.save(update_fields=["qty_in_stock"])
        return Response(DrugBatchSerializer(batch).data)

    @action(detail=False, methods=["get"])
    def expiring(self, request):
        try:
            days = int(request.query_params.get("days", "60"))
        except ValueError:
            days = 60
        cutoff = timezone.localdate() + timedelta(days=days)
        qs = self.get_queryset().filter(
            qty_in_stock__gt=0,
            expiry_date__lte=cutoff,
        ).order_by("expiry_date")[:200]
        return Response(self.get_serializer(qs, many=True).data)


# ─────────────────────────── Stock Movements ───────────────────────────

class StockMovementViewSet(TenantScopedViewSetMixin, viewsets.ReadOnlyModelViewSet):
    queryset = StockMovement.objects.select_related("drug", "batch")
    serializer_class = StockMovementSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["drug", "batch", "movement_type"]
    ordering_fields = ["-moved_at"]


# ─────────────────────────── Pharmacy Orders ───────────────────────────

class PharmacyOrderViewSet(TenantScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = (PharmacyOrder.objects
                .select_related("patient", "prescription", "consultation", "invoice")
                .prefetch_related("items__batch", "items__drug"))
    serializer_class = PharmacyOrderSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ["code", "patient__mrn", "patient__first_name",
                     "patient__last_name", "patient__phone"]
    filterset_fields = ["status", "patient", "prescription", "consultation"]
    ordering_fields = ["-order_date", "-created_at"]

    def perform_create(self, serializer):
        request = self.request
        on_date = serializer.validated_data.get("order_date") or timezone.localdate()
        code = PharmacyOrder.generate_code(request.hospital, on_date)
        serializer.save(
            hospital=request.hospital,
            created_by=request.user,
            code=code,
        )

    @action(detail=False, methods=["post"], url_path="start-from-prescription")
    def start_from_prescription(self, request):
        """Create a fresh DRAFT order populated from a Prescription via FEFO.

        Body: { "prescription_id": <id> }

        Returns: { "order": PharmacyOrder, "warnings": [{drug_name, reason}, ...] }
        Warnings list contains any Rx items that couldn't be allocated due to
        insufficient stock (the order is still created, just missing those items).
        """
        rx_id = request.data.get("prescription_id")
        if not rx_id:
            return Response({"detail": "prescription_id required"}, status=400)

        try:
            rx = (Prescription.objects
                  .prefetch_related("items__drug")
                  .get(id=rx_id, hospital=request.hospital))
        except Prescription.DoesNotExist:
            return Response({"detail": "Prescription not found"}, status=404)

        # Reuse an existing DRAFT order for this Rx if one exists
        existing = PharmacyOrder.objects.filter(
            hospital=request.hospital, prescription=rx, status="DRAFT",
        ).first()
        if existing:
            return Response({
                "order": PharmacyOrderSerializer(existing).data,
                "warnings": [],
            })

        warnings = []
        with transaction.atomic():
            order = PharmacyOrder.objects.create(
                hospital=request.hospital,
                created_by=request.user,
                code=PharmacyOrder.generate_code(request.hospital, timezone.localdate()),
                patient=rx.patient,
                prescription=rx,
                consultation=rx.consultation,
                status="DRAFT",
            )

            order_index = 0
            for rx_item in rx.items.all():
                if not rx_item.drug:
                    continue
                qty_needed = _estimate_rx_qty(rx_item)
                try:
                    allocs = allocate_fefo(
                        drug=rx_item.drug,
                        hospital=request.hospital,
                        qty_needed=qty_needed,
                    )
                except InsufficientStockError as e:
                    warnings.append({
                        "drug_name": rx_item.drug.display_name,
                        "reason": (f"Only {e.available} available, "
                                   f"requested {e.requested}"),
                    })
                    continue

                for batch, qty in allocs:
                    PharmacyOrderItem.objects.create(
                        hospital=request.hospital,
                        created_by=request.user,
                        order=order,
                        drug=rx_item.drug,
                        batch=batch,
                        prescription_item=rx_item,
                        quantity=qty,
                        unit_mrp=batch.mrp,
                        gst_rate=batch.gst_rate,
                        order_index=order_index,
                    )
                    order_index += 1

            order.recalculate_totals()

        return Response({
            "order": PharmacyOrderSerializer(order).data,
            "warnings": warnings,
        })

    @action(detail=True, methods=["post"], url_path="add-item")
    def add_item(self, request, pk=None):
        """Add a drug to a DRAFT order. FEFO-allocates batches.

        Body: { "drug_id": <id>, "quantity": <int>,
                "discount_pct"?: float, "unit_mrp"? : Decimal }
        """
        order = self.get_object()
        if order.status != "DRAFT":
            return Response({"detail": f"Cannot add to {order.status} order"}, status=400)

        drug_id = request.data.get("drug_id")
        qty = request.data.get("quantity")
        if not drug_id or not qty:
            return Response({"detail": "drug_id and quantity required"}, status=400)
        try:
            qty = int(qty)
            if qty <= 0:
                raise ValueError
        except (ValueError, TypeError):
            return Response({"detail": "quantity must be a positive integer"}, status=400)

        try:
            drug = DrugMaster.objects.get(id=drug_id, hospital=request.hospital)
        except DrugMaster.DoesNotExist:
            return Response({"detail": "Drug not found"}, status=404)

        try:
            allocs = allocate_fefo(
                drug=drug,
                hospital=request.hospital,
                qty_needed=qty,
            )
        except InsufficientStockError as e:
            return Response({
                "detail": str(e),
                "available": e.available,
                "requested": e.requested,
            }, status=400)

        discount_pct = Decimal(str(request.data.get("discount_pct", "0")))
        override_mrp = request.data.get("unit_mrp")

        with transaction.atomic():
            order_index = order.items.count()
            for batch, take in allocs:
                PharmacyOrderItem.objects.create(
                    hospital=request.hospital,
                    created_by=request.user,
                    order=order,
                    drug=drug,
                    batch=batch,
                    quantity=take,
                    unit_mrp=Decimal(str(override_mrp)) if override_mrp else batch.mrp,
                    discount_pct=discount_pct,
                    gst_rate=batch.gst_rate,
                    order_index=order_index,
                )
                order_index += 1
            order.recalculate_totals()

        return Response(PharmacyOrderSerializer(order).data)

    @action(detail=True, methods=["post"],
            url_path="remove-item/(?P<item_id>[^/.]+)")
    def remove_item(self, request, pk=None, item_id=None):
        order = self.get_object()
        if order.status != "DRAFT":
            return Response({"detail": "Can only remove from DRAFT order"}, status=400)
        try:
            item = order.items.get(id=item_id)
        except PharmacyOrderItem.DoesNotExist:
            return Response({"detail": "Item not found"}, status=404)
        item.delete()
        order.recalculate_totals()
        return Response(PharmacyOrderSerializer(order).data)

    @action(detail=True, methods=["get"])
    def preview(self, request, pk=None):
        order = self.get_object()
        out = []
        for it in order.items.select_related("drug").all():
            preview = preview_allocation(
                drug=it.drug,
                hospital=request.hospital,
                qty_needed=it.quantity,
            )
            preview["item_id"] = it.id
            preview["drug_name"] = it.drug_name
            out.append(preview)
        return Response(out)

    @action(detail=True, methods=["post"])
    def dispense(self, request, pk=None):
        order = self.get_object()
        try:
            dispense_order(order, user=request.user)
        except (ValueError, InsufficientStockError) as e:
            return Response({"detail": str(e)}, status=400)
        order.refresh_from_db()
        return Response(PharmacyOrderSerializer(order).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        order = self.get_object()
        if order.status != "DRAFT":
            return Response({"detail": "Only DRAFT orders can be cancelled"}, status=400)
        order.status = "CANCELLED"
        reason = request.data.get("reason", "")
        order.notes = (order.notes or "") + f"\n[cancelled] {reason}".rstrip()
        order.save(update_fields=["status", "notes"])
        return Response(PharmacyOrderSerializer(order).data)


def _estimate_rx_qty(rx_item):
    """Estimate qty for a Rx item: duration_days × frequency factor."""
    form = rx_item.drug.dosage_form if rx_item.drug else "TABLET"
    freq_factor = {
        "OD": 1, "BD": 2, "TDS": 3, "QID": 4,
        "HS": 1, "SOS": 1, "STAT": 1,
    }.get((rx_item.frequency or "").upper(), 1)
    if form in ("TABLET", "CAPSULE"):
        return max(1, rx_item.duration_days * freq_factor)
    elif form == "SYRUP":
        return 1
    return max(1, rx_item.duration_days)


# ─────────────────────────── Standalone endpoints ───────────────────────────

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def receive_stock(request):
    """Convenience wrapper for POST /batches/.
    Accepts both `drug` (FK) and `drug_id` for client convenience.
    """
    data = dict(request.data)
    if "drug_id" in data and "drug" not in data:
        data["drug"] = data.pop("drug_id")

    serializer = DrugBatchSerializer(data=data)
    serializer.is_valid(raise_exception=True)

    drug = serializer.validated_data["drug"]
    qty_purchased = serializer.validated_data.get("qty_purchased", 0)

    with transaction.atomic():
        batch = serializer.save(
            hospital=request.hospital,
            created_by=request.user,
            qty_in_stock=qty_purchased,
            **_denormalize_from_drug(drug),
        )
        _create_purchase_movement(
            hospital=request.hospital, user=request.user,
            drug=drug, batch=batch,
        )
    return Response(DrugBatchSerializer(batch).data, status=201)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def drug_availability(request, drug_id):
    try:
        drug = DrugMaster.objects.get(id=drug_id, hospital=request.hospital)
    except DrugMaster.DoesNotExist:
        return Response({"detail": "Drug not found"}, status=404)

    today = timezone.localdate()
    batches = (DrugBatch.objects
               .filter(hospital=request.hospital, drug=drug, qty_in_stock__gt=0)
               .order_by("expiry_date", "received_at"))

    live = [b for b in batches if b.expiry_date > today]
    expired = [b for b in batches if b.expiry_date <= today]

    return Response({
        "drug_id": drug.id,
        "drug_code": drug.code,
        "drug_name": drug.display_name,
        "strength": drug.strength,
        "dosage_form": drug.dosage_form,
        "reorder_level": drug.reorder_level or 0,
        "total_in_stock": sum(b.qty_in_stock for b in live),
        "expired_qty": sum(b.qty_in_stock for b in expired),
        "batches": DrugBatchSerializer(batches, many=True).data,
    })


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def allocate_preview(request):
    drug_id = request.data.get("drug_id")
    qty_needed = request.data.get("qty_needed") or request.data.get("qty")
    if not drug_id or not qty_needed:
        return Response({"detail": "drug_id and qty_needed required"}, status=400)
    try:
        qty_needed = int(qty_needed)
    except (ValueError, TypeError):
        return Response({"detail": "qty_needed must be an integer"}, status=400)

    try:
        drug = DrugMaster.objects.get(id=drug_id, hospital=request.hospital)
    except DrugMaster.DoesNotExist:
        return Response({"detail": "Drug not found"}, status=404)

    return Response(preview_allocation(
        drug=drug, hospital=request.hospital, qty_needed=qty_needed,
    ))


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def low_stock_report(request):
    """Drugs whose live stock ≤ threshold (?threshold=N) or ≤ reorder_level if no threshold.

    Returns: { threshold, count, drugs: [...] }  matching frontend shape.
    """
    today = timezone.localdate()
    threshold_param = request.query_params.get("threshold")
    threshold = None
    if threshold_param is not None:
        try:
            threshold = int(threshold_param)
        except ValueError:
            threshold = None

    per_drug = (DrugBatch.objects
                .filter(hospital=request.hospital,
                        qty_in_stock__gt=0,
                        expiry_date__gt=today)
                .values("drug")
                .annotate(total=Sum("qty_in_stock")))
    totals = {row["drug"]: row["total"] for row in per_drug}

    rows = []
    for d in DrugMaster.objects.filter(hospital=request.hospital, is_active=True):
        on_hand = totals.get(d.id, 0)
        cutoff = threshold if threshold is not None else (d.reorder_level or 0)
        if cutoff <= 0:
            continue
        if on_hand <= cutoff:
            rows.append({
                "drug_id": d.id,
                "code": d.code,
                "name": d.display_name,
                "generic_name": d.generic_name,
                "brand_name": d.brand_name,
                "strength": d.strength,
                "dosage_form": d.dosage_form,
                "total_in_stock": on_hand,
                "reorder_level": d.reorder_level or 0,
                "shortage": max(cutoff - on_hand, 0),
            })
    rows.sort(key=lambda r: -r["shortage"])
    return Response({
        "threshold": threshold,
        "count": len(rows),
        "drugs": rows,
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def near_expiry_report(request):
    """Live batches expiring within ?days=N (default 60)."""
    try:
        days = int(request.query_params.get("days", "60"))
    except ValueError:
        days = 60
    today = timezone.localdate()
    cutoff = today + timedelta(days=days)
    batches = (DrugBatch.objects
               .filter(hospital=request.hospital,
                       qty_in_stock__gt=0,
                       expiry_date__gte=today,
                       expiry_date__lte=cutoff)
               .select_related("drug")
               .order_by("expiry_date")[:500])
    batches = list(batches)
    return Response({
        "days": days,
        "count": len(batches),
        "batches": DrugBatchSerializer(batches, many=True).data,
    })


# ─────────────────────────── Dashboard ───────────────────────────

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def pharmacy_dashboard(request):
    """One-call summary for the pharmacy landing page."""
    hospital = request.hospital
    today = timezone.localdate()
    cutoff_60 = today + timedelta(days=60)

    total_drugs = DrugMaster.objects.filter(
        hospital=hospital, is_active=True,
    ).count()

    per_drug = (DrugBatch.objects
                .filter(hospital=hospital, qty_in_stock__gt=0,
                        expiry_date__gt=today)
                .values("drug")
                .annotate(total=Sum("qty_in_stock")))
    drug_totals = {row["drug"]: row["total"] for row in per_drug}

    out_of_stock, low_stock = [], []
    for d in DrugMaster.objects.filter(hospital=hospital, is_active=True):
        on_hand = drug_totals.get(d.id, 0)
        rl = d.reorder_level or 0
        if on_hand == 0:
            out_of_stock.append({
                "drug_id": d.id,
                "drug_name": d.display_name,
                "strength": d.strength,
                "dosage_form": d.dosage_form,
            })
        elif rl > 0 and on_hand <= rl:
            low_stock.append({
                "drug_id": d.id,
                "drug_name": d.display_name,
                "strength": d.strength,
                "dosage_form": d.dosage_form,
                "on_hand": on_hand,
                "reorder_level": rl,
            })

    expiring_batches = (DrugBatch.objects
                        .filter(hospital=hospital, qty_in_stock__gt=0,
                                expiry_date__gte=today,
                                expiry_date__lte=cutoff_60)
                        .select_related("drug")
                        .order_by("expiry_date")[:20])

    today_orders = PharmacyOrder.objects.filter(hospital=hospital, order_date=today)
    completed_today = today_orders.filter(status="COMPLETED")
    revenue = completed_today.aggregate(t=Sum("total_amount"))["t"] or Decimal("0")

    return Response({
        "as_of": timezone.now().isoformat(),
        "total_drugs": total_drugs,
        "out_of_stock_count": len(out_of_stock),
        "out_of_stock_items": out_of_stock[:30],
        "low_stock_count": len(low_stock),
        "low_stock_items": low_stock[:30],
        "expiring_soon_count": expiring_batches.count(),
        "expiring_soon_batches": DrugBatchSerializer(expiring_batches, many=True).data,
        "today_orders_count": today_orders.count(),
        "today_completed_count": completed_today.count(),
        "today_revenue": str(revenue),
    })
