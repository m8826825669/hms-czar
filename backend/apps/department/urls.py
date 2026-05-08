from rest_framework.routers import DefaultRouter
from django.urls import path, include
from . import views

router = DefaultRouter()
router.register("departments", views.DepartmentViewSet, basename="department")

urlpatterns = [path("", include(router.urls))]
