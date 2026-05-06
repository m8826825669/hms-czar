# Hospital Management System — Complete Development & Deployment Roadmap

**Stack:** Django 5 + DRF + Next.js 15 + PostgreSQL 16 + Redis + Celery + Channels
**Architecture:** Modular Monolith (single Django backend with 26 apps, single Next.js frontend)
**Estimated Timeline:** 24–28 weeks for production-grade build (1 dev), 12–16 weeks (2–3 devs)

---

## Table of Contents

1. [Architecture & Why Modular Monolith](#1-architecture)
2. [Tech Stack — Final](#2-tech-stack)
3. [Project Structure](#3-project-structure)
4. [Database Strategy](#4-database-strategy)
5. [Auth & RBAC Design](#5-auth--rbac)
6. [Module-by-Module Specification (all 26)](#6-modules)
7. [Phased Development Plan](#7-phases)
8. [Cross-cutting Concerns](#8-cross-cutting)
9. [External Integrations](#9-integrations)
10. [Testing Strategy](#10-testing)
11. [Deployment Options](#11-deployment)
12. [CI/CD Pipeline](#12-cicd)
13. [Monitoring, Backup, Compliance](#13-monitoring)
14. [Phase 1 Kickoff Checklist](#14-kickoff)

---

## 1. Architecture

**Decision: Modular Monolith** (not microservices, not full monolith)

```
┌────────────────────────────────────────────────────────────┐
│                    Next.js 15 Frontend                      │
│        (App Router · TypeScript · Tailwind · shadcn/ui)     │
└────────────────────────┬───────────────────────────────────┘
                         │ REST + WebSocket
┌────────────────────────▼───────────────────────────────────┐
│                  Django 5 Backend (Gunicorn + Daphne)       │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Core (auth, audit, RBAC, hospital, notifications)   │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │  Clinical: reception, opd, ipd, ward, ot, emr,       │  │
│  │  nursing, specialist, blood_bank, research            │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │  Pharmacy & Inventory: pharmacy, stock, bottles      │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │  Support: dietary, laundry, ambulance, comms         │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │  HR: staff, payroll, leave_attendance                │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │  Security: crisis, protection, admin_security        │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │  Finance: billing, accounting                        │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │  Scheduling: arrangement_scheduling, mis_reports     │  │
│  └──────────────────────────────────────────────────────┘  │
└──────┬─────────────────┬──────────────────┬────────────────┘
       │                 │                  │
   PostgreSQL          Redis             Celery
  (single DB,      (cache, queue,       Workers
   schemas)        channels layer)    (async tasks)
```

**Why modular monolith over microservices:**

- Single transaction across modules (e.g., admit patient → allocate bed → start charges → notify nurse)
- One auth context, no service mesh complexity
- Single DB = no eventual-consistency headaches for clinical data
- Deployable on a single VPS initially (₹2–3K/month)
- Each app is independent enough to extract into a microservice later if scale demands

**When to extract microservices later:**
- Pharmacy (high transaction volume) → standalone
- MIS Reports (heavy queries) → read replica + separate service
- Notifications (async heavy) → separate worker pool

---

## 2. Tech Stack

### Backend
| Component | Choice | Why |
|-----------|--------|-----|
| Framework | Django 5.x + DRF | Maturity, ORM, admin, your familiarity |
| Auth | djangorestframework-simplejwt | JWT access + refresh, blacklist |
| Real-time | Django Channels + Daphne | OT live status, code-blue alerts, internal chat |
| Async | Celery + Redis | SMS, reports, billing reconciliation, scheduled jobs |
| Scheduler | django-celery-beat | Bed cleaning, medication reminders, attendance auto-mark |
| API Docs | drf-spectacular | OpenAPI 3.0 auto-gen |
| File Storage | django-storages + S3/MinIO | Reports, prescriptions, lab images |
| PDF | WeasyPrint (HTML→PDF) + ReportLab | Bills, prescriptions, discharge summaries |
| Excel | openpyxl + pandas | MIS exports |
| Search | PostgreSQL FTS → Elasticsearch (Phase 7+) | Patient search, drug search |
| Permissions | django-guardian or custom RBAC | Object-level perms |
| Audit | django-simple-history | Every clinical record needs history |

### Frontend
| Component | Choice |
|-----------|--------|
| Framework | Next.js 15 App Router + TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| Forms | react-hook-form + Zod |
| Data fetching | TanStack Query (React Query v5) |
| State | Zustand (UI state) + TanStack Query (server state) |
| Tables | TanStack Table v8 |
| Charts | Recharts (operational dashboards) + ECharts (MIS) |
| Date | date-fns + dayjs (Indian formats) |
| Real-time | native WebSocket + react-use-websocket |
| Auth | Custom JWT in httpOnly cookies via Next.js Route Handlers |
| Print | react-to-print + browser print stylesheets |

### Infrastructure
- **PostgreSQL 16** — single DB, can split read replicas later
- **Redis 7** — cache (django-redis), queue (Celery), channels layer
- **Nginx** — reverse proxy, static files, SSL termination
- **Docker Compose** — local dev + staging
- **MinIO / AWS S3** — file storage
- **Sentry** — error tracking (free tier sufficient initially)

---

## 3. Project Structure

```
hms/
├── backend/
│   ├── manage.py
│   ├── pyproject.toml
│   ├── docker/
│   │   ├── Dockerfile
│   │   └── entrypoint.sh
│   ├── config/                    # Django project root
│   │   ├── settings/
│   │   │   ├── base.py
│   │   │   ├── dev.py
│   │   │   ├── staging.py
│   │   │   └── prod.py
│   │   ├── urls.py
│   │   ├── asgi.py
│   │   ├── wsgi.py
│   │   └── celery.py
│   ├── apps/
│   │   ├── core/                  # Hospital, AuditLog, base models, permissions
│   │   ├── accounts/              # User, Role, Permission, JWT
│   │   ├── notifications/         # SMS, email, in-app, WhatsApp
│   │   │
│   │   ├── reception/
│   │   ├── opd/
│   │   ├── ipd/
│   │   ├── ward/
│   │   ├── ot/
│   │   ├── emr/
│   │   ├── nursing/
│   │   ├── specialist/
│   │   ├── blood_bank/
│   │   ├── research/
│   │   │
│   │   ├── pharmacy/              # Drug Store
│   │   ├── stock/                 # General stock + purchase
│   │   ├── bottles/               # O2 cylinders + IV bottles
│   │   │
│   │   ├── dietary/
│   │   ├── laundry/               # Clothing Mgmt
│   │   ├── ambulance/
│   │   ├── internal_comms/
│   │   │
│   │   ├── staff/                 # HR
│   │   ├── payroll/
│   │   ├── attendance/            # Leave + Attendance
│   │   │
│   │   ├── crisis/                # Code blue / disaster
│   │   ├── protection/            # Security guards / patrol
│   │   ├── admin_security/        # System access control
│   │   │
│   │   ├── billing/               # Charging
│   │   ├── accounting/            # Monetary Accounting
│   │   │
│   │   ├── scheduling/            # Arrangement Scheduling
│   │   └── reports/               # MIS Reports
│   ├── static/
│   ├── media/
│   └── tests/
│
├── frontend/
│   ├── package.json
│   ├── next.config.ts
│   ├── tailwind.config.ts
│   ├── src/
│   │   ├── app/
│   │   │   ├── (auth)/login, /forgot-password
│   │   │   ├── (admin)/dashboard, /staff, /reports, /settings
│   │   │   ├── (clinical)/opd, /ipd, /ward, /ot, /emr, /nursing
│   │   │   ├── (pharmacy)/pharmacy, /stock, /bottles
│   │   │   ├── (support)/dietary, /laundry, /ambulance
│   │   │   ├── (hr)/staff, /payroll, /attendance
│   │   │   ├── (security)/crisis, /protection, /access-control
│   │   │   ├── (finance)/billing, /accounting
│   │   │   ├── (specialist)/research, /blood-bank
│   │   │   └── api/                  # Next.js Route Handlers (proxy)
│   │   ├── components/
│   │   │   ├── ui/                   # shadcn/ui components
│   │   │   ├── shared/               # Tables, forms, dialogs
│   │   │   └── modules/              # Per-module components
│   │   ├── lib/
│   │   │   ├── api.ts                # Axios client with JWT refresh
│   │   │   ├── auth.ts
│   │   │   └── utils.ts
│   │   ├── hooks/
│   │   ├── stores/                   # Zustand stores
│   │   └── types/                    # TS types matching DRF schemas
│   └── public/
│
├── docker-compose.yml               # postgres, redis, backend, frontend, nginx
├── docker-compose.prod.yml
├── nginx/
│   └── nginx.conf
├── scripts/
│   ├── seed_data.py
│   ├── backup.sh
│   └── restore.sh
└── docs/
    ├── api/
    └── modules/
```

---

## 4. Database Strategy

**Single PostgreSQL DB**, ~200 tables. Use logical grouping via app prefixes (Django auto-prefixes table names with app label).

### Multi-tenancy approach
Even if you start with one hospital, design **multi-tenant from day 1**:

```python
# apps/core/models.py
class Hospital(models.Model):
    name = models.CharField(max_length=200)
    code = models.CharField(max_length=20, unique=True)
    address = models.TextField()
    gst_number = models.CharField(max_length=15, blank=True)
    timezone = models.CharField(max_length=50, default='Asia/Kolkata')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

class TenantBaseModel(models.Model):
    hospital = models.ForeignKey(Hospital, on_delete=models.PROTECT, related_name='+')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, related_name='+')
    is_active = models.BooleanField(default=True)

    class Meta:
        abstract = True
```

Every domain model inherits from `TenantBaseModel`. Use middleware to inject `request.hospital_id` from JWT claims, and a custom QuerySet manager to auto-filter by hospital.

### Critical shared models

```
core.Hospital, core.Department, core.Location (rooms, halls, OTs)
accounts.User, accounts.Role, accounts.UserRole, accounts.Permission
core.Patient (one record, referenced by all clinical modules — single source of truth)
core.AuditLog (every write is logged)
notifications.NotificationLog
```

### Patient as single source of truth

```python
# apps/core/models.py
class Patient(TenantBaseModel):
    mrn = models.CharField(max_length=20, unique=True)  # Medical Record Number
    abha_id = models.CharField(max_length=20, blank=True)  # ABDM
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    dob = models.DateField()
    gender = models.CharField(max_length=10, choices=GENDER_CHOICES)
    blood_group = models.CharField(max_length=5, blank=True)
    phone = models.CharField(max_length=15)
    aadhaar_last4 = models.CharField(max_length=4, blank=True)  # don't store full
    address = models.JSONField(default=dict)
    emergency_contact = models.JSONField(default=dict)
    allergies = models.JSONField(default=list)
    chronic_conditions = models.JSONField(default=list)
    photo = models.ImageField(upload_to='patients/', blank=True)
```

`OPDVisit`, `IPDAdmission`, `Prescription`, `LabResult` all FK to `Patient`. EMR is the **aggregated view**, not a separate data store.

---

## 5. Auth & RBAC

### Roles (initial set — 18 roles)

```
SUPER_ADMIN          — system-wide (your dev/support team)
HOSPITAL_ADMIN       — full hospital access
DOCTOR               — sees patients, writes prescriptions, EMR
NURSE                — vitals, medication admin, ward duties
RECEPTIONIST         — registration, appointments
OPD_CLERK            — OPD billing, queue
IPD_CLERK            — admission/discharge formalities
PHARMACIST           — drug store, dispensing
STORE_KEEPER         — general stock, purchase
LAB_TECH             — diagnostics
RADIOLOGIST          — imaging reports
DIETICIAN            — meal planning
HOUSEKEEPING         — ward cleaning, laundry
AMBULANCE_DRIVER     — ambulance trips
SECURITY_GUARD       — patrol logs
HR_ADMIN             — staff, payroll, leave
ACCOUNTANT           — billing, financial
PATIENT              — patient portal (Phase 8+)
```

### Permission model (object + action level)

```python
# apps/accounts/models.py
class Permission(models.Model):
    """Format: 'opd.view', 'opd.create', 'opd.discharge', 'pharmacy.dispense'"""
    code = models.CharField(max_length=100, unique=True)
    description = models.CharField(max_length=255)
    module = models.CharField(max_length=50, db_index=True)

class Role(TenantBaseModel):
    name = models.CharField(max_length=50)
    code = models.CharField(max_length=30)
    permissions = models.ManyToManyField(Permission)

class UserRole(TenantBaseModel):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    role = models.ForeignKey(Role, on_delete=models.CASCADE)
    department = models.ForeignKey('core.Department', null=True, on_delete=models.SET_NULL)
```

### DRF permission class

```python
class HasModulePermission(BasePermission):
    required_perm = None  # set on viewset

    def has_permission(self, request, view):
        perm = getattr(view, 'required_perm', None)
        if not perm:
            return True
        return request.user.has_module_perm(perm)
```

---

## 6. Modules

For each module: **purpose · key models · key endpoints · main pages · dependencies**

### 6.1 Reception Management
**Purpose:** Patient registration (new + returning), appointment booking, visitor pass, queue token
**Models:** `Patient` (in core), `Appointment`, `VisitorPass`, `QueueToken`
**Endpoints:**
- `POST /api/reception/patients/` — register (auto-generates MRN)
- `GET /api/reception/patients/search/?q=` — phone/name/MRN search
- `POST /api/reception/appointments/`
- `POST /api/reception/visitor-passes/`
- `GET /api/reception/queue/today/`
**Pages:** New Registration, Patient Search, Today's Queue, Appointment Calendar
**Depends on:** core.Patient, accounts, specialist (for doctor list)

### 6.2 Outpatient (OPD) Management
**Models:** `OPDVisit`, `Vitals` (linked), `Triage`, `OPDQueue`
**Endpoints:** check-in, vitals, queue management, doctor consultation start/end, refer to IPD, pharmacy referral
**Pages:** OPD Queue board, Doctor's OPD console, Vitals entry (nurse view)
**Depends on:** reception, specialist, emr, pharmacy

### 6.3 Inpatient (IPD) Management
**Models:** `IPDAdmission`, `BedAllocation`, `DailyRoundNote`, `DischargeSummary`, `IPDTransfer`
**Endpoints:** admit, transfer ward, daily rounds, discharge planning, generate discharge summary PDF
**Pages:** Admission form, IPD dashboard, Patient bedside view, Discharge wizard
**Depends on:** ward, emr, billing, nursing, pharmacy

### 6.4 Ward Management
**Models:** `Ward`, `Room`, `Bed`, `BedStatus` (occupied/cleaning/blocked), `BedAllocation` (FK → IPDAdmission)
**Endpoints:** ward census, bed availability matrix, mark cleaning/maintenance
**Pages:** Bed map (visual grid), Ward census, Cleaning schedule
**Depends on:** core.Location, ipd

### 6.5 OT (Operation Theatre) Management
**Models:** `OTRoom`, `Surgery`, `SurgeryTeam`, `PreOpChecklist`, `IntraOpNotes`, `PostOpRecovery`, `OTSchedule`
**Endpoints:** schedule surgery, check OT availability, consent forms, surgical safety checklist (WHO), live OT board
**Pages:** OT Schedule (week view), Live OT Board (Channels-powered), Surgery details, Pre-op/Post-op checklists
**Depends on:** ipd, specialist, emr, stock (for OT consumables)

### 6.6 Research Center Management
**Models:** `ResearchProject`, `ClinicalTrial`, `TrialParticipant`, `ResearchProtocol`, `EthicsApproval`, `ResearchPublication`
**Endpoints:** project CRUD, participant enrollment with consent, protocol versions, IRB tracking, publication log
**Pages:** Project list, Participant enrollment, Trial dashboard, Document repository
**Depends on:** core.Patient (consenting subjects), staff (PI/Co-PI)

### 6.7 Blood Donation Center
**Models:** `Donor`, `DonationDrive`, `BloodUnit` (with blood group, component type, expiry), `BloodRequest`, `Transfusion`, `CrossMatchResult`
**Endpoints:** donor registration, eligibility screening, donation event, unit storage, cross-match, issue, expiry alerts
**Pages:** Donor portal, Inventory (by group/component), Drive scheduler, Request handling, Transfusion log
**Depends on:** ipd (transfusion patient), notifications (expiry alerts)
**Special:** Background Celery job for expiry tracking (whole blood 35d, RBC 42d, platelets 5d, FFP 1y)

### 6.8 Crisis Management (Code Blue / Disaster)
**Models:** `CrisisProtocol`, `CrisisIncident`, `IncidentResponse`, `MassCasualtyEvent`, `EmergencyContact`
**Endpoints:** trigger code blue (with location), assemble response team, log timeline, incident report
**Pages:** Crisis trigger button (top nav, always visible), Live incident dashboard, Drill scheduler
**Depends on:** ipd, internal_comms, ambulance, staff
**Special:** Channels-powered live alerts to entire hospital; SMS to on-call team

### 6.9 Protection Management (Security Guards)
**Models:** `SecurityGuard`, `Shift`, `PatrolRoute`, `PatrolLog`, `IncidentReport`, `VisitorEntry` (CCTV log linkage optional)
**Endpoints:** guard roster, patrol checkpoint scan (QR), incident reporting, visitor entry/exit
**Pages:** Patrol map, Incident log, Roster, Visitor pass desk
**Depends on:** staff, reception (visitor passes)
**Optional:** QR code at checkpoints; mobile PWA for guards to scan

### 6.10 Arrangement Scheduling
**Purpose:** Generic scheduler for resources — meeting rooms, equipment, vehicles, non-OT consultations
**Models:** `SchedulableResource`, `ScheduleSlot`, `Booking`, `RecurringBooking`
**Endpoints:** resource CRUD, availability check, book, recurring booking, conflict detection
**Pages:** Resource calendar, Booking form, My bookings
**Depends on:** core, accounts

### 6.11 Specialist Module
**Purpose:** Doctor profiles, specialties, OPD slots, fees, leaves, on-call
**Models:** `Doctor`, `Specialty`, `Qualification`, `OPDSlot`, `DoctorLeave`, `OnCallRoster`, `ConsultationFee`
**Endpoints:** doctor directory, specialty filter, slot availability, fee structure, leave application
**Pages:** Doctor directory (public-facing OK), Doctor profile editor, Slot management, On-call calendar
**Depends on:** staff (User), departments

### 6.12 Electronic Medical Record (EMR)
**Purpose:** Aggregated patient clinical view across all encounters
**Models:** `ClinicalNote`, `Diagnosis` (ICD-10), `Medication` (current + historical), `Allergy`, `LabResult`, `RadiologyReport`, `ProcedureHistory`, `Vaccination`, `FamilyHistory`
**Endpoints:** patient timeline (combined OPD+IPD+labs+meds), CCDA/FHIR export
**Pages:** Patient 360° view, Clinical notes editor, Prescription pad, Lab results viewer
**Depends on:** All clinical modules
**Special:** This is mostly a **read aggregator** + clinical notes write. Use materialized views or service-layer aggregation.

### 6.13 Nursing Module
**Models:** `NursingAssignment`, `VitalsRecord`, `MedicationAdministration` (MAR), `IntakeOutput`, `NursingNote`, `WoundCare`, `FallRiskAssessment`, `HandoffNote`
**Endpoints:** vitals entry, MAR (5 rights check), I/O chart, shift handoff, care plan
**Pages:** Nurse dashboard (assigned patients), Bedside vitals, MAR view, Handoff print
**Depends on:** ipd, ward, emr, pharmacy

### 6.14 Charging (Billing — operational)
**Purpose:** Charge capture as services happen; bill generation; payment
**Models:** `ServiceCatalog` (CPT-like internal codes + GST class), `ChargeItem`, `BillHeader`, `BillItem`, `Payment`, `Discount`, `Refund`, `InsuranceClaim`, `TPABilling`
**Endpoints:** charge capture (auto from OPD/IPD/pharmacy), bill preview, finalize, payment (Razorpay), refund, claim submission
**Pages:** Service catalog admin, Bill desk, Patient bill view, Pending bills, Payment history
**Depends on:** opd, ipd, pharmacy, lab/radiology, ot
**Special:** GST handling — CGST+SGST for intra-state, IGST for inter-state (corporate billing); HSN codes per service

### 6.15 Drug Store (Pharmacy) Management
**Models:** `Drug` (with composition, schedule, formulation), `DrugBatch` (with expiry, MRP), `Manufacturer`, `Supplier`, `PurchaseOrder`, `GRN` (Goods Receipt), `Prescription` (FK to OPD/IPD), `Dispensing`, `Return`, `Wastage`
**Endpoints:** drug master, FEFO batch allocation on dispense, prescription validation, schedule H/H1/X handling, expiry alerts, return/wastage
**Pages:** Drug master, Pharmacy POS, Dispensing queue, Stock dashboard, Expiry watchlist
**Depends on:** opd, ipd, billing, stock
**Special:** Schedule H1 drugs need physical Rx retention 2y; FEFO = First-Expiry-First-Out

### 6.16 Staff, HR, and Payroll
**Models:** `Employee` (extends User), `Department`, `Designation`, `Contract`, `SalaryStructure`, `PayslipRun`, `Payslip`, `PFAccount`, `ESIAccount`, `TDSDeduction`, `BankAccount`, `Document` (Aadhaar, PAN, certs)
**Endpoints:** employee onboarding, salary structure setup, monthly payroll run, payslip generation, Form-16, PF/ESI/TDS computation
**Pages:** Employee directory, Onboarding wizard, Salary structure, Monthly payroll, Payslip viewer (employee portal)
**Special:** PF 12% (employer+employee), ESI 0.75%/3.25% (if salary ≤ ₹21K), Professional Tax state-wise, TDS as per slabs

### 6.17 Leave & Attendance
**Models:** `LeaveType` (CL/SL/EL/Maternity/Comp), `LeaveBalance`, `LeaveApplication`, `AttendanceRecord`, `Holiday`, `Shift`, `BiometricLog`
**Endpoints:** apply leave, approve workflow, biometric ingest (REST/CSV), regularization, monthly attendance summary
**Pages:** My leaves, Team leave calendar, Approval inbox, Attendance dashboard, Holiday calendar
**Depends on:** staff, payroll (LOP calculation)

### 6.18 Stock Management & Purchase
**Models:** `StockItem` (general — gloves, syringes, stationery), `StockCategory`, `Vendor`, `PurchaseRequisition`, `RFQ`, `PurchaseOrder`, `GRN`, `IssueVoucher` (to departments), `StockAdjustment`, `MinMaxLevel`, `ReorderAlert`
**Endpoints:** requisition workflow, PO with approval matrix, GRN with quality check, department issue, reorder alerts
**Pages:** Stock dashboard, Item master, Requisition, PO board, GRN, Issue counter, Vendor master
**Depends on:** accounting (PO ledger entry), staff (approval roles)

### 6.19 Internal Communication System
**Models:** `Channel`, `ChannelMember`, `Message`, `Attachment`, `Announcement`, `BulletinBoard`
**Endpoints:** channel CRUD, post message, file upload, broadcast announcement, mention notifications
**Pages:** Chat (Slack-lite for hospital), Announcements, Bulletin board
**Depends on:** Channels, notifications
**Tech:** Django Channels + Redis pub/sub; rooms by department/role

### 6.20 Administrator Security (System Access Control)
**Models:** `LoginAttempt`, `Session`, `IPAllowList`, `MFASetting`, `PasswordPolicy`, `AccessReview`, `DataExportLog`, `BreakGlassAccess`
**Endpoints:** force logout, lockout management, MFA enrollment (TOTP), audit trail viewer, data export approvals, "break the glass" emergency access
**Pages:** Security dashboard, Active sessions, Audit log explorer, MFA setup, Access review
**Depends on:** accounts, audit
**Special:** Break-glass = doctor can override permission for emergency, but logged + reviewed

### 6.21 Clothing (Laundry/Linen) Management
**Models:** `LinenItem` (sheet, pillow, gown, surgical drape), `LinenStock`, `Vendor` (laundry contractor), `LaundryDispatch`, `LaundryReceive`, `LinenIssue` (to ward), `WastageReport`, `RFIDTag` (optional)
**Endpoints:** dispatch to vendor, receive back with count + condition, issue to ward, par level alerts, vendor SLA tracking, wastage/loss
**Pages:** Linen inventory, Dispatch desk, Receiving desk, Vendor scorecard, Ward issue
**Depends on:** stock, ward, accounting (vendor billing)

### 6.22 Emergency Vehicle (Ambulance) Management
**Models:** `Ambulance` (BLS/ALS/ICU type), `AmbulanceDriver`, `Paramedic`, `Trip` (call→pickup→drop), `MaintenanceLog`, `FuelLog`, `EmergencyCall`
**Endpoints:** dispatch trip, GPS coordinates ingest (optional), trip billing, maintenance schedule, fuel reconciliation
**Pages:** Live ambulance status board, Trip log, Maintenance calendar, Trip billing
**Depends on:** crisis, billing, staff

### 6.23 Bottle Management (O2 Cylinders + IV Bottles)
**Models:**
- For O2: `OxygenCylinder` (size: A/B/D/E/M/H, capacity), `CylinderStatus` (full/in-use/empty/refilling), `RefillLog`, `CylinderMovement` (location history), `Vendor`, `LeakTestLog`
- For IV: `IVBottle` (NS/RL/D5/D5NS/etc), `IVStock` (FEFO batched), `IVIssue`, `IVAdministration` (link to nursing.MedicationAdministration)

**Endpoints:** cylinder lifecycle, return-empty workflow, IV bottle dispensing, batch tracking, leak test schedule
**Pages:** Cylinder dashboard (with location), Refill orders, IV bottle inventory, Movement log
**Depends on:** ward, ot, ipd, nursing, stock, pharmacy

### 6.24 Dietary Management
**Models:** `MealPlan` (diabetic/cardiac/renal/normal/liquid/NPO), `FoodItem`, `Recipe`, `MealOrder` (per patient per shift), `KitchenSchedule`, `DietConsultation`, `NutrientProfile`, `SpecialRequest`
**Endpoints:** assign diet to patient, generate kitchen list per meal, dietician consultation, food cost tracking
**Pages:** Diet assignment (per patient), Kitchen dashboard (today's meals by ward), Dietician panel, Recipe master
**Depends on:** ipd, emr, billing (chargeable diets)

### 6.25 Monetary Accounting (Financial Accounting)
**Models:** `ChartOfAccounts`, `LedgerAccount`, `JournalEntry`, `JournalLine`, `Voucher` (Receipt/Payment/Contra/Journal), `BankReconciliation`, `GSTReturn` (GSTR-1/3B), `TDSReturn`, `FinancialYear`, `TrialBalance`, `BalanceSheet`, `ProfitLoss`
**Endpoints:** voucher entry, double-entry posting, bank recon, GST return prep, financial reports, Tally export
**Pages:** Voucher entry (Tally-like), Day book, Ledger view, Trial balance, P&L, Balance sheet, GST returns, Bank recon
**Depends on:** billing (revenue), payroll (salary expense), stock (purchase expense)
**Special:** Strict double-entry; every billing/payroll/PO transaction auto-posts journal entries

### 6.26 MIS Reports
**Purpose:** Reports for management; not a transactional module
**Reports (minimum 30):**
- Daily census, OPD volume, IPD admissions/discharges
- Bed occupancy %, ALOS (Avg Length of Stay)
- Revenue by department / specialty / doctor
- Cash flow, AR aging
- Drug consumption, expiry losses, stock turnover
- Nurse-to-patient ratio, mortality rate, readmission rate
- OT utilization, OT TAT (turnaround time)
- Lab/radiology TAT
- Staff attendance, leave trends, payroll cost
- Vendor performance, PO aging
- Patient satisfaction (if survey integrated)
- Financial: P&L, BS, GST, TDS

**Tech:** Django ORM + materialized views for heavy aggregations; refresh nightly via Celery beat. Export to Excel/PDF. Dashboard with ECharts.

---

## 7. Phases

### Phase 0 — Setup & Foundation (1 week)
- Repo init, monorepo structure, Docker Compose, pre-commit hooks
- Django settings split (base/dev/staging/prod), env management (.env)
- Next.js scaffolding with shadcn/ui setup
- CI skeleton (lint + test)
- DB schema for `core` and `accounts` apps; seed roles/permissions
- JWT auth working end-to-end (login flow on frontend)

### Phase 1 — Reception + Specialist + OPD + Billing v1 + EMR shell (4 weeks)
**Goal:** Walk-in patient → registration → doctor consultation → bill → leave
- Reception: registration + appointment + queue
- Specialist: doctor master + slots + fees
- OPD: queue, vitals, consultation, prescription
- EMR: clinical notes, allergies, basic timeline
- Billing v1: service catalog, OPD charge, bill, payment (cash + Razorpay)
- Pharmacy v0: minimal — drug master only (dispensing in Phase 2)

**Deliverable:** Working OPD flow, deployable demo

### Phase 2 — IPD + Ward + Nursing + OT + Pharmacy full (4 weeks)
- Ward: bed map, allocation, status
- IPD: admission, transfer, discharge, daily rounds
- Nursing: vitals, MAR, I/O, handoff
- OT: scheduling, surgery records, OT board (Channels)
- Pharmacy: full FEFO, dispensing, batches, expiry alerts
- Billing v2: IPD charges, ICU charges, package billing

**Deliverable:** Full inpatient flow

### Phase 3 — Pharmacy/Stock/Bottles + Dietary + Laundry (3 weeks)
- Stock: requisition, PO, GRN, issue, vendors
- Bottles: O2 cylinders + IV bottles
- Dietary: meal planning, kitchen list
- Laundry: dispatch/receive, vendor SLA

**Deliverable:** Logistics & support working

### Phase 4 — Staff/HR + Leave/Attendance + Payroll (3 weeks)
- Employee master, designation, department, document mgmt
- Leave types, balance, application, approval
- Attendance: biometric ingest, regularization
- Salary structure, payroll run, payslip, PF/ESI/TDS, Form-16

**Deliverable:** Hospital can run payroll on the system

### Phase 5 — Security suite + Internal Comms + Ambulance (3 weeks)
- Crisis: code blue, drill, live alerts (Channels)
- Protection: guard roster, patrol logs, incidents
- Admin Security: MFA, audit explorer, break-glass
- Internal Comms: chat + announcements (Channels)
- Ambulance: trip mgmt, maintenance, fuel

**Deliverable:** Operational backbone complete

### Phase 6 — Specialized: Blood Bank + Research + Scheduling (3 weeks)
- Blood Bank: donor → inventory → cross-match → transfusion
- Research: projects, trials, participants, ethics
- Arrangement Scheduling: generic resource booking

**Deliverable:** Specialized clinical services live

### Phase 7 — Accounting + MIS Reports (3 weeks)
- Chart of accounts, vouchers, double-entry posting
- Auto-journal from billing/payroll/PO
- Trial balance, P&L, BS
- GST returns prep
- 30+ MIS reports with Excel/PDF export
- Executive dashboard with ECharts

**Deliverable:** Finance & analytics complete

### Phase 8 — Polish, Hardening, UAT, Go-live (2–3 weeks)
- Performance tuning, indexing, query optimization
- Penetration testing
- Data migration scripts (if existing system)
- User training, video walkthroughs
- Final UAT
- Production deployment + monitoring
- Go-live

---

## 8. Cross-cutting

### Audit logging
Use `django-simple-history` on every clinical model. Plus a custom `AuditLog` for non-model events (login, export, break-glass).

### Notifications
`apps/notifications/` with adapters: SMS (MSG91), WhatsApp (MSG91/Gupshup), Email (SMTP/SES), in-app (DB + WebSocket push). Use Celery for delivery.

### File uploads
django-storages → S3/MinIO. Generate presigned URLs for direct browser upload of large files (lab images, OT videos).

### Reports generation
- **PDF:** WeasyPrint with HTML templates (cleaner than ReportLab for invoices/discharge summaries)
- **Excel:** openpyxl for raw data, pandas for pivots
- **Print:** browser print stylesheets for prescriptions/wristbands

### Search
- Phase 1–6: PostgreSQL `pg_trgm` + `tsvector` for patient/drug search
- Phase 7+: Elasticsearch if data volume crosses 1M+ patients

### Caching
- django-redis for view cache (rare reads — drug master, doctor list)
- TanStack Query for frontend cache
- Avoid caching clinical data (always fresh)

### Background jobs (Celery beat schedule)
- Every 15 min: appointment reminders
- Hourly: expiry alerts, low-stock reorder
- Daily 02:00: bill aging, MIS materialized view refresh, backup
- Daily 06:00: shift roster generation, attendance auto-mark
- Monthly: payroll run trigger, GST return draft

---

## 9. Integrations

| Integration | Purpose | Phase |
|---|---|---|
| Razorpay | Payment gateway | 1 |
| MSG91 | SMS + WhatsApp + OTP | 1 |
| ABDM/ABHA Sandbox | Health ID, consent, link records | 6 (post-MVP) |
| HL7/FHIR | Lab/radiology integration with external diagnostic chains | 7 |
| Tally Connector | Export accounting | 7 |
| GSTN | GST return filing (via ASP/GSP partner) | 7 |
| Biometric (eSSL/Matrix) | Attendance | 4 |
| BarCode/RFID printers | Patient wristbands, samples | 2 |
| PACS | DICOM image viewer (radiology) | 6+ |
| Insurance TPA portals | Claim submission (case-by-case) | 7+ |

---

## 10. Testing

### Backend
- **Unit:** pytest + pytest-django; aim 70%+ coverage on business logic
- **Integration:** API tests with DRF's `APIClient`, factory_boy for fixtures
- **Performance:** locust for OPD queue + pharmacy dispensing scenarios

### Frontend
- **Unit:** Vitest + React Testing Library
- **E2E:** Playwright — critical flows (registration → consultation → bill → discharge)

### Clinical safety testing (must have)
- Drug-drug interaction (use a library like `medspacy` or India-Mart drug DB)
- Allergy alert (block prescription if allergic drug)
- Dose calculation by weight (pediatric)
- Negative tests for medication 5-rights

### Test data seeder
`scripts/seed_demo_data.py` — generate 100 patients, 20 doctors, 6 wards, 50 drugs, 30 days of transactions for demo/UAT.

---

## 11. Deployment

You haven't decided yet, so here are 3 paths. Phase 0–7 dev work is identical; only deploy step changes.

### Option A — Hostinger VPS (cheapest, ~₹2,000–4,000/month)
**Best for:** small/mid hospital (< 500 OPD/day), single location

- VPS: 4 vCPU / 8 GB RAM / 200 GB SSD (Hostinger KVM 4)
- OS: Ubuntu 22.04
- Stack: Docker Compose with postgres, redis, backend (gunicorn+daphne), celery, frontend (next start), nginx
- SSL: Certbot (Let's Encrypt, auto-renew)
- Domain: subdomain pattern — `app.hospital.com` (frontend), `api.hospital.com` (backend)
- Backup: pg_dump nightly to S3-compatible storage (Cloudflare R2 cheap)
- DNS: Cloudflare (DDoS protection free)
- Existing pattern matches your DeployHub/Hostinger experience.

### Option B — AWS (production-grade scale)
**Best for:** multi-location chain, > 1000 OPD/day, regulatory needs

- Compute: ECS Fargate (backend + celery) OR EC2 t3.large with auto-scaling
- DB: RDS PostgreSQL 16 (db.t3.medium → m5 family as scale grows), Multi-AZ
- Cache/Queue: ElastiCache Redis
- Storage: S3 (encrypted) for files, EFS if shared FS needed
- LB: Application Load Balancer with WAF
- DNS: Route 53
- CDN: CloudFront for Next.js static
- Secrets: Secrets Manager
- Monitoring: CloudWatch + Sentry
- Cost: $200–500/month starter

### Option C — On-Premise (hospital server room)
**Best for:** data sovereignty, no internet dependency for clinical operations

- 2× physical servers (active-passive HA), VMware/Proxmox
- VLAN segregation: clinical / admin / public
- PostgreSQL with streaming replication
- NAS for backups
- UPS mandatory
- Local AD integration (LDAP) for staff auth
- Optional offsite DR backup over VPN
- Highest upfront cost (~₹5–10L hardware) but zero monthly cloud cost

### Generic deploy checklist (any option)
1. Domain + DNS configured
2. SSL certs (real, not self-signed)
3. Strong env secrets (use `python -c "import secrets; print(secrets.token_urlsafe(50))"` for SECRET_KEY)
4. `DEBUG=False`, `ALLOWED_HOSTS` strict, `CORS_ALLOWED_ORIGINS` strict
5. PostgreSQL: connection pooling (PgBouncer), regular VACUUM
6. Static/media via Nginx, not Django
7. `gunicorn` workers = 2×CPU + 1; daphne separate for WebSocket
8. Celery: separate worker pools (default + heavy + scheduled)
9. Logrotate for Nginx + app logs
10. Daily backup test (restore drill monthly)
11. Sentry DSN configured, alerts to email/Slack
12. Health check endpoint `/api/health/` (DB + Redis + Celery)
13. Rate limiting (nginx limit_req_zone) on auth + public endpoints
14. Security headers (CSP, HSTS, X-Frame-Options) via django-csp + nginx

---

## 12. CI/CD

### GitHub Actions workflow

```yaml
# .github/workflows/ci.yml — runs on every PR
- Checkout
- Setup Python 3.12 + Node 20
- Install deps (cache)
- Lint backend (ruff + black --check)
- Lint frontend (eslint + prettier --check)
- Type check (mypy backend, tsc frontend)
- Run pytest (backend, with PostgreSQL service)
- Run vitest (frontend)
- Build docker images
- Snyk/Trivy security scan

# .github/workflows/deploy-staging.yml — on merge to develop
- All of CI
- Push images to GHCR
- SSH to staging server, pull + restart
- Run migrations
- Smoke test

# .github/workflows/deploy-prod.yml — on tag v*
- All of CI
- Manual approval
- Push images
- SSH to prod, blue-green swap
- Run migrations
- Smoke test
- Sentry release notify
```

### Branch strategy
- `main` — production, protected
- `develop` — staging
- `feature/*` — feature branches → PR to develop

---

## 13. Monitoring

### Errors & performance
- **Sentry** — backend + frontend; tag with hospital_id, user role, module
- **Django Debug Toolbar** — dev only

### Uptime
- **Uptime Kuma** (self-hosted) or **UptimeRobot** — ping `/api/health/` every 1 min

### Logs
- App logs → JSON format → shipped to Loki/CloudWatch/Papertrail
- Audit logs in DB (queryable, separate retention policy)

### Backup strategy
- DB: full pg_dump nightly (compressed, encrypted) → S3/R2 with 30-day retention
- DB: WAL archiving for PITR (point-in-time recovery)
- Files: S3 versioning + lifecycle policy
- Test restore monthly

### Compliance (India)
- **DPDP Act 2023** (Digital Personal Data Protection): explicit consent, purpose limitation, data localization, breach reporting in 72h
- **NDHM/ABDM** standards (if integrating health ID)
- **MCI/NMC** prescription record retention (5 years)
- **NABH** standards if hospital is NABH-accredited (audit trails, drug safety, infection control)
- **Income Tax**: invoice retention 8 years
- **GST**: return retention 6 years

### Data retention policies
- Clinical records: lifetime (don't delete; archive after 10 years inactive)
- Audit logs: 7 years
- Login logs: 1 year
- File uploads: tied to clinical record retention
- Soft delete everywhere; hard delete via admin + logged

---

## 14. Kickoff

When you're ready to start Phase 0, here's exactly what I'll deliver as a zip:

**Phase 0 Zip will contain:**
- Backend skeleton: Django 5 + DRF + Channels + Celery, all 26 apps scaffolded (empty), settings split, JWT auth working, drf-spectacular setup
- Frontend skeleton: Next.js 15 App Router + TS + Tailwind + shadcn/ui, login page working, protected layout, axios client with JWT refresh
- Docker Compose: postgres + redis + backend + frontend + nginx
- Seed script: 1 hospital, 18 roles, 1 super admin
- README with setup steps for Windows 10 + WSL2
- `.env.example` with all required vars
- Pre-commit hooks (ruff, black, eslint, prettier)
- GitHub Actions CI workflow (lint + test)

**Phase 1 Zip:** Reception + Specialist + OPD + Billing v1 + EMR shell — fully functional OPD flow.

…and so on per phase.

### Things to confirm before Phase 0
1. Single hospital or multi-tenant chain from start? (My suggestion: design multi-tenant, deploy single)
2. Default language: English only, or Hindi+English UI from start? (LATER is fine — Phase 8)
3. Existing data to migrate? (legacy Excel/MySQL/etc)
4. Hardware hooks: barcode scanner, biometric, thermal printer — confirm models you'll use
5. Razorpay test creds available? (you have these from previous projects)

---

**Bottom line:** ye 6 month ka serious build hai for production-grade. Phase 0 me 1 week setup, fir har phase me kuch deliver hota rahega. Recommendation: Phase 1 ke baad ek demo deployment chala ke real users (1 doctor + 1 receptionist) se feedback lo, fir Phase 2 build kare. Iterative > big bang.
