# HMS Phase 1a - Install Guide

This zip extends Phase 0. Extract it on top of your existing `hms_phase0/` checkout —
it adds 3 new modules (Notifications, Specialist, Reception) with frontend pages.

## What's New

### Backend
- **`apps/notifications/`** — Pluggable adapter pattern (MSG91 / Console / SMTP) with auto-fallback. NotificationLog table records every send (success or failure) for audit. Reusable templates with `{placeholder}` substitution.
- **`apps/specialist/`** — Doctors (extends User), Specialties, Qualifications, weekly OPD slots with exceptions, multi-tier consultation fees, on-call roster.
- **`apps/reception/`** — Appointments (with auto-generated codes & status workflow), QueueTokens (priority-aware), VisitorPasses (with QR UUID + entry/exit tracking).
- **`config/urls.py`** — Routes wired up under `/api/v1/notifications/`, `/api/v1/specialist/`, `/api/v1/reception/`.
- **`apps/core/management/commands/seed_phase1.py`** — Sample data: 8 specialties, 7 qualifications, 5 doctors with slots+fees, 5 SMS templates, 10 patients, sample appointments.

### Frontend
- `/dashboard/reception` — Landing dashboard with quick actions + today's stats
- `/dashboard/reception/register` — New patient registration with full form
- `/dashboard/reception/search` — Patient search (debounced)
- `/dashboard/reception/appointments` — Appointment list with check-in/cancel
- `/dashboard/reception/appointments/new` — Booking with patient/doctor pickers + fee + availability
- `/dashboard/reception/queue` — 3-column live queue (waiting / in-consult / done) with auto-refresh
- `/dashboard/reception/visitor-pass` — Issue + track visitor passes
- `/dashboard/specialist` — Doctor directory grouped by specialty
- `/dashboard/specialist/[id]` — Doctor profile with tabs (profile / slots / fees / availability)

## Installation Steps

### 1. Extract on top of Phase 0

```bash
# Backup first (recommended)
cp -r D:\mywork\hms_phase0 D:\mywork\hms_phase0_backup

# Extract phase 1a zip into the same folder; let it overwrite config/urls.py
# All other files are NEW so no conflicts.
```

> **Important:** The extracted `apps/` folder _merges_ with existing `apps/`. The 3 new modules (notifications, specialist, reception) had stubs in Phase 0 that are now replaced with real implementations.

### 2. Generate migrations for the new models

Phase 0 me jaisa hua tha — `migrate` directly chalane se "no migrations" error aata hai. **`makemigrations` first, then `migrate`:**

```powershell
# In PowerShell (or your venv terminal)
cd D:\mywork\hms_phase0\backend
.\venv\Scripts\activate

python manage.py makemigrations notifications specialist reception
python manage.py migrate
```

Expected output: 3 new migrations created (one per app), then applied successfully.

### 3. Seed Phase 1a sample data

```powershell
python manage.py seed_phase1
```

Creates:
- 8 specialties: Cardiology, Orthopaedics, Paediatrics, OB-GYN, Dermatology, Neurology, General Medicine, ENT
- 7 qualifications: MBBS, MD, MS, DM, MCh, DNB, FRCS
- 5 doctors with weekly slots (Mon/Wed/Fri 9-1, Tue/Thu 4-8) + 3 fee tiers each
- 5 SMS templates (DLT-style placeholders for MSG91)
- 10 sample patients
- Sample appointments next 3 days
- On-call roster for today + tomorrow

**Doctor login credentials** (all password: `Password@123`):
- `drshahid` — Cardiology, 18 yrs
- `drpriya` — Paediatrics, 14 yrs
- `drrohan` — Orthopaedics, 22 yrs
- `drmeera` — OB-GYN, 12 yrs
- `drasif` — General Medicine, 9 yrs

### 4. Restart servers

```powershell
# Terminal 1 - Backend
daphne -b 127.0.0.1 -p 8000 config.asgi:application

# Terminal 2 - Frontend
cd ..\frontend
npm run dev
```

### 5. Verify it works

1. Login as `admin / ChangeMe@123` at http://localhost:3000
2. Click **Reception** in sidebar — should now load (no more 404 🎉)
3. Click **New Patient Registration** → fill form → submit. MRN auto-generated.
4. Click **Specialists** in sidebar → click any doctor → see profile, slots, fees, availability tabs
5. Click **Book Appointment** → search patient → select doctor → pick date/time → fee shows automatically → submit
6. Click **Queue** → check-in a booked appointment from `/reception/appointments` → token appears in queue → call → complete

## MSG91 Configuration (Optional)

System works **out of the box without MSG91**. SMS notifications will print to console + log to DB.

When you get MSG91 access, edit `backend/.env`:

```env
HMS_SMS_ADAPTER=msg91
MSG91_AUTH_KEY=your_authkey_here
MSG91_OTP_TEMPLATE_ID=your_dlt_approved_template_id
```

That's it — restart the backend and SMS will start going out for real. No code changes needed.

For each template (APPOINTMENT_BOOKED, APPOINTMENT_REMINDER, etc.), add the DLT-approved MSG91 template ID via Django admin: `/admin/notifications/notificationtemplate/` — edit each and set `Msg91 template id`.

## Verify Notification Adapter

To confirm console fallback is working:

1. Book an appointment via UI (it triggers `send_template_notification.delay(...)`)
2. Check Celery worker terminal — you'll see:
   ```
   ────────────────────────────────────────────────────────────
   [NOTIFICATION → +919876500001]
   Body: Dear Ramesh Kumar, your appointment with Dr. Shahid Khan is booked for 08 May 2026 at 10:00 AM. Ref: APT-20260508-0001. - City General Hospital
   ────────────────────────────────────────────────────────────
   ```
3. Visit `/admin/notifications/notificationlog/` — you'll see the log entry with status SENT, provider `console`.

## Celery Worker Required for SMS

If you don't have Celery worker running, the `send_template_notification.delay(...)` calls will queue but not execute. To run worker:

```powershell
# Terminal 3 - Celery worker (Windows)
cd D:\mywork\hms_phase0\backend
.\venv\Scripts\activate
celery -A config worker -l info -P solo
```

(`-P solo` is required on Windows since prefork doesn't work natively.)

## API Endpoints Summary

| Module | Route | Description |
|---|---|---|
| Specialist | `/api/v1/specialist/doctors/` | CRUD doctors |
| Specialist | `/api/v1/specialist/doctors/{id}/availability/?date=YYYY-MM-DD` | Slot availability for a date |
| Specialist | `/api/v1/specialist/doctors/{id}/fee/?visit_type=NEW` | Get consultation fee |
| Specialist | `/api/v1/specialist/specialties/` | CRUD specialties |
| Specialist | `/api/v1/specialist/qualifications/` | CRUD qualifications |
| Specialist | `/api/v1/specialist/slots/` | CRUD weekly OPD slots |
| Specialist | `/api/v1/specialist/fees/` | CRUD consultation fees |
| Specialist | `/api/v1/specialist/on-call/` | CRUD on-call roster |
| Reception | `/api/v1/reception/appointments/` | CRUD appointments |
| Reception | `/api/v1/reception/appointments/today/` | Today's appointments |
| Reception | `/api/v1/reception/appointments/{id}/check-in/` | Mark checked-in + auto-issue token |
| Reception | `/api/v1/reception/appointments/{id}/cancel/` | Cancel |
| Reception | `/api/v1/reception/queue/` | CRUD queue tokens |
| Reception | `/api/v1/reception/queue/today/` | Today's queue |
| Reception | `/api/v1/reception/queue/{id}/call_next/` | Mark IN_CONSULT |
| Reception | `/api/v1/reception/queue/{id}/complete/` | Mark DONE |
| Reception | `/api/v1/reception/visitor-passes/` | CRUD visitor passes |
| Notifications | `/api/v1/notifications/templates/` | CRUD templates (admin only) |
| Notifications | `/api/v1/notifications/logs/` | Read-only audit log |

Swagger docs auto-generated at: http://localhost:8000/api/docs/

## Troubleshooting

**Q: "Dependency on app with no migrations: notifications" when running `migrate`**
A: Run `python manage.py makemigrations notifications specialist reception` first.

**Q: Sidebar shows Reception link but page is still 404**
A: `npm run dev` me Next.js cache stale ho. Stop the dev server, delete `frontend/.next/`, restart.

**Q: Booking appointment me "patient not found" error**
A: Ensure `seed_phase1` ran successfully. Check `Patient.objects.count()` via `python manage.py shell`.

**Q: Queue page shows nothing despite booking + check-in**
A: Check that the queue token's `visit_date` matches today's date (UTC vs IST issue).
   Verify with: `QueueToken.objects.filter(visit_date=date.today()).count()`

**Q: SMS not sending — even console output not appearing**
A: Celery worker is not running. SMS sends are queued asynchronously via `.delay()`.
   Either run worker (see above) or set `CELERY_TASK_ALWAYS_EAGER=True` in dev settings to make tasks synchronous.

## What's Next — Phase 1b Preview

Phase 1b will add (in next zip):
- **OPD module** — full doctor's consultation console (vitals, exam notes, diagnoses, prescriptions)
- **EMR shell** — 360° patient view with timeline of visits, prescriptions, allergies, conditions
- **WebSocket queue updates** — replaces 10s polling with live push
- **Prescription with QR** — generates PDF + signed by doctor's PIN

Phase 1c after that: Billing v1 (Razorpay full flow), thermal printer, public prescription view, public queue display.
