// lib/api/reception.ts
import { useAuthStore } from "@/stores/auth-store";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";

function authHeaders(): HeadersInit {
  const token = useAuthStore.getState().token;
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: authHeaders(), cache: "no-store" });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? err?.message ?? `${res.status} ${res.statusText}`);
  }
  return res.json();
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type AppointmentStatus = "scheduled" | "checked_in" | "in_consultation" | "completed" | "cancelled" | "no_show";
export type Gender = "M" | "F" | "O";
export type BloodGroup = "A+" | "A-" | "B+" | "B-" | "O+" | "O-" | "AB+" | "AB-" | "Unknown";

export interface ReceptionStats {
  appointments_today:  number;
  pending_checkin:     number;
  in_queue:            number;
  in_consultation:     number;
  completed:           number;
  cancelled:           number;
}

export interface TodayAppointment {
  id:             number;
  token_number:   number;
  mrn:            string;
  patient_name:   string;
  age:            number;
  gender:         Gender;
  phone:          string;
  doctor_name:    string;
  department:     string;
  appointment_time: string;
  type:           "new" | "followup" | "emergency";
  status:         AppointmentStatus;
  checked_in_at:  string | null;
}

export interface PatientSearchResult {
  id:           number;
  mrn:          string;
  full_name:    string;
  age:          number;
  gender:       Gender;
  phone:        string;
  blood_group:  BloodGroup;
  last_visit:   string | null;
}

export interface NewPatientForm {
  first_name:   string;
  last_name:    string;
  date_of_birth:string;
  gender:       Gender;
  phone:        string;
  email?:       string;
  blood_group:  BloodGroup;
  address?:     string;
  emergency_contact_name?:  string;
  emergency_contact_phone?: string;
  allergies?:   string;
}

export interface VisitorPassForm {
  visitor_name:   string;
  patient_mrn:    string;
  relationship:   string;
  phone:          string;
  valid_hours:    number;
}

// ── API calls ─────────────────────────────────────────────────────────────────

export const receptionApi = {
  stats:          () => get<ReceptionStats>("/reception/stats/"),
  todayAppointments:() => get<TodayAppointment[]>("/reception/appointments/today/"),
  searchPatients: (q: string) => get<PatientSearchResult[]>(`/reception/patients/search/?q=${encodeURIComponent(q)}`),
  registerPatient:(form: NewPatientForm) => post<{ mrn: string; id: number }>("/reception/patients/register/", form),
  checkIn:        (id: number) => post<void>(`/reception/appointments/${id}/check-in/`, {}),
  bookAppointment:(body: unknown) => post<{ id: number; token_number: number }>("/reception/appointments/book/", body),
  issueVisitorPass:(form: VisitorPassForm) => post<{ pass_number: string }>("/reception/visitors/pass/", form),
};

// ── Mock data ─────────────────────────────────────────────────────────────────

export const RECEPTION_MOCK = {
  stats: {
    appointments_today: 34,
    pending_checkin: 8,
    in_queue: 6,
    in_consultation: 4,
    completed: 19,
    cancelled: 3,
  } as ReceptionStats,

  appointments: [
    { id:1,  token_number:1,  mrn:"MRN-00482", patient_name:"Ramesh Kumar",    age:45, gender:"M", phone:"9876543210", doctor_name:"Dr. A. Sharma",  department:"General OPD",  appointment_time:"09:00", type:"new",      status:"completed",      checked_in_at:"08:52" },
    { id:2,  token_number:2,  mrn:"MRN-00389", patient_name:"Priya Devi",      age:32, gender:"F", phone:"9812345678", doctor_name:"Dr. S. Mehta",    department:"Gynaecology",  appointment_time:"09:15", type:"followup", status:"completed",      checked_in_at:"09:10" },
    { id:3,  token_number:3,  mrn:"MRN-00501", patient_name:"Arun Singh",      age:58, gender:"M", phone:"9898989898", doctor_name:"Dr. R. Gupta",    department:"Cardiology",   appointment_time:"09:30", type:"followup", status:"completed",      checked_in_at:"09:22" },
    { id:4,  token_number:4,  mrn:"MRN-00271", patient_name:"Sunita Joshi",    age:27, gender:"F", phone:"9871234567", doctor_name:"Dr. A. Sharma",   department:"General OPD",  appointment_time:"09:45", type:"new",      status:"in_consultation",checked_in_at:"09:40" },
    { id:5,  token_number:5,  mrn:"MRN-00198", patient_name:"Mohan Kaul",      age:62, gender:"M", phone:"9823456789", doctor_name:"Dr. P. Patel",    department:"Orthopaedics", appointment_time:"10:00", type:"followup", status:"in_consultation",checked_in_at:"09:55" },
    { id:6,  token_number:6,  mrn:"MRN-00605", patient_name:"Lalita Verma",    age:41, gender:"F", phone:"9845671234", doctor_name:"Dr. K. Rao",      department:"Dermatology",  appointment_time:"10:15", type:"new",      status:"checked_in",     checked_in_at:"10:08" },
    { id:7,  token_number:7,  mrn:"MRN-00312", patient_name:"Suresh Nair",     age:35, gender:"M", phone:"9867890123", doctor_name:"Dr. R. Gupta",    department:"Cardiology",   appointment_time:"10:30", type:"followup", status:"checked_in",     checked_in_at:"10:25" },
    { id:8,  token_number:8,  mrn:"MRN-00567", patient_name:"Deepa Iyer",      age:29, gender:"F", phone:"9856789012", doctor_name:"Dr. S. Mehta",    department:"Gynaecology",  appointment_time:"10:45", type:"new",      status:"scheduled",      checked_in_at:null    },
    { id:9,  token_number:9,  mrn:"MRN-00423", patient_name:"Prakash Tiwari",  age:50, gender:"M", phone:"9834567890", doctor_name:"Dr. A. Sharma",   department:"General OPD",  appointment_time:"11:00", type:"followup", status:"scheduled",      checked_in_at:null    },
    { id:10, token_number:10, mrn:"MRN-00711", patient_name:"Kavitha Rao",     age:38, gender:"F", phone:"9878901234", doctor_name:"Dr. P. Patel",    department:"Orthopaedics", appointment_time:"11:15", type:"new",      status:"scheduled",      checked_in_at:null    },
    { id:11, token_number:11, mrn:"MRN-00156", patient_name:"Dinesh Pandey",   age:67, gender:"M", phone:"9890123456", doctor_name:"Dr. V. Kumar",    department:"Neurology",    appointment_time:"11:30", type:"emergency",status:"scheduled",      checked_in_at:null    },
    { id:12, token_number:12, mrn:"MRN-00634", patient_name:"Anjali Mishra",   age:24, gender:"F", phone:"9812398765", doctor_name:"Dr. K. Rao",      department:"Dermatology",  appointment_time:"11:45", type:"new",      status:"cancelled",      checked_in_at:null    },
  ] as TodayAppointment[],

  searchResults: [
    { id:1, mrn:"MRN-00482", full_name:"Ramesh Kumar",   age:45, gender:"M", phone:"9876543210", blood_group:"B+",  last_visit:"2026-05-05" },
    { id:2, mrn:"MRN-00389", full_name:"Priya Devi",     age:32, gender:"F", phone:"9812345678", blood_group:"O+",  last_visit:"2026-05-12" },
    { id:3, mrn:"MRN-00501", full_name:"Arun Singh",     age:58, gender:"M", phone:"9898989898", blood_group:"A+",  last_visit:"2026-04-28" },
  ] as PatientSearchResult[],
};