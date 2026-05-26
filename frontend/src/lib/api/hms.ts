// frontend/src/lib/api/hms.ts
"use client";
import { api } from "@/lib/api";
import type {
  Patient, Doctor, Appointment, QueueToken, VisitorPass, Specialty,
  Vitals, Drug, Consultation, Prescription, PrescriptionItem,
  ConsultationDiagnosis, Patient360, Paginated,
} from "@/types/hms";

// ─── Patients (core) ─────────────────────────────────────────────────────────
const CORE = "/core";

export const patientsApi = {
  list: (params?: { search?: string; page?: number }) =>
    api.get<Paginated<Patient>>(`${CORE}/patients/`, { params }).then(r => r.data),
  get: (id: number) =>
    api.get<Patient>(`${CORE}/patients/${id}/`).then(r => r.data),
  create: (data: Partial<Patient>) =>
    api.post<Patient>(`${CORE}/patients/`, data).then(r => r.data),
  update: (id: number, data: Partial<Patient>) =>
    api.patch<Patient>(`${CORE}/patients/${id}/`, data).then(r => r.data),
  search: (q: string) =>
    api.get<Paginated<Patient>>(`${CORE}/patients/`, { params: { search: q } })
       .then(r => r.data.results),
};

// ─── Doctors / Specialties ───────────────────────────────────────────────────
const SPC = "/specialist";

export const specialistApi = {
  listDoctors: (params?: { search?: string; is_consulting?: boolean }) =>
    api.get<Paginated<Doctor>>(`${SPC}/doctors/`, { params }).then(r => r.data),
  getDoctor: (id: number) =>
    api.get<Doctor>(`${SPC}/doctors/${id}/`).then(r => r.data),
  doctorAvailability: (id: number, date: string) =>
    api.get(`${SPC}/doctors/${id}/availability/`, { params: { date } })
       .then(r => r.data),
  doctorFee: (id: number, visit_type = "NEW") =>
    api.get(`${SPC}/doctors/${id}/fee/`, { params: { visit_type } })
       .then(r => r.data),
  listSpecialties: () =>
    api.get<Paginated<Specialty>>(`${SPC}/specialties/`).then(r => r.data),
};

// ─── Appointments / Queue / Visitor Passes (reception) ───────────────────────
const REC = "/reception";

export const appointmentsApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<Paginated<Appointment>>(`${REC}/appointments/`, { params }).then(r => r.data),
  today: (params?: { doctor?: number; status?: string }) =>
    api.get<Appointment[]>(`${REC}/appointments/today/`, { params }).then(r => r.data),
  create: (data: Partial<Appointment>) =>
    api.post<Appointment>(`${REC}/appointments/`, data).then(r => r.data),
  checkIn: (id: number) =>
    api.post(`${REC}/appointments/${id}/check-in/`).then(r => r.data),
  cancel: (id: number, reason: string) =>
    api.post(`${REC}/appointments/${id}/cancel/`, { reason }).then(r => r.data),
};

export const queueApi = {
  today: (params?: { doctor?: number; status?: string }) =>
    api.get<QueueToken[]>(`${REC}/queue/today/`, { params }).then(r => r.data),
  create: (data: Partial<QueueToken>) =>
    api.post<QueueToken>(`${REC}/queue/`, data).then(r => r.data),
  callNext: (id: number) =>
    api.post<QueueToken>(`${REC}/queue/${id}/call_next/`).then(r => r.data),
  complete: (id: number) =>
    api.post<QueueToken>(`${REC}/queue/${id}/complete/`).then(r => r.data),
};

export const visitorApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<Paginated<VisitorPass>>(`${REC}/visitor-passes/`, { params }).then(r => r.data),
  create: (data: Partial<VisitorPass>) =>
    api.post<VisitorPass>(`${REC}/visitor-passes/`, data).then(r => r.data),
  markEntry: (id: number) =>
    api.post(`${REC}/visitor-passes/${id}/mark_entry/`).then(r => r.data),
  markExit: (id: number) =>
    api.post(`${REC}/visitor-passes/${id}/mark_exit/`).then(r => r.data),
  revoke: (id: number) =>
    api.post(`${REC}/visitor-passes/${id}/revoke/`).then(r => r.data),
};

// ─── OPD ─────────────────────────────────────────────────────────────────────
const OPD = "/opd";

export const vitalsApi = {
  list: (params?: { patient?: number; queue_token?: number }) =>
    api.get<Paginated<Vitals>>(`${OPD}/vitals/`, { params }).then(r => r.data),
  get: (id: number) =>
    api.get<Vitals>(`${OPD}/vitals/${id}/`).then(r => r.data),
  create: (data: Partial<Vitals>) =>
    api.post<Vitals>(`${OPD}/vitals/`, data).then(r => r.data),
  update: (id: number, data: Partial<Vitals>) =>
    api.patch<Vitals>(`${OPD}/vitals/${id}/`, data).then(r => r.data),
};

export const consultationsApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<Paginated<Consultation>>(`${OPD}/consultations/`, { params }).then(r => r.data),
  get: (id: number) =>
    api.get<Consultation>(`${OPD}/consultations/${id}/`).then(r => r.data),
  startFromToken: (queue_token_id: number) =>
    api.post<Consultation>(`${OPD}/consultations/start-from-token/`, { queue_token_id }).then(r => r.data),
  update: (id: number, data: Partial<Consultation>) =>
    api.patch<Consultation>(`${OPD}/consultations/${id}/`, data).then(r => r.data),
  complete: (id: number) =>
    api.post<Consultation>(`${OPD}/consultations/${id}/complete/`).then(r => r.data),
  addDiagnosis: (data: Partial<ConsultationDiagnosis>) =>
    api.post<ConsultationDiagnosis>(`${OPD}/diagnoses/`, data).then(r => r.data),
  removeDiagnosis: (id: number) =>
    api.delete(`${OPD}/diagnoses/${id}/`).then(() => undefined),
};

export const drugsApi = {
  search: (q: string) =>
    api.get<Paginated<Drug>>(`${OPD}/drugs/`, { params: { search: q, page_size: 20 } })
       .then(r => r.data.results),
  list: () =>
    api.get<Paginated<Drug>>(`${OPD}/drugs/`).then(r => r.data),
};

export const prescriptionsApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<Paginated<Prescription>>(`${OPD}/prescriptions/`, { params }).then(r => r.data),
  get: (id: number) =>
    api.get<Prescription>(`${OPD}/prescriptions/${id}/`).then(r => r.data),
  create: (data: Partial<Prescription>) =>
    api.post<Prescription>(`${OPD}/prescriptions/`, data).then(r => r.data),
  addItem: (rxId: number, item: Partial<PrescriptionItem>) =>
    api.post<PrescriptionItem>(`${OPD}/prescriptions/${rxId}/add-item/`, item).then(r => r.data),
  removeItem: (itemId: number) =>
    api.delete(`${OPD}/prescription-items/${itemId}/`).then(() => undefined),
};

// ─── EMR ─────────────────────────────────────────────────────────────────────
const EMR = "/emr";

export const emrApi = {
  patient360: (patientId: number) =>
    api.get<Patient360>(`${EMR}/patient/${patientId}/360/`).then(r => r.data),
};
