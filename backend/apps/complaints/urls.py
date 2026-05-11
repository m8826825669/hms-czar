from rest_framework.routers import DefaultRouter
from django.urls import path, include
from .views import (
    TicketCategoryViewSet, TicketViewSet, TicketCommentViewSet,
    NPSResponseViewSet, nps_metrics, tickets_dashboard,
)

router = DefaultRouter()
router.register(r"categories",  TicketCategoryViewSet)
router.register(r"tickets",     TicketViewSet)
router.register(r"comments",    TicketCommentViewSet)
router.register(r"nps",         NPSResponseViewSet)

urlpatterns = [
    path("", include(router.urls)),
    path("nps-metrics/",     nps_metrics,         name="nps-metrics"),
    path("tickets-dashboard/", tickets_dashboard, name="tickets-dashboard"),
]
