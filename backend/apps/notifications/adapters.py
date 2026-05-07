"""Notification provider adapters.

Selection logic (set in settings or HMS_SMS_ADAPTER env var):
  - "msg91"   → real SMS via MSG91 API
  - "console" → log to console + DB (dev/no-key fallback) [DEFAULT]
  - "smtp"    → email only

Each adapter implements:
  send(to: str, body: str, subject: str = "", template_id: str = "") -> (success, msg_id, error)
"""
from __future__ import annotations
import logging
from typing import Tuple

from django.conf import settings

logger = logging.getLogger(__name__)


class BaseAdapter:
    name = "base"

    def send(self, to: str, body: str, subject: str = "",
             template_id: str = "") -> Tuple[bool, str, str]:
        raise NotImplementedError


class ConsoleAdapter(BaseAdapter):
    """Dev/test fallback. Prints message + returns synthetic message ID.
    Production-safe: any send still hits NotificationLog so admin can audit."""
    name = "console"

    def send(self, to, body, subject="", template_id=""):
        banner = "─" * 60
        print(f"\n{banner}\n[NOTIFICATION → {to}]")
        if subject:
            print(f"Subject: {subject}")
        if template_id:
            print(f"Template ID: {template_id}")
        print(f"Body: {body}\n{banner}\n")
        logger.info("ConsoleAdapter sent to %s: %s", to, body[:80])
        import uuid
        return True, f"CONSOLE-{uuid.uuid4().hex[:12]}", ""


class MSG91Adapter(BaseAdapter):
    """MSG91 SMS via Flow API.
    Docs: https://docs.msg91.com/sms/sending-sms-using-flow-api"""
    name = "msg91"

    def send(self, to, body, subject="", template_id=""):
        import requests
        auth_key = getattr(settings, "MSG91_AUTH_KEY", "")
        if not auth_key:
            return False, "", "MSG91_AUTH_KEY not configured"

        # Normalize phone: strip + and country code if Indian
        clean = to.lstrip("+")
        if clean.startswith("91") and len(clean) == 12:
            mobile = clean
        elif len(clean) == 10:
            mobile = "91" + clean
        else:
            mobile = clean

        try:
            resp = requests.post(
                "https://control.msg91.com/api/v5/flow",
                json={
                    "template_id": template_id or settings.MSG91_OTP_TEMPLATE_ID,
                    "short_url": "0",
                    "recipients": [{"mobiles": mobile, "var": body[:200]}],
                },
                headers={
                    "authkey": auth_key,
                    "accept": "application/json",
                    "content-type": "application/json",
                },
                timeout=10,
            )
            data = resp.json()
            if resp.status_code == 200 and data.get("type") == "success":
                return True, data.get("request_id", ""), ""
            return False, "", f"MSG91 error: {data}"
        except Exception as e:
            return False, "", str(e)


class SMTPAdapter(BaseAdapter):
    """Email via Django's send_mail."""
    name = "smtp"

    def send(self, to, body, subject="", template_id=""):
        from django.core.mail import send_mail
        try:
            send_mail(
                subject=subject or "Notification",
                message=body,
                from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "noreply@hospital.local"),
                recipient_list=[to],
                fail_silently=False,
            )
            return True, "smtp-sent", ""
        except Exception as e:
            return False, "", str(e)


# ─── Adapter registry ────────────────────────────────────
_ADAPTERS = {
    "console": ConsoleAdapter(),
    "msg91": MSG91Adapter(),
    "smtp": SMTPAdapter(),
}


def get_adapter(channel: str = "SMS") -> BaseAdapter:
    """Pick adapter based on settings + channel.

    SMS / WhatsApp → MSG91 if key present, else Console
    Email          → SMTP if configured, else Console
    """
    from django.conf import settings
    sms_provider = getattr(settings, "HMS_SMS_ADAPTER", "auto")

    if channel in ("SMS", "WHATSAPP"):
        if sms_provider == "console":
            return _ADAPTERS["console"]
        if sms_provider == "msg91":
            return _ADAPTERS["msg91"]
        # auto: real if key configured, else console
        if getattr(settings, "MSG91_AUTH_KEY", ""):
            return _ADAPTERS["msg91"]
        return _ADAPTERS["console"]
    if channel == "EMAIL":
        if getattr(settings, "EMAIL_HOST_USER", ""):
            return _ADAPTERS["smtp"]
        return _ADAPTERS["console"]
    return _ADAPTERS["console"]
