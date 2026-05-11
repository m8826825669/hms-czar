from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register("donors", views.BloodDonorViewSet, basename="blood-donor")
router.register("donations", views.BloodDonationViewSet, basename="blood-donation")
router.register("bags", views.BloodBagViewSet, basename="blood-bag")
router.register("requisitions", views.BloodRequisitionViewSet, basename="blood-requisition")
router.register("issues", views.BloodIssueViewSet, basename="blood-issue")

urlpatterns = [
    path("", include(router.urls)),
    path("inventory/", views.inventory_view, name="blood-inventory"),
    path("expire-old-bags/", views.expire_old_bags_view, name="blood-expire-old"),
]
