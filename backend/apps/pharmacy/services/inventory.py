"""Inventory allocation services.

FEFO (First Expiry First Out) — when a drug has multiple batches in stock,
always pick from the earliest-expiring batch first. This minimizes wastage.

Allocation never crosses an expired batch — those are excluded.
"""
from django.utils import timezone
from .. models import DrugBatch


class InsufficientStockError(Exception):
    """Raised when requested quantity exceeds available unexpired stock."""
    def __init__(self, drug, requested, available):
        self.drug = drug
        self.requested = requested
        self.available = available
        super().__init__(
            f"Insufficient stock for {drug}: requested {requested}, available {available}"
        )


def total_available(drug, hospital):
    """Total unexpired stock for a drug across all batches."""
    today = timezone.localdate()
    return sum(
        b.qty_in_stock for b in DrugBatch.objects.filter(
            hospital=hospital, drug=drug,
            qty_in_stock__gt=0, expiry_date__gt=today,
        )
    )


def allocate_fefo(*, drug, hospital, qty_needed):
    """Pick batches in expiry order to fulfill qty_needed.

    Args:
        drug: DrugMaster instance
        hospital: tenant scope
        qty_needed: positive int

    Returns:
        list of (DrugBatch, qty_to_take) tuples summing to qty_needed.

    Raises:
        InsufficientStockError if total unexpired stock < qty_needed.
    """
    if qty_needed <= 0:
        return []

    today = timezone.localdate()
    batches = list(
        DrugBatch.objects.select_for_update().filter(
            hospital=hospital, drug=drug,
            qty_in_stock__gt=0,
            expiry_date__gt=today,
        ).order_by("expiry_date", "received_at")
    )

    allocations = []
    remaining = qty_needed
    for b in batches:
        if remaining <= 0:
            break
        take = min(remaining, b.qty_in_stock)
        allocations.append((b, take))
        remaining -= take

    if remaining > 0:
        available = qty_needed - remaining
        raise InsufficientStockError(drug, qty_needed, available)

    return allocations


def preview_allocation(*, drug, hospital, qty_needed):
    """Like allocate_fefo but read-only (no SELECT FOR UPDATE).
    Used to show user a dispense preview before confirming.

    Returns: {"allocations": [...], "shortfall": int, "total_available": int}
    """
    today = timezone.localdate()
    batches = list(DrugBatch.objects.filter(
        hospital=hospital, drug=drug,
        qty_in_stock__gt=0, expiry_date__gt=today,
    ).order_by("expiry_date", "received_at"))

    allocations = []
    remaining = qty_needed
    total = 0
    for b in batches:
        total += b.qty_in_stock
        if remaining > 0:
            take = min(remaining, b.qty_in_stock)
            allocations.append({
                "batch_id": b.id,
                "batch_no": b.batch_no,
                "expiry_date": b.expiry_date.isoformat(),
                "available": b.qty_in_stock,
                "take": take,
                "mrp": str(b.mrp),
            })
            remaining -= take

    return {
        "allocations": allocations,
        "shortfall": max(remaining, 0),
        "total_available": total,
        "qty_requested": qty_needed,
    }
