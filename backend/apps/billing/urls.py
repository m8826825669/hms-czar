"""Billing URL routes — Phase 1c + Phase 2b (Refunds) + Phase 2c (GST reports).

Phase 2c adds three GST endpoints to the existing billing routes:
  /api/billing/gst/gstr1/?year=2026&month=5    → GSTR-1 JSON
  /api/billing/gst/gstr3b/?year=2026&month=5   → GSTR-3B JSON
  /api/billing/gst/workbook/?year=2026&month=5 → .xlsx download

The Phase 1c/2b URL pattern below is preserved verbatim — only `gst_views`
imports and three new path() lines are added.
"""
from rest_framework.routers import DefaultRouter
from django.urls import path, include
from . import views, gst_views

router = DefaultRouter()
router.register("services", views.ServiceCatalogViewSet, basename="service")
router.register("invoices", views.InvoiceViewSet, basename="invoice")
router.register("payments", views.PaymentViewSet, basename="payment")
router.register("refunds", views.RefundViewSet, basename="refund")  # Phase 2b

urlpatterns = [
    path("", include(router.urls)),
    path("payments/verify/", views.verify_razorpay_payment, name="verify-razorpay"),
    path("webhooks/razorpay/", views.razorpay_webhook, name="razorpay-webhook"),

    # Phase 2c — GST reports
    path("gst/gstr1/", gst_views.gstr1_view, name="gst-gstr1"),
    path("gst/gstr3b/", gst_views.gstr3b_view, name="gst-gstr3b"),
    path("gst/workbook/", gst_views.gstr_workbook_view, name="gst-workbook"),
]
