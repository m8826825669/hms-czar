from django.urls import path, include
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("codes", views.EmergencyCodeViewSet, basename="crisis-code")
router.register("activations", views.CodeActivationViewSet, basename="crisis-activation")
router.register("drills", views.DrillViewSet, basename="crisis-drill")

urlpatterns = [
    path("", include(router.urls)),
]
