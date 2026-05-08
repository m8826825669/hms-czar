from rest_framework.routers import DefaultRouter
from django.urls import path, include
from . import views

router = DefaultRouter()
router.register("tests", views.TestCatalogViewSet, basename="lab-test")
router.register("parameters", views.TestParameterViewSet, basename="lab-parameter")
router.register("orders", views.LabOrderViewSet, basename="lab-order")
router.register("samples", views.LabSampleViewSet, basename="lab-sample")
router.register("results", views.LabResultViewSet, basename="lab-result")

urlpatterns = [
    path("", include(router.urls)),
]
