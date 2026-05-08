// Phase 2b — Lab types

export type LabOrderStatus =
  | "DRAFT"
  | "ORDERED"
  | "COLLECTED"
  | "IN_PROGRESS"
  | "REPORTED"
  | "CANCELLED";

export type LabOrderPriority = "ROUTINE" | "URGENT" | "STAT";

export type LabResultFlag = "NORMAL" | "LOW" | "HIGH" | "CRITICAL";

export type SampleType =
  | "BLOOD"
  | "URINE"
  | "STOOL"
  | "SPUTUM"
  | "SWAB"
  | "CSF"
  | "TISSUE"
  | "IMAGE"
  | "OTHER";

export type TestCategory =
  | "HEMATOLOGY"
  | "BIOCHEMISTRY"
  | "MICROBIOLOGY"
  | "SEROLOGY"
  | "URINALYSIS"
  | "RADIOLOGY"
  | "PATHOLOGY"
  | "OTHER";

export interface TestParameter {
  id: number;
  test: number;
  code: string;
  name: string;
  unit: string;
  ref_low: string | null;
  ref_high: string | null;
  ref_text: string;
  critical_low: string | null;
  critical_high: string | null;
  is_qualitative: boolean;
  sort_order: number;
}

export interface TestCatalog {
  id: number;
  code: string;
  name: string;
  category: TestCategory;
  category_label: string;
  sample_type: SampleType;
  sample_type_label: string;
  sample_volume: string;
  price: string;
  hsn_code: string;
  gst_rate: string;
  typical_tat_hours: number;
  requires_fasting: boolean;
  instructions: string;
  is_active: boolean;
  parameters: TestParameter[];
  parameter_count: number;
}

export interface LabResult {
  id: number;
  order_item: number;
  parameter: number;
  parameter_name: string;
  parameter_unit: string;
  parameter_ref: string;
  parameter_code: string;
  is_qualitative: boolean;
  value: string;
  flag: LabResultFlag;
  flag_label: string;
  interpretation: string;
  entered_at: string;
  entered_by: number | null;
  entered_by_name: string;
  verified_at: string | null;
  verified_by: number | null;
  sort_order: number;
}

export interface LabOrderItem {
  id: number;
  order: number;
  test: number;
  test_code: string;
  test_name: string;
  test_category: string;
  test_parameters: TestParameter[];
  sample_type: string;
  price: string;
  gst_rate: string;
  gst_amount: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  status_label: string;
  abnormal_count: number;
  notes: string;
  order_index: number;
  results: LabResult[];
}

export interface LabSample {
  id: number;
  order: number;
  sample_type: SampleType;
  sample_type_label: string;
  container: string;
  barcode: string;
  volume: string;
  collected_by: number | null;
  collected_by_name: string;
  collected_at: string;
  is_received: boolean;
  is_rejected: boolean;
  rejection_reason: string;
  notes: string;
}

export interface LabOrder {
  id: number;
  code: string;
  order_date: string;
  patient: number;
  patient_name: string;
  patient_mrn: string;
  patient_phone: string;
  patient_age: number;
  patient_gender: string;
  consultation: number | null;
  consultation_code: string;
  ordered_by: number;
  ordered_by_name: string;
  reported_by: number | null;
  reported_by_name: string;
  priority: LabOrderPriority;
  priority_label: string;
  clinical_notes: string;
  requires_fasting: boolean;
  fasting_hours: number;
  subtotal: string;
  cgst_amount: string;
  sgst_amount: string;
  igst_amount: string;
  total_amount: string;
  invoice: number | null;
  invoice_code: string;
  invoice_status: string;
  status: LabOrderStatus;
  status_label: string;
  sample_collected_at: string | null;
  reported_at: string | null;
  notes: string;
  test_count: number;
  abnormal_count: number;
  items: LabOrderItem[];
  samples: LabSample[];
  created_at: string;
}

export interface LabTodayDashboard {
  date: string;
  order_count: number;
  by_status: Record<string, number>;
  pending_collection: number;
  in_progress: number;
  stat_orders: number;
  orders: LabOrder[];
}

// Refund types live in billing.ts already — see frontend/src/types/billing.ts
