from rest_framework.routers import DefaultRouter
from django.urls import path, include
from . import views

router = DefaultRouter()
router.register("services", views.ServiceCatalogViewSet, basename="service")
router.register("invoices", views.InvoiceViewSet, basename="invoice")
router.register("payments", views.PaymentViewSet, basename="payment")

urlpatterns = [
    path("", include(router.urls)),
    path("payments/verify/", views.verify_razorpay_payment, name="verify-razorpay"),
    path("webhooks/razorpay/", views.razorpay_webhook, name="razorpay-webhook"),
]
