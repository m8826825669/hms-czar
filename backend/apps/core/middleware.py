"""HospitalContextMiddleware - resolves the current hospital for each request.

Strategy:
  1. If JWT contains hospital_id claim → use it.
  2. Else fall back to the default hospital (single-tenant deployment).
The hospital is attached to request.hospital for use everywhere.
"""
from django.conf import settings
from django.utils.deprecation import MiddlewareMixin


class HospitalContextMiddleware(MiddlewareMixin):
    def process_request(self, request):
        from apps.core.models import Hospital
        hospital = None
        # Prefer JWT user's hospital if available
        user = getattr(request, "user", None)
        if user and user.is_authenticated:
            hospital = getattr(user, "hospital", None)
        # Fallback: default hospital (single-tenant install)
        if not hospital:
            hospital = Hospital.objects.filter(
                code=settings.HMS_DEFAULT_HOSPITAL_CODE,
                is_active=True,
            ).first()
        request.hospital = hospital
        return None
