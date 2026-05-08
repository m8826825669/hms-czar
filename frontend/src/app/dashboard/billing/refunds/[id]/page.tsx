"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { refundsApi } from "@/lib/api/refunds";
import type { RefundStatus } from "@/types/refunds";

const STATUS_BADGE: Record<RefundStatus, string> = {
  REQUESTED: "bg-amber-100 text-amber-800 ring-amber-300",
  APPROVED: "bg-blue-100 text-blue-800 ring-blue-300",
  PROCESSED: "bg-emerald-100 text-emerald-800 ring-emerald-300",
  REJECTED: "bg-slate-200 text-slate-700 ring-slate-300",
};

export default function RefundDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const refundId = Number(id);
  const qc = useQueryClient();

  const { data: refund, isLoading } = useQuery({
    queryKey: ["refund", refundId],
    queryFn: () => refundsApi.get(refundId),
  });

  const approve = useMutation({
    mutationFn: () => refundsApi.approve(refundId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["refund", refundId] }),
  });
  const process = useMutation({
    mutationFn: () => refundsApi.process(refundId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["refund", refundId] }),
  });
  const reject = useMutation({
    mutationFn: (reason: string) => refundsApi.reject(refundId, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["refund", refundId] }),
  });

  if (isLoading || !refund) {
    return <div className="p-12 text-center text-slate-400">Loading…</div>;
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/dashboard/billing/refunds" className="text-sm text-slate-500 hover:text-sky-700">
            ← All refunds
          </Link>
          <div className="flex items-center gap-3 mt-1">
            <h1 className="text-2xl font-semibold text-slate-900 font-mono">{refund.code}</h1>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ring-1 ${STATUS_BADGE[refund.status]}`}>
              {refund.status_label}
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          {refund.status === "REQUESTED" && (
            <>
              <button
                onClick={() => approve.mutate()}
                disabled={approve.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
              >
                Approve
              </button>
              <button
                onClick={() => {
                  const reason = prompt("Rejection reason:");
                  if (reason !== null) reject.mutate(reason);
                }}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 text-sm"
              >
                Reject
              </button>
            </>
          )}
          {refund.status === "APPROVED" && (
            <>
              <button
                onClick={() => process.mutate()}
                disabled={process.isPending}
                className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 text-sm font-medium disabled:opacity-50"
              >
                {refund.method === "RAZORPAY" ? "Process via Razorpay" : "Mark as Processed"}
              </button>
              <button
                onClick={() => {
                  const reason = prompt("Rejection reason:");
                  if (reason !== null) reject.mutate(reason);
                }}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 text-sm"
              >
                Reject
              </button>
            </>
          )}
        </div>
      </div>

      {(approve.isError || process.isError || reject.isError) && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">
          {((approve.error || process.error || reject.error) as
            { response?: { data?: { detail?: string } } })?.response?.data?.detail
            ?? "Action failed"}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          {/* Refund details */}
          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <h2 className="text-base font-semibold text-slate-800 mb-4">Refund Details</h2>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <Field label="Amount" value={`₹${Number(refund.amount).toFixed(2)}`} mono />
              <Field label="Method" value={refund.method_label} />
              <Field label="Patient" value={refund.patient_name} sub={refund.patient_mrn} />
              <Field label="Invoice" linkTo={`/dashboard/billing/${refund.invoice}`}
                value={refund.invoice_code}
                sub={`Total: ₹${Number(refund.invoice_total).toFixed(2)}`} />
              {refund.razorpay_refund_id && (
                <>
                  <Field label="Razorpay Refund ID" value={refund.razorpay_refund_id} mono />
                  <Field label="Razorpay Status" value={refund.razorpay_status || "—"} />
                </>
              )}
            </dl>

            <div className="mt-4 pt-4 border-t border-slate-100">
              <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">Reason</div>
              <div className="text-sm text-slate-800 whitespace-pre-line">{refund.reason}</div>
            </div>

            {refund.rejection_reason && (
              <div className="mt-3 px-3 py-2 bg-red-50 border border-red-200 rounded-md">
                <div className="text-xs uppercase tracking-wide text-red-700 mb-1">
                  Rejection Reason
                </div>
                <div className="text-sm text-red-800">{refund.rejection_reason}</div>
              </div>
            )}
          </div>

          {/* Razorpay panel */}
          {refund.method === "RAZORPAY" && (
            <div className="bg-white border border-slate-200 rounded-lg p-5">
              <h2 className="text-base font-semibold text-slate-800 mb-3">
                Razorpay Refund
              </h2>
              {refund.razorpay_refund_id ? (
                <div className="text-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Refund ID</span>
                    <span className="font-mono text-slate-800">{refund.razorpay_refund_id}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Razorpay Status</span>
                    <span className="font-medium text-slate-800">{refund.razorpay_status}</span>
                  </div>
                  <div className="text-xs text-slate-500 pt-2 border-t border-slate-100">
                    Funds typically settle to the customer's source account in 5-7 business days
                    (or instantly for "optimum" speed refunds).
                  </div>
                </div>
              ) : (
                <div className="text-sm text-slate-500 italic">
                  Razorpay refund will be initiated when this refund is processed.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Timeline */}
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500 mb-3">Timeline</div>
            <ol className="space-y-3">
              <TimelineItem
                label="Requested"
                value={refund.requested_at?.replace("T", " ").substring(0, 16)}
                done
              />
              <TimelineItem
                label="Approved"
                value={refund.approved_at?.replace("T", " ").substring(0, 16) ?? "—"}
                sub={refund.approved_by_name ? `by ${refund.approved_by_name}` : ""}
                done={!!refund.approved_at}
              />
              <TimelineItem
                label="Processed"
                value={refund.processed_at?.replace("T", " ").substring(0, 16) ?? "—"}
                done={!!refund.processed_at}
              />
              {refund.status === "REJECTED" && (
                <TimelineItem
                  label="Rejected"
                  value=""
                  done
                  red
                />
              )}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label, value, sub, mono, linkTo,
}: { label: string; value: string; sub?: string; mono?: boolean; linkTo?: string }) {
  const valueEl = (
    <div className={`text-sm text-slate-800 ${mono ? "font-mono" : "font-medium"}`}>
      {value || "—"}
    </div>
  );
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5">
        {linkTo ? (
          <Link href={linkTo} className="hover:text-sky-700 hover:underline">{valueEl}</Link>
        ) : valueEl}
        {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
      </dd>
    </div>
  );
}

function TimelineItem({
  label, value, sub, done, red,
}: { label: string; value: string; sub?: string; done: boolean; red?: boolean }) {
  return (
    <li className="flex items-start gap-3">
      <div
        className={`mt-1 w-2.5 h-2.5 rounded-full flex-shrink-0 ${
          red ? "bg-red-500" : done ? "bg-emerald-500" : "bg-slate-300"
        }`}
      />
      <div className="flex-1">
        <div className={`text-sm font-medium ${done ? "text-slate-800" : "text-slate-400"}`}>
          {label}
        </div>
        <div className="text-xs text-slate-500 font-mono">{value}</div>
        {sub && <div className="text-xs text-slate-500">{sub}</div>}
      </div>
    </li>
  );
}
