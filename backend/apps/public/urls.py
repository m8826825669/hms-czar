from django.urls import path
from . import views

urlpatterns = [
    path("rx/<uuid:uuid>/", views.public_prescription, name="public-rx"),
    path("queue/<int:hospital_id>/", views.public_queue, name="public-queue"),
]
