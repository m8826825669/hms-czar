// OT (Operation Theatre) module types — Phase 3a

export type TheatreType =
  | "GENERAL" | "CARDIAC" | "NEURO" | "OBGYN"
  | "ORTHO" | "MINOR" | "EMERGENCY";

export type TheatreStatus =
  | "AVAILABLE" | "OCCUPIED" | "CLEANING" | "MAINTENANCE";

export type ProcedureCategory =
  | "GENERAL" | "CARDIAC" | "NEURO" | "OBGYN" | "ORTHO"
  | "ENT" | "OPHTHAL" | "UROLOGY" | "GASTRO" | "ONCO"
  | "PLASTIC" | "MINOR";

export type SurgeryStatus =
  | "SCHEDULED" | "CHECKED_IN" | "IN_PROGRESS"
  | "COMPLETED" | "CANCELLED" | "POSTPONED";

export type Urgency = "ELECTIVE" | "URGENT" | "EMERGENCY";

export type TeamRole =
  | "SURGEON" | "ASSISTANT" | "ANAESTHETIST"
  | "NURSE_SCRUB" | "NURSE_CIRCULATING"
  | "TECHNICIAN" | "PERFUSIONIST" | "OBSERVER";


export interface OperationTheatre {
  id: number;
  hospital: number;
  code: string;
  name: string;
  theatre_type: TheatreType;
  theatre_type_label: string;
  floor: string;
  status: TheatreStatus;
  status_label: string;
  is_active: boolean;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface SurgicalProcedure {
  id: number;
  hospital: number;
  code: string;
  name: string;
  category: ProcedureCategory;
  category_label: string;
  typical_duration_minutes: number;
  base_price: string;
  hsn_code: string;
  gst_rate: string;
  requires_anaesthesia: boolean;
  anaesthesia_type: string;
  is_active: boolean;
  description: string;
}

export interface SurgeryTeamMember {
  id: number;
  booking: number;
  doctor: number | null;
  doctor_name: string | null;
  member_name: string;
  role: TeamRole;
  role_label: string;
  display_name: string;
  notes: string;
  created_at: string;
}

export interface OTConsumable {
  id: number;
  booking: number;
  item_name: string;
  quantity: string;
  unit: string;
  unit_price: string;
  gst_rate: string;
  subtotal: string;
  gst_amount: string;
  total: string;
  notes: string;
  added_at: string;
}

export interface OTRegister {
  id: number;
  booking: number;
  pre_op_findings: string;
  surgical_steps: string;
  intra_op_findings: string;
  complications: string;
  blood_loss_ml: number;
  blood_transfused_units: number;
  instruments_used: string;
  implants_used: string;
  specimens_sent: string;
  anaesthesia_type: string;
  anaesthesia_notes: string;
  post_op_orders: string;
  condition_on_shifting: string;
  prepared_by: number | null;
  prepared_by_name: string | null;
  prepared_at: string;
  finalized_at: string | null;
  is_finalized: boolean;
}

export interface SurgeryBooking {
  id: number;
  code: string;
  hospital: number;
  patient: number;
  patient_name: string;
  patient_mrn: string;
  patient_age: number | null;
  patient_gender: string;
  theatre: number;
  theatre_code: string;
  theatre_name: string;
  procedure: number;
  procedure_name: string;
  procedure_category: string;
  primary_surgeon: number;
  primary_surgeon_name: string;
  anaesthetist: number | null;
  anaesthetist_name: string | null;
  admission: number | null;
  admission_code: string | null;
  urgency: Urgency;
  urgency_label: string;
  status: SurgeryStatus;
  status_label: string;
  scheduled_start: string;
  scheduled_end: string;
  actual_start: string | null;
  actual_end: string | null;
  duration_minutes: number;
  pre_op_diagnosis: string;
  pre_op_assessment: string;
  consent_obtained: boolean;
  consent_witness: string;
  locked_procedure_price: string;
  locked_gst_rate: string;
  cancellation_reason: string;
  cancelled_at: string | null;
  invoice: number | null;
  invoice_code: string | null;
  invoice_status: string | null;
  notes: string;
  team: SurgeryTeamMember[];
  consumables: OTConsumable[];
  ot_register: OTRegister | null;
  created_at: string;
  updated_at: string;
}

export interface OTDashboard {
  date: string;
  theatres: OperationTheatre[];
  bookings: SurgeryBooking[];
  counts: {
    scheduled: number;
    in_progress: number;
    completed: number;
    cancelled: number;
  };
}
