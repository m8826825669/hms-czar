// frontend/src/lib/api/reception.ts
"use client";
import { api } from "@/lib/api";

const ROOT = "/reception";

// ─── Types ───────────────────────────────────────────────────────────────────

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

// ─── API calls ───────────────────────────────────────────────────────────────

// Bucket-3 cleanup (May 2026): the original receptionApi had four methods that
// called URLs the backend doesn't serve: `/patients/search/`, `/patients/register/`,
// `/appointments/book/`, `/visitors/pass/`. They've been:
//   - searchPatients   → rewired to /core/patients/?search=<q>, result mapped to flat shape
//   - registerPatient  → rewired to POST /core/patients/, form mapped to Patient fields
//   - bookAppointment  → deleted (no callers; create via POST /reception/appointments/)
//   - issueVisitorPass → deleted (no callers; create via POST /reception/visitor-passes/)

/** Shape of an item in the /core/patients/?search= response (full Patient serializer).
 *  Only the fields we care about here; anything else is ignored. */
interface CorePatient {
  id:           number;
  mrn:          string;
  full_name:    string;
  age:          number;
  gender:       Gender;
  phone:        string;
  blood_group:  BloodGroup;
}

export const receptionApi = {
  stats: () =>
    api.get<ReceptionStats>(`${ROOT}/stats/`).then(r => r.data),

  todayAppointments: () =>
    api.get<TodayAppointment[]>(`${ROOT}/appointments/today/`).then(r => r.data),

  searchPatients: async (q: string): Promise<PatientSearchResult[]> => {
    // /core/patients/ uses DRF SearchFilter on mrn/first_name/last_name/phone/abha_id
    const r = await api.get<{ results: CorePatient[] } | CorePatient[]>(
      "/core/patients/", { params: { search: q, page_size: 20 } },
    );
    const rows = Array.isArray(r.data) ? r.data : r.data.results;
    return rows.map(p => ({
      id:          p.id,
      mrn:         p.mrn,
      full_name:   p.full_name,
      age:         p.age,
      gender:      p.gender,
      phone:       p.phone,
      blood_group: p.blood_group,
      // `last_visit` is not on the Patient model — backend doesn't surface it.
      // Show null and let the UI render "—".
      last_visit:  null,
    }));
  },

  registerPatient: async (form: NewPatientForm): Promise<{ mrn: string; id: number }> => {
    // Map the reception form to the Patient model field names.
    const body: Record<string, unknown> = {
      first_name:   form.first_name,
      last_name:    form.last_name,
      dob:          form.date_of_birth,
      gender:       form.gender,
      phone:        form.phone,
      email:        form.email ?? "",
      blood_group:  form.blood_group,
      address_line1:form.address ?? "",
      emergency_contact_name:  form.emergency_contact_name ?? "",
      emergency_contact_phone: form.emergency_contact_phone ?? "",
    };
    // `allergies` on Patient is a JSONField (list of {substance, severity});
    // the reception form passes a free-text string. Convert lazily.
    if (form.allergies?.trim()) {
      body.allergies = [{ substance: form.allergies.trim(), severity: "unknown" }];
    }
    const r = await api.post<{ id: number; mrn: string }>("/core/patients/", body);
    return { mrn: r.data.mrn, id: r.data.id };
  },

  checkIn: (id: number) =>
    api.post<void>(`${ROOT}/appointments/${id}/check-in/`).then(r => r.data),
};

// ─── Mock data ───────────────────────────────────────────────────────────────

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
