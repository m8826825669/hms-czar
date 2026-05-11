from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register("categories", views.AssetCategoryViewSet, basename="asset-category")
router.register("assets", views.AssetViewSet, basename="asset")
router.register("maintenance-logs", views.AssetMaintenanceLogViewSet, basename="asset-maint")
router.register("amcs", views.AMCViewSet, basename="amc")
router.register("disposals", views.AssetDisposalViewSet, basename="asset-disposal")

urlpatterns = [
    path("", include(router.urls)),
    path("metrics/", views.asset_metrics, name="asset-metrics"),
]
