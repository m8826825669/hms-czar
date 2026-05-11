// Phase 4c: Insurance / TPA, Vaccination, Complaints & Feedback

// ─── Insurance ──────────────────────────────────────────────────────────

export interface InsuranceCompany {
  id: number;
  code: string;
  name: string;
  short_name: string;
  contact_person: string;
  phone: string;
  email: string;
  helpline_number: string;
  portal_url: string;
  is_empanelled: boolean;
  is_cashless: boolean;
  is_active: boolean;
  notes: string;
  created_at: string;
}

export interface TPA {
  id: number;
  code: string;
  name: string;
  short_name: string;
  contact_person: string;
  phone: string;
  email: string;
  address: string;
  portal_url: string;
  insurance_companies: number[];
  is_active: boolean;
  created_at: string;
}

export interface PolicyCoverage {
  id: number;
  patient: number;
  patient_name?: string;
  insurance_company: number;
  insurance_company_name?: string;
  tpa: number | null;
  tpa_name?: string;
  policy_number: string;
  member_id: string;
  policy_holder_name: string;
  relation_to_holder: string;
  cover_type: "INDIVIDUAL" | "FAMILY" | "GROUP" | "SENIOR" | "MATERNITY";
  cover_type_label?: string;
  sum_insured: string;
  co_pay_percentage: string;
  policy_start_date: string;
  policy_end_date: string;
  is_active: boolean;
  notes: string;
}

export interface PreAuth {
  id: number;
  code: string;
  patient: number;
  patient_name?: string;
  policy: number;
  policy_number?: string;
  insurance_name?: string;
  admission: number | null;
  urgency: "PLANNED" | "EMERG";
  urgency_label?: string;
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "PARTIAL" | "REJECTED" | "EXPIRED" | "CANCELLED";
  status_label?: string;
  request_date: string;
  expected_admission_date: string | null;
  expected_stay_days: number;
  primary_diagnosis: string;
  treatment_plan: string;
  requested_amount: string;
  approved_amount: string;
  tpa_reference: string;
  submitted_at: string | null;
  decision_at: string | null;
  decision_notes: string;
  valid_until: string | null;
  notes: string;
  created_at: string;
}

export interface ClaimLine {
  id: number;
  claim: number;
  description: string;
  quantity: string;
  rate: string;
  amount: string;
  is_disallowed: boolean;
  disallowance_reason: string;
}

export interface ClaimDocument {
  id: number;
  claim: number;
  document_type: string;
  document_type_label?: string;
  document_url: string;
  description: string;
  uploaded_at: string;
}

export interface Claim {
  id: number;
  code: string;
  patient: number;
  patient_name?: string;
  policy: number;
  policy_number?: string;
  insurance_name?: string;
  pre_auth: number | null;
  pre_auth_code?: string;
  invoice: number | null;
  invoice_code?: string;
  admission: number | null;
  claim_type: "CASHLESS" | "REIMBURSEMENT";
  claim_type_label?: string;
  status: "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "PARTIAL" | "REJECTED" | "SETTLED" | "CLOSED";
  status_label?: string;
  submission_date: string;
  tpa_claim_number: string;
  bill_amount: string;
  co_pay_amount: string;
  deductions: string;
  claim_amount: string;
  approved_amount: string;
  settled_amount: string;
  settled_date: string | null;
  rejection_reason: string;
  notes: string;
  lines: ClaimLine[];
  documents: ClaimDocument[];
  created_at: string;
}

export interface InsuranceDashboard {
  total_companies: number;
  active_policies: number;
  pre_auths_pending: number;
  claims_submitted: number;
  claims_approved_amount: string;
  claims_settled_amount: string;
  by_status: Record<string, number>;
}

// ─── Vaccination ────────────────────────────────────────────────────────

export interface ImmunizationSchedule {
  id: number;
  vaccine: number;
  dose_number: number;
  age_value: number;
  age_unit: "BIRTH" | "WEEK" | "MONTH" | "YEAR";
  age_unit_label?: string;
  description: string;
}

export interface Vaccine {
  id: number;
  code: string;
  name: string;
  full_name: string;
  vaccine_type: "PAEDIATRIC" | "ADULT" | "BOTH" | "TRAVEL" | "SEASONAL" | "PANDEMIC";
  vaccine_type_label?: string;
  manufacturer: string;
  doses_required: number;
  booster_required: boolean;
  booster_interval_months: number;
  route_of_administration: string;
  standard_dose_ml: string;
  is_under_uip: boolean;
  standard_price: string;
  description: string;
  contraindications: string;
  side_effects: string;
  is_active: boolean;
  schedule: ImmunizationSchedule[];
}

export interface VaccinationCertificate {
  id: number;
  record: number;
  certificate_number: string;
  issued_at: string;
  certificate_url: string;
  verification_code: string;
}

export interface VaccinationRecord {
  id: number;
  patient: number;
  patient_name?: string;
  patient_code?: string;
  vaccine: number;
  vaccine_code?: string;
  vaccine_name?: string;
  dose_number: number;
  scheduled_date: string | null;
  administered_date: string | null;
  next_dose_date: string | null;
  status: "SCHEDULED" | "ADMINISTERED" | "MISSED" | "REFUSED" | "DEFERRED";
  status_label?: string;
  batch_number: string;
  expiry_date: string | null;
  administrator_name: string;
  site_of_injection: string;
  adverse_reactions: string;
  notes: string;
  certificate: VaccinationCertificate | null;
  created_at: string;
}

export interface PatientVaccinationHistory {
  patient_id: number;
  patient_name: string;
  history: VaccinationRecord[];
  due_vaccinations: Array<{
    vaccine_id: number;
    vaccine_code: string;
    vaccine_name: string;
    dose_number: number;
    due_date: string;
  }>;
}

// ─── Complaints & Feedback ──────────────────────────────────────────────

export interface TicketCategory {
  id: number;
  code: string;
  name: string;
  description: string;
  default_priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  target_resolution_hours: number;
  is_active: boolean;
}

export interface TicketComment {
  id: number;
  ticket: number;
  author: number | null;
  author_name: string;
  comment: string;
  is_internal: boolean;
  is_status_change: boolean;
  attachment_url: string;
  created_at: string;
}

export interface Ticket {
  id: number;
  code: string;
  category: number;
  category_name?: string;
  category_code?: string;
  title: string;
  description: string;
  source: "PATIENT" | "ATTENDANT" | "STAFF" | "VENDOR" | "ONLINE" | "PHONE" | "WALK_IN";
  source_label?: string;
  reporter_name: string;
  reporter_phone: string;
  reporter_email: string;
  related_patient: number | null;
  related_patient_name?: string;
  related_department: number | null;
  related_department_name?: string;
  related_staff_name: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  priority_label?: string;
  status: "OPEN" | "IN_PROGRESS" | "WAITING" | "RESOLVED" | "CLOSED" | "REOPENED" | "CANCELLED";
  status_label?: string;
  assigned_to: number | null;
  assigned_to_name?: string;
  assigned_at: string | null;
  target_resolution_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  is_sla_breached: boolean;
  resolution: string;
  customer_satisfaction: number | null;
  notes: string;
  comments: TicketComment[];
  created_at: string;
  updated_at: string;
}

export interface NPSResponse {
  id: number;
  patient: number | null;
  patient_name?: string;
  reporter_name: string;
  reporter_phone: string;
  score: number;
  feedback: string;
  related_visit_date: string | null;
  related_department: number | null;
  related_department_name?: string;
  category: "PROMOTER" | "PASSIVE" | "DETRACTOR";
  created_at: string;
}

export interface NPSMetrics {
  period_days: number;
  total: number;
  promoters: number;
  passives: number;
  detractors: number;
  nps: number;
  avg_score: number;
}

export interface TicketsDashboard {
  open_count: number;
  sla_breached: number;
  by_status: Record<string, number>;
  by_priority: Record<string, number>;
  avg_csat: number;
  total: number;
}
