// Phase 1b types - additive to types/hms.ts (replace that file with this)
export interface Patient {
  id: number;
  uuid: string;
  mrn: string;
  abha_id?: string;
  first_name: string;
  middle_name?: string;
  last_name?: string;
  full_name: string;
  dob: string;
  age: number;
  gender: "M" | "F" | "O";
  blood_group: string;
  phone: string;
  alt_phone?: string;
  email?: string;
  aadhaar_last4?: string;
  address_line1?: string;
  city?: string;
  state?: string;
  pincode?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relation?: string;
  allergies: Array<{ substance: string; severity: string }>;
  chronic_conditions: string[];
  current_medications: string[];
  is_vip: boolean;
  is_deceased: boolean;
  photo?: string;
  created_at: string;
}

export interface Doctor {
  id: number;
  user_id: number;
  username: string;
  email?: string;
  phone?: string;
  registration_number: string;
  full_name: string;
  specialties: number[];
  specialty_names: string[];
  qualifications: number[];
  qualification_codes: string[];
  primary_department: number | null;
  department_name?: string;
  bio?: string;
  years_of_experience: number;
  languages: string[];
  signature?: string;
  is_consulting: boolean;
  is_active: boolean;
  created_at: string;
}

export interface Specialty {
  id: number;
  code: string;
  name: string;
  description?: string;
  icon?: string;
  is_active: boolean;
}

export interface Appointment {
  id: number;
  code: string;
  patient: number;
  patient_name: string;
  patient_mrn: string;
  patient_phone: string;
  doctor: number;
  doctor_name: string;
  location: number | null;
  location_name?: string;
  scheduled_date: string;
  scheduled_time: string;
  duration_minutes: number;
  visit_type: "NEW" | "FOLLOWUP" | "EMERGENCY" | "TELE";
  source: "WALK_IN" | "PHONE" | "ONLINE" | "REFERRAL";
  reason?: string;
  status: "BOOKED" | "CONFIRMED" | "CHECKED_IN" | "IN_CONSULT"
    | "COMPLETED" | "NO_SHOW" | "CANCELLED";
  status_label: string;
  checked_in_at?: string;
  consult_started_at?: string;
  consult_ended_at?: string;
  cancelled_reason?: string;
  created_at: string;
}

export interface QueueToken {
  id: number;
  token_no: string;
  patient: number;
  patient_name: string;
  patient_mrn: string;
  patient_age: number;
  patient_gender: string;
  doctor: number;
  doctor_name: string;
  location: number | null;
  location_name?: string;
  appointment: number | null;
  visit_date: string;
  priority: "EMERGENCY" | "URGENT" | "NORMAL" | "APPOINTMENT";
  status: "WAITING" | "IN_VITALS" | "IN_CONSULT" | "DONE" | "SKIPPED";
  status_label: string;
  issued_at: string;
  called_at?: string;
  completed_at?: string;
  notes?: string;
}

export interface VisitorPass {
  id: number;
  pass_uuid: string;
  pass_no: string;
  visitor_name: string;
  visitor_phone?: string;
  purpose: "ATTENDANT" | "VISITOR" | "VENDOR" | "CONTRACTOR" | "OFFICIAL";
  visiting_patient: number | null;
  visiting_patient_name?: string;
  relationship?: string;
  issued_at: string;
  valid_until: string;
  entered_at?: string;
  exited_at?: string;
  is_revoked: boolean;
  is_active: boolean;
  id_proof_type?: string;
  id_proof_last4?: string;
}

// ─── Phase 1b additions ─────────────────────────────────
export interface Vitals {
  id: number;
  patient: number;
  patient_name: string;
  patient_mrn: string;
  queue_token: number | null;
  recorded_at: string;
  temperature_c?: string | null;
  pulse_bpm?: number | null;
  bp_systolic?: number | null;
  bp_diastolic?: number | null;
  bp_text: string;
  spo2_percent?: number | null;
  respiration_rate?: number | null;
  weight_kg?: string | null;
  height_cm?: string | null;
  bmi?: string | null;
  blood_glucose_mgdl?: number | null;
  pain_score?: number | null;
  notes?: string;
}

export interface Drug {
  id: number;
  code: string;
  generic_name: string;
  brand_name: string;
  display_name: string;
  dosage_form: string;
  strength: string;
  manufacturer: string;
  hsn_code: string;
  gst_rate: string;
  is_schedule_h: boolean;
  common_dose: string;
}

export interface PrescriptionItem {
  id: number;
  prescription: number;
  drug: number | null;
  drug_display: string;
  drug_name: string;
  dose: string;
  frequency: string;
  duration_days: number;
  route: string;
  instructions?: string;
  is_continued: boolean;
  order_index: number;
}

export interface Prescription {
  id: number;
  code: string;
  prescription_uuid: string;
  consultation: number | null;
  patient: number;
  patient_name: string;
  patient_mrn: string;
  doctor: number;
  doctor_name: string;
  prescribed_at: string;
  general_instructions?: string;
  next_followup_days?: number | null;
  is_signed: boolean;
  signed_at?: string;
  items: PrescriptionItem[];
}

export interface ConsultationDiagnosis {
  id: number;
  consultation: number;
  icd10_code?: string;
  diagnosis_text: string;
  diagnosis_type: "PROVISIONAL" | "CONFIRMED" | "DIFFERENTIAL" | "FINAL";
  is_primary: boolean;
  notes?: string;
  order_index: number;
}

export interface Consultation {
  id: number;
  code: string;
  patient: number;
  patient_name: string;
  patient_mrn: string;
  patient_age: number;
  patient_gender: string;
  doctor: number;
  doctor_name: string;
  appointment: number | null;
  queue_token: number | null;
  queue_token_no: string;
  vitals: number | null;
  vitals_data: Vitals | null;
  consultation_date: string;
  chief_complaint?: string;
  history_of_present_illness?: string;
  past_medical_history?: string;
  examination_findings?: string;
  investigations_advised?: string;
  general_advice?: string;
  next_visit_date?: string | null;
  status: "DRAFT" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  started_at?: string;
  ended_at?: string;
  diagnoses: ConsultationDiagnosis[];
  prescriptions: Prescription[];
}

export interface Patient360 {
  patient: Patient;
  summary: {
    total_visits: number;
    total_prescriptions: number;
    active_allergies_count: number;
    chronic_conditions_count: number;
    upcoming_appointments_count: number;
  };
  recent_visits: Consultation[];
  recent_vitals: Vitals[];
  latest_prescription: Prescription | null;
  upcoming_appointments: Appointment[];
  past_appointments: Appointment[];
}

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
