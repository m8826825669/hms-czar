from django.urls import path, include
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("concerns", views.SafeguardingConcernViewSet, basename="prot-concern")
router.register("notes", views.ConcernNoteViewSet, basename="prot-note")
router.register("referrals", views.ConcernReferralViewSet, basename="prot-referral")

urlpatterns = [
    path("", include(router.urls)),
]
