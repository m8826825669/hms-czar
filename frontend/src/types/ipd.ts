// Phase 2c — IPD types

export type WardType =
  | "GENERAL" | "PRIVATE" | "SEMI_PRIVATE" | "ICU" | "HDU"
  | "MATERNITY" | "PAEDIATRIC" | "ISOLATION" | "DAY_CARE";

export type BedStatus =
  | "AVAILABLE" | "OCCUPIED" | "RESERVED" | "MAINTENANCE";

export type AdmissionStatus =
  | "ADMITTED" | "DISCHARGED" | "ABSCONDED" | "DAMA"
  | "EXPIRED" | "TRANSFERRED" | "CANCELLED";

export type AdmissionType =
  | "PLANNED" | "EMERGENCY" | "REFERRAL" | "MATERNITY";

export interface Ward {
  id: number;
  code: string;
  name: string;
  ward_type: WardType;
  ward_type_label: string;
  floor: string;
  default_bed_rent: string;
  default_nursing_charge: string;
  default_gst_rate: string;
  is_active: boolean;
  notes: string;
  room_count: number;
  bed_count: number;
  available_count: number;
  occupied_count: number;
}

export interface Room {
  id: number;
  ward: number;
  ward_code: string;
  ward_name: string;
  number: string;
  is_ac: boolean;
  has_attached_bath: boolean;
  notes: string;
  bed_count: number;
}

export interface Bed {
  id: number;
  room: number;
  room_number: string;
  ward_code: string;
  ward_name: string;
  ward_type: WardType;
  label: string;
  display_code: string;
  bed_rent: string;
  nursing_charge: string;
  gst_rate: string;
  status: BedStatus;
  status_label: string;
  current_admission_code: string;
  current_patient_name: string;
  notes: string;
}

export interface BedAvailability {
  ward_id: number;
  ward_code: string;
  ward_name: string;
  ward_type: WardType;
  ward_type_label: string;
  available: number;
  occupied: number;
  reserved: number;
  maintenance: number;
  total: number;
  beds: Bed[];
}

export interface DailyCharge {
  id: number;
  admission: number;
  charge_date: string;
  bed_rent: string;
  nursing_charge: string;
  other_charge: string;
  other_description: string;
  gst_rate: string;
  gst_amount: string;
  total: string;
}

export interface AdmissionService {
  id: number;
  admission: number;
  service: number | null;
  description: string;
  quantity: string;
  unit_price: string;
  gst_rate: string;
  subtotal: string;
  gst_amount: string;
  total: string;
  service_date: string;
  notes: string;
}

export interface DischargeSummary {
  id: number;
  admission: number;
  final_diagnosis: string;
  course_in_hospital: string;
  procedures_done: string;
  treatment_given: string;
  investigations_summary: string;
  condition_at_discharge: string;
  discharge_advice: string;
  medications_on_discharge: string;
  follow_up_advice: string;
  prepared_by: number | null;
  prepared_by_name: string;
  prepared_at: string;
  finalized_at: string | null;
  is_finalized: boolean;
}

export interface Admission {
  id: number;
  code: string;
  patient: number;
  patient_name: string;
  patient_mrn: string;
  patient_phone: string;
  patient_age: number;
  patient_gender: string;
  bed: number;
  bed_code: string;
  ward_name: string;
  ward_type: WardType;
  attending_doctor: number;
  attending_doctor_name: string;
  department: number | null;
  department_name: string;
  admission_type: AdmissionType;
  admission_type_label: string;
  admission_diagnosis: string;
  chief_complaint: string;
  admission_notes: string;
  admitted_at: string;
  expected_discharge_date: string | null;
  discharged_at: string | null;
  discharge_type: string;
  locked_bed_rent: string;
  locked_nursing_charge: string;
  locked_gst_rate: string;
  status: AdmissionStatus;
  status_label: string;
  invoice: number | null;
  invoice_code: string;
  invoice_status: string;
  invoice_total: string;
  notes: string;
  stay_days: number;
  accrued_total: string;
  daily_charges: DailyCharge[];
  services: AdmissionService[];
  discharge_summary: DischargeSummary | null;
  created_at: string;
}

export interface IPDDashboard {
  as_of: string;
  total_beds: number;
  occupied: number;
  available: number;
  reserved: number;
  maintenance: number;
  active_admissions: number;
  today_admissions: number;
  active: Admission[];
  recent_discharges: Admission[];
}
