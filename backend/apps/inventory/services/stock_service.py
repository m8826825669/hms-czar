"""
Inventory service — encapsulates all stock-changing operations.

All quantity changes flow through here to maintain consistency.
"""
from __future__ import annotations
from decimal import Decimal
from datetime import date
from typing import List, Tuple

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Sum, F, Q
from django.utils import timezone

from ..models import (
    StoreLocation, StockItem, StockBatch, Supplier,
    PurchaseOrder, POLine, GRN, GRNLine,
    StockRequisition, RequisitionLine,
    StockIssue, IssueLine, StockTransfer,
)


def _gen_code(model, hospital, prefix, field="code"):
    today = timezone.now().date()
    full_prefix = f"{prefix}-{today.strftime('%Y%m%d')}-"
    qs_filter = {"hospital": hospital, f"{field}__startswith": full_prefix}
    last = model.objects.filter(**qs_filter).order_by(f"-{field}").first()
    if last:
        try:
            n = int(getattr(last, field).split("-")[-1]) + 1
        except (ValueError, IndexError):
            n = 1
    else:
        n = 1
    return f"{full_prefix}{n:04d}"


# ─────────────────────────────────────────────────────────────────────────────
# Stock queries
# ─────────────────────────────────────────────────────────────────────────────

def get_stock_summary(hospital, store=None, item=None, low_stock_only=False):
    """Return a queryset of (item, store, total_qty) aggregated from batches."""
    qs = StockBatch.objects.filter(hospital=hospital, is_active=True,
                                    current_quantity__gt=0)
    if store:
        qs = qs.filter(store=store)
    if item:
        qs = qs.filter(item=item)

    summary = (qs.values("item", "item__code", "item__name", "item__uom",
                          "item__reorder_level", "store", "store__code")
               .annotate(total_qty=Sum("current_quantity"))
               .order_by("item__name"))

    if low_stock_only:
        summary = [s for s in summary
                    if s["item__reorder_level"]
                    and s["total_qty"] < s["item__reorder_level"]]
    return list(summary)


def get_expiring_batches(hospital, days=30, store=None):
    today = timezone.localdate()
    from datetime import timedelta
    cutoff = today + timedelta(days=days)
    qs = (StockBatch.objects.filter(
        hospital=hospital, is_active=True, current_quantity__gt=0,
        expiry_date__isnull=False,
        expiry_date__lte=cutoff,
    ).select_related("item", "store").order_by("expiry_date"))
    if store:
        qs = qs.filter(store=store)
    return qs


# ─────────────────────────────────────────────────────────────────────────────
# Purchase order workflow
# ─────────────────────────────────────────────────────────────────────────────

@transaction.atomic
def create_purchase_order(*, hospital, supplier, store, lines, **extra):
    """lines: list of dicts {item, quantity, unit_price, gst_rate, discount_pct, notes}"""
    if not lines:
        raise ValidationError("PO needs at least one line item.")

    po = PurchaseOrder.objects.create(
        hospital=hospital,
        code=_gen_code(PurchaseOrder, hospital, "PO"),
        supplier=supplier, store=store,
        expected_delivery_date=extra.get("expected_delivery_date"),
        payment_terms_days=extra.get("payment_terms_days", supplier.payment_terms_days),
        delivery_address=extra.get("delivery_address", ""),
        terms_and_conditions=extra.get("terms_and_conditions", ""),
        requested_by=extra.get("requested_by"),
        notes=extra.get("notes", ""),
        status="DRAFT",
    )

    for line in lines:
        POLine.objects.create(
            purchase_order=po,
            item=line["item"],
            quantity=Decimal(str(line["quantity"])),
            unit_price=Decimal(str(line["unit_price"])),
            discount_pct=Decimal(str(line.get("discount_pct", 0))),
            gst_rate=Decimal(str(line.get("gst_rate", line["item"].gst_rate))),
            notes=line.get("notes", ""),
        )

    _recalculate_po_totals(po)
    return po


def _recalculate_po_totals(po: PurchaseOrder):
    agg = po.lines.aggregate(
        sub=Sum("subtotal"), gst=Sum("gst_amount"), total=Sum("line_total"),
    )
    po.subtotal = agg["sub"] or Decimal("0")
    po.gst_amount = agg["gst"] or Decimal("0")
    po.total_amount = agg["total"] or Decimal("0")
    po.save(update_fields=["subtotal", "gst_amount", "total_amount", "updated_at"])


@transaction.atomic
def approve_purchase_order(po: PurchaseOrder, *, approved_by=None):
    if po.status != "SUBMITTED":
        raise ValidationError(f"Can only approve SUBMITTED PO (current: {po.status}).")
    po.status = "APPROVED"
    po.approved_by = approved_by
    po.approved_at = timezone.now()
    po.save(update_fields=["status", "approved_by", "approved_at", "updated_at"])
    return po


# ─────────────────────────────────────────────────────────────────────────────
# GRN workflow — creates stock batches
# ─────────────────────────────────────────────────────────────────────────────

@transaction.atomic
def create_grn_from_po(po: PurchaseOrder, *, supplier_invoice_number="",
                        supplier_invoice_date=None, received_by=None,
                        lines: List[dict] = None):
    """
    lines: [{po_line, accepted_quantity, rejected_quantity, batch_number,
              unit_price, mrp, expiry_date, manufacture_date, rejection_reason}]
    """
    if po.status not in ("APPROVED", "SENT", "PARTIAL"):
        raise ValidationError(f"Cannot GRN against PO in status {po.status}.")
    if not lines:
        raise ValidationError("GRN needs at least one line.")

    grn = GRN.objects.create(
        hospital=po.hospital,
        code=_gen_code(GRN, po.hospital, "GRN"),
        purchase_order=po, supplier=po.supplier, store=po.store,
        supplier_invoice_number=supplier_invoice_number,
        supplier_invoice_date=supplier_invoice_date,
        received_by=received_by,
        status="RECEIVED",
    )

    for ld in lines:
        po_line = ld["po_line"]
        accepted = Decimal(str(ld["accepted_quantity"]))
        rejected = Decimal(str(ld.get("rejected_quantity", 0)))
        received = accepted + rejected

        line = GRNLine.objects.create(
            grn=grn, po_line=po_line, item=po_line.item,
            batch_number=ld["batch_number"],
            received_quantity=received,
            accepted_quantity=accepted,
            rejected_quantity=rejected,
            unit_price=Decimal(str(ld.get("unit_price", po_line.unit_price))),
            mrp=Decimal(str(ld.get("mrp", 0))),
            gst_rate=po_line.gst_rate,
            manufacture_date=ld.get("manufacture_date"),
            expiry_date=ld.get("expiry_date"),
            rejection_reason=ld.get("rejection_reason", ""),
            notes=ld.get("notes", ""),
        )

        # Create or augment stock batch
        if accepted > 0:
            batch, created = StockBatch.objects.get_or_create(
                hospital=po.hospital, item=po_line.item, store=po.store,
                batch_number=ld["batch_number"],
                defaults={
                    "supplier": po.supplier,
                    "received_quantity": accepted,
                    "current_quantity": accepted,
                    "purchase_rate": line.unit_price,
                    "mrp": line.mrp,
                    "issue_rate": line.mrp or line.unit_price,
                    "manufacture_date": line.manufacture_date,
                    "expiry_date": line.expiry_date,
                    "grn_reference": grn.code,
                },
            )
            if not created:
                batch.received_quantity += accepted
                batch.current_quantity += accepted
                batch.save(update_fields=["received_quantity", "current_quantity",
                                           "updated_at"])

        # Update PO line received
        po_line.received_quantity += accepted
        po_line.save(update_fields=["received_quantity"])

    _recalculate_grn_totals(grn)
    _update_po_status_from_grn(po)
    return grn


def _recalculate_grn_totals(grn: GRN):
    agg = grn.lines.aggregate(total=Sum("line_total"))
    grn.total_amount = agg["total"] or Decimal("0")
    grn.subtotal = grn.total_amount  # simplified
    grn.save(update_fields=["subtotal", "total_amount", "updated_at"])


def _update_po_status_from_grn(po: PurchaseOrder):
    all_fulfilled = True
    any_received = False
    for line in po.lines.all():
        if line.received_quantity >= line.quantity:
            any_received = True
        elif line.received_quantity > 0:
            any_received = True
            all_fulfilled = False
        else:
            all_fulfilled = False

    if all_fulfilled:
        po.status = "RECEIVED"
    elif any_received:
        po.status = "PARTIAL"
    po.save(update_fields=["status", "updated_at"])


# ─────────────────────────────────────────────────────────────────────────────
# Requisition workflow
# ─────────────────────────────────────────────────────────────────────────────

@transaction.atomic
def create_requisition(*, hospital, requesting_dept, source_store, lines,
                         requested_by=None, **extra):
    if not lines:
        raise ValidationError("Requisition needs at least one line.")

    req = StockRequisition.objects.create(
        hospital=hospital,
        code=_gen_code(StockRequisition, hospital, "REQ"),
        requesting_dept=requesting_dept,
        source_store=source_store,
        requested_by=requested_by,
        required_by_date=extra.get("required_by_date"),
        urgency=extra.get("urgency", "ROUTINE"),
        purpose=extra.get("purpose", ""),
        notes=extra.get("notes", ""),
        status="SUBMITTED",
    )
    for line in lines:
        RequisitionLine.objects.create(
            requisition=req, item=line["item"],
            quantity_requested=Decimal(str(line["quantity_requested"])),
            quantity_approved=Decimal(str(line.get("quantity_approved",
                                                      line["quantity_requested"]))),
            notes=line.get("notes", ""),
        )
    return req


@transaction.atomic
def approve_requisition(req: StockRequisition, *, line_approvals: dict = None,
                          approved_by=None):
    """line_approvals: {line_id: approved_qty} — overrides for partial approval."""
    if req.status != "SUBMITTED":
        raise ValidationError(f"Cannot approve in status {req.status}.")
    line_approvals = line_approvals or {}
    for line in req.lines.all():
        if line.id in line_approvals:
            line.quantity_approved = Decimal(str(line_approvals[line.id]))
            line.save(update_fields=["quantity_approved"])
    req.status = "APPROVED"
    req.approved_by = approved_by
    req.approved_at = timezone.now()
    req.save(update_fields=["status", "approved_by", "approved_at", "updated_at"])
    return req


@transaction.atomic
def issue_against_requisition(req: StockRequisition, *,
                                 line_issues: List[dict],
                                 received_by_name: str = "",
                                 issued_by=None):
    """
    line_issues: [{requisition_line_id, batch_id, quantity}]
    """
    if req.status not in ("APPROVED", "PARTIAL"):
        raise ValidationError(f"Cannot issue against {req.status} requisition.")

    issue = StockIssue.objects.create(
        hospital=req.hospital,
        code=_gen_code(StockIssue, req.hospital, "ISS"),
        requisition=req,
        issuing_store=req.source_store,
        receiving_dept=req.requesting_dept,
        issued_by=issued_by,
        received_by_name=received_by_name,
    )

    total = Decimal("0")
    for li in line_issues:
        req_line = RequisitionLine.objects.get(id=li["requisition_line_id"])
        batch = StockBatch.objects.select_for_update().get(id=li["batch_id"])
        qty = Decimal(str(li["quantity"]))

        if batch.current_quantity < qty:
            raise ValidationError(
                f"Batch {batch.batch_number} has only "
                f"{batch.current_quantity} {batch.item.uom}.")
        if batch.item_id != req_line.item_id:
            raise ValidationError("Batch and requisition line refer to different items.")

        # Deduct stock
        batch.current_quantity -= qty
        batch.save(update_fields=["current_quantity", "updated_at"])

        # Create issue line
        il = IssueLine.objects.create(
            issue=issue, batch=batch,
            quantity=qty, issue_rate=batch.issue_rate,
        )
        total += il.line_total

        # Update requisition line
        req_line.quantity_issued += qty
        req_line.save(update_fields=["quantity_issued"])

    issue.total_value = total
    issue.save(update_fields=["total_value"])

    # Update requisition status
    all_fulfilled = all(l.quantity_issued >= l.quantity_approved
                          for l in req.lines.all())
    any_issued = any(l.quantity_issued > 0 for l in req.lines.all())
    if all_fulfilled:
        req.status = "FULFILLED"
    elif any_issued:
        req.status = "PARTIAL"
    req.save(update_fields=["status", "updated_at"])

    return issue


# ─────────────────────────────────────────────────────────────────────────────
# Transfer between stores
# ─────────────────────────────────────────────────────────────────────────────

@transaction.atomic
def create_transfer(*, hospital, from_store, to_store, item, quantity,
                      batch_number="", initiated_by=None, notes=""):
    if from_store == to_store:
        raise ValidationError("Source and destination stores must differ.")

    # Reserve quantity from source
    qty = Decimal(str(quantity))
    if batch_number:
        batch = StockBatch.objects.select_for_update().get(
            hospital=hospital, item=item, store=from_store,
            batch_number=batch_number,
        )
        if batch.current_quantity < qty:
            raise ValidationError(f"Insufficient stock in batch.")
        batch.current_quantity -= qty
        batch.save(update_fields=["current_quantity", "updated_at"])

        # Create or update destination batch
        dest, created = StockBatch.objects.get_or_create(
            hospital=hospital, item=item, store=to_store,
            batch_number=batch_number,
            defaults={
                "received_quantity": qty, "current_quantity": qty,
                "purchase_rate": batch.purchase_rate, "mrp": batch.mrp,
                "issue_rate": batch.issue_rate,
                "manufacture_date": batch.manufacture_date,
                "expiry_date": batch.expiry_date,
                "supplier": batch.supplier,
            },
        )
        if not created:
            dest.received_quantity += qty
            dest.current_quantity += qty
            dest.save(update_fields=["received_quantity", "current_quantity",
                                       "updated_at"])

    transfer = StockTransfer.objects.create(
        hospital=hospital,
        code=_gen_code(StockTransfer, hospital, "TXF"),
        from_store=from_store, to_store=to_store,
        item=item, quantity=qty, batch_number=batch_number,
        initiated_by=initiated_by, notes=notes,
        status="RECEIVED",
    )
    return transfer
