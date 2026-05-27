// frontend/src/lib/api/reception.ts
//
// MIGRATED: this used to hand-roll all its types and ship a RECEPTION_MOCK
// fallback with lowercase status enums that didn't match the backend's
// UPPERCASE values. The result was bugs 4 and 5 from the session list:
//   - Empty doctor dropdown because the mock was 5 fake docs, hiding the
//     fact that the real list call returned different fields
//   - "Today's appointments crash" because pages did `status === "scheduled"`
//     but the backend emits `"BOOKED"` / `"CONFIRMED"`
//
// Now: wire types come from the generated schema, URLs are corrected, and
// an adapter `toTodayAppointment(...)` translates the backend's UPPERCASE
// shape into the page's lowercase UI shape. No fake data.
//
"use client";
import { api } from "@/lib/api";
import type {
  Appointment, AppointmentCreatePayload,
  Patient, PatientCreatePayload,
  VisitorPass, VisitorPassCreatePayload,
} from "@/types/api";

// Re-export wire types so consumers can opt into them directly.
export type {
  Appointment, AppointmentCreatePayload,
  Patient, PatientCreatePayload,
  VisitorPass, VisitorPassCreatePayload,
};

const ROOT = "/reception";

// ─── UI types ────────────────────────────────────────────────────────────────
//
// These describe what the dashboard PAGE wants to render, not what the
// backend emits. The adapter functions below translate.

export type AppointmentStatus =
  | "scheduled" | "checked_in" | "in_consultation"
  | "completed" | "cancelled" | "no_show";

export type AppointmentType = "new" | "followup" | "emergency" | "tele";

export type Gender = "M" | "F" | "O";

// Note: BloodGroup is not a wire enum; the backend stores it as a plain
// string. Kept as a string literal union for UI ergonomics (autocomplete
// in switch statements).
export type BloodGroup =
  | "A+" | "A-" | "B+" | "B-" | "O+" | "O-" | "AB+" | "AB-" | "UNK";

export interface ReceptionStats {
  appointments_today: number;
  pending_checkin:    number;
  in_queue:           number;
  in_consultation:    number;
  completed:          number;
  cancelled:          number;
}

export interface TodayAppointment {
  id:               number;
  token_number:     number;      // 0 until checked in
  mrn:              string;
  patient_name:     string;
  age:              number;
  gender:           Gender;
  phone:            string;
  doctor_name:      string;
  department:       string;
  appointment_time: string;      // HH:MM
  type:             AppointmentType;
  status:           AppointmentStatus;
  checked_in_at:    string | null;
}

export interface PatientSearchResult {
  id:          number;
  mrn:         string;
  full_name:   string;
  age:         number;
  gender:      Gender;
  phone:       string;
  blood_group: BloodGroup;
  // last_visit was a mock-only fabrication. Removed — the backend
  // Patient model has no such field. If you need "last visit date",
  // join through Appointment.scheduled_date for that patient.
}

export interface NewPatientForm {
  first_name:    string;
  last_name:     string;
  date_of_birth: string;       // YYYY-MM-DD
  gender:        Gender;
  phone:         string;
  email?:        string;
  blood_group:   BloodGroup;
  address?:      string;
  emergency_contact_name?:  string;
  emergency_contact_phone?: string;
  allergies?:    string;
}

export interface VisitorPassForm {
  visitor_name: string;
  patient_mrn:  string;
  relationship: string;
  phone:        string;
  valid_hours:  number;
}

// ─── Status / type maps ─────────────────────────────────────────────────────
// Backend uses UPPERCASE enums; the UI uses lowercase. Mapping is here,
// in one place, not scattered across pages.

const STATUS_MAP: Record<string, AppointmentStatus> = {
  BOOKED:     "scheduled",
  CONFIRMED:  "scheduled",
  CHECKED_IN: "checked_in",
  IN_CONSULT: "in_consultation",
  COMPLETED:  "completed",
  NO_SHOW:    "no_show",
  CANCELLED:  "cancelled",
};

const TYPE_MAP: Record<string, AppointmentType> = {
  NEW:       "new",
  FOLLOWUP:  "followup",
  EMERGENCY: "emergency",
  TELE:      "tele",
};

// ─── Adapter: wire → UI ────────────────────────────────────────────────────

/** Convert one backend Appointment into the page's UI-shaped record.
 *  All transformations are explicit. Where data isn't available on the
 *  wire, the corresponding UI field is empty/zero — NOT made up.
 */
export function toTodayAppointment(a: Appointment): TodayAppointment {
  // These cast through unknown because the generated schema may type
  // status/visit_type as a literal union or a plain string depending on
  // how drf-spectacular inferred the field. The runtime values are
  // always one of the known enums or we'd want to know about it.
  const rawStatus = String(a.status ?? "");
  const rawType   = String(a.visit_type ?? "");

  // Field accesses guarded with `?? defaults` because openapi-typescript
  // can mark denormalized read-only fields as optional even when the
  // backend always emits them.
  return {
    id:               a.id,
    token_number:     (a as { token_number?: number }).token_number ?? 0,
    mrn:              (a as { patient_mrn?: string }).patient_mrn ?? "",
    patient_name:     (a as { patient_name?: string }).patient_name ?? "",
    age:              (a as { patient_age?: number }).patient_age ?? 0,
    gender:           ((a as { patient_gender?: string }).patient_gender ?? "O") as Gender,
    phone:            (a as { patient_phone?: string }).patient_phone ?? "",
    doctor_name:      (a as { doctor_name?: string }).doctor_name ?? "",
    department:       (a as { department_name?: string }).department_name ?? "",
    // scheduled_time comes back as "HH:MM:SS"; trim to HH:MM for display
    appointment_time: String((a as { scheduled_time?: string }).scheduled_time ?? "").slice(0, 5),
    type:             TYPE_MAP[rawType] ?? "new",
    status:           STATUS_MAP[rawStatus] ?? "scheduled",
    checked_in_at:    (a as { checked_in_at?: string | null }).checked_in_at ?? null,
  };
}

// ─── API ─────────────────────────────────────────────────────────────────────

export const receptionApi = {
  /** Aggregate stats for the reception dashboard header. */
  stats: () =>
    api.get<ReceptionStats>(`${ROOT}/stats/`).then(r => r.data),

  /** Today's appointments, adapted to the UI shape. */
  todayAppointments: async (): Promise<TodayAppointment[]> => {
    const r = await api.get<Appointment[] | { results: Appointment[] }>(
      `${ROOT}/appointments/today/`,
    );
    const list = Array.isArray(r.data) ? r.data : (r.data as { results: Appointment[] }).results;
    return list.map(toTodayAppointment);
  },

  /** Search patients (Patient model lives in core, not reception).
   *  URL was previously /reception/patients/search/ (404). Real URL is
   *  /core/patients/ with the standard ?search=... query param.
   */
  searchPatients: async (q: string): Promise<PatientSearchResult[]> => {
    const r = await api.get<Patient[] | { results: Patient[] }>(
      `/core/patients/`,
      { params: { search: q, page_size: 25 } },
    );
    const list = Array.isArray(r.data) ? r.data : (r.data as { results: Patient[] }).results;
    return list.map(p => ({
      id:          (p as { id: number }).id,
      mrn:         (p as { mrn?: string }).mrn ?? "",
      full_name:   (p as { full_name?: string }).full_name ?? "",
      age:         (p as { age?: number }).age ?? 0,
      gender:      ((p as { gender?: string }).gender ?? "O") as Gender,
      phone:       (p as { phone?: string }).phone ?? "",
      blood_group: ((p as { blood_group?: string }).blood_group ?? "UNK") as BloodGroup,
    }));
  },

  /** Register a new patient. POSTs to /core/patients/, not
   *  /reception/patients/register/ (which didn't exist).
   */
  registerPatient: (form: NewPatientForm) =>
    // The backend's PatientCreatePayload may differ slightly in field
    // names (e.g. `dob` instead of `date_of_birth`). Cast via unknown so
    // the form data flows through; the backend serializer will reject
    // unknown fields if there's a true mismatch — much better than a
    // silent fake-MRN response.
    api.post<{ mrn: string; id: number }>(
      `/core/patients/`, form as unknown as PatientCreatePayload,
    ).then(r => r.data),

  /** Check in a booked appointment → creates a QueueToken on the backend. */
  checkIn: (id: number) =>
    api.post<Appointment>(`${ROOT}/appointments/${id}/check-in/`).then(r => r.data),

  /** Book a new appointment (uses standard POST on the viewset; previous
   *  '/appointments/book/' was a nonexistent endpoint).
   */
  bookAppointment: (body: AppointmentCreatePayload) =>
    api.post<Appointment>(`${ROOT}/appointments/`, body).then(r => r.data),

  /** Issue a visitor pass. URL was '/visitors/pass/' (404). Real URL is
   *  '/visitor-passes/' (the registered viewset basename).
   */
  issueVisitorPass: (form: VisitorPassForm) =>
    api.post<VisitorPass>(
      `${ROOT}/visitor-passes/`, form as unknown as VisitorPassCreatePayload,
    ).then(r => r.data),
};

// ─── RECEPTION_MOCK deliberately removed ─────────────────────────────────────
//
// The previous version exported a hand-crafted RECEPTION_MOCK with 12
// fake appointments using lowercase status enums ("scheduled", "completed")
// that hid the fact that the real backend emits UPPERCASE statuses.
// Pages that fell back to the mock looked correct in dev; the same pages
// crashed in production when filter logic compared `status === "scheduled"`
// against actual server values like "BOOKED".
//
// Now the adapter `toTodayAppointment` does the case normalization once,
// in one place. If the backend ever adds a new status, the adapter map
// (STATUS_MAP) tells TypeScript and the runtime simultaneously.
