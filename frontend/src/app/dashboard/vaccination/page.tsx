"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { vaccinesApi, vaccinationRecordsApi, patientVaccinationApi } from "@/lib/api/phase4c";
import type { Vaccine, VaccinationRecord } from "@/types/phase4c";


export default function VaccinationDashboardPage() {
  const [patientId, setPatientId] = useState("");

  const { data: vaccines = [] } = useQuery({
    queryKey: ["vaccines"],
    queryFn: async () => (await vaccinesApi.list()).data,
  });
  const { data: records = [] } = useQuery({
    queryKey: ["vac-records"],
    queryFn: async () => (await vaccinationRecordsApi.list()).data,
  });

  const { data: patientHistory } = useQuery({
    queryKey: ["patient-vac-history", patientId],
    queryFn: async () => {
      if (!patientId) return null;
      return (await patientVaccinationApi.history(Number(patientId))).data;
    },
    enabled: !!patientId,
  });

  const administered = records.filter((r: VaccinationRecord) => r.status === "ADMINISTERED").length;

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Vaccination</h1>
        <p className="text-sm text-slate-500 mt-1">
          Immunization records, schedules, certificates
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Vaccines in Catalog" value={vaccines.length} />
        <Stat label="UIP (Free) Vaccines"
              value={vaccines.filter((v: Vaccine) => v.is_under_uip).length} tone="emerald" />
        <Stat label="Total Doses Given" value={administered} tone="emerald" />
        <Stat label="Total Records" value={records.length} />
      </div>

      <section>
        <h2 className="text-lg font-medium mb-3">Patient History Lookup</h2>
        <div className="border border-slate-200 rounded-md bg-white p-4 space-y-3">
          <div className="flex gap-2 items-center">
            <input value={patientId}
                   onChange={(e) => setPatientId(e.target.value.replace(/[^\d]/g, ""))}
                   placeholder="Enter patient ID (numeric)"
                   className="flex-1 max-w-xs border border-slate-300 rounded px-3 py-2 text-sm" />
            <span className="text-xs text-slate-500">
              Find patient ID in /dashboard/reception/search
            </span>
          </div>

          {patientHistory && (
            <div className="border-t border-slate-200 pt-3 mt-3 space-y-3">
              <h3 className="font-medium">
                {patientHistory.patient_name} (#{patientHistory.patient_id})
              </h3>
              {patientHistory.due_vaccinations.length > 0 && (
                <div>
                  <div className="text-sm font-medium text-rose-700 mb-1">
                    Due / Overdue ({patientHistory.due_vaccinations.length})
                  </div>
                  <div className="space-y-1 text-sm">
                    {patientHistory.due_vaccinations.map((d, i) => (
                      <div key={i} className="flex justify-between border-l-4 border-rose-400 pl-2">
                        <span>{d.vaccine_name} — Dose {d.dose_number}</span>
                        <span className="text-xs text-slate-500">
                          Due at {d.due_age}
                          {d.overdue_days > 0 && (
                            <span className="text-rose-700 ml-1">
                              ({d.overdue_days}d overdue)
                            </span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <div className="text-sm font-medium mb-1">
                  Administered ({patientHistory.history.length})
                </div>
                {patientHistory.history.length === 0 ? (
                  <div className="text-xs text-slate-500 italic">No records.</div>
                ) : (
                  <div className="space-y-1 text-sm">
                    {patientHistory.history.map(r => (
                      <div key={r.id} className="flex justify-between border-l-4 border-emerald-400 pl-2">
                        <span>{r.vaccine_name} — Dose {r.dose_number}</span>
                        <span className="text-xs text-slate-500">
                          {r.administered_date
                            ? new Date(r.administered_date).toLocaleDateString("en-IN")
                            : "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-medium mb-3">Recent Vaccination Records</h2>
        <div className="border border-slate-200 rounded-md bg-white overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left px-3 py-2 text-xs font-medium uppercase">Patient</th>
                <th className="text-left px-3 py-2 text-xs font-medium uppercase">Vaccine</th>
                <th className="text-center px-3 py-2 text-xs font-medium uppercase">Dose</th>
                <th className="text-left px-3 py-2 text-xs font-medium uppercase">Date</th>
                <th className="text-left px-3 py-2 text-xs font-medium uppercase">Batch</th>
                <th className="text-center px-3 py-2 text-xs font-medium uppercase">Status</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 && (
                <tr><td colSpan={6} className="text-center py-8 text-slate-500 italic">
                  No vaccination records yet.
                </td></tr>
              )}
              {records.slice(0, 30).map((r: VaccinationRecord) => (
                <tr key={r.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-3 py-2">{r.patient_name}</td>
                  <td className="px-3 py-2">
                    <span className="font-medium">{r.vaccine_name}</span>
                    <span className="ml-2 text-xs text-slate-500">({r.vaccine_code})</span>
                  </td>
                  <td className="px-3 py-2 text-center">{r.dose_number}</td>
                  <td className="px-3 py-2 text-xs text-slate-600">
                    {r.administered_date
                      ? new Date(r.administered_date).toLocaleDateString("en-IN")
                      : "—"}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{r.batch_number || "—"}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      r.status === "ADMINISTERED" ? "bg-emerald-100 text-emerald-800" :
                      r.status === "SCHEDULED" ? "bg-slate-100 text-slate-700" :
                      r.status === "MISSED" ? "bg-rose-100 text-rose-800" :
                                              "bg-amber-100 text-amber-800"
                    }`}>{r.status_label}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, tone = "slate" }: {
  label: string; value: number;
  tone?: "slate" | "emerald" | "amber" | "rose";
}) {
  const tones: Record<string, string> = {
    slate: "border-slate-300",
    emerald: "border-emerald-300 bg-emerald-50/30",
    amber: "border-amber-300 bg-amber-50/30",
    rose: "border-rose-300 bg-rose-50/30",
  };
  return (
    <div className={`border rounded-lg p-3 ${tones[tone]}`}>
      <div className="text-xs font-medium uppercase opacity-70">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </div>
  );
}
