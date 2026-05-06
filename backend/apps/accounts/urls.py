from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView, TokenVerifyView

from . import views

router = DefaultRouter()
router.register("users", views.UserViewSet, basename="user")
router.register("roles", views.RoleViewSet, basename="role")

urlpatterns = [
    path("login/", views.HMSLoginView.as_view(), name="login"),
    path("refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("verify/", TokenVerifyView.as_view(), name="token-verify"),
    path("logout/", views.logout_view, name="logout"),
    path("me/", views.me_view, name="me"),
    path("change-password/", views.change_password, name="change-password"),
    path("", include(router.urls)),
]
