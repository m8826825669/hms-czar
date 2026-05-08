"use client";
import { api } from "@/lib/api";
import type {
  Ward, Room, Bed, BedAvailability, Admission,
  DailyCharge, AdmissionService, DischargeSummary, IPDDashboard,
} from "@/types/ipd";

interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// ────────────────────────────── Wards / Rooms / Beds ───────────────────────────

export const wardsApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<Paginated<Ward>>("/ipd/wards/", { params }).then(r => r.data),
  get: (id: number) =>
    api.get<Ward>(`/ipd/wards/${id}/`).then(r => r.data),
  create: (data: Partial<Ward>) =>
    api.post<Ward>("/ipd/wards/", data).then(r => r.data),
};

export const roomsApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<Paginated<Room>>("/ipd/rooms/", { params }).then(r => r.data),
  create: (data: Partial<Room>) =>
    api.post<Room>("/ipd/rooms/", data).then(r => r.data),
};

export const bedsApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<Paginated<Bed>>("/ipd/beds/", { params }).then(r => r.data),

  availability: () =>
    api.get<{ wards: BedAvailability[] }>("/ipd/beds/availability/")
       .then(r => r.data),

  available: () =>
    api.get<Paginated<Bed>>("/ipd/beds/", {
      params: { status: "AVAILABLE", page_size: 200 },
    }).then(r => r.data),

  mark: (id: number, status: "AVAILABLE" | "RESERVED" | "MAINTENANCE", notes = "") =>
    api.post<Bed>(`/ipd/beds/${id}/mark/`, { status, notes }).then(r => r.data),
};

// ───────────────────────────────── Admissions ──────────────────────────────────

export const admissionsApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<Paginated<Admission>>("/ipd/admissions/", { params })
       .then(r => r.data),

  get: (id: number) =>
    api.get<Admission>(`/ipd/admissions/${id}/`).then(r => r.data),

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
    api.post<Admission>("/ipd/admissions/", data).then(r => r.data),

  active: () =>
    api.get<Admission[]>("/ipd/admissions/active/").then(r => r.data),

  transfer: (id: number, newBedId: number, reason = "") =>
    api.post<Admission>(`/ipd/admissions/${id}/transfer/`, {
      new_bed_id: newBedId, reason,
    }).then(r => r.data),

  accrueCharges: (id: number) =>
    api.post<{ created: number; admission: Admission }>(
      `/ipd/admissions/${id}/accrue-charges/`,
    ).then(r => r.data),

  addService: (id: number, data: {
    description: string;
    unit_price: number | string;
    quantity?: number | string;
    gst_rate?: number | string;
    notes?: string;
  }) =>
    api.post<AdmissionService>(`/ipd/admissions/${id}/add-service/`, data)
       .then(r => r.data),

  discharge: (id: number, opts: {
    discharge_type?: string;
    include_pharmacy?: boolean;
    include_lab?: boolean;
  } = {}) =>
    api.post<Admission>(`/ipd/admissions/${id}/discharge/`, opts)
       .then(r => r.data),

  // Discharge summary
  getSummary: (id: number) =>
    api.get<DischargeSummary>(`/ipd/admissions/${id}/discharge-summary/`)
       .then(r => r.data),

  upsertSummary: (id: number, data: Partial<DischargeSummary> & {
    finalize?: boolean;
    doctor_id?: number;
  }) =>
    api.post<DischargeSummary>(
      `/ipd/admissions/${id}/discharge-summary/`, data,
    ).then(r => r.data),

  finalizeSummary: (id: number) =>
    api.post<DischargeSummary>(
      `/ipd/admissions/${id}/discharge-summary/finalize/`,
    ).then(r => r.data),

  dischargePdfUrl: (id: number) =>
    `/api/ipd/admissions/${id}/discharge-pdf/`,

  dashboard: () =>
    api.get<IPDDashboard>("/ipd/admissions/dashboard/").then(r => r.data),
};
