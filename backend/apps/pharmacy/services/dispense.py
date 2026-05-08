"""Dispense workflow.

`dispense_order` is the main entry point — given a draft pharmacy order with items,
it FEFO-allocates batches, decrements stock, creates StockMovement entries, and
spawns a billing Invoice linked to the order.

Idempotent: calling on an already-COMPLETED order is a no-op.
"""
from decimal import Decimal
from django.db import transaction
from django.utils import timezone

from apps.billing.models import Invoice, InvoiceItem
from apps.billing.services.invoice_service import determine_gst_split
from ..models import PharmacyOrder, PharmacyOrderItem, StockMovement


@transaction.atomic
def dispense_order(order: PharmacyOrder, *, user=None):
    """Finalize a pharmacy order:
    1. Decrement DrugBatch.qty_in_stock for each item
    2. Create StockMovement(DISPENSE_OUT) entries
    3. Generate a billing Invoice in PENDING status
    4. Mark the order COMPLETED

    Raises if any batch has insufficient stock (rolls back atomically).
    """
    if order.status == "COMPLETED":
        return order  # idempotent

    if order.status != "DRAFT":
        raise ValueError(f"Cannot dispense order in status {order.status}")

    items = list(order.items.select_related("drug", "batch").select_for_update())
    if not items:
        raise ValueError("Cannot dispense empty order")

    # 1. Validate stock + decrement
    for it in items:
        batch = it.batch
        if not batch:
            raise ValueError(f"Item {it.drug_name} has no batch assigned")
        if batch.qty_in_stock < it.quantity:
            raise ValueError(
                f"Batch {batch.batch_no} has only {batch.qty_in_stock} "
                f"of {it.drug_name}, requested {it.quantity}"
            )
        batch.qty_in_stock -= it.quantity
        batch.save(update_fields=["qty_in_stock"])

        # 2. Stock movement record
        StockMovement.objects.create(
            hospital=order.hospital,
            created_by=user,
            drug=it.drug,
            batch=batch,
            movement_type="DISPENSE_OUT",
            quantity=it.quantity,
            reference_type="pharmacy_order",
            reference_id=str(order.id),
            notes=f"Pharmacy order {order.code}",
        )

    # 3. Create the invoice
    hospital_state = getattr(order.hospital, "state", "")
    patient_state = getattr(order.patient, "state", "") or ""
    gst_split = determine_gst_split(
        hospital_state=hospital_state, patient_state=patient_state,
    )

    invoice = Invoice.objects.create(
        hospital=order.hospital,
        created_by=user,
        code=Invoice.generate_code(order.hospital, order.order_date),
        bill_date=order.order_date,
        patient=order.patient,
        consultation=order.consultation,
        patient_state=patient_state,
        hospital_state=hospital_state,
        gst_split=gst_split,
        status="DRAFT",
        notes=f"Auto-generated from pharmacy order {order.code}",
    )

    for it in items:
        InvoiceItem.objects.create(
            hospital=order.hospital,
            created_by=user,
            invoice=invoice,
            service=None,
            service_name=f"{it.drug_name}  [Batch {it.batch_no}]",
            hsn_code=it.batch.hsn_code if it.batch else "",
            quantity=Decimal(str(it.quantity)),
            unit_price=it.unit_mrp,
            gst_rate=it.gst_rate,
            discount_pct=it.discount_pct,
            order_index=it.order_index,
        )

    invoice.recalculate_totals()
    invoice.status = "PENDING"
    invoice.save(update_fields=["status"])

    # 4. Link invoice to order + finalize
    order.invoice = invoice
    order.status = "COMPLETED"
    order.dispensed_at = timezone.now()
    order.recalculate_totals()
    order.save(update_fields=["invoice", "status", "dispensed_at"])

    return order
