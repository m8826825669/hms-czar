from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register("items", views.LinenItemViewSet, basename="linen-item")
router.register("stock", views.LinenStockViewSet, basename="linen-stock")
router.register("batches", views.LaundryBatchViewSet, basename="laundry-batch")
router.register("batch-items", views.LaundryBatchItemViewSet, basename="laundry-batch-item")
router.register("losses", views.LinenLossViewSet, basename="linen-loss")

urlpatterns = [
    path("", include(router.urls)),
    path("stock-summary/", views.stock_summary_view, name="laundry-stock-summary"),
]
