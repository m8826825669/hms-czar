/**
 * Canonical app-wide type aliases derived from the auto-generated OpenAPI
 * schema (frontend/src/lib/api/schema.ts).
 *
 * This module is the **single source of truth** for what each API resource
 * looks like on the wire. Page-local interfaces and lib/api/*.ts modules
 * should import from here instead of hand-rolling their own shapes.
 *
 * If `schema.ts` doesn't exist yet, run:
 *
 *     npm run gen:api
 *
 * That script (already wired in package.json) hits the live backend's
 * /api/schema/?format=json and regenerates schema.ts.
 *
 * ─── Why this matters ─────────────────────────────────────────────────────
 *
 * Eight bugs in the last session traced back to hand-written frontend
 * interfaces drifting away from what the backend serializer actually emits.
 * Each one looked like a different problem (blank doctor names, crashing
 * status badges, fake-MRN registrations) but the root cause was always
 * the same: an `interface Doctor` in a .tsx file that didn't match the
 * Django DoctorSerializer.
 *
 * Once a consumer page imports `Doctor` from this file instead of declaring
 * its own, **a wrong field name becomes a TypeScript compile error**, not
 * a silent undefined in production.
 *
 * ─── How to add a new alias ───────────────────────────────────────────────
 *
 * For a typical paginated resource at /api/v1/<app>/<thing>/:
 *
 *     export type Thing = NonNullable<
 *       ApiResponse<"/api/v1/<app>/<thing>/{id}/", "get">
 *     >;
 *
 * Use the {id}/ detail endpoint — it gives you the bare item type. The
 * collection endpoint gives you the paginated wrapper, which you usually
 * don't want as a top-level alias.
 *
 * For an action endpoint with a custom response shape (e.g.
 * `GET /admissions/dashboard/` returning {total_beds, occupied, ...}),
 * leave the response type hand-written for now — drf-spectacular's
 * inferred schema for actions can be flaky. Mark it with a TODO.
 *
 * ─── Naming convention ────────────────────────────────────────────────────
 *
 * • The resource type:                 `Doctor`, `Ward`, `Admission`
 * • Paginated list response:           `DoctorList`, `WardList`
 * • Create request body:               `DoctorCreatePayload`
 * • Partial update body:               `DoctorUpdatePayload`
 * • Action endpoint response (custom): kept hand-written, named to match
 *                                       (e.g. `IPDDashboard`)
 */
import type {
  ApiResponse, ApiRequestBody,
} from "@/lib/api/typed";


// ─── Specialist ──────────────────────────────────────────────────────────────

/**
 * A doctor as the DoctorSerializer emits it. After the specialist-fix
 * extension, this includes all 32 fields: full_name, specialty,
 * specialty_id, qualification, department, status (active/inactive/on_leave),
 * opd_fee, emergency_fee, availability, joined_date, patients_today,
 * total_patients, on_call, etc.
 *
 * If you find yourself writing `interface Doctor` anywhere in a .tsx file,
 * stop and import this instead.
 */
export type Doctor = NonNullable<
  ApiResponse<"/api/v1/specialist/doctors/{id}/", "get">
>;

export type DoctorList = NonNullable<
  ApiResponse<"/api/v1/specialist/doctors/", "get">
>;

export type DoctorCreatePayload = ApiRequestBody<"/api/v1/specialist/doctors/", "post">;

export type Specialty = NonNullable<
  ApiResponse<"/api/v1/specialist/specialties/{id}/", "get">
>;

export type SpecialtyList = NonNullable<
  ApiResponse<"/api/v1/specialist/specialties/", "get">
>;


// ─── Department ──────────────────────────────────────────────────────────────
// Note on the URL path: apps.department.urls registers the viewset at ""
// (not at "departments") so the included module's prefix isn't doubled.
// Final URLs: /api/v1/departments/ (list) and /api/v1/departments/{id}/ (detail).

export type Department = NonNullable<
  ApiResponse<"/api/v1/departments/{id}/", "get">
>;

export type DepartmentList = NonNullable<
  ApiResponse<"/api/v1/departments/", "get">
>;


// ─── Core: Patient ───────────────────────────────────────────────────────────

export type Patient = NonNullable<
  ApiResponse<"/api/v1/core/patients/{id}/", "get">
>;
export type PatientList = NonNullable<
  ApiResponse<"/api/v1/core/patients/", "get">
>;
export type PatientCreatePayload = ApiRequestBody<"/api/v1/core/patients/", "post">;


// ─── Reception: Appointment + QueueToken + VisitorPass ──────────────────────

export type Appointment = NonNullable<
  ApiResponse<"/api/v1/reception/appointments/{id}/", "get">
>;
export type AppointmentList = NonNullable<
  ApiResponse<"/api/v1/reception/appointments/", "get">
>;
export type AppointmentCreatePayload = ApiRequestBody<"/api/v1/reception/appointments/", "post">;

export type QueueToken = NonNullable<
  ApiResponse<"/api/v1/reception/queue/{id}/", "get">
>;

export type VisitorPass = NonNullable<
  ApiResponse<"/api/v1/reception/visitor-passes/{id}/", "get">
>;
export type VisitorPassCreatePayload = ApiRequestBody<"/api/v1/reception/visitor-passes/", "post">;


// ─── IPD ─────────────────────────────────────────────────────────────────────

export type Ward = NonNullable<
  ApiResponse<"/api/v1/ipd/wards/{id}/", "get">
>;
export type WardList = NonNullable<
  ApiResponse<"/api/v1/ipd/wards/", "get">
>;

export type Room = NonNullable<
  ApiResponse<"/api/v1/ipd/rooms/{id}/", "get">
>;
export type RoomList = NonNullable<
  ApiResponse<"/api/v1/ipd/rooms/", "get">
>;

export type Bed = NonNullable<
  ApiResponse<"/api/v1/ipd/beds/{id}/", "get">
>;
export type BedList = NonNullable<
  ApiResponse<"/api/v1/ipd/beds/", "get">
>;

export type Admission = NonNullable<
  ApiResponse<"/api/v1/ipd/admissions/{id}/", "get">
>;
export type AdmissionList = NonNullable<
  ApiResponse<"/api/v1/ipd/admissions/", "get">
>;
export type AdmissionCreatePayload = ApiRequestBody<"/api/v1/ipd/admissions/", "post">;

export type DailyCharge = NonNullable<
  ApiResponse<"/api/v1/ipd/daily-charges/{id}/", "get">
>;
export type AdmissionService = NonNullable<
  ApiResponse<"/api/v1/ipd/services/{id}/", "get">
>;


// ─── Action-endpoint shapes (kept hand-written) ─────────────────────────────
//
// These are response shapes for custom @action endpoints, not standard CRUD.
// drf-spectacular's inferred schema for actions is often `unknown` or a
// minimal wrapper. Keeping these hand-written until the backend either
// gains @extend_schema decorators or we move to per-action serializers.
//
// TODO(codegen): wire `@extend_schema(responses=IPDDashboardSerializer)`
// on the IPD dashboard action, then derive this from the schema too.

export interface BedAvailability {
  ward_id: number;
  ward_code: string;
  ward_name: string;
  ward_type: string;        // matches Ward["ward_type"] at runtime; kept loose here
  ward_type_label: string;
  available: number;
  occupied: number;
  reserved: number;
  maintenance: number;
  total: number;
  beds: Bed[];              // ← Bed comes from the generated schema, not hand-written
}

export interface IPDDashboard {
  as_of: string;
  total_beds: number;
  occupied: number;
  available: number;
  reserved: number;
  maintenance: number;
  active_admissions: number;
  today_admissions: number;
  active: Admission[];               // ← uses the generated Admission type
  recent_discharges: Admission[];    // ← same
}

export interface DischargeSummary {
  id: number;
  admission: number;
  final_diagnosis: string;
  course_in_hospital: string;
  procedures_done: string;
  treatment_given: string;
  investigations_summary: string;
  condition_at_discharge: string;
  discharge_advice: string;
  medications_on_discharge: string;
  follow_up_advice: string;
  prepared_by: number | null;
  prepared_by_name: string;
  prepared_at: string;
  finalized_at: string | null;
  is_finalized: boolean;
}


// ─── Standard DRF pagination wrapper ────────────────────────────────────────
//
// drf-spectacular's paginated lists have shape { count, next, previous,
// results: T[] }. When you use the *List alias above you already get this.
// This standalone helper is for the rare case where you need to express
// "any paginated response of T" generically.

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
