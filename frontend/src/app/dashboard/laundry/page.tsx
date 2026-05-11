"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { laundryBatchesApi, linenItemsApi } from "@/lib/api/phase3b";
import type { LaundryBatch, LinenItem } from "@/types/phase3b";

const STATUS_CHIPS: Record<string, string> = {
  COLLECTING:  "bg-slate-100 text-slate-700",
  COLLECTED:   "bg-indigo-100 text-indigo-800",
  SENT:        "bg-blue-100 text-blue-800",
  RECEIVED:    "bg-emerald-100 text-emerald-800",
  RECONCILED:  "bg-emerald-200 text-emerald-900",
  DISCARDED:   "bg-rose-100 text-rose-800",
};


export default function LaundryDashboardPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"batches" | "linen">("batches");

  const { data: batches = [] } = useQuery({
    queryKey: ["laundry-batches"],
    queryFn: async () => (await laundryBatchesApi.list()).data,
    enabled: tab === "batches",
  });
  const { data: linen = [] } = useQuery({
    queryKey: ["linen-items"],
    queryFn: async () => (await linenItemsApi.list()).data,
    enabled: tab === "linen",
  });

  const send = useMutation({
    mutationFn: (id: number) => laundryBatchesApi.sendToLaundry(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["laundry-batches"] }),
  });

  return (
    <div className="p-6 space-y-5 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Laundry / Linen</h1>
          <p className="text-sm text-slate-500 mt-1">
            Track linen circulation and laundry batches.
          </p>
        </div>
      </div>

      <div className="border-b border-slate-200">
        <nav className="flex gap-4">
          {(["batches", "linen"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
                    className={`px-4 py-2 text-sm border-b-2 ${
                      tab === t
                        ? "border-sky-700 text-sky-700 font-medium"
                        : "border-transparent text-slate-600"
                    }`}>
              {t === "batches" ? "Laundry Batches" : "Linen Inventory"}
            </button>
          ))}
        </nav>
      </div>

      {tab === "batches" && (
        <div className="space-y-2">
          {batches.length === 0 && (
            <p className="text-sm text-slate-500 italic text-center py-8">
              No laundry batches.
            </p>
          )}
          {batches.map((b: LaundryBatch) => (
            <div key={b.id}
                 className="border border-slate-200 rounded-md p-3 bg-white">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <span className="font-mono text-xs text-slate-500">{b.code}</span>
                  <span className="ml-3 font-medium">
                    {b.department_name || "—"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded ${STATUS_CHIPS[b.status]}`}>
                    {b.status_label}
                  </span>
                  {b.status === "COLLECTED" && (
                    <button onClick={() => send.mutate(b.id)}
                            disabled={send.isPending}
                            className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">
                      Send to Laundry
                    </button>
                  )}
                </div>
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Collected: {new Date(b.collected_at).toLocaleString("en-IN")}
                {b.sent_to_laundry_at && (
                  <span> · Sent: {new Date(b.sent_to_laundry_at).toLocaleString("en-IN")}</span>
                )}
                {b.received_back_at && (
                  <span> · Received: {new Date(b.received_back_at).toLocaleString("en-IN")}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "linen" && (
        <div className="border border-slate-200 rounded-md overflow-hidden bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-2 text-xs font-medium uppercase">Code</th>
                <th className="text-left px-4 py-2 text-xs font-medium uppercase">Name</th>
                <th className="text-left px-4 py-2 text-xs font-medium uppercase">Category</th>
                <th className="text-right px-4 py-2 text-xs font-medium uppercase">Unit Value</th>
                <th className="text-right px-4 py-2 text-xs font-medium uppercase">In Circulation</th>
              </tr>
            </thead>
            <tbody>
              {linen.length === 0 && (
                <tr><td colSpan={5} className="text-center py-8 text-slate-500 italic">
                  No linen items.
                </td></tr>
              )}
              {linen.map((l: LinenItem) => (
                <tr key={l.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2 font-mono text-xs">{l.code}</td>
                  <td className="px-4 py-2 font-medium">{l.name}</td>
                  <td className="px-4 py-2 text-slate-600">{l.category_label}</td>
                  <td className="px-4 py-2 text-right">₹{l.unit_value}</td>
                  <td className="px-4 py-2 text-right font-medium">{l.total_in_circulation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
