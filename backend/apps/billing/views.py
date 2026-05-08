"""Billing views (Phase 1c + Phase 2b Refunds).

Phase 1c flows preserved verbatim. Phase 2b additions:
- POST /invoices/<id>/request-refund/  → create Refund (REQUESTED status)
- POST /refunds/<id>/approve/          → manager approves → APPROVED
- POST /refunds/<id>/process/          → execute refund (cash/Razorpay)
- POST /refunds/<id>/reject/           → reject with reason
- RefundViewSet                        → list/filter all refunds
"""
from datetime import date
from decimal import Decimal
from django.conf import settings
from django.db import transaction
from django.http import HttpResponse, JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from rest_framework import viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response

from apps.core.views import TenantScopedViewSetMixin
from apps.notifications.tasks import send_template_notification
from .models import ServiceCatalog, Invoice, InvoiceItem, Payment, Refund
from .serializers import (ServiceCatalogSerializer, InvoiceSerializer,
                          InvoiceItemSerializer, PaymentSerializer,
                          RefundSerializer)
from .services.razorpay_service import (
    create_order as rzp_create_order,
    verify_payment_signature as rzp_verify_sig,
    verify_webhook_signature as rzp_verify_webhook,
    refund_payment as rzp_refund_payment,
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
    ).prefetch_related("items", "payments", "refunds")
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

    @action(detail=True, methods=["post"], url_path="add-item")
    def add_item(self, request, pk=None):
        invoice = self.get_object()
        if invoice.status not in ("DRAFT", "PENDING", "PARTIAL"):
            return Response({"detail": f"Cannot modify {invoice.status} invoice"}, status=400)

        data = {**request.data, "invoice": invoice.id}
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
        return Response(InvoiceSerializer(invoice).data, status=201)

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

    @action(detail=True, methods=["post"])
    def finalize(self, request, pk=None):
        invoice = self.get_object()
        if invoice.status != "DRAFT":
            return Response({"detail": "Only DRAFT can be finalized"}, status=400)
        if invoice.items.count() == 0:
            return Response({"detail": "Cannot finalize empty invoice"}, status=400)
        invoice.recalculate_totals()
        invoice.status = "PENDING"
        invoice.save(update_fields=["status"])

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
            return Response({"detail": "Cannot cancel paid invoice. Use refund."},
                            status=400)
        invoice.status = "CANCELLED"
        invoice.cancelled_reason = request.data.get("reason", "")
        invoice.save(update_fields=["status", "cancelled_reason"])
        return Response(InvoiceSerializer(invoice).data)

    @action(detail=True, methods=["post"], url_path="pay-cash")
    def pay_cash(self, request, pk=None):
        invoice = self.get_object()
        if invoice.status in ("CANCELLED", "REFUNDED"):
            return Response({"detail": "Cannot pay cancelled/refunded invoice"}, status=400)
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
        invoice = self.get_object()
        if invoice.amount_due <= 0:
            return Response({"detail": "No amount due"}, status=400)
        if invoice.status == "CANCELLED":
            return Response({"detail": "Invoice cancelled"}, status=400)
        try:
            order = rzp_create_order(
                amount_inr=invoice.amount_due,
                receipt=invoice.code,
                notes={"invoice_id": str(invoice.id), "patient_mrn": invoice.patient.mrn},
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

    @action(detail=True, methods=["get"], url_path="print")
    def thermal_print(self, request, pk=None):
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
                for s in ["DRAFT", "PENDING", "PARTIAL", "PAID", "CANCELLED", "REFUNDED"]
            },
            "invoices": InvoiceSerializer(qs.order_by("-created_at")[:50], many=True).data,
        })

    # ──────────────────────────── PHASE 2b: REFUND REQUEST ────────────────────────
    @action(detail=True, methods=["post"], url_path="request-refund")
    def request_refund(self, request, pk=None):
        """Create a refund request. Requires approve+process steps to actually credit.

        Body: {amount, reason, method?, payment_id?}

        method defaults to:
          - RAZORPAY if linked payment is RAZORPAY (auto-detected)
          - CASH otherwise
        """
        invoice = self.get_object()
        amount = Decimal(str(request.data.get("amount", "0")))
        reason = request.data.get("reason", "").strip()
        if amount <= 0:
            return Response({"detail": "amount must be > 0"}, status=400)
        if not reason:
            return Response({"detail": "reason is required for refund"}, status=400)
        max_refundable = invoice.amount_paid - invoice.amount_refunded
        if amount > max_refundable:
            return Response({
                "detail": (
                    f"Cannot refund ₹{amount} — only ₹{max_refundable} refundable "
                    f"(paid: ₹{invoice.amount_paid}, "
                    f"already refunded: ₹{invoice.amount_refunded})"
                )
            }, status=400)

        # Pick the payment to refund against
        payment_id = request.data.get("payment_id")
        payment = None
        if payment_id:
            payment = invoice.payments.filter(id=payment_id, status="SUCCESS").first()
        else:
            payment = invoice.payments.filter(status="SUCCESS").order_by("-received_at").first()

        method = request.data.get("method")
        if not method:
            method = "RAZORPAY" if (payment and payment.method == "RAZORPAY"
                                    and payment.razorpay_payment_id) else "CASH"

        refund = Refund.objects.create(
            hospital=request.hospital,
            created_by=request.user,
            code=Refund.generate_code(request.hospital, date.today()),
            invoice=invoice,
            payment=payment,
            amount=amount,
            method=method,
            reason=reason,
            status="REQUESTED",
        )
        return Response(RefundSerializer(refund).data, status=201)


class PaymentViewSet(TenantScopedViewSetMixin, viewsets.ReadOnlyModelViewSet):
    queryset = Payment.objects.select_related("invoice__patient")
    serializer_class = PaymentSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["invoice", "method", "status"]
    ordering_fields = ["-received_at"]


# ─────────────────────────── PHASE 2b: REFUND VIEWSET ────────────────────────────

class RefundViewSet(TenantScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = Refund.objects.select_related(
        "invoice__patient", "payment", "approved_by",
    )
    serializer_class = RefundSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ["code", "invoice__code", "invoice__patient__mrn",
                     "invoice__patient__first_name", "invoice__patient__last_name"]
    filterset_fields = ["status", "method", "invoice"]
    ordering_fields = ["-created_at"]

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        """Manager approves a REQUESTED refund. Doesn't actually process —
        that's a separate step (process/) so we can review before crediting."""
        refund = self.get_object()
        if refund.status != "REQUESTED":
            return Response({"detail": f"Cannot approve {refund.status} refund"},
                            status=400)
        refund.status = "APPROVED"
        refund.approved_at = timezone.now()
        refund.approved_by = request.user
        refund.save(update_fields=["status", "approved_at", "approved_by"])
        return Response(RefundSerializer(refund).data)

    @action(detail=True, methods=["post"])
    def process(self, request, pk=None):
        """Execute the refund. For Razorpay: calls refund API.
        For Cash: just records the disbursement.
        """
        refund = self.get_object()
        if refund.status != "APPROVED":
            return Response({"detail": f"Cannot process {refund.status} refund"},
                            status=400)

        with transaction.atomic():
            if refund.method == "RAZORPAY":
                if not refund.payment or not refund.payment.razorpay_payment_id:
                    return Response({
                        "detail": "Razorpay refund requires linked payment with payment_id"
                    }, status=400)
                try:
                    rzp_result = rzp_refund_payment(
                        payment_id=refund.payment.razorpay_payment_id,
                        amount_inr=refund.amount,
                        notes={"refund_code": refund.code,
                               "invoice": refund.invoice.code},
                    )
                except Exception as e:
                    return Response({"detail": f"Razorpay refund failed: {e}"},
                                    status=502)

                refund.razorpay_refund_id = rzp_result.get("id", "")
                refund.razorpay_status = rzp_result.get("status", "")

            # All methods: update invoice + refund record
            invoice = refund.invoice
            invoice.amount_refunded = (invoice.amount_refunded or Decimal("0")) + refund.amount
            invoice.amount_paid = (invoice.amount_paid or Decimal("0")) - refund.amount
            invoice.update_payment_status()

            refund.status = "PROCESSED"
            refund.processed_at = timezone.now()
            refund.save(update_fields=["status", "processed_at",
                                        "razorpay_refund_id", "razorpay_status"])

        return Response(RefundSerializer(refund).data)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        refund = self.get_object()
        if refund.status not in ("REQUESTED", "APPROVED"):
            return Response({"detail": f"Cannot reject {refund.status} refund"},
                            status=400)
        refund.status = "REJECTED"
        refund.rejection_reason = request.data.get("reason", "")
        refund.save(update_fields=["status", "rejection_reason"])
        return Response(RefundSerializer(refund).data)

    @action(detail=False, methods=["get"])
    def pending(self, request):
        """Refunds awaiting action (REQUESTED or APPROVED)."""
        qs = self.get_queryset().filter(status__in=["REQUESTED", "APPROVED"])
        return Response(RefundSerializer(qs, many=True).data)


# ─── Standalone API views (Phase 1c, preserved) ────────────────────────────────

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def verify_razorpay_payment(request):
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
    is_valid = rzp_verify_sig(order_id=order_id, payment_id=payment_id, signature=signature)
    payment_status = "SUCCESS" if is_valid else "FAILED"
    with transaction.atomic():
        payment, created = Payment.objects.get_or_create(
            invoice=invoice, razorpay_payment_id=payment_id,
            defaults={
                "hospital": request.hospital, "created_by": request.user,
                "amount": invoice.amount_due, "method": "RAZORPAY",
                "status": payment_status, "razorpay_order_id": order_id,
                "razorpay_signature": signature,
                "is_signature_verified": is_valid,
            },
        )
        if is_valid and created:
            invoice.amount_paid = (invoice.amount_paid or Decimal("0")) + payment.amount
            invoice.update_payment_status()
            if invoice.status == "PAID" and invoice.patient.phone:
                send_template_notification.delay(
                    code="PAYMENT_RECEIVED", channel="SMS",
                    ctx={"patient_name": invoice.patient.full_name,
                         "amount": f"{invoice.total_amount:.2f}", "code": invoice.code},
                    to=invoice.patient.phone, hospital_id=request.hospital.id,
                    related_object_type="invoice", related_object_id=str(invoice.id),
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
    signature = request.headers.get("X-Razorpay-Signature", "")
    body = request.body
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
                "hospital": invoice.hospital, "amount": amount,
                "method": "RAZORPAY",
                "status": "SUCCESS" if captured_status == "captured" else "FAILED",
                "razorpay_order_id": order_id, "is_signature_verified": True,
                "notes": f"Webhook event: {event}",
            },
        )
        if created and payment.status == "SUCCESS":
            invoice.amount_paid = (invoice.amount_paid or Decimal("0")) + amount
            invoice.update_payment_status()
    return JsonResponse({"ok": True, "event": event, "invoice": invoice.code})
