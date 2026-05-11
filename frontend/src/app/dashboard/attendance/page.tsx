"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { attendanceTodayApi, attendanceLogsApi, employeesApi, dailyAttendanceApi } from "@/lib/api/phase4b";
import type { AttendanceTodaySummary, AttendanceLog, DailyAttendance, Employee } from "@/types/phase4b";


export default function AttendanceDashboardPage() {
  const queryClient = useQueryClient();
  const [selectedEmp, setSelectedEmp] = useState<number | null>(null);

  const { data: summary } = useQuery<AttendanceTodaySummary>({
    queryKey: ["attendance-today"],
    queryFn: async () => (await attendanceTodayApi.summary()).data,
    refetchInterval: 30000,
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees-active"],
    queryFn: async () => (await employeesApi.list({ status: "ACTIVE" })).data,
  });

  const { data: todayAtt = [] } = useQuery({
    queryKey: ["daily-att-today"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      return (await dailyAttendanceApi.list({ work_date: today })).data;
    },
    refetchInterval: 30000,
  });

  const punch = useMutation({
    mutationFn: (data: { employee_id: number; punch_type: "IN" | "OUT" }) =>
      attendanceLogsApi.punch({ ...data, source: "WEB" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance-today"] });
      queryClient.invalidateQueries({ queryKey: ["daily-att-today"] });
    },
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Attendance</h1>
        <p className="text-sm text-slate-500 mt-1">
          Today's attendance · Punch in/out
        </p>
      </div>

      {summary && (
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          <Stat label="Active Emp" value={summary.total_active_employees} />
          <Stat label="Present" value={summary.counts.present} tone="emerald" />
          <Stat label="Late" value={summary.counts.late} tone="amber" />
          <Stat label="On Leave" value={summary.counts.on_leave} tone="amber" />
          <Stat label="Absent" value={summary.counts.absent} tone="rose" />
          <Stat label="Unmarked" value={summary.unmarked} />
        </div>
      )}

      <section>
        <h2 className="text-lg font-medium mb-3">Punch In / Out</h2>
        <div className="border border-slate-200 rounded-md bg-white p-4 space-y-3">
          <select value={selectedEmp ?? ""}
                  onChange={(e) => setSelectedEmp(Number(e.target.value) || null)}
                  className="w-full max-w-md border border-slate-300 rounded px-3 py-2 text-sm">
            <option value="">Select employee…</option>
            {employees.map((e: Employee) => (
              <option key={e.id} value={e.id}>
                {e.employee_code} — {e.full_name}
              </option>
            ))}
          </select>

          {selectedEmp && (
            <div className="flex gap-3">
              <button onClick={() => punch.mutate({ employee_id: selectedEmp, punch_type: "IN" })}
                      disabled={punch.isPending}
                      className="px-4 py-2 bg-emerald-600 text-white rounded text-sm">
                Punch IN
              </button>
              <button onClick={() => punch.mutate({ employee_id: selectedEmp, punch_type: "OUT" })}
                      disabled={punch.isPending}
                      className="px-4 py-2 bg-rose-600 text-white rounded text-sm">
                Punch OUT
              </button>
            </div>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-medium mb-3">Today's Attendance</h2>
        <div className="border border-slate-200 rounded-md bg-white overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left px-3 py-2 text-xs font-medium uppercase">Employee</th>
                <th className="text-left px-3 py-2 text-xs font-medium uppercase">Check In</th>
                <th className="text-left px-3 py-2 text-xs font-medium uppercase">Check Out</th>
                <th className="text-right px-3 py-2 text-xs font-medium uppercase">Hours</th>
                <th className="text-center px-3 py-2 text-xs font-medium uppercase">Status</th>
              </tr>
            </thead>
            <tbody>
              {todayAtt.length === 0 && (
                <tr><td colSpan={5} className="text-center py-6 text-slate-500 italic">
                  No attendance records yet for today.
                </td></tr>
              )}
              {todayAtt.map((a: DailyAttendance) => (
                <tr key={a.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-3 py-2 font-medium">{a.employee_name}</td>
                  <td className="px-3 py-2 text-slate-600 font-mono text-xs">
                    {a.check_in_time
                      ? new Date(a.check_in_time).toLocaleTimeString("en-IN")
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-slate-600 font-mono text-xs">
                    {a.check_out_time
                      ? new Date(a.check_out_time).toLocaleTimeString("en-IN")
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-right">{a.hours_worked}h</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      a.status === "PRESENT" ? "bg-emerald-100 text-emerald-800" :
                      a.status === "LATE" ? "bg-amber-100 text-amber-800" :
                      a.status === "ABSENT" ? "bg-rose-100 text-rose-800" :
                                              "bg-slate-100 text-slate-700"
                    }`}>{a.status_label}</span>
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
