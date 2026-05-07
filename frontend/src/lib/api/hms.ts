"use client";
import { api } from "@/lib/api";
import type {
  Patient, Doctor, Appointment, QueueToken, VisitorPass, Specialty,
  Vitals, Drug, Consultation, Prescription, PrescriptionItem,
  ConsultationDiagnosis, Patient360, Paginated,
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

// ─── Phase 1b: OPD ────────────────────────────────────
export const vitalsApi = {
  list: (params?: { patient?: number; queue_token?: number }) =>
    api.get<Paginated<Vitals>>("/opd/vitals/", { params }).then(r => r.data),
  get: (id: number) =>
    api.get<Vitals>(`/opd/vitals/${id}/`).then(r => r.data),
  create: (data: Partial<Vitals>) =>
    api.post<Vitals>("/opd/vitals/", data).then(r => r.data),
  update: (id: number, data: Partial<Vitals>) =>
    api.patch<Vitals>(`/opd/vitals/${id}/`, data).then(r => r.data),
};

export const consultationsApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<Paginated<Consultation>>("/opd/consultations/", { params }).then(r => r.data),
  get: (id: number) =>
    api.get<Consultation>(`/opd/consultations/${id}/`).then(r => r.data),
  startFromToken: (queue_token_id: number) =>
    api.post<Consultation>("/opd/consultations/start-from-token/", { queue_token_id }).then(r => r.data),
  update: (id: number, data: Partial<Consultation>) =>
    api.patch<Consultation>(`/opd/consultations/${id}/`, data).then(r => r.data),
  complete: (id: number) =>
    api.post<Consultation>(`/opd/consultations/${id}/complete/`).then(r => r.data),
  addDiagnosis: (data: Partial<ConsultationDiagnosis>) =>
    api.post<ConsultationDiagnosis>("/opd/diagnoses/", data).then(r => r.data),
  removeDiagnosis: (id: number) =>
    api.delete(`/opd/diagnoses/${id}/`).then(r => r.data),
};

export const drugsApi = {
  search: (q: string) =>
    api.get<Paginated<Drug>>("/opd/drugs/", { params: { search: q, page_size: 20 } })
       .then(r => r.data.results),
  list: () =>
    api.get<Paginated<Drug>>("/opd/drugs/").then(r => r.data),
};

export const prescriptionsApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<Paginated<Prescription>>("/opd/prescriptions/", { params }).then(r => r.data),
  get: (id: number) =>
    api.get<Prescription>(`/opd/prescriptions/${id}/`).then(r => r.data),
  create: (data: Partial<Prescription>) =>
    api.post<Prescription>("/opd/prescriptions/", data).then(r => r.data),
  addItem: (rxId: number, item: Partial<PrescriptionItem>) =>
    api.post<PrescriptionItem>(`/opd/prescriptions/${rxId}/add-item/`, item).then(r => r.data),
  removeItem: (itemId: number) =>
    api.delete(`/opd/prescription-items/${itemId}/`).then(r => r.data),
};

// ─── Phase 1b: EMR ────────────────────────────────────
export const emrApi = {
  patient360: (patientId: number) =>
    api.get<Patient360>(`/emr/patient/${patientId}/360/`).then(r => r.data),
};
