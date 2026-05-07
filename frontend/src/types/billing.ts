// Phase 1c types - additive to Phase 1b types/hms.ts
export interface Service {
  id: number;
  code: string;
  name: string;
  category: "CONSULTATION" | "INVESTIGATION" | "PROCEDURE" | "ROOM" | "MEDICINE" | "PACKAGE" | "OTHER";
  description?: string;
  price: string;
  hsn_code?: string;
  gst_rate: string;
  is_taxable: boolean;
  is_active: boolean;
}

export interface InvoiceItem {
  id: number;
  invoice: number;
  service: number | null;
  service_name: string;
  hsn_code?: string;
  quantity: string;
  unit_price: string;
  discount_pct: string;
  subtotal: string;
  gst_rate: string;
  gst_amount: string;
  total: string;
  order_index: number;
}

export interface Payment {
  id: number;
  invoice: number;
  amount: string;
  method: "CASH" | "CARD" | "UPI" | "NETBANKING" | "RAZORPAY" | "CHEQUE" | "WALLET" | "INSURANCE" | "OTHER";
  method_label: string;
  reference?: string;
  status: "INITIATED" | "SUCCESS" | "FAILED" | "REFUNDED";
  status_label: string;
  received_at: string;
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  is_signature_verified: boolean;
  notes?: string;
}

export interface Invoice {
  id: number;
  code: string;
  bill_date: string;
  patient: number;
  patient_name: string;
  patient_mrn: string;
  patient_phone?: string;
  consultation: number | null;
  consultation_code?: string;
  appointment: number | null;
  appointment_code?: string;

  patient_state?: string;
  hospital_state?: string;
  gst_split: "INTRA" | "INTER" | "EXEMPT";

  subtotal: string;
  discount_amount: string;
  discount_reason?: string;
  taxable_amount: string;
  cgst_amount: string;
  sgst_amount: string;
  igst_amount: string;
  total_amount: string;
  amount_paid: string;
  amount_due: string;

  status: "DRAFT" | "PENDING" | "PARTIAL" | "PAID" | "CANCELLED" | "REFUNDED";
  status_label: string;
  razorpay_order_id?: string;
  notes?: string;
  cancelled_reason?: string;
  printed_at?: string;

  items: InvoiceItem[];
  payments: Payment[];
}

export interface RazorpayInitResponse {
  razorpay_order_id: string;
  razorpay_key_id: string;
  amount_paise: number;
  currency: string;
  invoice_code: string;
  patient_name: string;
  patient_phone: string;
  patient_email: string;
}

export interface PublicPrescriptionView {
  code: string;
  prescribed_at: string;
  is_signed: boolean;
  patient: {
    name: string;
    mrn: string;
    age: number;
    gender: string;
  };
  doctor: {
    name: string;
    registration_number: string;
    qualifications: string[];
  };
  hospital: {
    name: string;
    city: string;
    phone: string;
  };
  consultation: {
    code: string | null;
    date: string | null;
    diagnoses: Array<{
      text: string; icd10: string; type: string; is_primary: boolean;
    }>;
  };
  items: Array<{
    drug_name: string;
    dose: string;
    frequency: string;
    duration_days: number;
    route: string;
    instructions: string;
    is_continued: boolean;
  }>;
  general_instructions: string;
  next_followup_days: number | null;
}

export interface PublicQueueView {
  as_of: string;
  now_serving: Array<{
    token_no: string;
    doctor: string;
  }>;
  waiting: Array<{
    token_no: string;
    doctor: string;
    status: string;
  }>;
  waiting_count: number;
  completed_today: number;
}
