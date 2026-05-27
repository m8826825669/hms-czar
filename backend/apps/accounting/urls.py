from django.urls import path, include
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("accounts", views.AccountViewSet, basename="acc-account")
router.register("journal-entries", views.JournalEntryViewSet, basename="acc-entry")

urlpatterns = [
    path("", include(router.urls)),
    path("reports/trial-balance/", views.TrialBalanceView.as_view(),
         name="acc-trial-balance"),
    path("reports/pl-summary/", views.ProfitLossSummaryView.as_view(),
         name="acc-pl-summary"),
]
