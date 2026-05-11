from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register("ambulances", views.AmbulanceViewSet, basename="ambulance")
router.register("drivers", views.AmbulanceDriverViewSet, basename="amb-driver")
router.register("dispatches", views.DispatchViewSet, basename="dispatch")

urlpatterns = [path("", include(router.urls))]
