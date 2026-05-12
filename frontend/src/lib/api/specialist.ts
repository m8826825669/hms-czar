// lib/api/specialist.ts
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
  const json = await res.json();
  // Handle both { results: [] } (DRF pagination) and plain [] responses
  return (json?.results ?? json) as T;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST", headers: authHeaders(), body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? err?.message ?? `${res.status}`);
  }
  return res.json();
}

async function patch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "PATCH", headers: authHeaders(), body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

async function del(path: string): Promise<void> {
  await fetch(`${BASE}${path}`, { method: "DELETE", headers: authHeaders() });
}

// ── Types ──────────────────────────────────────────────────────────────────────

export type DoctorStatus = "active" | "inactive" | "on_leave";

export interface Specialty {
  id:   number;
  name: string;
}

export interface DoctorSlot {
  day:        string;   // "Mon", "Tue" …
  start_time: string;   // "09:00"
  end_time:   string;   // "13:00"
  max_patients: number;
}

export interface Doctor {
  id:                  number;
  full_name:           string;
  registration_number: string;
  specialty:           string;
  specialty_id:        number;
  qualification:       string;
  department:          string;
  phone:               string;
  email:               string;
  opd_fee:             number;
  emergency_fee:       number;
  status:              DoctorStatus;
  avatar_url?:         string;
  availability:        DoctorSlot[];
  joined_date:         string;
  patients_today:      number;
  total_patients:      number;
  on_call:             boolean;
}

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

// ── API ────────────────────────────────────────────────────────────────────────

export const specialistApi = {
  list:       (q = "")   => get<Doctor[]>(`/specialist/doctors/${q ? `?search=${encodeURIComponent(q)}` : ""}`),
  specialties:()         => get<Specialty[]>("/specialist/specialties/"),
  create:     (b: DoctorForm)          => post<Doctor>("/specialist/doctors/", b),
  update:     (id: number, b: Partial<DoctorForm>) => patch<Doctor>(`/specialist/doctors/${id}/`, b),
  delete:     (id: number)             => del(`/specialist/doctors/${id}/`),
  toggleOnCall:(id: number, v: boolean)=> patch<Doctor>(`/specialist/doctors/${id}/on-call/`, { on_call: v }),
};

// ── Mock data (shown while Django isn't ready) ─────────────────────────────────

export const SPECIALIST_MOCK: Doctor[] = [
  {
    id:1, full_name:"Dr. Arvind Sharma",    registration_number:"MCI-2019-04821",
    specialty:"General Medicine",    specialty_id:1,  qualification:"MBBS, MD (Gen Med)",
    department:"OPD – Gen Medicine", phone:"9876540001", email:"arvind.sharma@hospital.in",
    opd_fee:400, emergency_fee:800,  status:"active",
    availability:[
      { day:"Mon", start_time:"09:00", end_time:"13:00", max_patients:20 },
      { day:"Wed", start_time:"09:00", end_time:"13:00", max_patients:20 },
      { day:"Fri", start_time:"09:00", end_time:"13:00", max_patients:20 },
    ],
    joined_date:"2019-06-01", patients_today:23, total_patients:4821, on_call:true,
  },
  {
    id:2, full_name:"Dr. Sneha Mehta",      registration_number:"MCI-2017-03142",
    specialty:"Gynaecology",         specialty_id:2,  qualification:"MBBS, MS (Obs & Gynae)",
    department:"OPD – Gynaecology",  phone:"9876540002", email:"sneha.mehta@hospital.in",
    opd_fee:600, emergency_fee:1200, status:"active",
    availability:[
      { day:"Mon", start_time:"10:00", end_time:"14:00", max_patients:15 },
      { day:"Tue", start_time:"10:00", end_time:"14:00", max_patients:15 },
      { day:"Thu", start_time:"10:00", end_time:"14:00", max_patients:15 },
    ],
    joined_date:"2017-03-15", patients_today:14, total_patients:3142, on_call:false,
  },
  {
    id:3, full_name:"Dr. Rajesh Gupta",     registration_number:"MCI-2015-01987",
    specialty:"Cardiology",          specialty_id:3,  qualification:"MBBS, MD, DM (Cardiology)",
    department:"OPD – Cardiology",   phone:"9876540003", email:"rajesh.gupta@hospital.in",
    opd_fee:800, emergency_fee:1500, status:"active",
    availability:[
      { day:"Tue", start_time:"09:00", end_time:"12:00", max_patients:12 },
      { day:"Thu", start_time:"09:00", end_time:"12:00", max_patients:12 },
      { day:"Sat", start_time:"09:00", end_time:"12:00", max_patients:12 },
    ],
    joined_date:"2015-09-01", patients_today:11, total_patients:1987, on_call:true,
  },
  {
    id:4, full_name:"Dr. Priya Patel",      registration_number:"MCI-2020-05634",
    specialty:"Orthopaedics",        specialty_id:4,  qualification:"MBBS, MS (Ortho)",
    department:"OPD – Orthopaedics", phone:"9876540004", email:"priya.patel@hospital.in",
    opd_fee:700, emergency_fee:1400, status:"active",
    availability:[
      { day:"Mon", start_time:"14:00", end_time:"18:00", max_patients:15 },
      { day:"Wed", start_time:"14:00", end_time:"18:00", max_patients:15 },
      { day:"Fri", start_time:"14:00", end_time:"18:00", max_patients:15 },
    ],
    joined_date:"2020-01-10", patients_today:9, total_patients:5634, on_call:false,
  },
  {
    id:5, full_name:"Dr. Kiran Rao",        registration_number:"MCI-2018-02341",
    specialty:"Dermatology",         specialty_id:5,  qualification:"MBBS, MD (Dermatology)",
    department:"OPD – Dermatology",  phone:"9876540005", email:"kiran.rao@hospital.in",
    opd_fee:500, emergency_fee:1000, status:"on_leave",
    availability:[
      { day:"Tue", start_time:"11:00", end_time:"15:00", max_patients:18 },
      { day:"Fri", start_time:"11:00", end_time:"15:00", max_patients:18 },
    ],
    joined_date:"2018-07-20", patients_today:0, total_patients:2341, on_call:false,
  },
];

export const SPECIALTIES_MOCK: Specialty[] = [
  { id:1, name:"General Medicine" }, { id:2, name:"Gynaecology" },
  { id:3, name:"Cardiology"       }, { id:4, name:"Orthopaedics" },
  { id:5, name:"Dermatology"      }, { id:6, name:"Paediatrics"  },
  { id:7, name:"Neurology"        }, { id:8, name:"Psychiatry"   },
  { id:9, name:"ENT"              }, { id:10,name:"Ophthalmology"},
];