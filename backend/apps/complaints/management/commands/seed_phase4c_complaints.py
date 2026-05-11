"""Seed complaints/feedback module — categories + sample tickets + NPS responses."""
import random
from datetime import timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.core.models import Hospital
from apps.complaints.models import TicketCategory, Ticket, TicketComment, NPSResponse
from apps.complaints.services import complaints_service


CATEGORIES = [
    {"code": "CLIN_CARE",  "name": "Clinical Care Quality",
     "default_priority": "HIGH",   "target_resolution_hours": 24,
     "description": "Issues related to medical care, doctor behaviour"},
    {"code": "NURSING",    "name": "Nursing Service",
     "default_priority": "MEDIUM", "target_resolution_hours": 48,
     "description": "Nurse behaviour, response time, attention"},
    {"code": "BILLING",    "name": "Billing & Charges",
     "default_priority": "HIGH",   "target_resolution_hours": 24,
     "description": "Billing disputes, GST, refunds, insurance"},
    {"code": "HYGIENE",    "name": "Hygiene & Housekeeping",
     "default_priority": "MEDIUM", "target_resolution_hours": 12,
     "description": "Room cleanliness, bathroom, linen"},
    {"code": "FOOD",       "name": "Dietary / Food",
     "default_priority": "MEDIUM", "target_resolution_hours": 24,
     "description": "Food quality, timing, dietary restrictions"},
    {"code": "FACILITY",   "name": "Facility / Infrastructure",
     "default_priority": "LOW",    "target_resolution_hours": 72,
     "description": "AC, electrical, plumbing, equipment"},
    {"code": "WAIT_TIME",  "name": "Wait Time / Delays",
     "default_priority": "MEDIUM", "target_resolution_hours": 48,
     "description": "OPD wait, appointment delays, diagnostics delay"},
    {"code": "PHARMACY",   "name": "Pharmacy / Medicines",
     "default_priority": "MEDIUM", "target_resolution_hours": 24,
     "description": "Medicine availability, dispensing errors"},
    {"code": "AMBULANCE",  "name": "Ambulance Service",
     "default_priority": "HIGH",   "target_resolution_hours": 24,
     "description": "Ambulance delays, equipment, driver"},
    {"code": "RECEPTION",  "name": "Reception & Communication",
     "default_priority": "LOW",    "target_resolution_hours": 48,
     "description": "Front desk staff, phone response"},
    {"code": "APPRECIATION","name": "Appreciation / Positive Feedback",
     "default_priority": "LOW",    "target_resolution_hours": 168,
     "description": "Praise for staff or service"},
    {"code": "SUGGESTION", "name": "Suggestion / Improvement",
     "default_priority": "LOW",    "target_resolution_hours": 168,
     "description": "Constructive suggestions"},
]


SAMPLE_TICKETS = [
    {"category": "BILLING", "title": "Discrepancy in IPD bill",
     "description": "Bill shows charge for surgery package + line items separately, totaling 18% more than quoted estimate.",
     "reporter_name": "Rakesh Mehra", "reporter_phone": "+919876511101",
     "source": "PATIENT", "priority": "HIGH"},
    {"category": "CLIN_CARE", "title": "Doctor did not explain diagnosis",
     "description": "Consultant rushed through visit, did not answer questions about treatment plan.",
     "reporter_name": "Anita Sharma", "reporter_phone": "+919876511102",
     "source": "PATIENT", "priority": "HIGH"},
    {"category": "HYGIENE", "title": "Bathroom not cleaned for 2 days",
     "description": "Room 204 bathroom shows visible stains and odour. Reported to nurse twice.",
     "reporter_name": "Suresh Kumar", "reporter_phone": "+919876511103",
     "source": "ATTENDANT", "priority": "MEDIUM"},
    {"category": "FOOD", "title": "Cold food served at dinner",
     "description": "Soup and dal served lukewarm despite being marked therapeutic diet.",
     "reporter_name": "Geeta Patel", "reporter_phone": "+919876511104",
     "source": "PATIENT", "priority": "MEDIUM"},
    {"category": "WAIT_TIME", "title": "3 hour wait for scheduled appointment",
     "description": "Appointment was at 10:30 AM, called in at 1:45 PM. No status update from reception.",
     "reporter_name": "Mohit Agarwal", "reporter_phone": "+919876511105",
     "source": "PATIENT", "priority": "MEDIUM"},
    {"category": "NURSING", "title": "Slow response to call bell",
     "description": "Pressed call bell at 2 AM for IV issue, nurse came after 25 minutes.",
     "reporter_name": "Pooja Singh", "reporter_phone": "+919876511106",
     "source": "PATIENT", "priority": "MEDIUM"},
    {"category": "PHARMACY", "title": "Wrong medicine dispensed",
     "description": "Prescription was for Atorvastatin 20mg, dispensed 40mg. Caught at home.",
     "reporter_name": "Naveen Joshi", "reporter_phone": "+919876511107",
     "source": "PATIENT", "priority": "URGENT"},
    {"category": "FACILITY", "title": "AC not working in OPD waiting area",
     "description": "Reception waiting hall AC malfunction during peak summer afternoon.",
     "reporter_name": "Rashmi Verma", "reporter_phone": "+919876511108",
     "source": "PATIENT", "priority": "LOW"},
    {"category": "APPRECIATION", "title": "Excellent care by Cardiology team",
     "description": "Dr. Priya Verma and Nurse Sunita Devi provided exceptional care during my mother's angioplasty.",
     "reporter_name": "Vikram Khurana", "reporter_phone": "+919876511109",
     "source": "PATIENT", "priority": "LOW"},
    {"category": "AMBULANCE", "title": "Ambulance arrived 40 mins late",
     "description": "Called for emergency pickup at 3 AM, ambulance arrived at 3:40 AM. ETA was 15 mins.",
     "reporter_name": "Suman Reddy", "reporter_phone": "+919876511110",
     "source": "PHONE", "priority": "URGENT"},
    {"category": "RECEPTION", "title": "Rude behaviour at front desk",
     "description": "Receptionist was abrupt when I asked about appointment rescheduling.",
     "reporter_name": "Pradeep Tiwari", "reporter_phone": "+919876511111",
     "source": "WALK_IN", "priority": "LOW"},
    {"category": "SUGGESTION", "title": "Add online prescription refill",
     "description": "Would be useful to refill regular medication online without OPD visit.",
     "reporter_name": "Kavita Mehta", "reporter_phone": "+919876511112",
     "source": "ONLINE", "priority": "LOW"},
    {"category": "BILLING", "title": "Cashless not approved by TPA",
     "description": "Insurance pre-auth was supposed to be done but TPA says no request received.",
     "reporter_name": "Amit Khanna", "reporter_phone": "+919876511113",
     "source": "PATIENT", "priority": "HIGH"},
    {"category": "CLIN_CARE", "title": "Discharge delayed by 6 hours",
     "description": "Discharge summary said morning but actual discharge happened in evening due to pharmacy and billing delays.",
     "reporter_name": "Lakshmi Iyer", "reporter_phone": "+919876511114",
     "source": "PATIENT", "priority": "MEDIUM"},
    {"category": "HYGIENE", "title": "Cockroach in OPD washroom",
     "description": "Saw cockroaches in the ground floor public washroom.",
     "reporter_name": "Rohan Bhatia", "reporter_phone": "+919876511115",
     "source": "PATIENT", "priority": "HIGH"},
]


NPS_FEEDBACK = [
    {"name": "Arjun Kapoor", "score": 10, "feedback": "Outstanding service, will definitely recommend."},
    {"name": "Meena Pillai",  "score": 9,  "feedback": "Great cardiology team, very professional."},
    {"name": "Deepak Rao",    "score": 9,  "feedback": "Smooth admission process, clean facilities."},
    {"name": "Sonia Kapur",   "score": 8,  "feedback": "Good overall, but billing could be faster."},
    {"name": "Harish Goyal",  "score": 8,  "feedback": "Doctors were thorough, food was average."},
    {"name": "Pallavi Joshi", "score": 7,  "feedback": "Mixed experience, some staff excellent, others not."},
    {"name": "Bharat Singh",  "score": 6,  "feedback": "Long wait times in OPD, otherwise fine."},
    {"name": "Nisha Aggarwal","score": 5,  "feedback": "Several issues with cleanliness and food quality."},
    {"name": "Kiran Desai",   "score": 4,  "feedback": "Disappointed, expected better communication from doctors."},
    {"name": "Ramesh Patil",  "score": 10, "feedback": "Excellent care by entire team, thank you!"},
    {"name": "Sushma Lal",    "score": 9,  "feedback": "Pharmacy and lab were quick. Very good."},
    {"name": "Vinay Sharma",  "score": 8,  "feedback": "Reasonable charges, good treatment."},
    {"name": "Aarti Kumari",  "score": 3,  "feedback": "Will not return — billing issues and rude staff."},
    {"name": "Mukesh Yadav",  "score": 7,  "feedback": "Treatment was good, infrastructure needs upgrade."},
    {"name": "Geetanjali R.", "score": 10, "feedback": "Best hospital I've been to in NCR."},
    {"name": "Hemant Kulkarni","score": 6, "feedback": "Doctor was good, but had to wait too long."},
    {"name": "Nita Suri",     "score": 9,  "feedback": "Maternity care was excellent."},
    {"name": "Tarun Bhargava","score": 7,  "feedback": "Decent. Cafeteria food was bad."},
    {"name": "Sangeeta Roy",  "score": 8,  "feedback": "Nursing staff was caring."},
    {"name": "Manish Pandey", "score": 9,  "feedback": "Lab reports were on time. Good experience."},
]


class Command(BaseCommand):
    help = "Seed complaints / feedback module"

    def handle(self, *args, **opts):
        hospital = Hospital.objects.first()
        if not hospital:
            self.stdout.write(self.style.ERROR("No hospital found. Run base seed first."))
            return

        self.stdout.write(self.style.SUCCESS("=== Seeding Complaints ==="))

        # Categories
        cat_map = {}
        for cat in CATEGORIES:
            obj, created = TicketCategory.objects.get_or_create(
                hospital=hospital, code=cat["code"],
                defaults={k: v for k, v in cat.items() if k != "code"})
            cat_map[cat["code"]] = obj
            if created:
                self.stdout.write(f"  + Category: {obj.code} — {obj.name}")
        self.stdout.write(self.style.SUCCESS(f"Categories: {len(CATEGORIES)}"))

        # Tickets — distribute across past 30 days
        now = timezone.now()
        ticket_count = 0
        resolved_count = 0
        for i, t in enumerate(SAMPLE_TICKETS):
            cat = cat_map[t["category"]]
            days_ago = random.randint(1, 30)
            created_at = now - timedelta(days=days_ago)
            ticket = complaints_service.create_ticket(
                hospital=hospital,
                category=cat,
                title=t["title"],
                description=t["description"],
                reporter_name=t["reporter_name"],
                reporter_phone=t["reporter_phone"],
                source=t["source"],
                priority=t["priority"],
            )
            # backdate
            Ticket.objects.filter(id=ticket.id).update(created_at=created_at)
            ticket_count += 1

            # Randomly resolve ~60% of older tickets
            if days_ago > 3 and random.random() < 0.6:
                ticket.refresh_from_db()
                resolution_time = created_at + timedelta(hours=random.randint(2, 72))
                Ticket.objects.filter(id=ticket.id).update(
                    status="RESOLVED",
                    resolved_at=resolution_time,
                    resolution=f"Investigated and addressed. {t['title'].lower()} has been resolved with appropriate action.",
                    is_sla_breached=resolution_time > ticket.target_resolution_at if ticket.target_resolution_at else False,
                )
                TicketComment.objects.create(
                    ticket=ticket,
                    author_name="HR Manager",
                    comment="Issue investigated, corrective action taken.",
                    is_status_change=True,
                )
                resolved_count += 1

                # And close ~50% of resolved
                if random.random() < 0.5:
                    Ticket.objects.filter(id=ticket.id).update(
                        status="CLOSED",
                        closed_at=resolution_time + timedelta(hours=2),
                        customer_satisfaction=random.randint(3, 5),
                    )

        self.stdout.write(self.style.SUCCESS(
            f"Tickets: {ticket_count} (resolved: {resolved_count})"))

        # NPS responses
        nps_count = 0
        for entry in NPS_FEEDBACK:
            days_ago = random.randint(1, 45)
            nps = complaints_service.submit_nps(
                hospital=hospital,
                reporter_name=entry["name"],
                score=entry["score"],
                feedback=entry["feedback"],
                related_visit_date=(now - timedelta(days=days_ago)).date(),
            )
            # backdate
            NPSResponse.objects.filter(id=nps.id).update(
                created_at=now - timedelta(days=days_ago))
            nps_count += 1
        self.stdout.write(self.style.SUCCESS(f"NPS responses: {nps_count}"))

        metrics = complaints_service.get_nps_metrics(hospital)
        self.stdout.write(self.style.SUCCESS(
            f"NPS score: {metrics['nps']} | avg: {metrics['avg_score']} | "
            f"P/Pa/D: {metrics['promoters']}/{metrics['passives']}/{metrics['detractors']}"))

        self.stdout.write(self.style.SUCCESS("=== Complaints seed complete ==="))
