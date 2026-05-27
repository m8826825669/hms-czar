from django.urls import path, include
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("notes", views.NursingNoteViewSet, basename="nursing-note")
router.register("medications", views.MedicationAdministrationViewSet, basename="medication-admin")
router.register("handovers", views.ShiftHandoverViewSet, basename="shift-handover")

urlpatterns = [
    path("", include(router.urls)),
]
