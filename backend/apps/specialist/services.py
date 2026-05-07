"""Specialist business logic - slot generation, availability."""
from __future__ import annotations
from datetime import datetime, date, timedelta, time
from typing import Optional

from .models import Doctor, OPDSlot, OPDSlotException


def get_doctor_availability(doctor: Doctor, target_date: date) -> dict:
    """Returns availability for a specific date.

    {
      "date": "2026-05-08",
      "available": true,
      "slots": [
        {"start": "09:00", "end": "09:15", "is_taken": false},
        ...
      ],
      "exception": null | {...}
    }
    """
    dow = target_date.weekday()  # 0=Mon

    # Check exceptions first
    exception = OPDSlotException.objects.filter(
        doctor=doctor, date=target_date,
    ).first()

    if exception and exception.exception_type in ("LEAVE", "HOLIDAY"):
        return {
            "date": target_date.isoformat(),
            "available": False,
            "slots": [],
            "exception": {
                "type": exception.exception_type,
                "reason": exception.reason,
            },
        }

    # Regular weekly slot
    weekly_slots = OPDSlot.objects.filter(
        doctor=doctor, day_of_week=dow, is_active=True,
    )
    if not weekly_slots.exists() and not (exception and exception.exception_type == "EXTRA"):
        return {
            "date": target_date.isoformat(),
            "available": False,
            "slots": [],
            "exception": None,
        }

    slot_list = []
    for ws in weekly_slots:
        slot_list += _expand_slot(ws.start_time, ws.end_time, ws.slot_duration_minutes,
                                   ws.location_id, ws.id)

    if exception and exception.exception_type == "EXTRA":
        slot_list += _expand_slot(exception.start_time, exception.end_time,
                                   15, exception.location_id, None, is_extra=True)

    # Mark taken slots — count appointments already booked
    from apps.reception.models import Appointment
    booked = Appointment.objects.filter(
        doctor=doctor, scheduled_date=target_date,
        status__in=["BOOKED", "CHECKED_IN", "IN_CONSULT"],
    ).values_list("scheduled_time", flat=True)
    booked_set = {t.strftime("%H:%M") for t in booked}
    for s in slot_list:
        s["is_taken"] = s["start"] in booked_set

    return {
        "date": target_date.isoformat(),
        "available": True,
        "slots": slot_list,
        "exception": (
            {"type": exception.exception_type, "reason": exception.reason}
            if exception else None
        ),
    }


def _expand_slot(start: time, end: time, duration_min: int,
                 location_id: int | None, slot_id: int | None,
                 is_extra: bool = False) -> list[dict]:
    """Break a time range into discrete bookable slots."""
    if not start or not end:
        return []
    out = []
    cur = datetime.combine(date.today(), start)
    end_dt = datetime.combine(date.today(), end)
    while cur + timedelta(minutes=duration_min) <= end_dt:
        nxt = cur + timedelta(minutes=duration_min)
        out.append({
            "start": cur.time().strftime("%H:%M"),
            "end": nxt.time().strftime("%H:%M"),
            "is_taken": False,
            "is_extra": is_extra,
            "location_id": location_id,
            "slot_id": slot_id,
        })
        cur = nxt
    return out


def get_consultation_fee(doctor: Doctor, visit_type: str = "NEW",
                          on_date: Optional[date] = None) -> Optional[float]:
    """Returns the active fee for the given visit type."""
    on_date = on_date or date.today()
    fee = doctor.fees.filter(
        visit_type=visit_type,
        valid_from__lte=on_date,
    ).filter(
        models_q_active(on_date)
    ).order_by("-valid_from").first()
    return float(fee.amount) if fee else None


def models_q_active(on_date):
    from django.db.models import Q
    return Q(valid_to__isnull=True) | Q(valid_to__gte=on_date)
