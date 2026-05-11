from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register("shifts", views.ShiftViewSet, basename="shift")
router.register("holidays", views.HolidayViewSet, basename="holiday")
router.register("rosters", views.ShiftRosterViewSet, basename="roster")
router.register("logs", views.AttendanceLogViewSet, basename="att-log")
router.register("daily", views.DailyAttendanceViewSet, basename="daily-att")
router.register("overtime", views.OvertimeViewSet, basename="overtime")

urlpatterns = [
    path("", include(router.urls)),
    path("today-summary/", views.today_summary, name="att-today"),
]
