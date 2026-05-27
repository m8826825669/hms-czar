// frontend/src/lib/api/specialist.ts
//
// MIGRATED: types come from @/types/api, which derives them from the
// auto-generated OpenAPI schema at @/lib/api/schema.ts. No hand-written
// `interface Doctor` here — the wire shape is whatever the backend's
// DoctorSerializer says it is.
//
// Re-run `npm run gen:api` after any backend serializer change and tsc
// will surface every consumer that needs updating.
//
"use client";
import { api } from "@/lib/api";
import type {
  Doctor, Specialty, DoctorCreatePayload,
} from "@/types/api";

// Re-export so existing pages can keep doing `import { Doctor } from
// "@/lib/api/specialist"` without breaking. New code should import from
// "@/types/api" directly.
export type { Doctor, Specialty, DoctorCreatePayload };

// DoctorStatus is derived from the generated Doctor type so the schema is
// authoritative. If the backend ever adds a status value (e.g. "retired"),
// this widens automatically — no hand-edit needed here.
export type DoctorStatus = NonNullable<Doctor["status"]>;

const ROOT = "/specialist";

// Some endpoints return either `{ results: [...] }` (paginated) or a plain
// array depending on whether pagination is forced. This helper handles both.
async function unwrapList<T>(p: Promise<{ data: T[] | { results: T[] } }>): Promise<T[]> {
  const r = await p;
  return Array.isArray(r.data) ? r.data : (r.data as { results: T[] }).results;
}

// ─── Local types that aren't on the wire ─────────────────────────────────────
// DoctorForm is what the **frontend form** holds in state (with "" as a valid
// placeholder for unfilled number fields). It is NOT the API payload shape —
// the create call must coerce these to real numbers before sending. Keep it
// hand-written; the form's local UX isn't part of the API contract.
export interface DoctorForm {
  full_name:           string;
  registration_number: string;
  specialty_id:        number | "";
  qualification:       string;
  department:          string;
  phone:               string;
  email:               string;
  opd_fee:             number | "";
  emergency_fee:       number | "";
  status:              DoctorStatus;
  on_call:             boolean;
}

// ─── API ─────────────────────────────────────────────────────────────────────

export const specialistApi = {
  list: (q = "") =>
    unwrapList<Doctor>(
      api.get<Doctor[] | { results: Doctor[] }>(`${ROOT}/doctors/`,
        q ? { params: { search: q } } : undefined),
    ),
  specialties: () =>
    unwrapList<Specialty>(
      api.get<Specialty[] | { results: Specialty[] }>(`${ROOT}/specialties/`),
    ),
  create: (b: DoctorForm) =>
    api.post<Doctor>(`${ROOT}/doctors/`, b).then(r => r.data),
  update: (id: number, b: Partial<DoctorForm>) =>
    api.patch<Doctor>(`${ROOT}/doctors/${id}/`, b).then(r => r.data),
  delete: (id: number) =>
    api.delete(`${ROOT}/doctors/${id}/`).then(() => undefined),
  toggleOnCall: (id: number, v: boolean) =>
    api.patch<Doctor>(`${ROOT}/doctors/${id}/on-call/`, { on_call: v }).then(r => r.data),
};

// ─── Mock data deliberately removed ──────────────────────────────────────────
//
// The previous version exported SPECIALIST_MOCK and SPECIALTIES_MOCK with
// hardcoded fake doctors. Pages used these as silent fallbacks when the API
// returned no data — which masked real bugs. (See session bug #6: a
// doc.status='active' baked into the mock hid a real undefined coming from
// the backend, until the page crashed in production.)
//
// If you need test data, use the real seed: `python manage.py seed_specialist`
// (which already creates 5 doctors with the full 32-field shape).
