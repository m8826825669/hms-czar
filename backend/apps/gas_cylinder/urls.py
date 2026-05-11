from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register("cylinder-types", views.CylinderTypeViewSet, basename="cylinder-type")
router.register("cylinders", views.CylinderViewSet, basename="cylinder")
router.register("usage", views.CylinderUsageViewSet, basename="cylinder-usage")
router.register("refills", views.RefillRecordViewSet, basename="refill")

urlpatterns = [
    path("", include(router.urls)),
    path("inventory/", views.cylinder_inventory, name="cylinder-inventory"),
]
