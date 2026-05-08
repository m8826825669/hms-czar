"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { admissionsApi } from "@/lib/api/ipd";
import type { Admission, AdmissionStatus } from "@/types/ipd";

const STATUS_BADGE: Record<AdmissionStatus, string> = {
  ADMITTED: "bg-blue-100 text-blue-800",
  DISCHARGED: "bg-emerald-100 text-emerald-800",
  ABSCONDED: "bg-amber-100 text-amber-800",
  DAMA: "bg-amber-100 text-amber-800",
  EXPIRED: "bg-slate-200 text-slate-700",
  TRANSFERRED: "bg-indigo-100 text-indigo-800",
  CANCELLED: "bg-slate-100 text-slate-500 line-through",
};

export default function IPDDashboardPage() {
  const dash = useQuery({
    queryKey: ["ipd-dashboard"],
    queryFn: admissionsApi.dashboard,
    refetchInterval: 30_000,
  });

  const d = dash.data;
  const occupancyPct = d && d.total_beds > 0
    ? Math.round((d.occupied / d.total_beds) * 100) : 0;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">In-Patient Department</h1>
          <p className="text-sm text-slate-500 mt-1">
            Bed occupancy, admissions, and discharges
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/dashboard/ipd/beds"
            className="px-4 py-2 border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 text-sm font-medium"
          >
            Bed Board
          </Link>
          <Link
            href="/dashboard/ipd/admissions/new"
            className="px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 text-sm font-medium"
          >
            + New Admission
          </Link>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard title="Total Beds" value={d?.total_beds ?? "—"} tone="slate" />
        <StatCard title="Occupied" value={d?.occupied ?? "—"}
                  subtitle={`${occupancyPct}% capacity`} tone="blue" />
        <StatCard title="Available" value={d?.available ?? "—"} tone="emerald" />
        <StatCard title="Reserved" value={d?.reserved ?? "—"} tone="amber" />
        <StatCard title="Today's Admissions" value={d?.today_admissions ?? "—"} tone="indigo" />
      </div>

      {/* Occupancy bar */}
      {d && d.total_beds > 0 && (
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-slate-700">Hospital occupancy</h3>
            <span className="text-sm text-slate-600 font-mono">
              {d.occupied} / {d.total_beds}
            </span>
          </div>
          <div className="w-full h-3 bg-slate-100 rounded overflow-hidden flex">
            <div className="bg-blue-500" style={{ width: `${(d.occupied / d.total_beds) * 100}%` }} />
            <div className="bg-amber-400" style={{ width: `${(d.reserved / d.total_beds) * 100}%` }} />
            <div className="bg-slate-300" style={{ width: `${(d.maintenance / d.total_beds) * 100}%` }} />
          </div>
          <div className="flex gap-4 mt-2 text-xs text-slate-500">
            <span><span className="inline-block w-2 h-2 bg-blue-500 mr-1 rounded-sm" />Occupied</span>
            <span><span className="inline-block w-2 h-2 bg-amber-400 mr-1 rounded-sm" />Reserved</span>
            <span><span className="inline-block w-2 h-2 bg-slate-300 mr-1 rounded-sm" />Maintenance</span>
            <span><span className="inline-block w-2 h-2 bg-emerald-500 mr-1 rounded-sm" />Available</span>
          </div>
        </div>
      )}

      {/* Active admissions */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-800">
            Active Admissions ({d?.active_admissions ?? 0})
          </h2>
          {dash.isFetching && <span className="text-xs text-slate-400">refreshing…</span>}
        </div>
        {dash.isLoading ? (
          <div className="p-12 text-center text-slate-400">Loading…</div>
        ) : !d?.active.length ? (
          <div className="p-12 text-center text-slate-400">
            No active admissions. Click "+ New Admission" to admit a patient.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-left text-xs uppercase tracking-wide">
              <tr>
                <th className="px-5 py-2 font-medium">IPD Code</th>
                <th className="px-5 py-2 font-medium">Patient</th>
                <th className="px-5 py-2 font-medium">Bed / Ward</th>
                <th className="px-5 py-2 font-medium">Doctor</th>
                <th className="px-5 py-2 font-medium">Admitted</th>
                <th className="px-5 py-2 font-medium text-right">Days</th>
                <th className="px-5 py-2 font-medium text-right">Accrued</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {d.active.map(a => <AdmissionRow key={a.id} a={a} />)}
            </tbody>
          </table>
        )}
      </div>

      {/* Recent discharges */}
      {d?.recent_discharges && d.recent_discharges.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100">
            <h2 className="text-base font-semibold text-slate-800">
              Recent Discharges <span className="text-xs text-slate-500 font-normal">(last 7 days)</span>
            </h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-left text-xs uppercase tracking-wide">
              <tr>
                <th className="px-5 py-2 font-medium">Code</th>
                <th className="px-5 py-2 font-medium">Patient</th>
                <th className="px-5 py-2 font-medium">Discharged</th>
                <th className="px-5 py-2 font-medium">Type</th>
                <th className="px-5 py-2 font-medium text-right">Invoice</th>
                <th className="px-5 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {d.recent_discharges.map(a => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="px-5 py-2 font-mono text-xs">
                    <Link href={`/dashboard/ipd/admissions/${a.id}`}
                          className="text-sky-700 hover:underline">{a.code}</Link>
                  </td>
                  <td className="px-5 py-2">{a.patient_name}</td>
                  <td className="px-5 py-2 text-xs text-slate-500">
                    {a.discharged_at?.replace("T", " ").substring(0, 16)}
                  </td>
                  <td className="px-5 py-2 text-xs">{a.discharge_type || "—"}</td>
                  <td className="px-5 py-2 text-right font-mono text-xs">
                    {a.invoice_code ? (
                      <Link href={`/dashboard/billing/${a.invoice}`} className="text-sky-700 hover:underline">
                        {a.invoice_code}
                      </Link>
                    ) : "—"}
                  </td>
                  <td className="px-5 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[a.status]}`}>
                      {a.status_label}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatCard({
  title, value, subtitle, tone,
}: { title: string; value: number | string; subtitle?: string; tone: "slate" | "blue" | "emerald" | "amber" | "indigo" }) {
  const tones = {
    slate: "border-slate-200 bg-slate-50",
    blue: "border-blue-200 bg-blue-50",
    emerald: "border-emerald-200 bg-emerald-50",
    amber: "border-amber-200 bg-amber-50",
    indigo: "border-indigo-200 bg-indigo-50",
  };
  const accent = {
    slate: "text-slate-700",
    blue: "text-blue-700",
    emerald: "text-emerald-700",
    amber: "text-amber-700",
    indigo: "text-indigo-700",
  };
  return (
    <div className={`rounded-lg border px-4 py-3 ${tones[tone]}`}>
      <div className="text-xs uppercase tracking-wide text-slate-500">{title}</div>
      <div className={`text-2xl font-semibold mt-1 ${accent[tone]}`}>{value}</div>
      {subtitle && <div className="text-xs text-slate-500 mt-0.5">{subtitle}</div>}
    </div>
  );
}

function AdmissionRow({ a }: { a: Admission }) {
  return (
    <tr className="hover:bg-slate-50">
      <td className="px-5 py-2 font-mono text-xs">
        <Link href={`/dashboard/ipd/admissions/${a.id}`} className="text-sky-700 hover:underline">
          {a.code}
        </Link>
      </td>
      <td className="px-5 py-2">
        <div className="font-medium text-slate-800">{a.patient_name}</div>
        <div className="text-xs text-slate-500">{a.patient_mrn}</div>
      </td>
      <td className="px-5 py-2">
        <div className="font-mono text-xs">{a.bed_code}</div>
        <div className="text-xs text-slate-500">{a.ward_name}</div>
      </td>
      <td className="px-5 py-2 text-sm">{a.attending_doctor_name}</td>
      <td className="px-5 py-2 text-xs text-slate-500">
        {a.admitted_at.replace("T", " ").substring(0, 16)}
      </td>
      <td className="px-5 py-2 text-right font-mono">{a.stay_days}</td>
      <td className="px-5 py-2 text-right font-mono">₹{Number(a.accrued_total).toFixed(2)}</td>
    </tr>
  );
}
