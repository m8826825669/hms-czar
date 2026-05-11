"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { employeesApi, leaveRequestsApi } from "@/lib/api/phase4b";
import type { Employee, LeaveRequest } from "@/types/phase4b";

const LEAVE_CHIPS: Record<string, string> = {
  SUBMITTED: "bg-indigo-100 text-indigo-800",
  APPROVED:  "bg-emerald-100 text-emerald-800",
  REJECTED:  "bg-rose-100 text-rose-800",
  CANCELLED: "bg-slate-100 text-slate-500",
  DRAFT:     "bg-slate-100 text-slate-700",
};

export default function HRDashboardPage() {
  const queryClient = useQueryClient();

  const { data: employees = [] } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => (await employeesApi.list()).data,
  });
  const { data: leaves = [] } = useQuery({
    queryKey: ["leaves"],
    queryFn: async () => (await leaveRequestsApi.list()).data,
  });

  const approve = useMutation({
    mutationFn: (id: number) => leaveRequestsApi.approve(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["leaves"] }),
  });
  const reject = useMutation({
    mutationFn: (id: number) => leaveRequestsApi.reject(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["leaves"] }),
  });

  const active = employees.filter((e: Employee) => e.status === "ACTIVE").length;
  const onLeave = employees.filter((e: Employee) => e.status === "ON_LEAVE").length;
  const pending = leaves.filter((l: LeaveRequest) => l.status === "SUBMITTED").length;

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">HR</h1>
        <p className="text-sm text-slate-500 mt-1">
          Employees, designations, leave management
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Total Employees" value={employees.length} />
        <Stat label="Active" value={active} tone="emerald" />
        <Stat label="On Leave" value={onLeave} tone="amber" />
        <Stat label="Pending Leave Reqs" value={pending} tone="rose" />
      </div>

      <section>
        <h2 className="text-lg font-medium mb-3">Pending Leave Requests</h2>
        {leaves.filter((l: LeaveRequest) => l.status === "SUBMITTED").length === 0 ? (
          <div className="text-center py-6 text-slate-500 italic border border-dashed border-slate-300 rounded">
            No pending leave requests.
          </div>
        ) : (
          <div className="space-y-2">
            {leaves
              .filter((l: LeaveRequest) => l.status === "SUBMITTED")
              .map((l: LeaveRequest) => (
              <div key={l.id} className="border border-slate-200 rounded-md p-3 bg-white">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <span className="font-mono text-xs text-slate-500">{l.code}</span>
                    <span className="ml-3 font-medium">{l.employee_name}</span>
                    <span className="ml-2 text-xs text-slate-500">
                      ({l.employee_code})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 bg-slate-100 rounded">
                      {l.leave_type_code} · {l.num_days}d
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded ${LEAVE_CHIPS[l.status]}`}>
                      {l.status_label}
                    </span>
                    <button onClick={() => approve.mutate(l.id)}
                            className="text-xs px-2 py-1 bg-emerald-600 text-white rounded">
                      Approve
                    </button>
                    <button onClick={() => reject.mutate(l.id)}
                            className="text-xs px-2 py-1 bg-rose-600 text-white rounded">
                      Reject
                    </button>
                  </div>
                </div>
                <div className="text-sm mt-1">{l.reason}</div>
                <div className="text-xs text-slate-500 mt-1">
                  {new Date(l.start_date).toLocaleDateString("en-IN")} →
                  {new Date(l.end_date).toLocaleDateString("en-IN")}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-medium mb-3">Employee Directory</h2>
        <div className="border border-slate-200 rounded-md bg-white overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left px-3 py-2 text-xs font-medium uppercase">Code</th>
                <th className="text-left px-3 py-2 text-xs font-medium uppercase">Name</th>
                <th className="text-left px-3 py-2 text-xs font-medium uppercase">Designation</th>
                <th className="text-left px-3 py-2 text-xs font-medium uppercase">Department</th>
                <th className="text-left px-3 py-2 text-xs font-medium uppercase">Phone</th>
                <th className="text-center px-3 py-2 text-xs font-medium uppercase">Status</th>
              </tr>
            </thead>
            <tbody>
              {employees.length === 0 && (
                <tr><td colSpan={6} className="text-center py-8 text-slate-500 italic">
                  No employees yet.
                </td></tr>
              )}
              {employees.slice(0, 50).map((e: Employee) => (
                <tr key={e.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono text-xs">{e.employee_code}</td>
                  <td className="px-3 py-2 font-medium">{e.full_name}</td>
                  <td className="px-3 py-2 text-slate-600 text-xs">{e.designation_title}</td>
                  <td className="px-3 py-2 text-slate-600 text-xs">{e.department_name || "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs">{e.phone}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      e.status === "ACTIVE" ? "bg-emerald-100 text-emerald-800" :
                      e.status === "ON_LEAVE" ? "bg-amber-100 text-amber-800" :
                                                "bg-slate-200 text-slate-600"
                    }`}>{e.status_label}</span>
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
  tone?: "slate" | "emerald" | "rose" | "amber";
}) {
  const tones: Record<string, string> = {
    slate: "border-slate-300",
    emerald: "border-emerald-300 bg-emerald-50/30",
    rose: "border-rose-300 bg-rose-50/30",
    amber: "border-amber-300 bg-amber-50/30",
  };
  return (
    <div className={`border rounded-lg p-4 ${tones[tone]}`}>
      <div className="text-xs font-medium uppercase opacity-70">{label}</div>
      <div className="text-3xl font-semibold mt-1">{value}</div>
    </div>
  );
}
