from django.urls import path, include
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("departments", views.DepartmentViewSet, basename="department")
router.register("locations", views.LocationViewSet, basename="location")
router.register("patients", views.PatientViewSet, basename="patient")

urlpatterns = [
    path("health/", views.health_check, name="health"),
    path("hospital/", views.current_hospital, name="current-hospital"),
    path("", include(router.urls)),
]
