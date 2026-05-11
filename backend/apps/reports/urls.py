from rest_framework.routers import DefaultRouter
from django.urls import path, include
from . import views

router = DefaultRouter()
router.register("appointments", views.AppointmentViewSet, basename="appointment")
router.register("queue", views.QueueTokenViewSet, basename="queue-token")
router.register("visitor-passes", views.VisitorPassViewSet, basename="visitor-pass")

urlpatterns = [path("", include(router.urls))]
