from rest_framework.routers import DefaultRouter
from django.urls import path, include
from . import views

router = DefaultRouter()
# IMPORTANT: register at "" not "departments".
# This module is included at /api/v1/departments/ in config/urls.py, so
# registering at "departments" would produce /api/v1/departments/departments/.
router.register("", views.DepartmentViewSet, basename="department")

urlpatterns = [path("", include(router.urls))]
