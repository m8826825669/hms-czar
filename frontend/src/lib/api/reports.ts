// frontend/src/lib/api/reports.ts
"use client";
import { api } from "@/lib/api";

const BILL = "/billing";
const SPC  = "/specialist";

// ─── GST report types ────────────────────────────────────────────────────────

export interface GSTR1Row {
  place_of_supply: string;
  rate: string;
  supply_type: string;
  taxable_value: string;
  cgst: string;
  sgst: string;
  igst: string;
}

export interface GSTR1HSNRow {
  hsn_code: string;
  rate: string;
  quantity: string;
  taxable_value: string;
  cgst: string;
  sgst: string;
  igst: string;
  total_value: string;
}

export interface GSTR1Report {
  gstin: string;
  fp: string;
  period: string;
  period_label: string;
  b2cs: GSTR1Row[];
  b2cl: Array<{
    invoice_no: string; invoice_date: string; invoice_value: string;
    place_of_supply: string; rate: string;
    taxable_value: string; igst: string;
  }>;
  hsn_summary: GSTR1HSNRow[];
  docs: {
    invoices_issued: number;
    invoices_cancelled: number;
    refunds_processed: number;
  };
  totals: {
    taxable_value: string;
    cgst: string;
    sgst: string;
    igst: string;
    total_tax: string;
    grand_total: string;
  };
}

export interface GSTR3BReport {
  gstin: string;
  ret_period: string;
  period: string;
  period_label: string;
  sec_3_1: {
    outward_taxable: { taxable_value: string; cgst: string; sgst: string; igst: string; cess: string };
    other_outward:    { taxable_value: string; cgst: string; sgst: string; igst: string; cess: string };
    zero_rated:       { taxable_value: string; igst: string; cess: string };
    inward_reverse:   { taxable_value: string; cgst: string; sgst: string; igst: string; cess: string };
    non_gst_outward:  { taxable_value: string };
  };
  sec_4_itc: { itc_available: { cgst: string; sgst: string; igst: string }; note: string };
  sec_6_1_tax_payable: { cgst: string; sgst: string; igst: string; total: string };
  summary: {
    total_outward_taxable: string;
    total_outward_exempt: string;
    total_invoices: number;
    total_tax_payable: string;
  };
}

// ─── GST API ─────────────────────────────────────────────────────────────────

export const gstApi = {
  gstr1: (year: number, month: number) =>
    api.get<GSTR1Report>(`${BILL}/gst/gstr1/`, { params: { year, month } })
       .then(r => r.data),

  gstr3b: (year: number, month: number) =>
    api.get<GSTR3BReport>(`${BILL}/gst/gstr3b/`, { params: { year, month } })
       .then(r => r.data),

  workbookUrl: (year: number, month: number) =>
    `${process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000"}/api/v1${BILL}/gst/workbook/?year=${year}&month=${month}`,
};

// ─── Doctor dashboard ────────────────────────────────────────────────────────

export interface DoctorDashboard {
  as_of: string;
  doctor: {
    id: number;
    name: string;
    registration_number: string;
    department: string;
  };
  counts: {
    today_appointments: number;
    pending_consultations: number;
    pending_lab_orders: number;
    active_ipd_admissions: number;
    recent_prescriptions: number;
  };
  today_appointments: Array<{
    id: number; code: string;
    patient_id: number; patient_name: string; patient_mrn: string;
    scheduled_at: string; status: string; status_label: string;
  }>;
  pending_consultations: Array<{
    id: number; code: string;
    patient_id: number; patient_name: string; patient_mrn: string;
    consultation_date: string; chief_complaint: string;
  }>;
  pending_lab_orders: Array<{
    id: number; code: string;
    patient_id: number; patient_name: string; patient_mrn: string;
    order_date: string; status: string; status_label: string;
    priority: string; test_count: number; abnormal_count: number;
  }>;
  active_ipd_admissions: Array<{
    id: number; code: string;
    patient_name: string; patient_mrn: string;
    bed_code: string; ward_name: string;
    admitted_at: string; stay_days: number; admission_type: string;
  }>;
  recent_prescriptions: Array<{
    id: number; code: string;
    patient_name: string; patient_mrn: string;
    consultation_code: string;
    issued_at: string; item_count: number;
  }>;
}

export const doctorDashboardApi = {
  today: (doctorId?: number) =>
    api.get<DoctorDashboard>(`${SPC}/dashboard/today/`, {
      params: doctorId ? { doctor_id: doctorId } : {},
    }).then(r => r.data),
};
