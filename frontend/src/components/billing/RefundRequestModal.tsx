"use client";

import { useState, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { refundsApi } from "@/lib/api/refunds";

interface InvoiceLite {
  id: number;
  code: string;
  amount_paid: string;
  amount_refunded?: string;
  payments?: Array<{
    id: number;
    amount: string;
    method: string;
    status: string;
    received_at: string;
    razorpay_payment_id?: string;
  }>;
}

interface Props {
  invoice: InvoiceLite;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function RefundRequestModal({ invoice, open, onClose, onSuccess }: Props) {
  const successPayments = useMemo(
    () => (invoice.payments ?? []).filter(p => p.status === "SUCCESS"),
    [invoice.payments],
  );
  const defaultPayment = successPayments
    .slice()
    .sort((a, b) => b.received_at.localeCompare(a.received_at))[0];

  const maxRefundable = Math.max(
    0,
    Number(invoice.amount_paid) - Number(invoice.amount_refunded ?? 0),
  );

  const [paymentId, setPaymentId] = useState<number | undefined>(defaultPayment?.id);
  const [amount, setAmount] = useState<string>(maxRefundable.toFixed(2));
  const [reason, setReason] = useState("");
  const [method, setMethod] = useState<string>(
    defaultPayment?.method === "RAZORPAY" && defaultPayment?.razorpay_payment_id
      ? "RAZORPAY" : "CASH"
  );

  const submit = useMutation({
    mutationFn: () =>
      refundsApi.request(invoice.id, {
        amount,
        reason: reason.trim(),
        method,
        payment_id: paymentId,
      }),
    onSuccess: () => {
      onSuccess?.();
      onClose();
    },
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg w-full max-w-lg mx-4 shadow-xl">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Request Refund</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl leading-none">
            ×
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="bg-slate-50 border border-slate-200 rounded-md p-3 text-sm">
            <div className="font-mono text-slate-700">{invoice.code}</div>
            <div className="text-xs text-slate-500 mt-1">
              Paid: ₹{Number(invoice.amount_paid).toFixed(2)} ·
              Already refunded: ₹{Number(invoice.amount_refunded ?? 0).toFixed(2)} ·
              <span className="font-medium text-slate-700"> Refundable: ₹{maxRefundable.toFixed(2)}</span>
            </div>
          </div>

          {/* Payment to refund against */}
          {successPayments.length > 1 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Refund against payment
              </label>
              <select
                value={paymentId ?? ""}
                onChange={e => {
                  const id = e.target.value ? Number(e.target.value) : undefined;
                  setPaymentId(id);
                  const p = successPayments.find(x => x.id === id);
                  if (p?.method === "RAZORPAY" && p.razorpay_payment_id) {
                    setMethod("RAZORPAY");
                  } else if (method === "RAZORPAY") {
                    setMethod("CASH");
                  }
                }}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 outline-none"
              >
                {successPayments.map(p => (
                  <option key={p.id} value={p.id}>
                    ₹{p.amount} · {p.method} · {p.received_at.substring(0, 10)}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Amount (₹)
            </label>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              min={0.01}
              max={maxRefundable}
              step={0.01}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 outline-none font-mono"
            />
            <div className="text-xs text-slate-500 mt-1">
              Maximum refundable: ₹{maxRefundable.toFixed(2)}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Refund Method
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { v: "RAZORPAY", label: "Razorpay (online)" },
                { v: "CASH", label: "Cash" },
                { v: "BANK_TRANSFER", label: "Bank Transfer" },
                { v: "ADJUSTMENT", label: "Credit Adjustment" },
              ].map(opt => (
                <button
                  key={opt.v}
                  onClick={() => setMethod(opt.v)}
                  disabled={
                    opt.v === "RAZORPAY" &&
                    !(defaultPayment?.method === "RAZORPAY" && defaultPayment?.razorpay_payment_id)
                  }
                  className={`px-3 py-2 text-sm rounded-md border transition ${
                    method === opt.v
                      ? "border-sky-500 bg-sky-50 text-sky-700 font-medium"
                      : "border-slate-200 hover:border-slate-300 text-slate-700"
                  } disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={3}
              placeholder="e.g. Patient cancelled procedure, billing error, duplicate charge…"
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 outline-none"
            />
          </div>

          {submit.isError && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">
              {(submit.error as { response?: { data?: { detail?: string } } })?.response?.data?.detail
                ?? (submit.error as Error)?.message
                ?? "Could not submit refund"}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-slate-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 text-sm"
          >
            Cancel
          </button>
          <button
            onClick={() => submit.mutate()}
            disabled={
              submit.isPending ||
              !reason.trim() ||
              Number(amount) <= 0 ||
              Number(amount) > maxRefundable
            }
            className="px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 disabled:opacity-50 text-sm font-medium"
          >
            {submit.isPending ? "Submitting…" : "Submit Refund Request"}
          </button>
        </div>
      </div>
    </div>
  );
}
