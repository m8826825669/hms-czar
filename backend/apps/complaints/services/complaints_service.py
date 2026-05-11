"""Complaints / feedback service — ticket workflow."""
from datetime import timedelta
from django.db import transaction
from django.utils import timezone

from ..models import Ticket, TicketComment, TicketCategory, NPSResponse


def _gen_ticket_code(hospital):
    today = timezone.now()
    prefix = f"TKT-{today.strftime('%Y%m%d')}"
    last = (Ticket.objects.filter(hospital=hospital, code__startswith=prefix)
            .order_by("-id").first())
    if last:
        try:
            n = int(last.code.split("-")[-1]) + 1
        except (ValueError, IndexError):
            n = 1
    else:
        n = 1
    return f"{prefix}-{n:04d}"


@transaction.atomic
def create_ticket(*, hospital, category, title, description, reporter_name,
                  source="PATIENT", reporter_phone="", reporter_email="",
                  related_patient=None, related_department=None,
                  related_staff_name="", priority=None, notes=""):
    """Create a new complaint/feedback ticket; computes SLA target."""
    if priority is None:
        priority = category.default_priority
    target = timezone.now() + timedelta(hours=category.target_resolution_hours)

    return Ticket.objects.create(
        hospital=hospital,
        code=_gen_ticket_code(hospital),
        category=category,
        title=title,
        description=description,
        source=source,
        reporter_name=reporter_name,
        reporter_phone=reporter_phone,
        reporter_email=reporter_email,
        related_patient=related_patient,
        related_department=related_department,
        related_staff_name=related_staff_name,
        priority=priority,
        target_resolution_at=target,
        notes=notes,
    )


@transaction.atomic
def assign_ticket(ticket, *, user, author=None, author_name=""):
    ticket.assigned_to = user
    ticket.assigned_at = timezone.now()
    if ticket.status == "OPEN":
        ticket.status = "IN_PROGRESS"
    ticket.save(update_fields=["assigned_to", "assigned_at", "status", "updated_at"])
    TicketComment.objects.create(
        ticket=ticket,
        author=author,
        author_name=author_name or (author.username if author else "system"),
        comment=f"Assigned to {user.get_full_name() or user.username}",
        is_internal=True,
        is_status_change=True,
    )
    return ticket


@transaction.atomic
def add_comment(ticket, *, comment, author=None, author_name="",
                is_internal=False, attachment_url=""):
    return TicketComment.objects.create(
        ticket=ticket,
        author=author,
        author_name=author_name or (author.username if author else "Anonymous"),
        comment=comment,
        is_internal=is_internal,
        attachment_url=attachment_url,
    )


@transaction.atomic
def resolve_ticket(ticket, *, resolution, author=None, author_name=""):
    now = timezone.now()
    ticket.status = "RESOLVED"
    ticket.resolution = resolution
    ticket.resolved_at = now
    if ticket.target_resolution_at and now > ticket.target_resolution_at:
        ticket.is_sla_breached = True
    ticket.save(update_fields=["status", "resolution", "resolved_at",
                                "is_sla_breached", "updated_at"])
    TicketComment.objects.create(
        ticket=ticket,
        author=author,
        author_name=author_name or (author.username if author else "system"),
        comment=f"Ticket resolved: {resolution[:200]}",
        is_status_change=True,
    )
    return ticket


@transaction.atomic
def close_ticket(ticket, *, satisfaction_rating=None, author=None,
                 author_name=""):
    ticket.status = "CLOSED"
    ticket.closed_at = timezone.now()
    if satisfaction_rating is not None:
        ticket.customer_satisfaction = max(1, min(5, int(satisfaction_rating)))
    ticket.save(update_fields=["status", "closed_at", "customer_satisfaction",
                                "updated_at"])
    TicketComment.objects.create(
        ticket=ticket,
        author=author,
        author_name=author_name or (author.username if author else "system"),
        comment="Ticket closed",
        is_status_change=True,
    )
    return ticket


@transaction.atomic
def reopen_ticket(ticket, *, reason, author=None, author_name=""):
    ticket.status = "REOPENED"
    ticket.resolved_at = None
    ticket.closed_at = None
    # Recompute SLA: extend by category SLA hours from now
    ticket.target_resolution_at = (timezone.now() +
        timedelta(hours=ticket.category.target_resolution_hours))
    ticket.is_sla_breached = False
    ticket.save()
    TicketComment.objects.create(
        ticket=ticket,
        author=author,
        author_name=author_name or (author.username if author else "system"),
        comment=f"Reopened: {reason}",
        is_status_change=True,
    )
    return ticket


def submit_nps(*, hospital, reporter_name, score, feedback="",
               patient=None, reporter_phone="", related_visit_date=None,
               related_department=None):
    """Submit NPS / feedback response."""
    return NPSResponse.objects.create(
        hospital=hospital,
        patient=patient,
        reporter_name=reporter_name,
        reporter_phone=reporter_phone,
        score=max(0, min(10, int(score))),
        feedback=feedback,
        related_visit_date=related_visit_date,
        related_department=related_department,
    )


def get_nps_metrics(hospital, *, since=None):
    """Compute NPS = %promoters - %detractors."""
    qs = NPSResponse.objects.filter(hospital=hospital)
    if since:
        qs = qs.filter(created_at__gte=since)
    total = qs.count()
    if not total:
        return {"total": 0, "promoters": 0, "passives": 0,
                "detractors": 0, "nps": 0, "avg_score": 0}
    promoters = qs.filter(score__gte=9).count()
    passives = qs.filter(score__gte=7, score__lte=8).count()
    detractors = qs.filter(score__lte=6).count()
    avg = sum(r.score for r in qs) / total
    nps = ((promoters - detractors) / total) * 100
    return {
        "total": total,
        "promoters": promoters,
        "passives": passives,
        "detractors": detractors,
        "nps": round(nps, 1),
        "avg_score": round(avg, 2),
    }
