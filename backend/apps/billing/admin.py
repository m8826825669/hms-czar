from django.contrib import admin
from .models import ServiceCatalog, Invoice, InvoiceItem, Payment, Refund


@admin.register(ServiceCatalog)
class ServiceCatalogAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "category", "price", "gst_rate", "is_active")
    list_filter = ("category", "is_active", "is_taxable")
    search_fields = ("code", "name")


class InvoiceItemInline(admin.TabularInline):
    model = InvoiceItem
    extra = 0
    readonly_fields = ("subtotal", "gst_amount", "total")


class PaymentInline(admin.TabularInline):
    model = Payment
    extra = 0
    readonly_fields = ("razorpay_payment_id", "is_signature_verified")


class RefundInline(admin.TabularInline):
    model = Refund
    extra = 0
    fields = ("code", "amount", "method", "status", "approved_at", "processed_at")
    readonly_fields = ("code", "approved_at", "processed_at")


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ("code", "patient", "bill_date", "total_amount",
                    "amount_paid", "amount_refunded", "amount_due", "status")
    list_filter = ("status", "bill_date", "gst_split")
    search_fields = ("code", "patient__mrn", "patient__first_name", "patient__last_name")
    date_hierarchy = "bill_date"
    raw_id_fields = ("patient", "consultation", "appointment")
    readonly_fields = ("subtotal", "taxable_amount", "cgst_amount", "sgst_amount",
                       "igst_amount", "total_amount", "amount_paid", "amount_refunded",
                       "amount_due", "razorpay_order_id", "printed_at")
    inlines = [InvoiceItemInline, PaymentInline, RefundInline]


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ("invoice", "amount", "method", "status", "received_at")
    list_filter = ("method", "status", "received_at")
    search_fields = ("invoice__code", "razorpay_payment_id", "reference")


@admin.register(Refund)
class RefundAdmin(admin.ModelAdmin):
    list_display = ("code", "invoice", "amount", "method", "status",
                    "requested_at", "processed_at")
    list_filter = ("status", "method", "requested_at")
    search_fields = ("code", "invoice__code", "reason")
    raw_id_fields = ("invoice", "payment")
    readonly_fields = ("code", "approved_at", "processed_at",
                       "razorpay_refund_id", "razorpay_status")
