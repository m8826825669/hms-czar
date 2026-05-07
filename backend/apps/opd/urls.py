from rest_framework.routers import DefaultRouter
from django.urls import path, include
from . import views

router = DefaultRouter()
router.register("vitals", views.VitalsViewSet, basename="vitals")
router.register("consultations", views.ConsultationViewSet, basename="consultation")
router.register("diagnoses", views.ConsultationDiagnosisViewSet, basename="cons-dx")
router.register("drugs", views.DrugMasterViewSet, basename="drug")
router.register("prescriptions", views.PrescriptionViewSet, basename="prescription")
router.register("prescription-items", views.PrescriptionItemViewSet, basename="rx-item")

urlpatterns = [path("", include(router.urls))]
