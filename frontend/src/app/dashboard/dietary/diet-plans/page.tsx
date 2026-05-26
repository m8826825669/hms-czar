"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { dietPlansApi } from "@/lib/api/phase3b";
import type { DietPlan } from "@/types/phase3b";

const STATUS_CHIPS: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-800",
  PAUSED: "bg-amber-100 text-amber-800",
  ENDED: "bg-slate-100 text-slate-700",
};


export default function DietPlansPage() {
  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["diet-plans"],
    queryFn: async () => await dietPlansApi.list(),
  });

  if (isLoading) return <div className="p-8 text-slate-500">Loading…</div>;

  return (
    <div className="p-6 space-y-5 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Diet Plans</h1>
          <p className="text-sm text-slate-500 mt-1">
            {plans.length} plan{plans.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link href="/dashboard/dietary"
              className="px-4 py-2 text-sm border border-slate-300 rounded-md hover:bg-slate-50">
          ← Dashboard
        </Link>
      </div>

      <div className="border border-slate-200 rounded-md overflow-hidden bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-2 text-xs font-medium uppercase">Patient</th>
              <th className="text-left px-4 py-2 text-xs font-medium uppercase">Admission</th>
              <th className="text-left px-4 py-2 text-xs font-medium uppercase">Diet Type</th>
              <th className="text-left px-4 py-2 text-xs font-medium uppercase">Started</th>
              <th className="text-left px-4 py-2 text-xs font-medium uppercase">Restrictions</th>
              <th className="text-left px-4 py-2 text-xs font-medium uppercase">Status</th>
            </tr>
          </thead>
          <tbody>
            {plans.length === 0 && (
              <tr><td colSpan={6} className="text-center py-8 text-slate-500 italic">
                No diet plans.
              </td></tr>
            )}
            {plans.map((p: DietPlan) => (
              <tr key={p.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-4 py-2 font-medium">{p.patient_name}</td>
                <td className="px-4 py-2 font-mono text-xs">{p.admission_code || "—"}</td>
                <td className="px-4 py-2">{p.diet_type_name}</td>
                <td className="px-4 py-2 text-slate-600">
                  {new Date(p.started_at).toLocaleDateString("en-IN")}
                </td>
                <td className="px-4 py-2 text-xs text-slate-600">
                  {p.is_vegetarian && <span className="mr-2">🌱 Veg</span>}
                  {p.is_jain && <span className="mr-2">Jain</span>}
                  {p.is_diabetic && <span className="mr-2">DM</span>}
                  {p.allergies && <span className="text-amber-700">⚠ {p.allergies}</span>}
                </td>
                <td className="px-4 py-2">
                  <span className={`text-xs px-2 py-0.5 rounded ${STATUS_CHIPS[p.status]}`}>
                    {p.status_label}
                  </span>
                  {p.npo_until && (
                    <span className="ml-1 text-xs text-rose-600">NPO</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
