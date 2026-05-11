"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { requisitionsApi } from "@/lib/api/blood_bank";
import type { BloodRequisition } from "@/types/blood_bank";

const STATUS_COLORS: Record<string, string> = {
  PENDING:    "bg-slate-100 text-slate-700",
  CROSSMATCH: "bg-indigo-100 text-indigo-800",
  RESERVED:   "bg-amber-100 text-amber-800",
  ISSUED:     "bg-emerald-100 text-emerald-800",
  CANCELLED:  "bg-rose-100 text-rose-800",
  REJECTED:   "bg-rose-100 text-rose-800",
};
const URGENCY_COLORS: Record<string, string> = {
  ROUTINE:   "bg-slate-100 text-slate-600",
  URGENT:    "bg-amber-100 text-amber-800",
  EMERGENCY: "bg-rose-100 text-rose-800 font-semibold",
};


export default function RequisitionsPage() {
  const [tab, setTab] = useState<"pending" | "all">("pending");

  const { data: requisitions = [] } = useQuery({
    queryKey: ["bb-requisitions", tab],
    queryFn: async () => {
      if (tab === "pending") return (await requisitionsApi.pending()).data;
      return (await requisitionsApi.list()).data;
    },
  });

  return (
    <div className="p-6 space-y-5 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Blood Requisitions
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {requisitions.length} requisition{requisitions.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/dashboard/blood-bank"
            className="px-4 py-2 text-sm border border-slate-300 rounded-md hover:bg-slate-50"
          >
            ← Dashboard
          </Link>
          <Link
            href="/dashboard/blood-bank/requisitions/new"
            className="px-4 py-2 text-sm bg-rose-700 text-white rounded-md hover:bg-rose-800"
          >
            + New Requisition
          </Link>
        </div>
      </div>

      <div className="border-b border-slate-200">
        <nav className="flex gap-4">
          {(["pending", "all"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm border-b-2 ${
                tab === t
                  ? "border-rose-700 text-rose-700 font-medium"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              {t === "pending" ? "Active (Pending / Crossmatch / Reserved)" : "All"}
            </button>
          ))}
        </nav>
      </div>

      <div className="space-y-2">
        {requisitions.length === 0 && (
          <p className="text-sm text-slate-500 italic text-center py-8">
            No requisitions.
          </p>
        )}
        {requisitions.map((r: BloodRequisition) => (
          <Link
            key={r.id}
            href={`/dashboard/blood-bank/requisitions/${r.id}`}
            className="block border border-slate-200 rounded-md p-4 bg-white hover:bg-slate-50"
          >
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="font-mono text-xs text-slate-500">{r.code}</span>
                <span className="font-medium text-slate-900">{r.patient_name}</span>
                <span className="text-xs text-slate-500">MRN {r.patient_mrn}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded ${URGENCY_COLORS[r.urgency]}`}>
                  {r.urgency_label}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLORS[r.status]}`}>
                  {r.status_label}
                </span>
              </div>
            </div>
            <div className="mt-2 text-sm text-slate-600 flex items-center gap-3 flex-wrap">
              <span>
                <strong>{r.units_required} units</strong> of{" "}
                {r.component_label} {r.blood_group_label}
              </span>
              <span className="text-slate-400">·</span>
              <span>Issued: {r.units_issued} / {r.units_required}</span>
              <span className="text-slate-400">·</span>
              <span>By {r.requested_by_name}</span>
              {r.admission_code && (
                <>
                  <span className="text-slate-400">·</span>
                  <span>Admission {r.admission_code}</span>
                </>
              )}
            </div>
            {r.purpose && (
              <div className="mt-1 text-xs text-slate-500 italic">{r.purpose}</div>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
