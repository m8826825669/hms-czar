"""WebSocket URL routing.

Phase 0: empty. Modules will register their consumers here as they're built:
  - OT live board (Phase 2)
  - Crisis / code-blue alerts (Phase 5)
  - Internal comms (Phase 5)
"""
from django.urls import re_path

websocket_urlpatterns: list = [
    # re_path(r"ws/ot/board/$", OTBoardConsumer.as_asgi()),
    # re_path(r"ws/crisis/alerts/$", CrisisAlertConsumer.as_asgi()),
    # re_path(r"ws/comms/(?P<channel_id>[^/]+)/$", CommsConsumer.as_asgi()),
]
