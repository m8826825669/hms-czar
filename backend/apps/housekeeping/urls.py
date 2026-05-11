from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register("zones", views.HKZoneViewSet, basename="hk-zone")
router.register("staff", views.HKStaffViewSet, basename="hk-staff")
router.register("task-templates", views.HKTaskTemplateViewSet, basename="hk-template")
router.register("task-assignments", views.HKTaskAssignmentViewSet, basename="hk-assignment")
router.register("deep-cleanings", views.DeepCleaningScheduleViewSet,
                basename="hk-deep-cleaning")

urlpatterns = [
    path("", include(router.urls)),
    path("today-summary/", views.today_summary, name="hk-today-summary"),
    path("generate-daily-tasks/", views.generate_daily_tasks,
         name="hk-generate-daily"),
]
