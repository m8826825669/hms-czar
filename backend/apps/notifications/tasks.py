"""Async notification tasks via Celery."""
from celery import shared_task
from apps.core.models import Hospital
from .services import notify, notify_template


@shared_task(name="notifications.send")
def send_notification(*, channel, to, body, hospital_id,
                      subject="", related_object_type="", related_object_id=""):
    """Async send. Use: send_notification.delay(channel='SMS', to='...', ...)"""
    hospital = Hospital.objects.filter(id=hospital_id).first()
    if not hospital:
        return {"status": "FAILED", "error": "hospital not found"}
    log = notify(
        channel=channel, to=to, body=body, hospital=hospital,
        subject=subject,
        related_object_type=related_object_type,
        related_object_id=related_object_id,
    )
    return {"status": log.status, "log_id": log.id}


@shared_task(name="notifications.send_template")
def send_template_notification(*, code, channel, ctx, to, hospital_id,
                               related_object_type="", related_object_id=""):
    hospital = Hospital.objects.filter(id=hospital_id).first()
    if not hospital:
        return {"status": "FAILED", "error": "hospital not found"}
    log = notify_template(
        code=code, channel=channel, ctx=ctx, to=to, hospital=hospital,
        related_object_type=related_object_type,
        related_object_id=related_object_id,
    )
    return {"status": log.status if log else "FAILED", "log_id": log.id if log else None}
