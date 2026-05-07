"""Razorpay integration service.

Two verification surfaces:
1. Frontend handler   : razorpay.checkout returns order_id + payment_id + signature.
                        We verify signature on /verify-payment endpoint.
2. Webhook            : Razorpay POSTs to /webhook with X-Razorpay-Signature header.
                        We verify with webhook secret.

Both paths converge on the same Payment record. Idempotent against duplicate webhooks
via `razorpay_payment_id` uniqueness check.
"""
import logging
from decimal import Decimal
from django.conf import settings

logger = logging.getLogger(__name__)


def _get_client():
    """Lazy-import razorpay so the module doesn't crash if SDK isn't installed yet."""
    try:
        import razorpay
    except ImportError:
        raise RuntimeError(
            "razorpay package not installed. Run: pip install razorpay"
        )
    key_id = getattr(settings, "RAZORPAY_KEY_ID", None)
    key_secret = getattr(settings, "RAZORPAY_KEY_SECRET", None)
    if not key_id or not key_secret:
        raise RuntimeError(
            "RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET not configured in settings"
        )
    return razorpay.Client(auth=(key_id, key_secret))


def create_order(*, amount_inr, receipt, notes=None):
    """Create a Razorpay order for the given INR amount.

    Args:
        amount_inr: Decimal/float in rupees
        receipt:    String reference (we use invoice code)
        notes:      Optional dict of metadata

    Returns:
        dict with at least {"id": "order_xxx", "amount": <paise>, ...}
    """
    client = _get_client()
    paise = int(round(float(amount_inr) * 100))
    if paise < 100:
        raise ValueError("Razorpay requires minimum ₹1.00 (100 paise)")

    payload = {
        "amount": paise,
        "currency": "INR",
        "receipt": receipt[:40],  # Razorpay limit
        "notes": notes or {},
    }
    order = client.order.create(payload)
    logger.info("Razorpay order created: %s for ₹%s", order.get("id"), amount_inr)
    return order


def verify_payment_signature(*, order_id, payment_id, signature):
    """Verify Razorpay handler response.

    Returns True/False - never raises (so caller can record FAILED payment).
    """
    try:
        client = _get_client()
        client.utility.verify_payment_signature({
            "razorpay_order_id": order_id,
            "razorpay_payment_id": payment_id,
            "razorpay_signature": signature,
        })
        return True
    except Exception as e:
        logger.warning("Razorpay signature verify FAILED: %s", e)
        return False


def verify_webhook_signature(*, body_bytes, signature_header):
    """Verify Razorpay webhook X-Razorpay-Signature header against secret."""
    try:
        client = _get_client()
        webhook_secret = getattr(settings, "RAZORPAY_WEBHOOK_SECRET", "")
        if not webhook_secret:
            logger.error("RAZORPAY_WEBHOOK_SECRET not configured")
            return False
        client.utility.verify_webhook_signature(
            body_bytes.decode() if isinstance(body_bytes, bytes) else body_bytes,
            signature_header,
            webhook_secret,
        )
        return True
    except Exception as e:
        logger.warning("Razorpay webhook signature FAILED: %s", e)
        return False


def fetch_payment(payment_id):
    """Retrieve payment details from Razorpay (used to confirm webhook events)."""
    client = _get_client()
    return client.payment.fetch(payment_id)
