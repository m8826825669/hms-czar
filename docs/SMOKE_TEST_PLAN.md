# Smoke Test Plan — HMS Phase 0–4d

Run this checklist immediately after deployment, after every release, and as the final sign-off step on cutover day. Each test takes 2–5 minutes; the full suite runs in under an hour by one person.

A test passes only when **all** acceptance criteria are met. A single failed test blocks the release.

---

## 1. Reception — patient registration

Steps:
1. Log in as `reception_user`
2. Navigate to **Reception → New Patient**
3. Enter mock patient data (name, DOB, gender, phone)
4. Save

Acceptance:
- Patient created with sequential MRN
- Patient appears in `/dashboard/reception/patients/` list
- KPI card "Today's OPD visits" unchanged (registration ≠ visit)
- Notification fires to reception desk

---

## 2. OPD — token issuance → consultation → prescription

Steps:
1. Reception: issue OPD token for the patient registered in test 1, doctor "Dr. Sample"
2. Log in as `nurse_user`: capture vitals (BP, pulse, temp, SpO2, weight)
3. Log in as `doctor_user`: open encounter, write chief complaint, primary diagnosis, prescription with 2 drugs
4. Submit encounter

Acceptance:
- Token appears in doctor's queue with vitals populated
- Encounter saved with SOAP note
- Prescription PDF generates and displays
- KPI "Today's OPD visits" increments by 1
- Stock dropped reservation appears in pharmacy queue

---

## 3. Billing & Razorpay payment

Steps:
1. Log in as `billing_user`
2. Open the encounter from test 2
3. Add consultation fee + prescription items
4. Generate invoice; verify GST split is correct
5. Click "Pay via Razorpay"; complete a test-mode payment

Acceptance:
- Invoice status moves PENDING → PAID
- KPI "Today's revenue" increments by the invoice grand total
- Webhook callback logged, payment receipt visible
- GST values feed into next GSTR-1 run

---

## 4. IPD — admission → care → discharge

Steps:
1. Reception: convert the OPD patient to admission, choose ward + bed
2. Nurse: add 2 nursing notes and one MAR entry
3. Lab + pharmacy charges accrue
4. Doctor: write discharge summary
5. Billing: consolidate IPD bill; mark patient discharged

Acceptance:
- Bed status flips OCCUPIED → AVAILABLE on discharge
- IPD invoice contains pharmacy, lab, room rent, doctor visits
- KPI "Bed occupancy %" updates
- Patient appears in "Today's discharges" KPI

---

## 5. Pharmacy — batch dispense with FEFO

Steps:
1. Log in as `pharmacist_user`
2. Open the dispense queue, pick the prescription from test 2
3. Verify the system suggests the **earliest-expiry** batch first
4. Dispense; print invoice

Acceptance:
- Selected batch quantity drops by dispensed amount
- Dispense invoice generated and linked to encounter
- KPI "Pharmacy sales today" increments
- Batch with later expiry is **not** selected when an earlier-expiry batch has stock

---

## 6. Lab — order → sample → result → report

Steps:
1. Doctor: order a CBC test on the patient
2. Lab tech: log sample collection (vacutainer barcode if available)
3. Lab tech: enter all CBC parameter values, mark any out-of-range
4. Lab senior: verify results; click "Release report"

Acceptance:
- PDF report has correct reference ranges, units, flags
- KPI "Today's lab orders" increments
- Out-of-range values are highlighted on the PDF
- Patient gets notification (email/SMS) that report is ready

---

## 7. OT — case scheduling

Steps:
1. Log in as `ot_coordinator`
2. Schedule a case: select theatre, surgeon, anaesthetist, date/time, 60 min duration
3. Verify consent and pre-op checklist appear
4. Mark case complete with post-op notes

Acceptance:
- OT calendar shows the booking
- KPI "Today's OT cases" increments if scheduled for today
- No double-booking allowed (verify by attempting overlapping booking)
- Optimistic-lock conflict surfaces a clean error, not a crash

---

## 8. HR — punch in/out & attendance summary

Steps:
1. Log in as an `employee_user`
2. Click "Punch in" at the dashboard
3. Wait 1 minute, click "Punch out"
4. Open `/dashboard/attendance/`

Acceptance:
- Daily attendance row shows status `PRESENT`, work_hours ≈ 0.02
- Analytics "Attendance today" → Present count includes this user
- Manager view shows this employee as present

---

## 9. Leave application → approval

Steps:
1. Employee: apply for 1 day of casual leave for tomorrow
2. Log in as `manager_user`: see the pending request, click Approve

Acceptance:
- Leave balance decrements by 1 day
- Tomorrow's attendance for this employee will pre-populate as `ON_LEAVE`
- Notification sent to employee
- Audit log records both submission and approval with timestamps

---

## 10. Analytics dashboard renders

Steps:
1. Log in as `admin_user`
2. Navigate to `/dashboard/analytics`
3. Wait for full payload load
4. Open `/dashboard/reports` and click **Go-Live Checklist** tab

Acceptance:
- All 12 KPI cards show non-error values
- Revenue line chart shows at least 1 month with non-zero data
- AR Aging bars render
- IPD occupancy table lists at least one ward
- Go-Live checklist returns ≥ 21 rows, summary `pass + warn + fail == total`
- Re-running checklist after fixing a `FAIL` reduces the fail count

---

## Negative tests (should fail gracefully, no 500s)

| Scenario | Expected behaviour |
|----------|--------------------|
| Submit invoice with negative quantity | 400 Bad Request with clear validation error |
| Dispense a batch that's expired | Reject with "Batch expired" message |
| Schedule OT with end < start | Reject with clear time-validation error |
| Discharge IPD patient with unpaid invoice | Warning prompt, allow only after override + reason |
| Hit `/api/analytics/dashboard/` without auth | 401 Unauthorised, not 500 |
| Run report with a malformed `parameters` JSON | 400 with parse error message, no traceback exposed |

---

## Performance smoke

- `/api/analytics/dashboard/` median latency under 800 ms on a populated DB (50 000 invoices, 10 000 patients)
- Concurrent 50-user load to `/api/opd/visits/` returns p95 < 1.5 s
- WebSocket queue (`/ws/queue/`) accepts 100 concurrent connections, broadcast latency < 200 ms

---

## Sign-off

| Tester | Date | Pass/Fail | Notes |
|--------|------|-----------|-------|
| Reception lead | | | |
| Senior consultant | | | |
| Pharmacy in-charge | | | |
| Lab in-charge | | | |
| Billing supervisor | | | |
| HR head | | | |
| IT vendor lead | | | |
| Hospital administrator | | | |

All ten paths plus negative tests must pass before go-live is declared.
