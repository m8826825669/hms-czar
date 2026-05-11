"""Laundry batch lifecycle service."""
from decimal import Decimal
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from ..models import (
    LinenItem, LinenStock, LaundryBatch, LaundryBatchItem, LinenLoss,
)


def _gen_batch_code(hospital):
    today = timezone.now().date()
    prefix = f"LB-{today.strftime('%Y%m%d')}-"
    last = (LaundryBatch.objects
            .filter(hospital=hospital, code__startswith=prefix)
            .order_by("-code").first())
    if last:
        try:
            n = int(last.code.split("-")[-1]) + 1
        except (ValueError, IndexError):
            n = 1
    else:
        n = 1
    return f"{prefix}{n:04d}"


@transaction.atomic
def create_batch(*, hospital, batch_type="OUTSOURCED",
                  source_department=None, source_ward_label="",
                  vendor_name="", vendor_contact="",
                  expected_return_at=None, notes="") -> LaundryBatch:
    return LaundryBatch.objects.create(
        hospital=hospital,
        code=_gen_batch_code(hospital),
        batch_type=batch_type,
        source_department=source_department,
        source_ward_label=source_ward_label,
        vendor_name=vendor_name,
        vendor_contact=vendor_contact,
        expected_return_at=expected_return_at,
        notes=notes,
        status="CREATED",
    )


@transaction.atomic
def add_item_to_batch(batch: LaundryBatch, *, item: LinenItem,
                       quantity_sent: int,
                       cost_per_unit: Decimal = None) -> LaundryBatchItem:
    if batch.status not in ("CREATED", "PICKED_UP"):
        raise ValidationError(
            f"Cannot add items to batch in status {batch.status}",
        )
    if cost_per_unit is None:
        cost_per_unit = item.laundry_cost_per_wash

    bi, created = LaundryBatchItem.objects.update_or_create(
        batch=batch, item=item,
        defaults={
            "quantity_sent": quantity_sent,
            "cost_per_unit": cost_per_unit,
        },
    )
    _recalculate_batch_total(batch)
    return bi


def _recalculate_batch_total(batch: LaundryBatch):
    total = sum(
        (bi.line_cost for bi in batch.items.all()),
        Decimal("0"),
    )
    batch.total_cost = total
    batch.save(update_fields=["total_cost", "updated_at"])


@transaction.atomic
def transition_batch(batch: LaundryBatch, new_status: str, *,
                      user=None) -> LaundryBatch:
    valid_transitions = {
        "CREATED":   ["PICKED_UP", "CANCELLED"],
        "PICKED_UP": ["WASHING", "CANCELLED"],
        "WASHING":   ["READY", "CANCELLED"],
        "READY":     ["RETURNED"],
    }
    if new_status not in valid_transitions.get(batch.status, []):
        raise ValidationError(
            f"Invalid transition {batch.status} → {new_status}",
        )

    batch.status = new_status
    now = timezone.now()
    if new_status == "PICKED_UP":
        batch.pickup_at = now
    elif new_status == "RETURNED":
        batch.returned_at = now
    batch.save()

    # Update LinenStock movements
    if new_status == "PICKED_UP":
        for bi in batch.items.all():
            _move_stock(batch, bi.item, sent=bi.quantity_sent)
    elif new_status == "RETURNED":
        for bi in batch.items.all():
            _move_stock(batch, bi.item,
                         received=bi.quantity_received,
                         lost=bi.quantity_lost,
                         damaged=bi.quantity_damaged)

    return batch


def _move_stock(batch, item, *, sent=0, received=0, lost=0, damaged=0):
    """Update LinenStock totals — convert in_use → in_laundry on pickup,
    in_laundry → clean_in_stock on return.
    """
    stock, _ = LinenStock.objects.get_or_create(
        hospital=batch.hospital, item=item,
        department=batch.source_department,
        ward_label=batch.source_ward_label,
        defaults={"total_units": 0, "in_use": 0, "in_laundry": 0, "clean_in_stock": 0},
    )

    if sent > 0:
        # Pickup: in_use → in_laundry
        from_in_use = min(stock.in_use, sent)
        stock.in_use -= from_in_use
        stock.in_laundry += sent

    if received > 0:
        # Return: in_laundry → clean_in_stock
        stock.in_laundry = max(0, stock.in_laundry - received)
        stock.clean_in_stock += received

    if lost > 0 or damaged > 0:
        stock.in_laundry = max(0, stock.in_laundry - lost - damaged)
        stock.total_units = max(0, stock.total_units - lost - damaged)
        if lost > 0:
            LinenLoss.objects.create(
                hospital=batch.hospital, item=item, loss_type="LOST",
                quantity=lost, department=batch.source_department, batch=batch,
                cost_impact=item.cost_per_unit * lost,
            )
        if damaged > 0:
            LinenLoss.objects.create(
                hospital=batch.hospital, item=item, loss_type="DAMAGED",
                quantity=damaged, department=batch.source_department, batch=batch,
                cost_impact=item.cost_per_unit * damaged,
            )

    stock.save()
    return stock


@transaction.atomic
def reconcile_batch_item(item_row: LaundryBatchItem, *,
                          quantity_received: int,
                          quantity_lost: int = 0,
                          quantity_damaged: int = 0,
                          notes: str = "") -> LaundryBatchItem:
    if item_row.batch.status not in ("READY", "RETURNED"):
        raise ValidationError(
            "Reconcile only when batch is READY or RETURNED",
        )
    if quantity_received + quantity_lost + quantity_damaged > item_row.quantity_sent:
        raise ValidationError("Received + lost + damaged exceeds sent quantity")

    item_row.quantity_received = quantity_received
    item_row.quantity_lost = quantity_lost
    item_row.quantity_damaged = quantity_damaged
    if notes:
        item_row.notes = notes
    item_row.save()
    return item_row


def stock_summary(hospital):
    """Return dict of stock totals + low-stock alerts."""
    items = []
    low = []
    for s in LinenStock.objects.select_related("item", "department").filter(
        hospital=hospital,
    ):
        entry = {
            "item_id": s.item.id,
            "item_code": s.item.code,
            "item_name": s.item.name,
            "category": s.item.category,
            "department": s.department.name if s.department else s.ward_label or "-",
            "total": s.total_units,
            "in_use": s.in_use,
            "in_laundry": s.in_laundry,
            "clean": s.clean_in_stock,
            "minimum": s.minimum_threshold,
            "is_low": s.clean_in_stock < s.minimum_threshold,
        }
        items.append(entry)
        if entry["is_low"]:
            low.append(entry)
    return {"items": items, "low_stock_alerts": low}
