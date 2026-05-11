// Blood Bank module types — Phase 3a

export type BloodGroup =
  | "A_POS" | "A_NEG"
  | "B_POS" | "B_NEG"
  | "AB_POS" | "AB_NEG"
  | "O_POS" | "O_NEG";

export type ComponentType =
  | "WHOLE" | "PRBC" | "FFP" | "PLATELETS" | "CRYO";

export type ScreenResult = "PENDING" | "NEGATIVE" | "POSITIVE";

export type DonationStatus =
  | "COLLECTED" | "SCREENING" | "PASSED" | "FAILED" | "DISCARDED";

export type BagStatus =
  | "QUARANTINE" | "AVAILABLE" | "RESERVED"
  | "ISSUED" | "EXPIRED" | "DISCARDED";

export type RequisitionStatus =
  | "PENDING" | "CROSSMATCH" | "RESERVED"
  | "ISSUED" | "CANCELLED" | "REJECTED";

export type RequisitionUrgency = "ROUTINE" | "URGENT" | "EMERGENCY";

export type CrossMatchResult = "PENDING" | "COMPATIBLE" | "INCOMPATIBLE";


export interface BloodDonor {
  id: number;
  donor_id: string;
  hospital: number;
  first_name: string;
  last_name: string;
  full_name: string;
  gender: "M" | "F" | "O";
  gender_label: string;
  dob: string;
  age: number | null;
  blood_group: BloodGroup;
  blood_group_label: string;
  phone: string;
  email: string;
  address: string;
  aadhaar_last4: string;
  weight_kg: string;
  is_eligible: boolean;
  deferral_until: string | null;
  deferral_reason: string;
  donor_type: string;
  donor_type_label: string;
  last_donation_date: string | null;
  total_donations: number;
  eligibility: { can_donate: boolean; reason: string };
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface BloodDonation {
  id: number;
  donation_id: string;
  hospital: number;
  donor: number;
  donor_name: string;
  donor_id_str: string;
  donation_date: string;
  volume_collected_ml: number;
  blood_group: BloodGroup;
  blood_group_label: string;
  pre_hb_g_dl: string;
  pre_bp_systolic: number;
  pre_bp_diastolic: number;
  pre_pulse: number;
  pre_temperature_c: string;
  test_hiv: ScreenResult;
  test_hbsag: ScreenResult;
  test_hcv: ScreenResult;
  test_syphilis: ScreenResult;
  test_malaria: ScreenResult;
  all_tests_complete: boolean;
  all_tests_passed: boolean;
  any_test_failed: boolean;
  screening_completed_at: string | null;
  status: DonationStatus;
  status_label: string;
  discard_reason: string;
  notes: string;
}

export interface BloodBag {
  id: number;
  bag_id: string;
  hospital: number;
  donation: number;
  donor_name: string;
  component: ComponentType;
  component_label: string;
  blood_group: BloodGroup;
  blood_group_label: string;
  volume_ml: number;
  collected_at: string;
  expiry_date: string;
  days_to_expiry: number | null;
  is_expired: boolean;
  status: BagStatus;
  status_label: string;
  storage_location: string;
  issued_to_requisition: number | null;
  discard_reason: string;
  notes: string;
}

export interface CrossMatch {
  id: number;
  requisition: number;
  bag: number;
  bag_id_str: string;
  bag_blood_group: string;
  bag_component: string;
  result: CrossMatchResult;
  result_label: string;
  notes: string;
  performed_at: string;
}

export interface BloodIssue {
  id: number;
  requisition: number;
  bag: number;
  bag_id_str: string;
  bag_component: string;
  bag_blood_group: string;
  issued_to_dept: string;
  issued_at: string;
  received_by_name: string;
  invoice: number | null;
  invoice_code: string | null;
  transfusion_started_at: string | null;
  transfusion_completed_at: string | null;
  reactions_observed: string;
  bag_returned: boolean;
  notes: string;
}

export interface BloodRequisition {
  id: number;
  code: string;
  hospital: number;
  patient: number;
  patient_name: string;
  patient_mrn: string;
  requested_by: number;
  requested_by_name: string;
  department: number | null;
  admission: number | null;
  admission_code: string | null;
  blood_group: BloodGroup;
  blood_group_label: string;
  component: ComponentType;
  component_label: string;
  units_required: number;
  units_issued: number;
  urgency: RequisitionUrgency;
  urgency_label: string;
  purpose: string;
  status: RequisitionStatus;
  status_label: string;
  rejection_reason: string;
  cancelled_reason: string;
  requested_at: string;
  issued_at: string | null;
  crossmatches: CrossMatch[];
  issues: BloodIssue[];
  notes: string;
}

export interface InventorySummary {
  as_of: string;
  stock_by_group_component: {
    [group: string]: { [component: string]: number };
  };
  totals: {
    available: number;
    reserved: number;
    quarantine: number;
    expiring_soon: number;
    expired_pending_discard: number;
  };
  expiring_soon: Array<{
    id: number;
    bag_id: string;
    component: ComponentType;
    blood_group: BloodGroup;
    expiry_date: string;
    storage_location: string;
  }>;
}
