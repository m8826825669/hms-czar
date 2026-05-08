"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { refundsApi } from "@/lib/api/refunds";
import type { Refund, RefundStatus } from "@/types/refunds";

const STATUS_BADGE: Record<RefundStatus, string> = {
  REQUESTED: "bg-amber-100 text-amber-800",
  APPROVED: "bg-blue-100 text-blue-800",
  PROCESSED: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-slate-200 text-slate-600",
};

export default function RefundsListPage() {
  const [tab, setTab] = useState<"pending" | "all">("pending");
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ["refunds", tab],
    queryFn: () =>
      tab === "pending"
        ? refundsApi.pending()
        : refundsApi.list({ page_size: 100 }).then(r => r.results),
  });

  const approve = useMutation({
    mutationFn: (id: number) => refundsApi.approve(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["refunds"] }),
  });
  const process = useMutation({
    mutationFn: (id: number) => refundsApi.process(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["refunds"] }),
  });
  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      refundsApi.reject(id, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["refunds"] }),
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Refunds</h1>
          <p className="text-sm text-slate-500 mt-1">
            Review, approve, and process refund requests
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <div className="flex gap-1">
          {([
            { k: "pending" as const, label: "Pending" },
            { k: "all" as const, label: "All Refunds" },
          ]).map(({ k, label }) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
                tab === k
                  ? "border-sky-600 text-sky-700"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {list.isLoading ? (
          <div className="p-12 text-center text-slate-400">Loading…</div>
        ) : !list.data?.length ? (
          <div className="p-12 text-center text-slate-400">
            {tab === "pending" ? "No pending refunds." : "No refunds yet."}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-left text-xs uppercase tracking-wide">
              <tr>
                <th className="px-5 py-2 font-medium">Code</th>
                <th className="px-5 py-2 font-medium">Invoice</th>
                <th className="px-5 py-2 font-medium">Patient</th>
                <th className="px-5 py-2 font-medium text-right">Amount</th>
                <th className="px-5 py-2 font-medium">Method</th>
                <th className="px-5 py-2 font-medium">Status</th>
                <th className="px-5 py-2 font-medium">Reason</th>
                <th className="px-5 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.data.map(r => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-5 py-2 font-mono text-xs">
                    <Link href={`/dashboard/billing/refunds/${r.id}`}
                          className="text-sky-700 hover:underline">
                      {r.code}
                    </Link>
                  </td>
                  <td className="px-5 py-2 font-mono text-xs">
                    <Link href={`/dashboard/billing/${r.invoice}`}
                          className="text-slate-700 hover:text-sky-700 hover:underline">
                      {r.invoice_code}
                    </Link>
                  </td>
                  <td className="px-5 py-2">
                    <div className="font-medium text-slate-800">{r.patient_name}</div>
                    <div className="text-xs text-slate-500 font-mono">{r.patient_mrn}</div>
                  </td>
                  <td className="px-5 py-2 text-right font-mono text-slate-800 font-medium">
                    ₹{Number(r.amount).toFixed(2)}
                  </td>
                  <td className="px-5 py-2 text-xs">{r.method_label}</td>
                  <td className="px-5 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[r.status]}`}>
                      {r.status_label}
                    </span>
                  </td>
                  <td className="px-5 py-2 text-xs text-slate-600 max-w-xs truncate" title={r.reason}>
                    {r.reason}
                  </td>
                  <td className="px-5 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {r.status === "REQUESTED" && (
                        <>
                          <button
                            onClick={() => approve.mutate(r.id)}
                            disabled={approve.isPending}
                            className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => {
                              const reason = prompt("Rejection reason:");
                              if (reason !== null) reject.mutate({ id: r.id, reason });
                            }}
                            className="px-2 py-1 text-xs border border-slate-300 text-slate-700 rounded hover:bg-slate-50"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {r.status === "APPROVED" && (
                        <button
                          onClick={() => process.mutate(r.id)}
                          disabled={process.isPending}
                          className="px-2 py-1 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50"
                        >
                          Process
                        </button>
                      )}
                      <Link
                        href={`/dashboard/billing/refunds/${r.id}`}
                        className="px-2 py-1 text-xs text-slate-600 hover:text-sky-700"
                      >
                        View →
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
