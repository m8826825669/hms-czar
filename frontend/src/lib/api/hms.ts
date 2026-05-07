"use client";
import { api } from "@/lib/api";
import type {
  Patient, Doctor, Appointment, QueueToken, VisitorPass, Specialty, Paginated,
} from "@/types/hms";

// ─── Patients ──────────────────────────────────────────
export const patientsApi = {
  list: (params?: { search?: string; page?: number }) =>
    api.get<Paginated<Patient>>("/core/patients/", { params }).then(r => r.data),
  get: (id: number) =>
    api.get<Patient>(`/core/patients/${id}/`).then(r => r.data),
  create: (data: Partial<Patient>) =>
    api.post<Patient>("/core/patients/", data).then(r => r.data),
  update: (id: number, data: Partial<Patient>) =>
    api.patch<Patient>(`/core/patients/${id}/`, data).then(r => r.data),
  search: (q: string) =>
    api.get<Paginated<Patient>>("/core/patients/", { params: { search: q } })
       .then(r => r.data.results),
};

// ─── Doctors / Specialties ────────────────────────────
export const specialistApi = {
  listDoctors: (params?: { search?: string; is_consulting?: boolean }) =>
    api.get<Paginated<Doctor>>("/specialist/doctors/", { params }).then(r => r.data),
  getDoctor: (id: number) =>
    api.get<Doctor>(`/specialist/doctors/${id}/`).then(r => r.data),
  doctorAvailability: (id: number, date: string) =>
    api.get(`/specialist/doctors/${id}/availability/`, { params: { date } })
       .then(r => r.data),
  doctorFee: (id: number, visit_type = "NEW") =>
    api.get(`/specialist/doctors/${id}/fee/`, { params: { visit_type } })
       .then(r => r.data),
  listSpecialties: () =>
    api.get<Paginated<Specialty>>("/specialist/specialties/").then(r => r.data),
};

// ─── Appointments ─────────────────────────────────────
export const appointmentsApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<Paginated<Appointment>>("/reception/appointments/", { params }).then(r => r.data),
  today: (params?: { doctor?: number; status?: string }) =>
    api.get<Appointment[]>("/reception/appointments/today/", { params }).then(r => r.data),
  create: (data: Partial<Appointment>) =>
    api.post<Appointment>("/reception/appointments/", data).then(r => r.data),
  checkIn: (id: number) =>
    api.post(`/reception/appointments/${id}/check-in/`).then(r => r.data),
  cancel: (id: number, reason: string) =>
    api.post(`/reception/appointments/${id}/cancel/`, { reason }).then(r => r.data),
};

// ─── Queue ─────────────────────────────────────────────
export const queueApi = {
  today: (params?: { doctor?: number; status?: string }) =>
    api.get<QueueToken[]>("/reception/queue/today/", { params }).then(r => r.data),
  create: (data: Partial<QueueToken>) =>
    api.post<QueueToken>("/reception/queue/", data).then(r => r.data),
  callNext: (id: number) =>
    api.post<QueueToken>(`/reception/queue/${id}/call_next/`).then(r => r.data),
  complete: (id: number) =>
    api.post<QueueToken>(`/reception/queue/${id}/complete/`).then(r => r.data),
};

// ─── Visitor passes ───────────────────────────────────
export const visitorApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<Paginated<VisitorPass>>("/reception/visitor-passes/", { params }).then(r => r.data),
  create: (data: Partial<VisitorPass>) =>
    api.post<VisitorPass>("/reception/visitor-passes/", data).then(r => r.data),
  markEntry: (id: number) =>
    api.post(`/reception/visitor-passes/${id}/mark_entry/`).then(r => r.data),
  markExit: (id: number) =>
    api.post(`/reception/visitor-passes/${id}/mark_exit/`).then(r => r.data),
  revoke: (id: number) =>
    api.post(`/reception/visitor-passes/${id}/revoke/`).then(r => r.data),
};
