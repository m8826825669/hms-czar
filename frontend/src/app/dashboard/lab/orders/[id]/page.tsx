"use client";

import { useState } from "react";
import { use } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { labOrdersApi } from "@/lib/api/lab";
import type {
  LabOrder, LabOrderItem, LabOrderStatus, LabResultFlag, TestParameter,
} from "@/types/lab";

const STATUS_BADGE: Record<LabOrderStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  ORDERED: "bg-amber-100 text-amber-800",
  COLLECTED: "bg-blue-100 text-blue-800",
  IN_PROGRESS: "bg-indigo-100 text-indigo-800",
  REPORTED: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-slate-100 text-slate-500",
};

const FLAG_BADGE: Record<LabResultFlag, string> = {
  NORMAL: "bg-emerald-50 text-emerald-700 border-emerald-200",
  LOW: "bg-amber-50 text-amber-800 border-amber-300",
  HIGH: "bg-red-50 text-red-700 border-red-300",
  CRITICAL: "bg-red-100 text-red-900 border-red-500 font-bold",
};

export default function LabOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const orderId = Number(id);
  const qc = useQueryClient();

  const { data: order, isLoading } = useQuery({
    queryKey: ["lab-order", orderId],
    queryFn: () => labOrdersApi.get(orderId),
    refetchInterval: (q) =>
      ["DRAFT", "REPORTED", "CANCELLED"].includes(q.state.data?.status ?? "")
        ? false : 30_000,
  });

  const finalize = useMutation({
    mutationFn: () => labOrdersApi.finalize(orderId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lab-order", orderId] }),
  });
  const collect = useMutation({
    mutationFn: () => labOrdersApi.collectSamples(orderId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lab-order", orderId] }),
  });
  const release = useMutation({
    mutationFn: () => labOrdersApi.release(orderId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lab-order", orderId] }),
  });
  const cancel = useMutation({
    mutationFn: (reason: string) => labOrdersApi.cancel(orderId, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lab-order", orderId] }),
  });

  if (isLoading || !order) {
    return <div className="p-12 text-center text-slate-400">Loading…</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/dashboard/lab" className="text-sm text-slate-500 hover:text-sky-700">
            ← Lab dashboard
          </Link>
          <div className="flex items-center gap-3 mt-1">
            <h1 className="text-2xl font-semibold text-slate-900 font-mono">{order.code}</h1>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_BADGE[order.status]}`}>
              {order.status_label}
            </span>
            {order.priority !== "ROUTINE" && (
              <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                order.priority === "STAT" ? "bg-red-600 text-white" : "bg-orange-500 text-white"
              }`}>
                {order.priority}
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          {order.status === "REPORTED" && (
            <a
              href={labOrdersApi.reportPdfUrl(orderId)}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 text-sm font-medium"
            >
              📄 Download Report
            </a>
          )}
          {(order.status === "IN_PROGRESS") && (
            <a
              href={labOrdersApi.reportPdfUrl(orderId)}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 border border-emerald-300 text-emerald-700 rounded-md hover:bg-emerald-50 text-sm font-medium"
            >
              Preview Report
            </a>
          )}
          {!["REPORTED", "CANCELLED"].includes(order.status) && (
            <button
              onClick={() => {
                const reason = prompt("Reason for cancellation:");
                if (reason !== null) cancel.mutate(reason);
              }}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 text-sm"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Patient + clinical */}
          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <Field label="Patient" value={order.patient_name} sub={order.patient_mrn} />
              <Field label="Age / Gender" value={`${order.patient_age}y / ${order.patient_gender}`} />
              <Field label="Phone" value={order.patient_phone} />
              <Field label="Ordered By" value={order.ordered_by_name} />
              <Field label="Order Date" value={order.order_date} />
              {order.consultation_code && (
                <Field label="Consultation" value={order.consultation_code} />
              )}
            </div>
            {order.clinical_notes && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                  Clinical Notes
                </div>
                <div className="text-sm text-slate-700">{order.clinical_notes}</div>
              </div>
            )}
            {order.requires_fasting && (
              <div className="mt-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-800">
                ⚠ Fasting required: {order.fasting_hours} hours
              </div>
            )}
          </div>

          {/* DRAFT actions */}
          {order.status === "DRAFT" && (
            <DraftActions order={order} onFinalize={() => finalize.mutate()} pending={finalize.isPending} />
          )}

          {/* ORDERED → collect samples */}
          {order.status === "ORDERED" && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-base font-semibold text-amber-900">Awaiting Sample Collection</h3>
                  <p className="text-sm text-amber-800 mt-1">
                    Click below to auto-create sample tubes (one per unique sample type) and print barcodes.
                  </p>
                </div>
                <button
                  onClick={() => collect.mutate()}
                  disabled={collect.isPending}
                  className="px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 disabled:opacity-50 text-sm font-medium whitespace-nowrap"
                >
                  {collect.isPending ? "Creating…" : "Collect Samples →"}
                </button>
              </div>
            </div>
          )}

          {/* Tests + Results */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-800">
                Tests Ordered ({order.items.length})
              </h2>
            </div>
            {order.items.map((item) => (
              <TestSection
                key={item.id}
                order={order}
                item={item}
                onSaved={() => qc.invalidateQueries({ queryKey: ["lab-order", orderId] })}
              />
            ))}
          </div>

          {/* Release report */}
          {order.status === "IN_PROGRESS" && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-base font-semibold text-emerald-900">Ready to Release</h3>
                  <p className="text-sm text-emerald-800 mt-1">
                    Pathologist sign-off will mark all results verified and lock the report.
                  </p>
                </div>
                <button
                  onClick={() => release.mutate()}
                  disabled={release.isPending}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50 text-sm font-medium whitespace-nowrap"
                >
                  {release.isPending ? "Releasing…" : "Verify & Release Report"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Invoice */}
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">Invoice</div>
            {order.invoice_code ? (
              <Link
                href={`/dashboard/billing/${order.invoice}`}
                className="block hover:bg-slate-50 -m-2 p-2 rounded"
              >
                <div className="font-mono text-sm font-medium text-sky-700">
                  {order.invoice_code}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {order.invoice_status} · ₹{Number(order.total_amount).toFixed(2)}
                </div>
              </Link>
            ) : (
              <div className="text-sm text-slate-500">
                Not yet finalized — no invoice generated.
              </div>
            )}
          </div>

          {/* Samples */}
          {order.samples.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">
                Samples ({order.samples.length})
              </div>
              <div className="space-y-2">
                {order.samples.map(s => (
                  <div key={s.id} className="border border-slate-200 rounded p-2 text-xs">
                    <div className="font-mono font-medium text-slate-800">{s.barcode}</div>
                    <div className="text-slate-500 mt-0.5">
                      {s.sample_type_label}
                      {s.is_rejected && <span className="text-red-600 font-medium"> · REJECTED</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Abnormal counter */}
          {order.abnormal_count > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="text-xs uppercase tracking-wide text-red-700 mb-1">
                Abnormal Results
              </div>
              <div className="text-2xl font-bold text-red-700">{order.abnormal_count}</div>
              <div className="text-xs text-red-600 mt-0.5">parameter values out of range</div>
            </div>
          )}

          {/* Timeline */}
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">Timeline</div>
            <div className="space-y-2 text-xs">
              <TimelineRow label="Ordered" value={order.order_date} done />
              <TimelineRow label="Sample Collected"
                value={order.sample_collected_at?.replace("T", " ").substring(0, 16) ?? "—"}
                done={!!order.sample_collected_at} />
              <TimelineRow label="Reported"
                value={order.reported_at?.replace("T", " ").substring(0, 16) ?? "—"}
                done={!!order.reported_at} />
              {order.reported_by_name && (
                <div className="pt-2 border-t border-slate-100 text-slate-600">
                  By: <span className="font-medium">{order.reported_by_name}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Components ────────────────────────────────────────────────────────────────

function Field({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-sm text-slate-800 font-medium">{value || "—"}</div>
      {sub && <div className="text-xs text-slate-500 font-mono">{sub}</div>}
    </div>
  );
}

function TimelineRow({ label, value, done }: { label: string; value: string; done: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${done ? "bg-emerald-500" : "bg-slate-300"}`} />
      <div className={done ? "text-slate-700" : "text-slate-400"}>
        <span className="font-medium">{label}:</span> {value}
      </div>
    </div>
  );
}

function DraftActions({
  order, onFinalize, pending,
}: { order: LabOrder; onFinalize: () => void; pending: boolean }) {
  return (
    <div className="bg-sky-50 border border-sky-200 rounded-lg p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-sky-900">Draft Order</h3>
          <p className="text-sm text-sky-800 mt-1">
            Finalize to generate an invoice (₹{Number(order.total_amount).toFixed(2)})
            and send the order to the lab.
          </p>
        </div>
        <button
          onClick={onFinalize}
          disabled={pending || order.items.length === 0}
          className="px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 disabled:opacity-50 text-sm font-medium whitespace-nowrap"
        >
          {pending ? "Finalizing…" : "Finalize & Generate Invoice →"}
        </button>
      </div>
    </div>
  );
}

function TestSection({
  order, item, onSaved,
}: { order: LabOrder; item: LabOrderItem; onSaved: () => void }) {
  const canEnterResults = ["COLLECTED", "IN_PROGRESS"].includes(order.status);
  const isLocked = order.status === "REPORTED";

  // Build initial values from existing results
  const [values, setValues] = useState<Record<number, string>>(() => {
    const v: Record<number, string> = {};
    item.results.forEach(r => { v[r.parameter] = r.value; });
    return v;
  });

  const saveResults = useMutation({
    mutationFn: () => {
      const payload = Object.entries(values)
        .filter(([, v]) => (v ?? "").trim())
        .map(([param_id, value]) => ({
          parameter_id: Number(param_id),
          value,
        }));
      return labOrdersApi.enterResults(order.id, item.id, payload);
    },
    onSuccess: onSaved,
  });

  // Live preview of flags as user types
  const previewFlag = (param: TestParameter, raw: string): LabResultFlag | null => {
    if (!raw || param.is_qualitative) return null;
    const num = parseFloat(raw);
    if (Number.isNaN(num)) return null;
    if (param.critical_low !== null && num < parseFloat(param.critical_low)) return "CRITICAL";
    if (param.critical_high !== null && num > parseFloat(param.critical_high)) return "CRITICAL";
    if (param.ref_low !== null && num < parseFloat(param.ref_low)) return "LOW";
    if (param.ref_high !== null && num > parseFloat(param.ref_high)) return "HIGH";
    return "NORMAL";
  };

  return (
    <div className="border-b border-slate-100 last:border-b-0">
      <div className="px-5 py-3 bg-slate-50 flex items-center justify-between">
        <div>
          <div className="font-medium text-slate-800">{item.test_name}</div>
          <div className="text-xs text-slate-500 font-mono">
            {item.test_code} · {item.test_category}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {item.abnormal_count > 0 && (
            <span className="text-xs font-medium text-red-700">
              {item.abnormal_count} abnormal
            </span>
          )}
          <span className="px-2 py-0.5 rounded text-xs font-medium bg-white border border-slate-200">
            {item.status_label}
          </span>
        </div>
      </div>

      {item.test_parameters.length === 0 ? (
        <div className="px-5 py-3 text-xs text-slate-500 italic">
          No parameters defined for this test.
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-white text-slate-500 text-xs uppercase tracking-wide">
            <tr className="border-b border-slate-100">
              <th className="px-5 py-2 text-left font-medium">Parameter</th>
              <th className="px-5 py-2 text-left font-medium">Result</th>
              <th className="px-5 py-2 text-left font-medium">Unit</th>
              <th className="px-5 py-2 text-left font-medium">Reference</th>
              <th className="px-5 py-2 text-left font-medium">Flag</th>
            </tr>
          </thead>
          <tbody>
            {item.test_parameters.map(param => {
              const stored = values[param.id] ?? "";
              const flag = previewFlag(param, stored);
              const refDisplay = param.is_qualitative
                ? param.ref_text
                : (param.ref_low !== null && param.ref_high !== null
                    ? `${param.ref_low} - ${param.ref_high}`
                    : param.ref_low !== null ? `≥ ${param.ref_low}`
                    : param.ref_high !== null ? `≤ ${param.ref_high}` : "—");
              return (
                <tr key={param.id} className="border-b border-slate-100 last:border-b-0">
                  <td className="px-5 py-2">
                    <div className="text-slate-800">{param.name}</div>
                    <div className="text-xs text-slate-400 font-mono">{param.code}</div>
                  </td>
                  <td className="px-5 py-2">
                    {isLocked || !canEnterResults ? (
                      <span className={`font-mono ${flag === "LOW" ? "text-amber-700"
                        : flag === "HIGH" ? "text-red-700"
                        : flag === "CRITICAL" ? "text-red-900 font-bold" : "text-slate-800"}`}>
                        {stored || "—"}
                      </span>
                    ) : (
                      <input
                        type="text"
                        value={stored}
                        onChange={e => setValues(v => ({ ...v, [param.id]: e.target.value }))}
                        placeholder={param.is_qualitative ? "e.g. Negative" : "—"}
                        className={`w-32 border rounded px-2 py-1 text-sm font-mono outline-none focus:ring-2 focus:ring-sky-500 ${
                          flag === "LOW" ? "border-amber-300 text-amber-700"
                          : flag === "HIGH" ? "border-red-300 text-red-700"
                          : flag === "CRITICAL" ? "border-red-500 text-red-900 font-bold bg-red-50"
                          : "border-slate-300"
                        }`}
                      />
                    )}
                  </td>
                  <td className="px-5 py-2 text-xs text-slate-600">{param.unit || "—"}</td>
                  <td className="px-5 py-2 text-xs text-slate-600">{refDisplay}</td>
                  <td className="px-5 py-2">
                    {flag && (
                      <span className={`px-2 py-0.5 rounded border text-xs ${FLAG_BADGE[flag]}`}>
                        {flag}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {canEnterResults && item.test_parameters.length > 0 && (
        <div className="px-5 py-3 bg-slate-50 flex justify-end">
          <button
            onClick={() => saveResults.mutate()}
            disabled={saveResults.isPending}
            className="px-3 py-1.5 bg-sky-600 text-white rounded text-sm hover:bg-sky-700 disabled:opacity-50"
          >
            {saveResults.isPending ? "Saving…" : "Save Results"}
          </button>
        </div>
      )}
    </div>
  );
}
