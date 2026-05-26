from rest_framework.routers import DefaultRouter
from django.urls import path, include
from . import views, dashboard_views

router = DefaultRouter()
router.register("specialties",     views.SpecialtyViewSet,          basename="specialty")
router.register("qualifications",  views.QualificationViewSet,      basename="qualification")
router.register("doctors",         views.DoctorViewSet,             basename="doctor")
router.register("slots",           views.OPDSlotViewSet,            basename="opd-slot")
router.register("slot-exceptions", views.OPDSlotExceptionViewSet,   basename="slot-exception")
router.register("fees",            views.ConsultationFeeViewSet,    basename="consultation-fee")
router.register("on-call",         views.OnCallRosterViewSet,       basename="on-call")

urlpatterns = [
    # Doctor's per-day dashboard summary (must come before the router
    # include so it isn't shadowed by an empty-prefix viewset action).
    path("dashboard/today/", dashboard_views.doctor_dashboard_today,
         name="doctor-dashboard-today"),
    path("", include(router.urls)),
]
