from rest_framework.routers import DefaultRouter
from django.urls import path, include
from . import views

router = DefaultRouter()
router.register("batches", views.DrugBatchViewSet, basename="drug-batch")
router.register("movements", views.StockMovementViewSet, basename="stock-movement")
router.register("orders", views.PharmacyOrderViewSet, basename="pharmacy-order")

urlpatterns = [
    path("", include(router.urls)),
    path("dashboard/", views.pharmacy_dashboard, name="pharmacy-dashboard"),
    path("receive-stock/", views.receive_stock, name="receive-stock"),
    path("drugs/<int:drug_id>/availability/", views.drug_availability, name="drug-availability"),
    path("allocate-preview/", views.allocate_preview, name="allocate-preview"),
    path("reports/low-stock/", views.low_stock_report, name="low-stock"),
    path("reports/near-expiry/", views.near_expiry_report, name="near-expiry"),
]
