# HMS Phase 1b — Installation Guide

**Prerequisite:** Phase 0 + Phase 1a installed and working at `D:\hms_phase0\hms\`.

Phase 1b adds:
- **OPD module** — Vitals capture, Consultation console, Diagnosis (ICD-10), Drug master, Prescription builder
- **EMR module** — Patient 360° aggregator
- **WebSocket queue** — Live queue updates via Channels (no more page refreshes)

---

## 1. Extract over existing tree

Extract `hms_phase1b.zip` over `D:\hms_phase0\hms\`. It will:

- **Add new files**: `apps/opd/`, `apps/emr/`, drug seed command, Phase 1b frontend pages
- **Overwrite a few existing files** (carrying forward Phase 1a behavior + adding new wiring):
  - `backend/config/asgi.py` — adds WebSocket routing
  - `backend/config/urls.py` — adds `opd/` + `emr/` routes
  - `backend/apps/reception/views.py` — adds WebSocket broadcasts on queue events
  - `frontend/src/types/hms.ts` — adds Vitals/Consultation/Drug/Prescription types
  - `frontend/src/lib/api/hms.ts` — adds vitalsApi/consultationsApi/drugsApi/prescriptionsApi/emrApi

> No SQL data is wiped — only new tables added.

---

## 2. Run migrations

Open the backend terminal (with venv activated):

```powershell
cd D:\hms_phase0\hms\backend
.\venv\Scripts\activate
python manage.py makemigrations opd emr
python manage.py migrate
```

Expected output:
```
Migrations for 'opd':
  apps\opd\migrations\0001_initial.py
    - Create model DrugMaster
    - Create model Vitals
    - Create model Consultation
    - Create model Prescription
    - Create model PrescriptionItem
    - Create model ConsultationDiagnosis
Operations to perform:
  Apply all migrations: ..., opd
Running migrations:
  Applying opd.0001_initial... OK
```

---

## 3. Seed drug master

```powershell
python manage.py seed_phase1b
```

Seeds ~55 common Indian drugs (Crocin, Dolo, Mox, Augmentin, Pan-40, Telma,
Glycomet, Asthalin, Becosules, etc.) with HSN codes + GST rates + common doses.

To re-run cleanly: `python manage.py seed_phase1b --reset`

---

## 4. Restart with daphne (NOT runserver)

> **CRITICAL:** Phase 1b uses WebSockets. `runserver` does NOT support WebSockets.
> You must use **daphne** (Channels' ASGI server).

```powershell
# Backend (daphne — supports HTTP + WebSocket)
daphne -b 0.0.0.0 -p 8000 config.asgi:application
```

If daphne not installed:
```powershell
pip install daphne
```

In a separate terminal, frontend as usual:
```powershell
cd D:\hms_phase0\hms\frontend
npm run dev
```

---

## 5. Verify

### Backend smoke test

Visit `http://localhost:8000/api/docs/` — you should see new endpoints:
- `/api/v1/opd/vitals/`
- `/api/v1/opd/consultations/`
- `/api/v1/opd/consultations/start-from-token/`
- `/api/v1/opd/drugs/` (with search)
- `/api/v1/opd/prescriptions/`
- `/api/v1/emr/patient/<id>/360/`

### WebSocket smoke test

Open browser devtools console, run:
```javascript
const ws = new WebSocket("ws://localhost:8000/ws/queue/1/");
ws.onmessage = (e) => console.log("← ", e.data);
ws.onopen = () => console.log("CONNECTED");
```

You should see `CONNECTED` then a `{"type":"CONNECTED",...}` welcome frame.

### End-to-end test

1. Login as `admin` / `ChangeMe@123`
2. Navigate to **Reception → Walk-In** (Phase 1a flow): pick a patient,
   create appointment, check in → token issued.
3. Navigate to **OPD** (new in 1b sidebar):
   - You'll see the live queue with the new token in **Vitals Desk** section.
   - Click "Take Vitals" → fill BP/Pulse/SpO2/Wt/Ht (BMI auto-computes) → Save.
   - Token moves from `WAITING` → `IN_VITALS` automatically (live, via WebSocket).
4. Back on OPD console, doctor's room card now shows the patient as next.
   Click "Open Console":
   - Auto-creates a Consultation in `IN_PROGRESS`
   - Left pane: patient EMR snapshot (allergies/chronic/last vitals/history)
   - Center: SOAP notes (chief complaint, HPI, exam, investigations, advice) +
     diagnosis builder (text + ICD-10 + Provisional/Confirmed)
   - Right: Prescription builder with drug autocomplete (try typing "para"
     → Crocin/Dolo show; pick one → dose auto-fills; add to Rx)
   - Click "Complete & Send Patient" → token marked DONE, broadcast to all clients.
5. Navigate to **EMR** → search patient → click → 360° view with Overview /
   Visits / Vitals / Prescriptions / Appointments tabs.

---

## 6. Sidebar entries (manual add if not auto-included)

If your sidebar doesn't show the new entries, edit
`frontend/src/components/shared/sidebar.tsx` and add to the `nav` array:

```ts
{ label: "OPD",    href: "/dashboard/opd",    icon: Stethoscope },
{ label: "EMR",    href: "/dashboard/emr",    icon: FileText },
```

(Already has Reception, Notifications, etc. from Phase 1a.)

---

## 7. Phase 1a template fix (carried forward)

The seed file in this Phase 1b zip does NOT touch `notifications` — your
manually-fixed templates from the previous session ("Dr. Dr." → "Dr.")
remain intact in the database.

If you ever re-run `seed_initial`, the original templates will come back with
the bug. To fix permanently in the seed source, edit
`backend/apps/notifications/management/commands/seed_initial.py` and replace
all occurrences of `Dr. {doctor_name}` with `{doctor_name}`. (Patch is
documented in the prior session — 3 templates: APPOINTMENT_BOOKED,
APPOINTMENT_REMINDER, PRESCRIPTION_READY.)

---

## What's in this zip

```
backend/
├── apps/
│   ├── opd/                        (NEW MODULE)
│   │   ├── __init__.py
│   │   ├── apps.py
│   │   ├── models.py               (Vitals, Consultation, ConsultationDiagnosis,
│   │   │                            DrugMaster, Prescription, PrescriptionItem)
│   │   ├── serializers.py
│   │   ├── views.py                (6 ViewSets + start-from-token + complete actions)
│   │   ├── consumers.py            (QueueConsumer + broadcast helper)
│   │   ├── routing.py              (WebSocket URL routes)
│   │   ├── urls.py
│   │   ├── admin.py
│   │   └── migrations/__init__.py
│   ├── emr/                        (NEW MODULE)
│   │   ├── __init__.py
│   │   ├── apps.py
│   │   ├── views.py                (patient_360 aggregator)
│   │   ├── urls.py
│   │   └── migrations/__init__.py
│   ├── reception/views.py          (UPDATED: WebSocket broadcasts on queue events)
│   └── core/management/commands/
│       └── seed_phase1b.py         (NEW: ~55 Indian drugs with HSN/GST)
├── config/
│   ├── asgi.py                     (UPDATED: WebSocket routing wired)
│   └── urls.py                     (UPDATED: opd/ + emr/ enabled)

frontend/
└── src/
    ├── types/hms.ts                (UPDATED: + Vitals/Consultation/Drug/etc.)
    ├── lib/api/hms.ts              (UPDATED: + vitalsApi/consultationsApi/etc.)
    ├── hooks/useQueueSocket.ts     (NEW: WebSocket hook + reconnect)
    └── app/dashboard/
        ├── opd/
        │   ├── page.tsx            (Live queue dashboard)
        │   ├── vitals/[tokenId]/page.tsx
        │   └── consultation/[tokenId]/page.tsx   (3-pane doctor's console)
        └── emr/
            ├── page.tsx            (Patient search)
            └── [patientId]/page.tsx (360° tabbed view)
```

---

## Phase 1c preview (next zip)

- **Billing module** — Service catalog with HSN/GST, invoice with CGST/SGST/IGST,
  Razorpay full flow (order create + webhook signature verify + payment confirm)
- **Thermal printer** invoice PDF (uses Phase 0 utils/thermal_printer.py)
- **Public prescription view** at `/p/rx/<uuid>` (no auth, scannable QR)
- **Public queue display** for waiting room TV (read-only, big-text)
- **Comprehensive sample seed** — 50 patients with realistic Indian names,
  appointments spread across past/today/future, sample consultations,
  30-service catalog with GST rates

Bolo "Phase 1c chalu karo" jab ready ho.
