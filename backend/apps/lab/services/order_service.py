"""Lab order business logic.

Decoupled from views so that:
- finalize_order() can be called from a UI button OR a Celery webhook.
- collect_samples() ensures one sample per unique sample_type.
- enter_results() handles auto-flagging in a single atomic save.
- generate_invoice_for_order() mirrors the pattern used in pharmacy.dispense.
"""
from decimal import Decimal
from django.db import transaction
from django.utils import timezone

from apps.billing.models import Invoice, InvoiceItem
from apps.billing.services.invoice_service import determine_gst_split
from ..models import LabOrder, LabOrderItem, LabSample, LabResult, TestParameter


# ─────────────────────────────────── Finalize ───────────────────────────────────

def finalize_order(order, *, user):
    """DRAFT → ORDERED.

    Generates an Invoice (status=PENDING) and links it back to the order.
    Idempotent: if order already has an invoice we just return it.
    """
    if order.status != "DRAFT":
        return order  # already finalized; caller may inspect status

    if order.items.count() == 0:
        raise ValueError("Cannot finalize an empty lab order")

    with transaction.atomic():
        # Generate invoice
        if not order.invoice_id:
            patient = order.patient
            hospital = order.hospital
            hospital_state = getattr(hospital, "state", "")
            patient_state = getattr(patient, "state", "")
            gst_split = determine_gst_split(
                hospital_state=hospital_state, patient_state=patient_state,
            )
            invoice = Invoice.objects.create(
                hospital=hospital,
                created_by=user,
                code=Invoice.generate_code(hospital, timezone.localdate()),
                bill_date=timezone.localdate(),
                patient=patient,
                consultation=order.consultation,
                patient_state=patient_state,
                hospital_state=hospital_state,
                gst_split=gst_split,
                status="DRAFT",
            )
            # Add items
            for idx, oi in enumerate(order.items.all()):
                InvoiceItem.objects.create(
                    hospital=hospital,
                    created_by=user,
                    invoice=invoice,
                    service=None,
                    service_name=f"{oi.test_name} [{oi.test_code}]",
                    hsn_code=oi.test.hsn_code or "9993",
                    quantity=Decimal("1"),
                    unit_price=oi.price,
                    discount_pct=Decimal("0"),
                    gst_rate=oi.gst_rate,
                    order_index=idx,
                )
            invoice.recalculate_totals()
            invoice.status = "PENDING"
            invoice.save(update_fields=["status"])
            order.invoice = invoice

        order.status = "ORDERED"
        order.save(update_fields=["invoice", "status"])
        order.recalculate_totals()
    return order


# ─────────────────────────────── Sample collection ───────────────────────────────

def collect_samples(order, *, user, sample_specs=None):
    """Create LabSample records and advance order to COLLECTED.

    sample_specs: list of {"sample_type": "BLOOD", "container": "...",
                          "volume": "...", "notes": "..."}
    If omitted, we auto-create one sample per *unique* sample_type implied
    by the order's tests.
    """
    if order.status not in ("ORDERED", "COLLECTED", "IN_PROGRESS"):
        raise ValueError(f"Cannot collect samples for {order.status} order")

    with transaction.atomic():
        existing_count = order.samples.count()
        if not sample_specs:
            # Derive from tests
            sample_types = list(
                order.items.values_list("sample_type", flat=True).distinct()
            )
            sample_specs = [{"sample_type": st or "BLOOD", "container": "",
                             "volume": ""} for st in sample_types]

        seq = existing_count + 1
        created = []
        for spec in sample_specs:
            barcode = LabSample.generate_barcode(
                order.hospital, order.code, seq
            )
            sample = LabSample.objects.create(
                hospital=order.hospital,
                created_by=user,
                order=order,
                sample_type=spec.get("sample_type", "BLOOD"),
                container=spec.get("container", ""),
                volume=spec.get("volume", ""),
                barcode=barcode,
                collected_by=user,
                collected_at=timezone.now(),
                notes=spec.get("notes", ""),
            )
            created.append(sample)
            seq += 1

        if order.status == "ORDERED":
            order.status = "COLLECTED"
            order.sample_collected_at = timezone.now()
            order.save(update_fields=["status", "sample_collected_at"])

    return created


# ───────────────────────────────── Result entry ─────────────────────────────────

def enter_results_for_item(order_item, *, user, results):
    """Bulk-enter results for an order item.

    results: list of {"parameter_id": int, "value": str, "interpretation": str?}
    """
    if order_item.order.status not in ("COLLECTED", "IN_PROGRESS"):
        raise ValueError(
            f"Cannot enter results for order in status {order_item.order.status}"
        )

    saved = []
    with transaction.atomic():
        for r in results:
            param_id = r.get("parameter_id")
            value = (r.get("value") or "").strip()
            if not param_id or not value:
                continue
            try:
                param = TestParameter.objects.get(
                    id=param_id, test=order_item.test
                )
            except TestParameter.DoesNotExist:
                continue
            obj, _ = LabResult.objects.update_or_create(
                hospital=order_item.hospital,
                order_item=order_item,
                parameter=param,
                defaults={
                    "created_by": user,
                    "value": value,
                    "interpretation": r.get("interpretation", ""),
                    "entered_by": user,
                    "entered_at": timezone.now(),
                    "flag": "NORMAL",
                },
            )
            # auto_flag is invoked inside save() but only when flag is NORMAL,
            # so we re-evaluate explicitly to handle re-entry of values:
            obj.auto_flag()
            obj.save(update_fields=["flag", "interpretation"])
            saved.append(obj)

        # If all parameters now have results → mark order_item COMPLETED
        total_params = order_item.test.parameters.count()
        results_count = order_item.results.count()
        if total_params and results_count >= total_params:
            order_item.status = "COMPLETED"
            order_item.save(update_fields=["status"])
        elif results_count > 0 and order_item.status == "PENDING":
            order_item.status = "IN_PROGRESS"
            order_item.save(update_fields=["status"])

        # Bump order to IN_PROGRESS if any results entered
        order = order_item.order
        if order.status == "COLLECTED":
            order.status = "IN_PROGRESS"
            order.save(update_fields=["status"])

    return saved


# ───────────────────────────────────── Verify ─────────────────────────────────────

def verify_and_release_report(order, *, user, doctor=None):
    """Lab pathologist verifies all results and releases the report.

    Marks all unverified LabResults as verified and the order as REPORTED.
    """
    if order.status not in ("IN_PROGRESS", "COLLECTED"):
        raise ValueError(f"Cannot release report for {order.status} order")

    with transaction.atomic():
        unverified = LabResult.objects.filter(
            order_item__order=order, verified_at__isnull=True,
        )
        unverified.update(verified_at=timezone.now(), verified_by=user)

        order.status = "REPORTED"
        order.reported_at = timezone.now()
        if doctor:
            order.reported_by = doctor
        order.save(update_fields=["status", "reported_at", "reported_by"])

    return order
