"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { payrollRunsApi, payslipsApi } from "@/lib/api/phase4b";
import type { PayrollRun, Payslip } from "@/types/phase4b";

const STATUS_CHIPS: Record<string, string> = {
  DRAFT:      "bg-slate-100 text-slate-700",
  PROCESSING: "bg-blue-100 text-blue-800",
  PROCESSED:  "bg-indigo-100 text-indigo-800",
  APPROVED:   "bg-emerald-100 text-emerald-800",
  PAID:       "bg-emerald-200 text-emerald-900",
  CANCELLED:  "bg-rose-100 text-rose-800",
};

export default function PayrollDashboardPage() {
  const queryClient = useQueryClient();
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);

  const { data: runs = [] } = useQuery({
    queryKey: ["payroll-runs"],
    queryFn: async () => (await payrollRunsApi.list()).data,
  });

  const { data: payslips = [] } = useQuery({
    queryKey: ["payslips", selectedRunId],
    queryFn: async () => {
      if (!selectedRunId) return [];
      return (await payslipsApi.list({ payroll_run: String(selectedRunId) })).data;
    },
    enabled: !!selectedRunId,
  });

  const create = useMutation({
    mutationFn: ({ year, month }: { year: number; month: number }) =>
      payrollRunsApi.create({ year, month }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["payroll-runs"] }),
  });
  const process = useMutation({
    mutationFn: (id: number) => payrollRunsApi.process(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["payroll-runs"] }),
  });
  const approve = useMutation({
    mutationFn: (id: number) => payrollRunsApi.approve(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["payroll-runs"] }),
  });
  const markPaid = useMutation({
    mutationFn: (id: number) => payrollRunsApi.markPaid(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["payroll-runs"] }),
  });

  const now = new Date();

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Payroll</h1>
          <p className="text-sm text-slate-500 mt-1">
            Monthly payroll runs and payslips
          </p>
        </div>
        <button onClick={() => create.mutate({
                  year: now.getFullYear(),
                  month: now.getMonth() + 1,
                })}
                disabled={create.isPending}
                className="px-4 py-2 text-sm bg-sky-700 text-white rounded-md">
          + Create Run for {now.toLocaleString("en-IN", { month: "long", year: "numeric" })}
        </button>
      </div>

      <section>
        <h2 className="text-lg font-medium mb-3">Payroll Runs</h2>
        <div className="border border-slate-200 rounded-md bg-white overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left px-3 py-2 text-xs font-medium uppercase">Code</th>
                <th className="text-left px-3 py-2 text-xs font-medium uppercase">Period</th>
                <th className="text-right px-3 py-2 text-xs font-medium uppercase">Employees</th>
                <th className="text-right px-3 py-2 text-xs font-medium uppercase">Gross</th>
                <th className="text-right px-3 py-2 text-xs font-medium uppercase">Deductions</th>
                <th className="text-right px-3 py-2 text-xs font-medium uppercase">Net Pay</th>
                <th className="text-center px-3 py-2 text-xs font-medium uppercase">Status</th>
                <th className="text-center px-3 py-2 text-xs font-medium uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {runs.length === 0 && (
                <tr><td colSpan={8} className="text-center py-8 text-slate-500 italic">
                  No payroll runs yet. Create one to start.
                </td></tr>
              )}
              {runs.map((r: PayrollRun) => (
                <tr key={r.id}
                    className={`border-b border-slate-100 last:border-0 cursor-pointer hover:bg-slate-50 ${
                      selectedRunId === r.id ? "bg-sky-50" : ""
                    }`}
                    onClick={() => setSelectedRunId(r.id)}>
                  <td className="px-3 py-2 font-mono text-xs">{r.code}</td>
                  <td className="px-3 py-2">
                    {r.month}/{r.year}
                  </td>
                  <td className="px-3 py-2 text-right">{r.total_employees}</td>
                  <td className="px-3 py-2 text-right">
                    ₹{Number(r.total_gross).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-3 py-2 text-right">
                    ₹{Number(r.total_deductions).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold">
                    ₹{Number(r.total_net).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded ${STATUS_CHIPS[r.status]}`}>
                      {r.status_label}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center space-x-1" onClick={(e) => e.stopPropagation()}>
                    {r.status === "DRAFT" && (
                      <button onClick={() => process.mutate(r.id)}
                              className="text-xs px-2 py-1 bg-blue-600 text-white rounded">
                        Process
                      </button>
                    )}
                    {r.status === "PROCESSED" && (
                      <button onClick={() => approve.mutate(r.id)}
                              className="text-xs px-2 py-1 bg-emerald-600 text-white rounded">
                        Approve
                      </button>
                    )}
                    {r.status === "APPROVED" && (
                      <button onClick={() => markPaid.mutate(r.id)}
                              className="text-xs px-2 py-1 bg-emerald-700 text-white rounded">
                        Mark Paid
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {selectedRunId && (
        <section>
          <h2 className="text-lg font-medium mb-3">
            Payslips ({payslips.length})
          </h2>
          <div className="border border-slate-200 rounded-md bg-white overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left px-3 py-2 text-xs font-medium uppercase">Code</th>
                  <th className="text-left px-3 py-2 text-xs font-medium uppercase">Employee</th>
                  <th className="text-right px-3 py-2 text-xs font-medium uppercase">Earnings</th>
                  <th className="text-right px-3 py-2 text-xs font-medium uppercase">Deductions</th>
                  <th className="text-right px-3 py-2 text-xs font-medium uppercase">Net Pay</th>
                  <th className="text-center px-3 py-2 text-xs font-medium uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {payslips.map((p: Payslip) => (
                  <tr key={p.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="px-3 py-2 font-mono text-xs">{p.code}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{p.employee_name}</div>
                      <div className="text-xs text-slate-500">{p.employee_code}</div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      ₹{Number(p.gross_earnings).toLocaleString("en-IN")}
                    </td>
                    <td className="px-3 py-2 text-right text-rose-700">
                      ₹{Number(p.gross_deductions).toLocaleString("en-IN")}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold">
                      ₹{Number(p.net_pay).toLocaleString("en-IN")}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className="text-xs px-2 py-0.5 bg-slate-100 rounded">
                        {p.status_label}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
