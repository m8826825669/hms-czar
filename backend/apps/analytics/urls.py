from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    DashboardView, KPIView, WidgetView,
    ReportTypesView, RunReportView,
    SavedReportViewSet, ReportRunViewSet, DashboardWidgetViewSet,
    GoLiveChecklistView,
)


router = DefaultRouter()
router.register(r"saved-reports", SavedReportViewSet, basename="saved-report")
router.register(r"runs", ReportRunViewSet, basename="report-run")
router.register(r"widgets", DashboardWidgetViewSet, basename="dashboard-widget")


urlpatterns = [
    path("dashboard/",           DashboardView.as_view(),       name="analytics-dashboard"),
    path("kpis/",                KPIView.as_view(),             name="analytics-kpis"),
    path("widget/<str:metric>/", WidgetView.as_view(),          name="analytics-widget"),
    path("report-types/",        ReportTypesView.as_view(),     name="analytics-report-types"),
    path("run-report/",          RunReportView.as_view(),       name="analytics-run-report"),
    path("go-live-checklist/",   GoLiveChecklistView.as_view(), name="analytics-go-live"),

    path("", include(router.urls)),
]
