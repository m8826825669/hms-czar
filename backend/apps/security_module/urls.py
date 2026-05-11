from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register("guards", views.SecurityGuardViewSet, basename="guard")
router.register("visitor-passes", views.VisitorPassViewSet, basename="visitor-pass")
router.register("gate-passes", views.GatePassViewSet, basename="gate-pass")
router.register("incidents", views.IncidentViewSet, basename="incident")

urlpatterns = [
    path("", include(router.urls)),
    path("dashboard/", views.security_dashboard, name="security-dashboard"),
]
