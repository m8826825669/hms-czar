from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register("theatres", views.OperationTheatreViewSet, basename="theatre")
router.register("procedures", views.SurgicalProcedureViewSet, basename="procedure")
router.register("bookings", views.SurgeryBookingViewSet, basename="surgery-booking")
router.register("team-members", views.SurgeryTeamViewSet, basename="surgery-team")
router.register("consumables", views.OTConsumableViewSet, basename="ot-consumable")

urlpatterns = [
    path("", include(router.urls)),
]
