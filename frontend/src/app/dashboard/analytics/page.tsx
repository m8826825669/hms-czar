"use client";

import { useEffect, useState } from "react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid,
} from "recharts";

import { analyticsApi } from "@/lib/api/phase4d";
import type { DashboardPayload } from "@/types/phase4d";

const COLORS = ["#0ea5e9", "#22c55e", "#a855f7", "#f97316", "#ef4444", "#eab308", "#14b8a6", "#ec4899"];

function formatINR(n: number): string {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)} L`;
  if (n >= 1e3) return `₹${(n / 1e3).toFixed(1)} K`;
  return `₹${n.toFixed(0)}`;
}

interface KPICardProps {
  label: string;
  value: string | number;
  hint?: string;
  accent?: string;
}

function KPICard({ label, value, hint, accent = "bg-blue-50 border-blue-200" }: KPICardProps) {
  return (
    <div className={`rounded-lg border ${accent} p-4 shadow-sm`}>
      <div className="text-xs font-medium uppercase tracking-wide text-gray-600">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-gray-900">{value}</div>
      {hint && <div className="mt-1 text-xs text-gray-500">{hint}</div>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-gray-700">{title}</h3>
      {children}
    </div>
  );
}

export default function AnalyticsDashboardPage() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    analyticsApi
      .dashboard()
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setError(String(e?.message || e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="p-8 text-center text-gray-500">Loading analytics dashboard…</div>
    );
  }
  if (error) {
    return (
      <div className="m-8 rounded-md border border-red-200 bg-red-50 p-4 text-red-800">
        Failed to load: {error}
      </div>
    );
  }
  if (!data) return null;

  const { kpis } = data;

  return (
    <div className="space-y-6 p-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Hospital Analytics</h1>
          <p className="text-sm text-gray-500">As of {kpis.as_of}</p>
        </div>
        <a
          href="/dashboard/reports"
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
        >
          Custom reports →
        </a>
      </header>

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        <KPICard label="OPD Today"     value={kpis.today_opd_visits} accent="bg-sky-50 border-sky-200" />
        <KPICard label="Admissions"    value={kpis.today_admissions} accent="bg-emerald-50 border-emerald-200" />
        <KPICard label="Discharges"    value={kpis.today_discharges} accent="bg-emerald-50 border-emerald-200" />
        <KPICard label="Bed Occupancy" value={`${kpis.occupancy_pct}%`} hint={`${kpis.occupied_beds}/${kpis.total_beds}`} accent="bg-indigo-50 border-indigo-200" />
        <KPICard label="OT Cases"      value={kpis.today_ot_cases} accent="bg-purple-50 border-purple-200" />
        <KPICard label="Lab Orders"    value={kpis.today_lab_orders} accent="bg-purple-50 border-purple-200" />
        <KPICard label="Pharmacy Sales" value={formatINR(kpis.today_pharmacy_sales)} accent="bg-orange-50 border-orange-200" />
        <KPICard label="Revenue Today" value={formatINR(kpis.today_revenue)} accent="bg-amber-50 border-amber-200" />
        <KPICard label="AR Outstanding" value={formatINR(kpis.ar_outstanding)} accent="bg-rose-50 border-rose-200" />
        <KPICard label="Blood Units"   value={kpis.blood_units_in_stock} accent="bg-red-50 border-red-200" />
        <KPICard label="Active Staff"  value={kpis.active_staff} accent="bg-teal-50 border-teal-200" />
        <KPICard label="Open Complaints" value={kpis.open_complaints} accent={kpis.open_complaints > 0 ? "bg-yellow-50 border-yellow-200" : "bg-gray-50 border-gray-200"} />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title="Revenue — Last 6 Months">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data.revenue_monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" fontSize={11} />
              <YAxis tickFormatter={formatINR} fontSize={11} />
              <Tooltip formatter={(v: number) => formatINR(v)} />
              <Line type="monotone" dataKey="revenue" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </Section>

        <Section title="OPD Volume — Last 30 Days">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.opd_volume}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" fontSize={10} />
              <YAxis fontSize={11} />
              <Tooltip />
              <Bar dataKey="visits" fill="#22c55e" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Section>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title="Revenue by Department">
          {data.revenue_by_dept.length === 0 ? (
            <p className="text-sm text-gray-400">No invoice line departments configured.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.revenue_by_dept} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" tickFormatter={formatINR} fontSize={10} />
                <YAxis type="category" dataKey="department" width={120} fontSize={11} />
                <Tooltip formatter={(v: number) => formatINR(v)} />
                <Bar dataKey="revenue" fill="#a855f7" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Section>

        <Section title="Accounts Receivable Aging">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.ar_aging.buckets}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="bucket" fontSize={11} />
              <YAxis tickFormatter={formatINR} fontSize={11} />
              <Tooltip formatter={(v: number) => formatINR(v)} />
              <Bar dataKey="amount" fill="#ef4444" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Section>
      </div>

      {/* Charts row 3 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Section title="OT Utilization (30 days)">
          {data.ot_utilization.length === 0 ? (
            <p className="text-sm text-gray-400">No OT bookings.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.ot_utilization}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="theatre" fontSize={10} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Bar dataKey="cases" fill="#f97316" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Section>

        <Section title="Blood Inventory by Group">
          {data.blood_inventory.length === 0 ? (
            <p className="text-sm text-gray-400">No blood units in stock.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={data.blood_inventory}
                  dataKey="units"
                  nameKey="blood_group"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={2}
                >
                  {data.blood_inventory.map((_, idx) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Section>

        <Section title="Top Diagnoses">
          {data.top_diagnoses.length === 0 ? (
            <p className="text-sm text-gray-400">No diagnoses recorded yet.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {data.top_diagnoses.map((d, i) => (
                <li key={i} className="flex items-center justify-between border-b border-gray-100 pb-1 last:border-0">
                  <span className="truncate text-gray-700">{d.diagnosis}</span>
                  <span className="ml-2 inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                    {d.count}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      {/* Charts row 4 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title="IPD Occupancy by Ward">
          {data.ipd_occupancy.length === 0 ? (
            <p className="text-sm text-gray-400">No ward data.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="py-2 font-medium">Ward</th>
                  <th className="py-2 font-medium">Beds</th>
                  <th className="py-2 font-medium">Occupied</th>
                  <th className="py-2 font-medium">%</th>
                </tr>
              </thead>
              <tbody>
                {data.ipd_occupancy.map((w, i) => (
                  <tr key={i} className="border-b border-gray-100 last:border-0">
                    <td className="py-1.5">{w.ward}</td>
                    <td className="py-1.5">{w.total}</td>
                    <td className="py-1.5">{w.occupied}</td>
                    <td className="py-1.5">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          w.occupancy_pct > 85
                            ? "bg-red-100 text-red-800"
                            : w.occupancy_pct > 60
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-green-100 text-green-800"
                        }`}
                      >
                        {w.occupancy_pct}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        <Section title="Attendance Today">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-md bg-green-50 p-3">
              <div className="text-xs text-green-700">Present</div>
              <div className="text-xl font-semibold text-green-900">{data.attendance.present}</div>
            </div>
            <div className="rounded-md bg-red-50 p-3">
              <div className="text-xs text-red-700">Absent</div>
              <div className="text-xl font-semibold text-red-900">{data.attendance.absent}</div>
            </div>
            <div className="rounded-md bg-orange-50 p-3">
              <div className="text-xs text-orange-700">Late</div>
              <div className="text-xl font-semibold text-orange-900">{data.attendance.late}</div>
            </div>
            <div className="rounded-md bg-blue-50 p-3">
              <div className="text-xs text-blue-700">On Leave</div>
              <div className="text-xl font-semibold text-blue-900">{data.attendance.on_leave}</div>
            </div>
            <div className="rounded-md bg-purple-50 p-3">
              <div className="text-xs text-purple-700">Half Day</div>
              <div className="text-xl font-semibold text-purple-900">{data.attendance.half_day}</div>
            </div>
            <div className="rounded-md bg-gray-50 p-3">
              <div className="text-xs text-gray-700">Unmarked</div>
              <div className="text-xl font-semibold text-gray-900">{data.attendance.unmarked}</div>
            </div>
          </div>
        </Section>
      </div>

      {/* Charts row 5 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title="Pharmacy Turnover (6 mo)">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={data.pharmacy_turn}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" fontSize={11} />
              <YAxis tickFormatter={formatINR} fontSize={11} />
              <Tooltip formatter={(v: number) => formatINR(v)} />
              <Line type="monotone" dataKey="revenue" stroke="#0ea5e9" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </Section>

        <Section title="Lab Turnover (6 mo)">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.lab_turnover}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip />
              <Bar dataKey="orders" fill="#14b8a6" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Section>
      </div>

      {/* Charts row 6 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Section title="HR Headcount by Department">
          {data.hr_headcount.length === 0 ? (
            <p className="text-sm text-gray-400">No employees.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.hr_headcount} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" fontSize={10} />
                <YAxis type="category" dataKey="department" width={110} fontSize={10} />
                <Tooltip />
                <Bar dataKey="headcount" fill="#0ea5e9" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Section>

        <Section title="Asset Depreciation">
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-md bg-blue-50 p-2">
                <div className="text-xs text-blue-700">Acquisition</div>
                <div className="text-sm font-semibold text-blue-900">
                  {formatINR(data.asset_deprec.totals.acquisition_value)}
                </div>
              </div>
              <div className="rounded-md bg-emerald-50 p-2">
                <div className="text-xs text-emerald-700">Current</div>
                <div className="text-sm font-semibold text-emerald-900">
                  {formatINR(data.asset_deprec.totals.current_value)}
                </div>
              </div>
              <div className="rounded-md bg-red-50 p-2">
                <div className="text-xs text-red-700">Depreciation</div>
                <div className="text-sm font-semibold text-red-900">
                  {formatINR(data.asset_deprec.totals.depreciation)}
                </div>
              </div>
            </div>
            {data.asset_deprec.category_breakdown.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs">
                {data.asset_deprec.category_breakdown.slice(0, 5).map((c, i) => (
                  <li key={i} className="flex justify-between text-gray-600">
                    <span className="truncate">{c.category}</span>
                    <span>{formatINR(c.current_value)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Section>

        <Section title="Complaints SLA (3 mo)">
          <div className="space-y-2">
            <div className="rounded-md bg-amber-50 p-3">
              <div className="text-xs text-amber-700">Avg resolution time</div>
              <div className="text-2xl font-semibold text-amber-900">
                {data.complaints.avg_resolution_hours} <span className="text-sm font-normal">hrs</span>
              </div>
            </div>
            {data.complaints.by_status.length > 0 && (
              <ul className="mt-2 space-y-1 text-sm">
                {data.complaints.by_status.map((s, i) => (
                  <li key={i} className="flex justify-between">
                    <span className="text-gray-600">{s.status}</span>
                    <span className="font-medium">{s.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Section>
      </div>

      {/* Insurance section */}
      <Section title="Insurance Claims (6 mo)">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.insurance.by_month}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" fontSize={11} />
                <YAxis yAxisId="left" fontSize={11} />
                <YAxis yAxisId="right" orientation="right" tickFormatter={formatINR} fontSize={11} />
                <Tooltip />
                <Legend />
                <Bar yAxisId="left" dataKey="claims" fill="#0ea5e9" name="Claims" />
                <Bar yAxisId="right" dataKey="amount" fill="#22c55e" name="Amount" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div>
            <h4 className="mb-2 text-xs font-medium uppercase text-gray-500">By Status</h4>
            <ul className="space-y-1 text-sm">
              {data.insurance.by_status.map((s, i) => (
                <li key={i} className="flex justify-between border-b border-gray-100 py-1">
                  <span className="text-gray-700">{s.status}</span>
                  <span className="font-medium">{s.count}</span>
                </li>
              ))}
              {data.insurance.by_status.length === 0 && (
                <li className="text-xs text-gray-400">No claims data.</li>
              )}
            </ul>
          </div>
        </div>
      </Section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <a
          href="/dashboard/reports"
          className="rounded-lg border-2 border-dashed border-blue-300 bg-blue-50/50 p-6 text-center transition hover:border-blue-400 hover:bg-blue-100/50"
        >
          <div className="text-lg font-semibold text-blue-900">Custom Reports</div>
          <p className="mt-1 text-sm text-blue-700">
            Run and save reports across all modules — revenue, AR, headcount, claims, and more.
          </p>
        </a>
        <a
          href="/dashboard/reports#go-live"
          className="rounded-lg border-2 border-dashed border-emerald-300 bg-emerald-50/50 p-6 text-center transition hover:border-emerald-400 hover:bg-emerald-100/50"
        >
          <div className="text-lg font-semibold text-emerald-900">Go-Live Checklist</div>
          <p className="mt-1 text-sm text-emerald-700">
            21 operational readiness checks — security, master data, gateways, backups, and ops.
          </p>
        </a>
      </div>
    </div>
  );
}
