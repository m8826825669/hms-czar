"use client";

import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { requisitionsApi } from "@/lib/api/phase4a";
import type { StockRequisition } from "@/types/phase4a";

const STATUS_CHIPS: Record<string, string> = {
  DRAFT:     "bg-slate-100 text-slate-700",
  SUBMITTED: "bg-indigo-100 text-indigo-800",
  APPROVED:  "bg-emerald-100 text-emerald-800",
  PARTIAL:   "bg-amber-100 text-amber-800",
  FULFILLED: "bg-emerald-200 text-emerald-900",
  CANCELLED: "bg-rose-100 text-rose-800",
};
const URGENCY_CHIPS: Record<string, string> = {
  ROUTINE: "bg-slate-100 text-slate-700",
  URGENT:  "bg-amber-100 text-amber-800",
  EMERG:   "bg-rose-100 text-rose-800 font-semibold",
};


export default function RequisitionsPage() {
  const queryClient = useQueryClient();

  const { data: reqs = [] } = useQuery({
    queryKey: ["requisitions"],
    queryFn: async () => (await requisitionsApi.list()).data,
  });

  const approve = useMutation({
    mutationFn: (id: number) => requisitionsApi.approve(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["requisitions"] }),
  });

  return (
    <div className="p-6 space-y-5 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Stock Requisitions</h1>
          <p className="text-sm text-slate-500 mt-1">
            {reqs.length} requisition{reqs.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link href="/dashboard/inventory"
              className="px-4 py-2 text-sm border border-slate-300 rounded-md hover:bg-slate-50">
          ← Dashboard
        </Link>
      </div>

      <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-3">
        ℹ️ Create requisitions via Django Admin or POST to <code>/api/inventory/requisitions/</code>.
        For full UI flow, see Phase 4 roadmap.
      </p>

      <div className="space-y-2">
        {reqs.length === 0 && (
          <div className="text-center py-8 text-slate-500 italic border border-dashed border-slate-300 rounded">
            No requisitions yet.
          </div>
        )}
        {reqs.map((r: StockRequisition) => (
          <div key={r.id} className="border border-slate-200 rounded-md p-3 bg-white">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <span className="font-mono text-xs text-slate-500">{r.code}</span>
                <span className="ml-3 font-medium">{r.requesting_dept_name}</span>
                <span className="ml-2 text-xs text-slate-500">
                  → {r.source_store_name}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded ${URGENCY_CHIPS[r.urgency]}`}>
                  {r.urgency_label}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded ${STATUS_CHIPS[r.status]}`}>
                  {r.status_label}
                </span>
                {r.status === "SUBMITTED" && (
                  <button onClick={() => approve.mutate(r.id)}
                          className="text-xs px-2 py-1 bg-emerald-600 text-white rounded">
                    Approve
                  </button>
                )}
              </div>
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {r.purpose && <span>{r.purpose} · </span>}
              {new Date(r.requested_date).toLocaleDateString("en-IN")} ·
              {(r.lines?.length || 0)} line{(r.lines?.length || 0) !== 1 ? "s" : ""}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
