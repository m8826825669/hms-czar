"""WebSocket URL routing for OPD live queue."""
from django.urls import re_path
from .consumers import QueueConsumer

websocket_urlpatterns = [
    re_path(r"ws/queue/(?P<hospital_id>\d+)/$", QueueConsumer.as_asgi()),
]
