from django.urls import path
from . import views

urlpatterns = [
    path("patient/<int:patient_id>/360/", views.patient_360, name="patient-360"),
]
