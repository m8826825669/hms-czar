"""Razorpay integration service (Phase 1c + Phase 2b refund support).

Phase 1c: order create + signature verify (handler + webhook)
Phase 2b: + refund_payment for online refunds via Razorpay refund API
"""
import logging
from decimal import Decimal
from django.conf import settings

logger = logging.getLogger(__name__)


def _get_client():
    try:
        import razorpay
    except ImportError:
        raise RuntimeError("razorpay package not installed. Run: pip install razorpay")
    key_id = getattr(settings, "RAZORPAY_KEY_ID", None)
    key_secret = getattr(settings, "RAZORPAY_KEY_SECRET", None)
    if not key_id or not key_secret:
        raise RuntimeError("RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET not configured")
    return razorpay.Client(auth=(key_id, key_secret))


def create_order(*, amount_inr, receipt, notes=None):
    client = _get_client()
    paise = int(round(float(amount_inr) * 100))
    if paise < 100:
        raise ValueError("Razorpay requires minimum ₹1.00 (100 paise)")
    payload = {
        "amount": paise,
        "currency": "INR",
        "receipt": receipt[:40],
        "notes": notes or {},
    }
    order = client.order.create(payload)
    logger.info("Razorpay order created: %s for ₹%s", order.get("id"), amount_inr)
    return order


def verify_payment_signature(*, order_id, payment_id, signature):
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
    client = _get_client()
    return client.payment.fetch(payment_id)


# ───────────────────────────── PHASE 2b: REFUNDS ─────────────────────────────────

def refund_payment(*, payment_id, amount_inr=None, notes=None, speed="normal"):
    """Issue a refund against a Razorpay payment.

    Args:
        payment_id  : str — razorpay_payment_id from a successful Payment record
        amount_inr  : Decimal/float — partial refund amount in rupees;
                      omit/None for full refund
        notes       : optional dict for internal tracking
        speed       : "normal" (T+5-7 days, free) or "optimum" (instant, 0.25% fee)

    Returns:
        dict from Razorpay with {"id": "rfnd_xxx", "status": "...", ...}
    """
    client = _get_client()
    payload = {"speed": speed, "notes": notes or {}}
    if amount_inr is not None:
        payload["amount"] = int(round(float(amount_inr) * 100))

    try:
        result = client.payment.refund(payment_id, payload)
        logger.info("Razorpay refund issued: %s for payment %s",
                    result.get("id"), payment_id)
        return result
    except Exception as e:
        logger.error("Razorpay refund FAILED for %s: %s", payment_id, e)
        raise
