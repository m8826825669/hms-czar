// Phase 2a types — Department, DrugBatch, StockMovement, PharmacyOrder

export interface Department {
  id: number;
  code: string;
  name: string;
  type: "CLINICAL" | "DIAGNOSTIC" | "PHARMACY" | "WARD" | "OT" | "ADMIN" | "SUPPORT";
  type_label: string;
  description?: string;
  head_doctor: number | null;
  head_doctor_name?: string;
  location_hint?: string;
  phone_extn?: string;
  is_active: boolean;
  sort_order: number;
}

export interface DrugBatch {
  id: number;
  drug: number;
  drug_name: string;
  drug_strength: string;
  drug_dosage_form: string;
  batch_no: string;
  mfg_date: string | null;
  expiry_date: string;
  qty_purchased: number;
  qty_in_stock: number;
  purchase_price: string;
  mrp: string;
  supplier_name?: string;
  supplier_invoice_no?: string;
  received_at: string;
  hsn_code?: string;
  gst_rate: string;
  is_expired: boolean;
  is_near_expiry: boolean;
  notes?: string;
}

export interface StockMovement {
  id: number;
  drug: number;
  drug_name: string;
  batch: number | null;
  batch_no?: string;
  movement_type: "PURCHASE_IN" | "DISPENSE_OUT" | "RETURN_IN"
    | "EXPIRED_OUT" | "DAMAGED_OUT" | "ADJUSTMENT_IN" | "ADJUSTMENT_OUT";
  movement_label: string;
  quantity: number;
  moved_at: string;
  reference_type?: string;
  reference_id?: string;
  notes?: string;
}

export interface PharmacyOrderItem {
  id: number;
  order: number;
  drug: number;
  drug_strength?: string;
  batch: number;
  batch_no: string;
  expiry_date: string | null;
  drug_name: string;
  quantity: number;
  unit_mrp: string;
  discount_pct: string;
  gst_rate: string;
  subtotal: string;
  gst_amount: string;
  total: string;
  prescription_item: number | null;
  order_index: number;
}

export interface PharmacyOrder {
  id: number;
  code: string;
  order_date: string;
  patient: number;
  patient_name: string;
  patient_mrn: string;
  patient_phone?: string;
  prescription: number | null;
  prescription_code?: string;
  consultation: number | null;
  invoice: number | null;
  invoice_code?: string;
  invoice_status?: string;

  subtotal: string;
  discount_amount: string;
  cgst_amount: string;
  sgst_amount: string;
  igst_amount: string;
  total_amount: string;

  status: "DRAFT" | "COMPLETED" | "CANCELLED";
  status_label: string;
  dispensed_at?: string;
  notes?: string;

  items: PharmacyOrderItem[];
}

export interface AvailabilityResponse {
  drug_id: number;
  drug_name: string;
  total_in_stock: number;
  expired_qty: number;
  batches: DrugBatch[];
}

export interface LowStockRow {
  drug_id: number;
  code: string;
  name: string;
  dosage_form: string;
  strength: string;
  total_in_stock: number;
}

export interface OrderWithWarnings {
  order: PharmacyOrder;
  warnings: Array<{ drug_name: string; reason: string }>;
}
