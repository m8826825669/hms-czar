"""WebSocket consumer for live queue updates.

Broadcast pattern:
  group: queue_<hospital_id>          → all queue events for the hospital
  group: queue_<hospital_id>_d_<doc_id> → events for one doctor only

Connection URL examples:
  ws://localhost:8000/ws/queue/1/             (subscribe to all queue events for hospital 1)
  ws://localhost:8000/ws/queue/1/?doctor=5   (only doctor 5's queue)

Message payloads sent to clients:
  {
    "type": "TOKEN_UPDATED",
    "token": { ... QueueToken serialized ... },
    "ts": "2026-05-07T10:34:21+05:30"
  }
"""
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from django.utils import timezone


class QueueConsumer(AsyncJsonWebsocketConsumer):
    """Subscribes a client to live queue events for a hospital (optionally a specific
    doctor). Authentication relies on the Channels default scope - any logged-in user
    can subscribe; finer ACL can be added in Phase 2."""

    async def connect(self):
        self.hospital_id = self.scope["url_route"]["kwargs"]["hospital_id"]
        # Optional ?doctor=<id> filter
        query_string = self.scope.get("query_string", b"").decode()
        self.doctor_id = None
        for kv in query_string.split("&"):
            if kv.startswith("doctor="):
                try:
                    self.doctor_id = int(kv.split("=", 1)[1])
                except (ValueError, IndexError):
                    pass

        # Join the hospital-wide group
        self.hospital_group = f"queue_{self.hospital_id}"
        await self.channel_layer.group_add(self.hospital_group, self.channel_name)

        # Optionally also join doctor-scoped group
        self.doctor_group = None
        if self.doctor_id:
            self.doctor_group = f"queue_{self.hospital_id}_d_{self.doctor_id}"
            await self.channel_layer.group_add(self.doctor_group, self.channel_name)

        await self.accept()
        await self.send_json({"type": "CONNECTED",
                              "hospital_id": int(self.hospital_id),
                              "doctor_id": self.doctor_id})

    async def disconnect(self, code):
        try:
            await self.channel_layer.group_discard(self.hospital_group, self.channel_name)
            if self.doctor_group:
                await self.channel_layer.group_discard(self.doctor_group, self.channel_name)
        except Exception:
            pass

    async def queue_event(self, event):
        """Receives messages from group_send and forwards to client."""
        await self.send_json(event["data"])


# ───── Sync helper for views/services ─────────────────────────
def broadcast_queue_event(*, hospital_id: int, payload: dict, doctor_id: int | None = None):
    """Fire-and-forget broadcast from sync code (DRF views, Celery tasks).

    payload must be JSON-serializable. Adds `ts` field automatically.

    Calling from a view:
        broadcast_queue_event(
            hospital_id=request.hospital.id,
            payload={"type": "TOKEN_UPDATED", "token": serialized_token},
            doctor_id=doctor.id,
        )
    """
    channel_layer = get_channel_layer()
    if channel_layer is None:
        return  # No CHANNEL_LAYERS configured (unit-test mode)

    payload = {**payload, "ts": timezone.now().isoformat()}

    # Always broadcast to hospital-wide group
    async_to_sync(channel_layer.group_send)(
        f"queue_{hospital_id}",
        {"type": "queue.event", "data": payload},
    )

    # Also broadcast to doctor-scoped group if specified
    if doctor_id:
        async_to_sync(channel_layer.group_send)(
            f"queue_{hospital_id}_d_{doctor_id}",
            {"type": "queue.event", "data": payload},
        )
