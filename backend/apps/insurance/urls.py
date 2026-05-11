from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register("companies", views.InsuranceCompanyViewSet, basename="insurance-company")
router.register("tpas", views.TPAViewSet, basename="tpa")
router.register("policies", views.PolicyCoverageViewSet, basename="policy")
router.register("pre-auths", views.PreAuthViewSet, basename="pre-auth")
router.register("claims", views.ClaimViewSet, basename="claim")

urlpatterns = [
    path("", include(router.urls)),
    path("dashboard/", views.insurance_dashboard, name="insurance-dashboard"),
]
