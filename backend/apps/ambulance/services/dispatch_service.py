"""
Ambulance dispatch service.

Workflow:
  request → assign → en_route → on_scene → patient_picked → at_hospital → completed
"""
from __future__ import annotations
from decimal import Decimal
from datetime import datetime
from typing import Optional

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from ..models import Ambulance, AmbulanceDriver, Dispatch, DispatchLog


def _gen_dispatch_code(hospital):
    today = timezone.now().date()
    prefix = f"AMB-{today.strftime('%Y%m%d')}-"
    last = (Dispatch.objects
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


def _log(dispatch, event_type, **kw):
    return DispatchLog.objects.create(
        dispatch=dispatch, event_type=event_type, **kw,
    )


@transaction.atomic
def request_dispatch(*, hospital, call_type="EMERGENCY", priority="URGENT",
                      pickup_address, **extra) -> Dispatch:
    """Create a new dispatch request — usually called from operator/control room."""
    d = Dispatch.objects.create(
        hospital=hospital,
        code=_gen_dispatch_code(hospital),
        call_type=call_type,
        priority=priority,
        pickup_address=pickup_address,
        pickup_lat=extra.get("pickup_lat"),
        pickup_lng=extra.get("pickup_lng"),
        pickup_landmark=extra.get("pickup_landmark", ""),
        drop_address=extra.get("drop_address", ""),
        patient=extra.get("patient"),
        patient_name_temp=extra.get("patient_name_temp", ""),
        patient_phone_temp=extra.get("patient_phone_temp", ""),
        caller_name=extra.get("caller_name", ""),
        caller_phone=extra.get("caller_phone", ""),
        caller_relation=extra.get("caller_relation", ""),
        chief_complaint=extra.get("chief_complaint", ""),
        age_estimate=extra.get("age_estimate"),
        is_conscious=extra.get("is_conscious"),
        is_breathing=extra.get("is_breathing"),
        notes=extra.get("notes", ""),
        status="REQUESTED",
    )
    _log(d, "STATUS_CHANGE", to_status="REQUESTED",
         note=f"Dispatch requested ({priority} priority)")
    return d


@transaction.atomic
def assign_ambulance(dispatch: Dispatch, *, ambulance: Ambulance,
                      driver: Optional[AmbulanceDriver] = None,
                      paramedic: Optional[AmbulanceDriver] = None,
                      user=None) -> Dispatch:
    if dispatch.status != "REQUESTED":
        raise ValidationError(
            f"Cannot assign in status {dispatch.status}.",
        )
    if ambulance.status != "AVAILABLE":
        raise ValidationError(
            f"Ambulance {ambulance.code} is not available "
            f"(status: {ambulance.status}).",
        )

    dispatch.ambulance = ambulance
    dispatch.driver = driver
    dispatch.paramedic = paramedic
    dispatch.status = "ASSIGNED"
    dispatch.assigned_at = timezone.now()
    dispatch.save()

    ambulance.status = "DISPATCHED"
    ambulance.save(update_fields=["status", "updated_at"])

    _log(dispatch, "STATUS_CHANGE",
         from_status="REQUESTED", to_status="ASSIGNED",
         note=f"Assigned {ambulance.code}", user=user)
    return dispatch


@transaction.atomic
def update_status(dispatch: Dispatch, *, new_status: str,
                   lat: Optional[Decimal] = None,
                   lng: Optional[Decimal] = None,
                   note: str = "", user=None) -> Dispatch:
    """Generic status update. Validates transitions."""
    valid_next = {
        "ASSIGNED":        ["EN_ROUTE", "CANCELLED"],
        "EN_ROUTE":        ["ON_SCENE", "CANCELLED"],
        "ON_SCENE":        ["PATIENT_PICKED", "CANCELLED"],
        "PATIENT_PICKED":  ["AT_HOSPITAL", "CANCELLED"],
        "AT_HOSPITAL":     ["COMPLETED"],
    }
    allowed = valid_next.get(dispatch.status, [])
    if new_status not in allowed:
        raise ValidationError(
            f"Invalid transition {dispatch.status} → {new_status}. "
            f"Allowed: {allowed}"
        )

    old_status = dispatch.status
    dispatch.status = new_status
    now = timezone.now()
    field_map = {
        "EN_ROUTE":        "en_route_at",
        "ON_SCENE":        "on_scene_at",
        "PATIENT_PICKED":  "patient_picked_at",
        "AT_HOSPITAL":     "at_hospital_at",
        "COMPLETED":       "completed_at",
    }
    if new_status in field_map:
        setattr(dispatch, field_map[new_status], now)
    dispatch.save()

    # Free up the ambulance once completed
    if new_status == "COMPLETED" and dispatch.ambulance:
        dispatch.ambulance.status = "AVAILABLE"
        dispatch.ambulance.save(update_fields=["status", "updated_at"])

    _log(dispatch, "STATUS_CHANGE",
         from_status=old_status, to_status=new_status,
         lat=lat, lng=lng, note=note, user=user)
    return dispatch


@transaction.atomic
def cancel_dispatch(dispatch: Dispatch, *, reason: str, user=None) -> Dispatch:
    if dispatch.status in ("COMPLETED", "CANCELLED"):
        raise ValidationError("Already finalized.")
    old = dispatch.status
    dispatch.status = "CANCELLED"
    dispatch.cancellation_reason = reason
    dispatch.completed_at = timezone.now()
    dispatch.save()

    if dispatch.ambulance:
        dispatch.ambulance.status = "AVAILABLE"
        dispatch.ambulance.save(update_fields=["status", "updated_at"])

    _log(dispatch, "STATUS_CHANGE", from_status=old, to_status="CANCELLED",
         note=f"Cancelled: {reason}", user=user)
    return dispatch


@transaction.atomic
def bill_dispatch(dispatch: Dispatch, *,
                   distance_km: Decimal,
                   gst_rate: Decimal = Decimal("0")) -> Dispatch:
    """Compute and create a standalone invoice based on distance + per-km rate."""
    from apps.billing.models import Invoice, InvoiceLine
    from apps.billing.services.invoice_service import (
        generate_invoice_code, recalculate_invoice_totals,
    )

    if dispatch.status != "COMPLETED":
        raise ValidationError("Bill only after completed dispatch.")

    if not dispatch.patient:
        raise ValidationError(
            "Cannot bill — dispatch has no linked patient. "
            "Link the patient first before billing."
        )

    amb = dispatch.ambulance
    base = amb.base_price if amb else Decimal("500")
    per_km = amb.per_km_rate if amb else Decimal("20")

    inv = Invoice.objects.create(
        hospital=dispatch.hospital,
        code=generate_invoice_code(dispatch.hospital),
        patient=dispatch.patient,
        invoice_type="AMBULANCE",
        status="PENDING",
        notes=f"Ambulance dispatch {dispatch.code}",
    )

    InvoiceLine.objects.create(
        invoice=inv,
        description="Ambulance call-out / base fare",
        hsn_code="9993",
        quantity=1,
        unit_price=base,
        gst_rate=gst_rate,
    )
    if distance_km > 0:
        InvoiceLine.objects.create(
            invoice=inv,
            description=f"Distance charge ({distance_km} km @ ₹{per_km}/km)",
            hsn_code="9993",
            quantity=distance_km,
            unit_price=per_km,
            gst_rate=gst_rate,
        )

    recalculate_invoice_totals(inv)
    dispatch.distance_km = distance_km
    dispatch.invoice = inv
    dispatch.save(update_fields=["distance_km", "invoice", "updated_at"])
    return dispatch
