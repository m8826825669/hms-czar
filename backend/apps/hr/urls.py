from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register("designations", views.DesignationViewSet, basename="designation")
router.register("employees", views.EmployeeViewSet, basename="employee")
router.register("contracts", views.EmploymentContractViewSet, basename="contract")
router.register("leave-types", views.LeaveTypeViewSet, basename="leave-type")
router.register("leave-balances", views.LeaveBalanceViewSet, basename="leave-balance")
router.register("leave-requests", views.LeaveRequestViewSet, basename="leave-request")

urlpatterns = [path("", include(router.urls))]
