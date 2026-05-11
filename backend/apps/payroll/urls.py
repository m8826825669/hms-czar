from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register("components", views.SalaryComponentViewSet, basename="salary-component")
router.register("structures", views.SalaryStructureViewSet, basename="salary-structure")
router.register("runs", views.PayrollRunViewSet, basename="payroll-run")
router.register("payslips", views.PayslipViewSet, basename="payslip")
router.register("loans", views.LoanAdvanceViewSet, basename="loan")

urlpatterns = [path("", include(router.urls))]
