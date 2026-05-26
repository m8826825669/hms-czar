// frontend/src/lib/api/ipd.ts
"use client";
import { api } from "@/lib/api";
import type {
  Ward, Room, Bed, BedAvailability, Admission,
  DailyCharge, AdmissionService, DischargeSummary, IPDDashboard,
} from "@/types/ipd";

const ROOT = "/ipd";

interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// ─── Wards / Rooms / Beds ────────────────────────────────────────────────────

export const wardsApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<Paginated<Ward>>(`${ROOT}/wards/`, { params }).then(r => r.data),
  get: (id: number) =>
    api.get<Ward>(`${ROOT}/wards/${id}/`).then(r => r.data),
  create: (data: Partial<Ward>) =>
    api.post<Ward>(`${ROOT}/wards/`, data).then(r => r.data),
};

export const roomsApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<Paginated<Room>>(`${ROOT}/rooms/`, { params }).then(r => r.data),
  create: (data: Partial<Room>) =>
    api.post<Room>(`${ROOT}/rooms/`, data).then(r => r.data),
};

export const bedsApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<Paginated<Bed>>(`${ROOT}/beds/`, { params }).then(r => r.data),

  availability: () =>
    api.get<{ wards: BedAvailability[] }>(`${ROOT}/beds/availability/`).then(r => r.data),

  available: () =>
    api.get<Paginated<Bed>>(`${ROOT}/beds/`, {
      params: { status: "AVAILABLE", page_size: 200 },
    }).then(r => r.data),

  mark: (id: number, status: "AVAILABLE" | "RESERVED" | "MAINTENANCE", notes = "") =>
    api.post<Bed>(`${ROOT}/beds/${id}/mark/`, { status, notes }).then(r => r.data),
};

// ─── Admissions ──────────────────────────────────────────────────────────────

export const admissionsApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<Paginated<Admission>>(`${ROOT}/admissions/`, { params }).then(r => r.data),

  get: (id: number) =>
    api.get<Admission>(`${ROOT}/admissions/${id}/`).then(r => r.data),

  create: (data: {
    patient: number;
    bed: number;
    attending_doctor: number;
    department?: number;
    admission_type?: string;
    admission_diagnosis: string;
    chief_complaint?: string;
    admission_notes?: string;
    expected_discharge_date?: string;
  }) =>
    api.post<Admission>(`${ROOT}/admissions/`, data).then(r => r.data),

  active: () =>
    api.get<Admission[]>(`${ROOT}/admissions/active/`).then(r => r.data),

  transfer: (id: number, newBedId: number, reason = "") =>
    api.post<Admission>(`${ROOT}/admissions/${id}/transfer/`, {
      new_bed_id: newBedId, reason,
    }).then(r => r.data),

  accrueCharges: (id: number) =>
    api.post<{ created: number; admission: Admission }>(
      `${ROOT}/admissions/${id}/accrue-charges/`,
    ).then(r => r.data),

  addService: (id: number, data: {
    description: string;
    unit_price: number | string;
    quantity?: number | string;
    gst_rate?: number | string;
    notes?: string;
  }) =>
    api.post<AdmissionService>(`${ROOT}/admissions/${id}/add-service/`, data)
       .then(r => r.data),

  discharge: (id: number, opts: {
    discharge_type?: string;
    include_pharmacy?: boolean;
    include_lab?: boolean;
  } = {}) =>
    api.post<Admission>(`${ROOT}/admissions/${id}/discharge/`, opts).then(r => r.data),

  // Discharge summary
  getSummary: (id: number) =>
    api.get<DischargeSummary>(`${ROOT}/admissions/${id}/discharge-summary/`).then(r => r.data),

  upsertSummary: (id: number, data: Partial<DischargeSummary> & {
    finalize?: boolean;
    doctor_id?: number;
  }) =>
    api.post<DischargeSummary>(
      `${ROOT}/admissions/${id}/discharge-summary/`, data,
    ).then(r => r.data),

  finalizeSummary: (id: number) =>
    api.post<DischargeSummary>(
      `${ROOT}/admissions/${id}/discharge-summary/finalize/`,
    ).then(r => r.data),

  dischargePdfUrl: (id: number) =>
    `${process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000"}/api/v1${ROOT}/admissions/${id}/discharge-pdf/`,

  dashboard: () =>
    api.get<IPDDashboard>(`${ROOT}/admissions/dashboard/`).then(r => r.data),
};
