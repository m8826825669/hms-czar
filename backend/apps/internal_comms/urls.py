from django.urls import path, include
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("messages", views.MessageViewSet, basename="ic-message")
router.register("bulletins", views.BulletinViewSet, basename="ic-bulletin")
router.register("acknowledgments", views.BulletinAcknowledgmentViewSet,
                basename="ic-ack")

urlpatterns = [
    path("", include(router.urls)),
]
