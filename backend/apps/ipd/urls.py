from rest_framework.routers import DefaultRouter
from django.urls import path, include
from . import views

router = DefaultRouter()
router.register("wards", views.WardViewSet, basename="ipd-ward")
router.register("rooms", views.RoomViewSet, basename="ipd-room")
router.register("beds", views.BedViewSet, basename="ipd-bed")
router.register("admissions", views.AdmissionViewSet, basename="ipd-admission")
router.register("daily-charges", views.DailyChargeViewSet, basename="ipd-daily-charge")
router.register("services", views.AdmissionServiceViewSet, basename="ipd-service")

urlpatterns = [path("", include(router.urls))]
