from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register("vaccines", views.VaccineViewSet, basename="vaccine")
router.register("schedules", views.ImmunizationScheduleViewSet, basename="schedule")
router.register("records", views.VaccinationRecordViewSet, basename="vac-record")

urlpatterns = [
    path("", include(router.urls)),
    path("patient/<int:patient_id>/history/", views.patient_history,
         name="vac-patient-history"),
]
