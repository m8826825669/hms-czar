// Phase 2b — Refund types
//
// IMPORTANT: This file ADDS to your existing types/billing.ts from Phase 1c.
// Append the contents below to that file (or copy this whole file as a new
// types/refunds.ts and import from there — both work).

export type RefundStatus = "REQUESTED" | "APPROVED" | "PROCESSED" | "REJECTED";
export type RefundMethod = "CASH" | "RAZORPAY" | "BANK_TRANSFER" | "ADJUSTMENT";

export interface Refund {
  id: number;
  code: string;
  invoice: number;
  invoice_code: string;
  invoice_total: string;
  patient_name: string;
  patient_mrn: string;
  payment: number | null;
  payment_method: string;
  amount: string;
  method: RefundMethod;
  method_label: string;
  reason: string;
  status: RefundStatus;
  status_label: string;
  requested_at: string;
  approved_at: string | null;
  processed_at: string | null;
  approved_by: number | null;
  approved_by_name: string;
  razorpay_refund_id: string;
  razorpay_status: string;
  rejection_reason: string;
  notes: string;
  created_at: string;
}

// The Phase 1c Invoice type already has amount_paid + amount_due. Phase 2b adds
// amount_refunded — extend your existing Invoice type with this one field:
//   amount_refunded: string;
// (it's already returned by the API; just declare it on the TS side too.)
