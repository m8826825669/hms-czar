// frontend/src/types/__codegen_check.ts
//
// Compile-time verification that the codegen migration is sound. This file
// is type-checked by `tsc --noEmit` but emits nothing at runtime — it's a
// "did the migration actually wire up correctly" smoke test.
//
// After running `npm run gen:api`, run `npm run typecheck` (or just open
// VS Code). Any error here means the schema doesn't have the expected
// fields, which means either:
//
//   (a) the backend serializer drifted from what consumers expect
//       (the migration just surfaced a real bug — fix the backend), or
//   (b) the path string in types/api.ts is wrong (no such endpoint), or
//   (c) drf-spectacular doesn't have a schema for that endpoint yet
//       (add @extend_schema to the view, or split into a dedicated
//        serializer).
//
// If this file ever needs to be deleted to make tsc pass, the migration
// is broken and should be reverted, not patched.

import type {
  Doctor, Specialty,
  Ward, Bed, Admission,
  IPDDashboard,
} from "@/types/api";

// ─── Spot-check Doctor has the fields pages actually use ─────────────────────
//
// These assertions are the field names that consumer pages reference. If
// `npm run gen:api` produced a schema where any of these is missing,
// tsc will error here at the line that picks the field.

function _checkDoctorShape(d: Doctor): void {
  // These are the field names that consumer pages reference. tsc errors
  // here means the schema doesn't have the field — either the backend
  // serializer changed, the path string is wrong, or drf-spectacular
  // didn't generate a useful schema for this endpoint.
  //
  // Note: we use `void` (not e.g. `const _: string = d.x`) so that nullable
  // or optional fields don't false-positive. We only care that the field
  // EXISTS on the type, not its exact strictness.
  void d.id;
  void d.full_name;                // bug #8: was misspelled `user_full_name`
  void d.registration_number;
  void d.specialty;                // post-fix derived field
  void d.qualification;
  void d.department;
  void d.status;                   // bug #6: was undefined in the wire shape
  void d.opd_fee;
  void d.emergency_fee;
  void d.availability;
}

function _checkSpecialtyShape(s: Specialty): void {
  void s.id;
  void s.name;
}

function _checkWardShape(w: Ward): void {
  void w.id;
  void w.code;
  void w.name;
}

function _checkBedShape(b: Bed): void {
  void b.id;
  void b.label;                    // schema land mine: NOT `number`
  void b.status;
  void b.bed_rent;
  void b.nursing_charge;
}

function _checkAdmissionShape(a: Admission): void {
  void a.id;
  void a.patient;
  void a.patient_name;
  void a.bed;
  void a.attending_doctor;         // bug area: NOT `admitting_doctor`
  void a.admitted_at;              // bug area: NOT `admitted_on`
  void a.status;
}

function _checkDashboardShape(d: IPDDashboard): void {
  // IPDDashboard is hand-written but its arrays reference the generated
  // Admission type. This confirms that wire-up.
  void d.total_beds;
  void d.active;
  void d.recent_discharges;
}

export {};
