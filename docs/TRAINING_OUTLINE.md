# End-User Training Outline — HMS Phase 0–4d

Audience: hospital operational staff (reception, doctors, nurses, pharmacy, lab, billing, HR, IT/admin).
Duration: 4 weeks (3 weeks before cutover + 1 week reinforcement after).
Approach: train-the-trainer + role-based hands-on workshops on a staging copy.

## Week 1 — Foundation + Reception/OPD

### Day 1 — System overview (all staff, 90 min)
- The 26-module landscape; how modules talk to each other
- Login, password rules, two-factor (if enabled)
- Navigation, search, notifications
- How to report bugs and feature gaps (channel + template)

### Day 2 — Reception staff (2 hr)
- Patient registration: walk-in vs appointment, ABHA capture, photo
- Appointment booking, doctor slot view
- Queue management dashboard, token issuance
- Visitor pass + ID generation
- *Hands-on*: register 10 mock patients, generate 10 tokens

### Day 3 — OPD doctors (2 hr)
- Token-call workflow, vitals entry
- Encounter creation, SOAP notes, ICD-10 coding
- Prescription writing, drug interaction warnings
- Referral creation, follow-up scheduling
- *Hands-on*: complete 5 mock encounters end-to-end

### Day 4 — Nursing staff (2 hr)
- Vitals capture on tablet/desktop
- Triage scoring, priority queue routing
- Wound-care notes attached to encounters
- *Hands-on*: take vitals on 5 mock patients, route 2 to emergency triage

### Day 5 — Review + Q&A (1 hr, all Week 1 attendees)

## Week 2 — Clinical & ancillary modules

### Day 6 — Pharmacy staff (3 hr)
- GRN (goods receipt) with batch and expiry
- Dispense workflow: prescription → batch FEFO → invoice
- Stock-take, expiry alerts, low-stock report
- Return-to-supplier process
- *Hands-on*: receive a 20-line GRN, dispense 5 prescriptions

### Day 7 — Lab technicians (3 hr)
- Order intake, sample collection labeling
- Result entry — text, numeric, range-checked, reference panel
- Result verification + report PDF
- Reagent inventory link
- *Hands-on*: process 5 lab orders from order to printed report

### Day 8 — IPD nurses (3 hr)
- Admission flow: ward → bed assignment → consent forms
- Daily nursing notes, medication administration record (MAR)
- Discharge summary, bill consolidation, follow-up referral
- Bed turnover and housekeeping handoff
- *Hands-on*: admit, manage 1 day of care, discharge 3 mock patients

### Day 9 — Billing cashiers (3 hr)
- Invoice generation: OPD, IPD, pharmacy, lab, OT
- GST handling (intra/inter-state), TPA pricing
- Razorpay payment, cash/card receipt
- Refund workflow with approval matrix
- Day-end cashier reconciliation
- *Hands-on*: generate 10 invoices spanning all departments, process refund

### Day 10 — Review + role-play scenarios (2 hr)

## Week 3 — Operational, HR & analytics

### Day 11 — OT scheduling (2 hr)
- Theatre calendar, surgeon + anaesthetist availability
- Pre-op checklist, consent, fasting
- Intra-op notes, instrument check, post-op handover
- *Hands-on*: schedule 3 OT cases, run through to closure

### Day 12 — Blood bank + Ambulance + Diet + Laundry + Gas (2 hr)
- Blood donor registration, screening, issue workflow
- Ambulance dispatch + trip log
- Diet planning per ward/patient
- Laundry pickup, count, return cycle
- Gas cylinder refill log
- *Hands-on*: 1 transaction per module

### Day 13 — Inventory + Assets + Housekeeping (2 hr)
- Multi-store inventory, transfer requests, indents
- Asset register, depreciation schedule, AMC tracking
- Housekeeping room schedule, infection-control logs
- *Hands-on*: full indent → approval → issue cycle

### Day 14 — HR + Payroll + Attendance (2 hr)
- Employee onboarding, document upload
- Daily attendance, biometric/manual punch
- Leave application → approval → balance
- Monthly payroll run, payslip generation, PF/ESI/TDS
- Security incident logging
- *Hands-on*: full month-end payroll dry-run

### Day 15 — Insurance + Vaccination + Complaints (1.5 hr)
- TPA cashless intake, claim creation, document upload
- Vaccination schedule + AEFI capture
- Complaint logging, SLA tracking, escalation
- *Hands-on*: 1 cashless claim end-to-end

### Day 16 — Super-admin / hospital management (3 hr)
- `/dashboard/analytics` — interpreting all 14 widgets
- `/dashboard/reports` — running, saving, scheduling
- Go-live checklist re-runs, monthly readiness review
- User management, role assignment, audit log review
- Backup and disaster recovery awareness
- *Hands-on*: build 2 custom reports, walk through go-live checklist

## Week 4 — Cutover support + reinforcement

- T-7 to T-3: open lab hours twice a day for hands-on practice
- T-2 to T-0: floor walkers — 1 super-user per ward, present during shift
- T+1 to T+7: daily 15-min stand-ups with each department, capture friction
- T+7: review training gaps and schedule top-up modules

## Training materials checklist

- [ ] One-page quick reference card per role
- [ ] Screen-recorded videos for top 10 workflows
- [ ] Printed step-by-step manuals for reception and pharmacy (most printed-out reliance)
- [ ] Sandbox URL with reset-nightly demo data
- [ ] Glossary of system terms (token, encounter, dispense, indent, claim)
- [ ] FAQ document maintained by the trainer; weekly diff distributed

## Train-the-trainer cadre

- 1 super-user per department, identified at T-30 days
- Attends weeks 1–3 in full, plus an extra 2 hr session per week on troubleshooting
- Authority to escalate to IT vendor without ticket queue during cutover week
- Continues as the in-house product champion post-cutover

## Sign-off

Each attendee signs an attendance + competency sheet at end of week 3. Department head sign-off required before the user is granted production access.
