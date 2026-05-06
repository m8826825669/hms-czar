# HMS — Hospital Management System

Production-grade hospital management platform with **26 modules** spanning clinical, pharmacy, HR, security, and finance operations.

**Phase 0 — Foundation**
This zip contains the foundation: working auth, all 26 apps scaffolded, hardware hooks, data migration commands, Docker Compose, and a Next.js frontend with login + dashboard shell. Modules are filled in phase-by-phase per the [roadmap](docs/HMS_Roadmap.md).

---

## Quick Start (Docker Compose)

Prerequisites: Docker Desktop with WSL2 backend (Windows 10) or Docker on Linux/macOS.

```bash
# 1. Clone / unzip and enter the directory
cd hms

# 2. Bring up everything
docker compose up --build -d

# 3. Seed initial data (one-time, on first run)
docker compose exec backend python manage.py seed_initial

# 4. Open in your browser
#    Frontend       → http://localhost:3000
#    API docs       → http://localhost:8000/api/docs/
#    Django admin   → http://localhost:8000/admin/
```

**Default login:** `admin` / `ChangeMe@123`

To stop everything:

```bash
docker compose down              # keeps data
docker compose down -v           # ALSO wipes the database volume
```

---

## Stack

| Layer | Technology |
|---|---|
| Backend | Django 5.1 + DRF + Channels + Celery |
| Frontend | Next.js 15 + TypeScript + Tailwind + shadcn/ui |
| Database | PostgreSQL 16 |
| Cache / Queue / Channels | Redis 7 |
| Reverse proxy (prod) | Nginx |
| Auth | JWT (Simple JWT) with custom claims |

---

## Project Structure

```
hms/
├── backend/                  # Django 5
│   ├── config/               # settings, urls, asgi, celery
│   ├── apps/
│   │   ├── core/             # Hospital, Patient, AuditLog, base mixins
│   │   ├── accounts/         # User, Role, Permission, JWT
│   │   ├── notifications/
│   │   ├── reception/  opd/  ipd/  ward/  ot/  emr/
│   │   ├── nursing/  specialist/  blood_bank/  research/
│   │   ├── pharmacy/  stock/  bottles/
│   │   ├── dietary/  laundry/  ambulance/  internal_comms/
│   │   ├── staff/  payroll/  attendance/
│   │   ├── crisis/  protection/  admin_security/
│   │   ├── billing/  accounting/
│   │   └── scheduling/  reports/
│   ├── utils/                # barcode, thermal_printer, biometric, pdf
│   ├── tests/
│   └── requirements.txt
├── frontend/                 # Next.js 15 App Router
│   └── src/
│       ├── app/login   app/dashboard
│       ├── components/ui  components/shared
│       ├── lib/  hooks/  stores/  types/
├── nginx/                    # reverse proxy config
├── docker-compose.yml        # local dev
├── docker-compose.prod.yml   # production
├── .github/workflows/        # CI
└── docs/                     # roadmap, API specs
```

---

## What's in Phase 0

### Backend
- Custom **User** with hospital, employee_code, lockout
- **Role + Permission** model (70+ permissions across 26 modules, 18 system roles)
- **JWT auth** (login / refresh / logout) with hospital, roles, permissions in token claims
- **Failed-login tracking** with auto-lockout after 5 attempts
- **Audit log** for login, logout, password change, exports, break-glass
- **Patient** model: auto-generated MRN, allergies, chronic conditions, ABDM-ready, full history (`django-simple-history`)
- **Hospital + Department + Location** with multi-tenant base classes
- **Hospital context middleware** that resolves `request.hospital` for every request
- **Health check** endpoint (`/api/v1/core/health/`) that pings DB + Redis
- **OpenAPI docs** auto-generated at `/api/docs/` (Swagger UI) and `/api/redoc/`

### Hardware integrations (`backend/utils/`)
- **`barcode.py`** — Code128 + QR generation; helpers for patient wristbands and prescription QRs
- **`thermal_printer.py`** — ESC/POS support for TVS / Epson / Citizen 80mm thermal printers (network, USB, serial); ready jobs for OPD token, tax invoice, wristband
- **`biometric.py`** — eSSL/ZKTeco CSV, Matrix COSEC JSON push, ZKTeco TCP polling via `pyzk`. Emits a normalised `PunchEvent`.
- **`pdf.py`** — WeasyPrint helper

### Migration commands
- `python manage.py seed_initial [--reset]` — full hospital + roles + permissions + admin
- `python manage.py import_excel <file> --entity {patients|staff} [--dry-run]`
- `python manage.py import_mysql --entity {patients|staff} --query "SELECT ..."` — pulls from a legacy MySQL DB

### Frontend
- Login page (react-hook-form + zod, with sonner toasts)
- Auth store (Zustand) with localStorage persistence
- Axios client with **automatic JWT refresh** on 401, single-flight refresh queue
- Dashboard layout with **all 26 modules in the sidebar**, each item gated by its permission code
- Permission-aware sidebar — users see only modules they have access to
- shadcn/ui base components (Button, Input, Label, Card)
- React Query provider configured

---

## Common Commands

### Backend (inside Docker)

```bash
# Shell
docker compose exec backend python manage.py shell

# Create a superuser (interactive)
docker compose exec backend python manage.py createsuperuser

# Migrations
docker compose exec backend python manage.py makemigrations
docker compose exec backend python manage.py migrate

# Run tests
docker compose exec backend pytest -v

# Re-seed (wipes seed users + roles + perms)
docker compose exec backend python manage.py seed_initial --reset

# Excel import
docker compose exec backend python manage.py import_excel /app/uploads/patients.xlsx --entity patients --dry-run

# MySQL import
docker compose exec backend python manage.py import_mysql \
    --query "SELECT fname AS first_name, lname AS last_name, mob AS phone, dob, sex AS gender FROM old_patients" \
    --entity patients --host legacy-db.local --user root --password xxx --database old_hms
```

### Frontend (inside Docker)

```bash
docker compose exec frontend npm run lint
docker compose exec frontend npm run type-check
```

### Working without Docker (Windows + WSL2 native)

See [`SETUP_WINDOWS_WSL2.md`](SETUP_WINDOWS_WSL2.md) for the native-WSL2 path (Python venv + Node.js + Postgres on WSL).

---

## API Reference

Once running, full interactive docs are at:

- **Swagger UI:** http://localhost:8000/api/docs/
- **ReDoc:** http://localhost:8000/api/redoc/
- **OpenAPI JSON:** http://localhost:8000/api/schema/

Key endpoints (Phase 0):

```
POST   /api/v1/auth/login/                     # username + password → JWT pair + user payload
POST   /api/v1/auth/refresh/                   # refresh access token
POST   /api/v1/auth/logout/                    # blacklist refresh token
GET    /api/v1/auth/me/                        # current user profile
POST   /api/v1/auth/change-password/

GET    /api/v1/auth/users/                     # admin: list users
POST   /api/v1/auth/users/                     # admin: create user
GET    /api/v1/auth/roles/                     # admin: list roles

GET    /api/v1/core/health/                    # liveness/readiness
GET    /api/v1/core/hospital/                  # current hospital info
GET    /api/v1/core/departments/
GET    /api/v1/core/locations/
POST   /api/v1/core/patients/                  # creates patient with auto-MRN
GET    /api/v1/core/patients/?search=9876543210
```

---

## Hardware Hooks — How to Use

### Barcode / QR
```python
from utils.barcode import generate_barcode, generate_qr, prescription_qr_url

png = generate_barcode("MRN00000123")                   # → Code128 PNG
qr  = generate_qr(prescription_qr_url(42, "https://hospital.com"))
```

### Thermal printer (e.g., TVS RP-3220 over LAN)
```python
from utils.thermal_printer import network_printer, print_opd_token

with network_printer("192.168.1.50", port=9100) as p:
    print_opd_token(
        p,
        token_no="A-0042",
        patient_name="Ramesh Kumar",
        doctor="Dr. Shahid",
        department="OPD-Cardio",
        opd_room="Cabin 3",
        dt_str="06-May-2026 11:14",
        hospital_name="City General Hospital",
    )
```

### Biometric — eSSL CSV
```python
from utils.biometric import parse_essl_csv, ingest_punches

with open("attendance.csv") as f:
    events = parse_essl_csv(f.read())
result = ingest_punches(events, hospital=request.hospital, dry_run=True)
# → {"total": 412, "matched": 0, "unmatched_codes": [...], "errors": 0}
```

### Biometric — ZKTeco / eSSL TCP
```python
from utils.biometric import fetch_zk_punches, ingest_punches
events = fetch_zk_punches("192.168.1.201", port=4370)
ingest_punches(events, hospital=hospital, dry_run=False)   # Phase 4 wires the writes
```

---

## Data Migration

### From Excel
1. Place file in `backend/` (Docker mounts it at `/app/`)
2. Make sure column headers match the spec inside `apps/core/management/commands/import_excel.py`
3. Run with `--dry-run` first to validate
4. Re-run without `--dry-run` to commit

### From legacy MySQL
1. Set `LEGACY_MYSQL_*` env vars in `backend/.env`
2. Write a SELECT that aliases columns to HMS field names
3. Run `import_mysql --query "<sql>" --entity patients --dry-run`
4. Inspect output, then re-run without `--dry-run`

For multi-table source schemas, copy the command into a one-off script and chain entity imports (patients → staff → ...).

---

## Razorpay (Test Mode)

1. Get test creds from https://dashboard.razorpay.com/app/keys
2. Set in `backend/.env`:
   ```
   RAZORPAY_KEY_ID=rzp_test_xxxx
   RAZORPAY_KEY_SECRET=xxxx
   RAZORPAY_WEBHOOK_SECRET=xxxx
   ```
3. Phase 1 wires the actual order/payment flow into the billing module.

---

## Production Deployment (Outline)

When you're ready to deploy (Hostinger VPS, AWS, or on-premise — decide later):

1. Generate strong secrets:
   ```bash
   python -c "import secrets; print(secrets.token_urlsafe(50))"
   ```
2. Set `DJANGO_SETTINGS_MODULE=config.settings.prod`, `DEBUG=False`, strict `ALLOWED_HOSTS`
3. Get TLS certs (Let's Encrypt) and uncomment SSL block in `nginx/nginx.conf`
4. Run `docker compose -f docker-compose.prod.yml up -d --build`
5. Configure backups: nightly `pg_dump` + media sync to S3/R2
6. Set up monitoring (Sentry DSN, Uptime Kuma)

Detailed deploy steps for each option live in `docs/HMS_Roadmap.md` (section 11).

---

## What's Next — Phase 1

Phase 1 (4 weeks) builds the OPD walk-in flow end to end:

- Reception: patient registration, appointment, queue
- Specialist: doctor master, slots, fees
- OPD: queue, vitals, consultation, prescription
- EMR: clinical notes, allergies, basic timeline
- Billing v1: service catalog, OPD charge, bill, Razorpay payment
- Frontend pages for all of the above

Reach out when ready and I'll generate the Phase 1 zip.
