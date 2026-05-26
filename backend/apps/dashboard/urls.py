from django.urls import path
from . import views

app_name = "dashboard"

urlpatterns = [
    path("stats/",             views.stats,             name="stats"),
    path("ward-occupancy/",    views.ward_occupancy,    name="ward-occupancy"),
    path("recent-opd/",        views.recent_opd,        name="recent-opd"),
    path("ot-schedule/",       views.ot_schedule,       name="ot-schedule"),
    path("alerts/",            views.alerts,            name="alerts"),
    path("monthly-trend/",     views.monthly_trend,     name="monthly-trend"),
    path("opd-weekly/",        views.opd_weekly,        name="opd-weekly"),
    path("revenue-breakdown/", views.revenue_breakdown, name="revenue-breakdown"),
]
