from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register("diet-types", views.DietTypeViewSet, basename="diet-type")
router.register("meal-items", views.MealItemViewSet, basename="meal-item")
router.register("diet-plans", views.DietPlanViewSet, basename="diet-plan")
router.register("patient-meals", views.PatientMealViewSet, basename="patient-meal")
router.register("kitchen-orders", views.KitchenOrderViewSet, basename="kitchen-order")

urlpatterns = [
    path("", include(router.urls)),
    path("kitchen-today/", views.kitchen_today, name="kitchen-today"),
    path("generate-all-meals/", views.generate_all_meals_today, name="generate-all-meals"),
]
