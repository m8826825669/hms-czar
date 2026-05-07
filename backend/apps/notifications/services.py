"""Notification dispatch service.

Public API:
  notify(channel, to, body, hospital, ...)        — sync send
  notify_async.delay(...)                         — async via Celery
  notify_template(code, ctx, to, hospital, ...)   — template + context

Returns the NotificationLog instance.
"""
from __future__ import annotations
from typing import Optional
from django.utils import timezone

from .models import NotificationLog, NotificationTemplate
from .adapters import get_adapter


def notify(
    *,
    channel: str,
    to: str,
    body: str,
    hospital,
    subject: str = "",
    template: Optional[NotificationTemplate] = None,
    related_object_type: str = "",
    related_object_id: str = "",
    created_by=None,
) -> NotificationLog:
    """Dispatches a notification via the appropriate adapter and logs it."""
    log = NotificationLog.objects.create(
        hospital=hospital,
        channel=channel,
        to_address=to,
        subject=subject,
        body=body,
        template=template,
        related_object_type=related_object_type,
        related_object_id=related_object_id,
        status="PENDING",
        created_by=created_by,
    )
    adapter = get_adapter(channel)
    template_id = template.msg91_template_id if template else ""
    success, msg_id, err = adapter.send(to, body, subject, template_id)

    log.provider = adapter.name
    log.provider_message_id = msg_id
    log.error = err
    log.status = "SENT" if success else "FAILED"
    log.sent_at = timezone.now() if success else None
    log.save(update_fields=["provider", "provider_message_id", "error",
                            "status", "sent_at"])
    return log


def notify_template(
    *,
    code: str,
    channel: str,
    ctx: dict,
    to: str,
    hospital,
    related_object_type: str = "",
    related_object_id: str = "",
    created_by=None,
) -> Optional[NotificationLog]:
    """Resolve template by code+channel for the hospital, render with ctx, send."""
    tpl = NotificationTemplate.objects.filter(
        hospital=hospital, code=code, channel=channel, is_active=True,
    ).first()
    if not tpl:
        # Graceful fallback: console-log so dev sees what would have gone out
        print(f"[notify_template] No template for {code}/{channel} in hospital "
              f"{hospital.code if hospital else '?'}; using ctx as body")
        return notify(channel=channel, to=to, body=str(ctx), hospital=hospital,
                      related_object_type=related_object_type,
                      related_object_id=related_object_id, created_by=created_by)
    body = tpl.render(ctx)
    return notify(
        channel=channel, to=to, body=body, hospital=hospital,
        subject=tpl.subject, template=tpl,
        related_object_type=related_object_type,
        related_object_id=related_object_id, created_by=created_by,
    )
