// frontend/src/lib/api/ot.ts
"use client";
import { api } from "@/lib/api";
import type {
  OperationTheatre, SurgicalProcedure, SurgeryBooking,
  SurgeryTeamMember, OTConsumable, OTRegister, OTDashboard,
} from "@/types/ot";

const ROOT = "/ot";

// ─── Theatres ────────────────────────────────────────────────────────────────
export const theatresApi = {
  list: () =>
    api.get<OperationTheatre[]>(`${ROOT}/theatres/`).then(r => r.data),
  get: (id: number) =>
    api.get<OperationTheatre>(`${ROOT}/theatres/${id}/`).then(r => r.data),
  create: (data: Partial<OperationTheatre>) =>
    api.post<OperationTheatre>(`${ROOT}/theatres/`, data).then(r => r.data),
  update: (id: number, data: Partial<OperationTheatre>) =>
    api.patch<OperationTheatre>(`${ROOT}/theatres/${id}/`, data).then(r => r.data),
};

// ─── Procedures ──────────────────────────────────────────────────────────────
export const proceduresApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<SurgicalProcedure[]>(`${ROOT}/procedures/`, { params }).then(r => r.data),
  get: (id: number) =>
    api.get<SurgicalProcedure>(`${ROOT}/procedures/${id}/`).then(r => r.data),
  create: (data: Partial<SurgicalProcedure>) =>
    api.post<SurgicalProcedure>(`${ROOT}/procedures/`, data).then(r => r.data),
};

// ─── Bookings ────────────────────────────────────────────────────────────────
export const bookingsApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<SurgeryBooking[]>(`${ROOT}/bookings/`, { params }).then(r => r.data),
  get: (id: number) =>
    api.get<SurgeryBooking>(`${ROOT}/bookings/${id}/`).then(r => r.data),
  create: (data: Partial<SurgeryBooking>) =>
    api.post<SurgeryBooking>(`${ROOT}/bookings/`, data).then(r => r.data),
  today: () =>
    api.get<OTDashboard>(`${ROOT}/bookings/today/`).then(r => r.data),
  calendar: (start: string, end: string) =>
    api.get<SurgeryBooking[]>(`${ROOT}/bookings/calendar/`, {
      params: { start, end },
    }).then(r => r.data),

  // State transitions
  checkIn: (id: number) =>
    api.post<SurgeryBooking>(`${ROOT}/bookings/${id}/check-in/`).then(r => r.data),
  start: (id: number) =>
    api.post<SurgeryBooking>(`${ROOT}/bookings/${id}/start/`).then(r => r.data),
  complete: (id: number, generate_invoice = true) =>
    api.post<SurgeryBooking>(`${ROOT}/bookings/${id}/complete/`,
      { generate_invoice }).then(r => r.data),
  cancel: (id: number, reason: string) =>
    api.post<SurgeryBooking>(`${ROOT}/bookings/${id}/cancel/`, { reason }).then(r => r.data),
  postpone: (id: number, new_start: string, new_end: string, reason = "") =>
    api.post<SurgeryBooking>(`${ROOT}/bookings/${id}/postpone/`,
      { new_start, new_end, reason }).then(r => r.data),

  // Team + consumables
  addTeamMember: (id: number, data: {
    role: string; doctor_id?: number; member_name?: string; notes?: string;
  }) =>
    api.post<SurgeryTeamMember>(`${ROOT}/bookings/${id}/add-team-member/`, data).then(r => r.data),
  addConsumable: (id: number, data: {
    item_name: string; quantity: string; unit_price: string;
    unit?: string; gst_rate?: string; notes?: string;
  }) =>
    api.post<OTConsumable>(`${ROOT}/bookings/${id}/add-consumable/`, data).then(r => r.data),

  // Register
  getRegister: (id: number) =>
    api.get<OTRegister>(`${ROOT}/bookings/${id}/register/`).then(r => r.data),
  upsertRegister: (id: number, data: Partial<OTRegister> & {
    finalize?: boolean; prepared_by_id?: number;
  }) =>
    api.post<OTRegister>(`${ROOT}/bookings/${id}/register/`, data).then(r => r.data),
  registerPdfUrl: (id: number) =>
    `${process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000"}/api/v1${ROOT}/bookings/${id}/register-pdf/`,
};
