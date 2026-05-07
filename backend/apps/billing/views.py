"""Billing views.

Key flows:
- POST /invoices/                 → create draft invoice
- POST /invoices/<id>/add-item/   → add a service line; auto-recalcs totals
- POST /invoices/<id>/finalize/   → freeze totals, mark PENDING
- POST /invoices/<id>/pay-cash/   → record cash/UPI/card payment manually
- POST /invoices/<id>/pay-online/ → create Razorpay order, return order_id+key
- POST /payments/verify/          → verify Razorpay handler signature
- POST /webhooks/razorpay/        → Razorpay webhook (no auth, signature-verified)
- GET  /invoices/<id>/print/      → thermal-format PDF download
- GET  /invoices/today/           → today's collection summary
"""
from datetime import date
from decimal import Decimal
from django.conf import settings
from django.db import transaction
from django.http import HttpResponse, JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response

from apps.core.views import TenantScopedViewSetMixin
from apps.notifications.tasks import send_template_notification
from .models import ServiceCatalog, Invoice, InvoiceItem, Payment
from .serializers import (ServiceCatalogSerializer, InvoiceSerializer,
                          InvoiceItemSerializer, PaymentSerializer)
from .services.razorpay_service import (
    create_order as rzp_create_order,
    verify_payment_signature as rzp_verify_sig,
    verify_webhook_signature as rzp_verify_webhook,
)
from .services.invoice_service import determine_gst_split
from .services.thermal_print import generate_invoice_pdf


class ServiceCatalogViewSet(TenantScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = ServiceCatalog.objects.all()
    serializer_class = ServiceCatalogSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ["code", "name"]
    filterset_fields = ["category", "is_active"]


class InvoiceViewSet(TenantScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = Invoice.objects.select_related(
        "patient", "consultation", "appointment"
    ).prefetch_related("items", "payments")
    serializer_class = InvoiceSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ["code", "patient__mrn", "patient__first_name",
                     "patient__last_name", "patient__phone"]
    filterset_fields = ["status", "bill_date", "patient", "gst_split"]
    ordering_fields = ["-bill_date", "-created_at"]

    def perform_create(self, serializer):
        request = self.request
        on_date = serializer.validated_data.get("bill_date") or date.today()
        code = Invoice.generate_code(request.hospital, on_date)

        # Auto-determine GST split if patient given
        patient = serializer.validated_data.get("patient")
        hospital_state = getattr(request.hospital, "state", "")
        patient_state = getattr(patient, "state", "") if patient else ""
        gst_split = determine_gst_split(
            hospital_state=hospital_state, patient_state=patient_state,
        )
        serializer.save(
            hospital=request.hospital,
            created_by=request.user,
            code=code,
            patient_state=patient_state,
            hospital_state=hospital_state,
            gst_split=gst_split,
        )

    # ─── Items ───────────────────────────
    @action(detail=True, methods=["post"], url_path="add-item")
    def add_item(self, request, pk=None):
        """Append a service line. Body can include `service` (catalog FK) OR free text.

        Body: {service?, service_name, quantity, unit_price, discount_pct?, gst_rate?, hsn_code?}
        """
        invoice = self.get_object()
        if invoice.status not in ("DRAFT", "PENDING", "PARTIAL"):
            return Response({"detail": f"Cannot modify {invoice.status} invoice"},
                            status=status.HTTP_400_BAD_REQUEST)

        data = {**request.data, "invoice": invoice.id}
        # If a service is specified, auto-fill name/hsn/gst from catalog
        svc_id = data.get("service")
        if svc_id:
            try:
                svc = ServiceCatalog.objects.get(id=svc_id, hospital=request.hospital)
                data.setdefault("service_name", svc.name)
                data.setdefault("hsn_code", svc.hsn_code)
                data.setdefault("unit_price", str(svc.price))
                data.setdefault("gst_rate", str(svc.gst_rate))
            except ServiceCatalog.DoesNotExist:
                pass

        ser = InvoiceItemSerializer(data=data)
        ser.is_valid(raise_exception=True)
        ser.save(hospital=request.hospital, created_by=request.user)
        invoice.recalculate_totals()
        return Response(InvoiceSerializer(invoice).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="remove-item/(?P<item_id>[^/.]+)")
    def remove_item(self, request, pk=None, item_id=None):
        invoice = self.get_object()
        try:
            item = invoice.items.get(id=item_id)
        except InvoiceItem.DoesNotExist:
            return Response({"detail": "Item not found"}, status=404)
        item.delete()
        invoice.recalculate_totals()
        return Response(InvoiceSerializer(invoice).data)

    # ─── Lifecycle ───────────────────────────
    @action(detail=True, methods=["post"])
    def finalize(self, request, pk=None):
        """Move DRAFT → PENDING, freeze totals."""
        invoice = self.get_object()
        if invoice.status != "DRAFT":
            return Response({"detail": "Only DRAFT can be finalized"},
                            status=status.HTTP_400_BAD_REQUEST)
        if invoice.items.count() == 0:
            return Response({"detail": "Cannot finalize empty invoice"},
                            status=status.HTTP_400_BAD_REQUEST)
        invoice.recalculate_totals()
        invoice.status = "PENDING"
        invoice.save(update_fields=["status"])

        # Notify patient
        if invoice.patient.phone:
            send_template_notification.delay(
                code="INVOICE_GENERATED",
                channel="SMS",
                ctx={
                    "patient_name": invoice.patient.full_name,
                    "amount": f"{invoice.total_amount:.2f}",
                    "code": invoice.code,
                },
                to=invoice.patient.phone,
                hospital_id=request.hospital.id,
                related_object_type="invoice",
                related_object_id=str(invoice.id),
            )

        return Response(InvoiceSerializer(invoice).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        invoice = self.get_object()
        if invoice.status == "PAID":
            return Response({"detail": "Cannot cancel a paid invoice. Refund instead."},
                            status=status.HTTP_400_BAD_REQUEST)
        invoice.status = "CANCELLED"
        invoice.cancelled_reason = request.data.get("reason", "")
        invoice.save(update_fields=["status", "cancelled_reason"])
        return Response(InvoiceSerializer(invoice).data)

    # ─── Payments ───────────────────────────
    @action(detail=True, methods=["post"], url_path="pay-cash")
    def pay_cash(self, request, pk=None):
        """Record a manual (cash/card/UPI offline) payment.
        Body: {amount, method, reference?, notes?}
        """
        invoice = self.get_object()
        if invoice.status in ("CANCELLED", "REFUNDED"):
            return Response({"detail": "Cannot pay cancelled/refunded invoice"},
                            status=status.HTTP_400_BAD_REQUEST)

        amount = Decimal(str(request.data.get("amount", "0")))
        if amount <= 0:
            return Response({"detail": "amount must be > 0"}, status=400)

        method = request.data.get("method", "CASH").upper()
        with transaction.atomic():
            payment = Payment.objects.create(
                hospital=request.hospital,
                created_by=request.user,
                invoice=invoice,
                amount=amount,
                method=method,
                reference=request.data.get("reference", ""),
                notes=request.data.get("notes", ""),
                status="SUCCESS",
            )
            invoice.amount_paid = (invoice.amount_paid or Decimal("0")) + amount
            invoice.update_payment_status()

        # Notify on full payment
        if invoice.status == "PAID" and invoice.patient.phone:
            send_template_notification.delay(
                code="PAYMENT_RECEIVED",
                channel="SMS",
                ctx={
                    "patient_name": invoice.patient.full_name,
                    "amount": f"{invoice.total_amount:.2f}",
                    "code": invoice.code,
                },
                to=invoice.patient.phone,
                hospital_id=request.hospital.id,
                related_object_type="invoice",
                related_object_id=str(invoice.id),
            )
        return Response({
            "invoice": InvoiceSerializer(invoice).data,
            "payment": PaymentSerializer(payment).data,
        })

    @action(detail=True, methods=["post"], url_path="pay-online")
    def pay_online(self, request, pk=None):
        """Initialise Razorpay order. Returns order_id + key_id for frontend checkout.

        Frontend then opens Razorpay Checkout with these params, receives
        razorpay_payment_id + signature in handler, and POSTs back to /verify-payment.
        """
        invoice = self.get_object()
        if invoice.amount_due <= 0:
            return Response({"detail": "No amount due"}, status=400)
        if invoice.status == "CANCELLED":
            return Response({"detail": "Invoice cancelled"}, status=400)

        try:
            order = rzp_create_order(
                amount_inr=invoice.amount_due,
                receipt=invoice.code,
                notes={
                    "invoice_id": str(invoice.id),
                    "patient_mrn": invoice.patient.mrn,
                },
            )
        except Exception as e:
            return Response({"detail": f"Razorpay error: {e}"}, status=502)

        invoice.razorpay_order_id = order["id"]
        invoice.save(update_fields=["razorpay_order_id"])

        return Response({
            "razorpay_order_id": order["id"],
            "razorpay_key_id": getattr(settings, "RAZORPAY_KEY_ID", ""),
            "amount_paise": order["amount"],
            "currency": order["currency"],
            "invoice_code": invoice.code,
            "patient_name": invoice.patient.full_name,
            "patient_phone": invoice.patient.phone or "",
            "patient_email": invoice.patient.email or "",
        })

    # ─── Print ───────────────────────────
    @action(detail=True, methods=["get"], url_path="print")
    def thermal_print(self, request, pk=None):
        """Returns a thermal-format (80mm) PDF of the invoice."""
        invoice = self.get_object()
        try:
            pdf_bytes = generate_invoice_pdf(invoice)
        except Exception as e:
            return Response({"detail": f"PDF generation failed: {e}"}, status=500)
        invoice.printed_at = timezone.now()
        invoice.save(update_fields=["printed_at"])
        resp = HttpResponse(pdf_bytes, content_type="application/pdf")
        resp["Content-Disposition"] = f'inline; filename="{invoice.code}.pdf"'
        return resp

    # ─── Reports ───────────────────────────
    @action(detail=False, methods=["get"])
    def today(self, request):
        today = timezone.localdate()
        qs = self.get_queryset().filter(bill_date=today)
        total_billed = sum((i.total_amount for i in qs), Decimal("0"))
        total_collected = sum((i.amount_paid for i in qs), Decimal("0"))
        return Response({
            "date": today.isoformat(),
            "invoice_count": qs.count(),
            "total_billed": str(total_billed),
            "total_collected": str(total_collected),
            "total_due": str(total_billed - total_collected),
            "by_status": {
                s: qs.filter(status=s).count()
                for s in ["DRAFT", "PENDING", "PARTIAL", "PAID", "CANCELLED"]
            },
            "invoices": InvoiceSerializer(qs.order_by("-created_at")[:50], many=True).data,
        })


class PaymentViewSet(TenantScopedViewSetMixin, viewsets.ReadOnlyModelViewSet):
    queryset = Payment.objects.select_related("invoice__patient")
    serializer_class = PaymentSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["invoice", "method", "status"]
    ordering_fields = ["-received_at"]


# ─── Standalone API views ─────────────────────────────────
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def verify_razorpay_payment(request):
    """POST /api/v1/billing/payments/verify/

    Body: {invoice_id, razorpay_order_id, razorpay_payment_id, razorpay_signature}

    Verifies signature → records Payment → updates invoice status.
    """
    invoice_id = request.data.get("invoice_id")
    order_id = request.data.get("razorpay_order_id")
    payment_id = request.data.get("razorpay_payment_id")
    signature = request.data.get("razorpay_signature")
    if not all([invoice_id, order_id, payment_id, signature]):
        return Response({"detail": "Missing required fields"}, status=400)

    try:
        invoice = Invoice.objects.get(id=invoice_id, hospital=request.hospital)
    except Invoice.DoesNotExist:
        return Response({"detail": "Invoice not found"}, status=404)

    if invoice.razorpay_order_id != order_id:
        return Response({"detail": "Order ID mismatch"}, status=400)

    is_valid = rzp_verify_sig(
        order_id=order_id, payment_id=payment_id, signature=signature
    )
    payment_status = "SUCCESS" if is_valid else "FAILED"

    with transaction.atomic():
        # Idempotent against duplicate verifies
        payment, created = Payment.objects.get_or_create(
            invoice=invoice, razorpay_payment_id=payment_id,
            defaults={
                "hospital": request.hospital,
                "created_by": request.user,
                "amount": invoice.amount_due,
                "method": "RAZORPAY",
                "status": payment_status,
                "razorpay_order_id": order_id,
                "razorpay_signature": signature,
                "is_signature_verified": is_valid,
            },
        )
        if is_valid and created:
            invoice.amount_paid = (invoice.amount_paid or Decimal("0")) + payment.amount
            invoice.update_payment_status()
            if invoice.status == "PAID" and invoice.patient.phone:
                send_template_notification.delay(
                    code="PAYMENT_RECEIVED",
                    channel="SMS",
                    ctx={
                        "patient_name": invoice.patient.full_name,
                        "amount": f"{invoice.total_amount:.2f}",
                        "code": invoice.code,
                    },
                    to=invoice.patient.phone,
                    hospital_id=request.hospital.id,
                    related_object_type="invoice",
                    related_object_id=str(invoice.id),
                )

    return Response({
        "verified": is_valid,
        "invoice": InvoiceSerializer(invoice).data,
        "payment": PaymentSerializer(payment).data,
    }, status=200 if is_valid else 400)


@csrf_exempt
@api_view(["POST"])
@permission_classes([AllowAny])
def razorpay_webhook(request):
    """POST /api/v1/billing/webhooks/razorpay/

    Razorpay-initiated webhook. Verifies X-Razorpay-Signature and processes
    payment.captured / payment.failed events.

    No auth (Razorpay servers don't carry user creds). Security via signature only.
    """
    signature = request.headers.get("X-Razorpay-Signature", "")
    body = request.body  # raw bytes

    if not rzp_verify_webhook(body_bytes=body, signature_header=signature):
        return JsonResponse({"detail": "invalid signature"}, status=400)

    payload = request.data
    event = payload.get("event")
    payment_data = payload.get("payload", {}).get("payment", {}).get("entity", {})
    payment_id = payment_data.get("id")
    order_id = payment_data.get("order_id")
    amount_paise = payment_data.get("amount", 0)
    captured_status = payment_data.get("status", "")

    if not order_id:
        return JsonResponse({"ok": True, "noop": "no order_id"})

    invoice = Invoice.objects.filter(razorpay_order_id=order_id).first()
    if not invoice:
        return JsonResponse({"ok": True, "noop": "no matching invoice"})

    amount = Decimal(amount_paise) / Decimal("100")

    with transaction.atomic():
        payment, created = Payment.objects.get_or_create(
            invoice=invoice, razorpay_payment_id=payment_id,
            defaults={
                "hospital": invoice.hospital,
                "amount": amount,
                "method": "RAZORPAY",
                "status": "SUCCESS" if captured_status == "captured" else "FAILED",
                "razorpay_order_id": order_id,
                "is_signature_verified": True,
                "notes": f"Webhook event: {event}",
            },
        )
        if created and payment.status == "SUCCESS":
            invoice.amount_paid = (invoice.amount_paid or Decimal("0")) + amount
            invoice.update_payment_status()

    return JsonResponse({"ok": True, "event": event, "invoice": invoice.code})
