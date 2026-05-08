"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { doctorDashboardApi } from "@/lib/api/reports";
import type { DoctorDashboard } from "@/lib/api/reports";

export default function DoctorDashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["doctor-today"],
    queryFn: doctorDashboardApi.today,
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return <div className="p-12 text-center text-slate-400">Loading…</div>;
  }
  if (error || !data) {
    return (
      <div className="p-12 max-w-2xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-md p-4 text-sm text-red-800">
          Could not load doctor dashboard. This view requires you to be logged in as a
          doctor (or pass <code>?doctor_id=&lt;id&gt;</code> as an admin).
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Welcome, {data.doctor.name}
          </h1>
          <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
            <span>Reg: {data.doctor.registration}</span>
            {data.doctor.department && (
              <>
                <span>·</span>
                <span>{data.doctor.department}</span>
              </>
            )}
            <span>·</span>
            <span className="text-xs">
              As of {new Date(data.as_of).toLocaleString("en-IN")}
            </span>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <CountCard
          title="Today's Appointments"
          count={data.counts.today_appointments}
          tone="sky"
          href="/dashboard/reception"
        />
        <CountCard
          title="Pending Consultations"
          count={data.counts.pending_consultations}
          tone="amber"
          subtitle="DRAFT EMRs"
          href="/dashboard/opd"
        />
        <CountCard
          title="Pending Lab Orders"
          count={data.counts.pending_lab_orders}
          tone="indigo"
          subtitle="Awaiting your review"
          href="/dashboard/lab"
        />
        <CountCard
          title="Active IPD Patients"
          count={data.counts.active_ipd_admissions}
          tone="blue"
          subtitle="Under your care"
          href="/dashboard/ipd"
        />
        <CountCard
          title="Recent Prescriptions"
          count={data.counts.recent_prescriptions}
          tone="emerald"
          subtitle="Last 7 days"
        />
      </div>

      {/* Today's appointments */}
      <SectionCard title="Today's Appointments" countLabel={data.today_appointments.length}>
        {data.today_appointments.length === 0 ? (
          <Empty>No appointments scheduled for today.</Empty>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-5 py-2 text-left font-medium">Time</th>
                <th className="px-5 py-2 text-left font-medium">Patient</th>
                <th className="px-5 py-2 text-left font-medium">Token</th>
                <th className="px-5 py-2 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.today_appointments.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="px-5 py-2 font-mono text-xs">
                    {a.appointment_time?.substring(0, 5) ?? "—"}
                  </td>
                  <td className="px-5 py-2">
                    <div className="font-medium text-slate-800">{a.patient_name}</div>
                    <div className="text-xs text-slate-500 font-mono">{a.patient_mrn}</div>
                  </td>
                  <td className="px-5 py-2 font-mono text-sm">{a.token_number ?? "—"}</td>
                  <td className="px-5 py-2">
                    <StatusBadge status={a.status} label={a.status_label} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionCard>

      {/* Pending consultations */}
      <SectionCard title="Pending Consultations (DRAFT)" countLabel={data.pending_consultations.length}>
        {data.pending_consultations.length === 0 ? (
          <Empty>No draft consultations to finalize.</Empty>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-5 py-2 text-left font-medium">Code</th>
                <th className="px-5 py-2 text-left font-medium">Patient</th>
                <th className="px-5 py-2 text-left font-medium">Started</th>
                <th className="px-5 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.pending_consultations.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-5 py-2 font-mono text-xs">
                    <Link
                      href={`/dashboard/opd/${c.id}`}
                      className="text-sky-700 hover:underline"
                    >
                      {c.code}
                    </Link>
                  </td>
                  <td className="px-5 py-2">{c.patient_name}</td>
                  <td className="px-5 py-2 text-xs text-slate-500 font-mono">
                    {c.started_at?.replace("T", " ").substring(0, 16)}
                  </td>
                  <td className="px-5 py-2 text-right">
                    <Link
                      href={`/dashboard/opd/${c.id}`}
                      className="text-xs px-2 py-1 border border-slate-300 rounded hover:bg-slate-50 text-slate-700"
                    >
                      Resume →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionCard>

      {/* Pending lab orders */}
      <SectionCard title="Lab Orders to Review" countLabel={data.pending_lab_orders.length}>
        {data.pending_lab_orders.length === 0 ? (
          <Empty>No outstanding lab orders.</Empty>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-5 py-2 text-left font-medium">Code</th>
                <th className="px-5 py-2 text-left font-medium">Patient</th>
                <th className="px-5 py-2 text-left font-medium">Date</th>
                <th className="px-5 py-2 text-left font-medium">Status</th>
                <th className="px-5 py-2 text-center font-medium">Abnormal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.pending_lab_orders.map((o) => (
                <tr key={o.id} className="hover:bg-slate-50">
                  <td className="px-5 py-2 font-mono text-xs">
                    <Link
                      href={`/dashboard/lab/orders/${o.id}`}
                      className="text-sky-700 hover:underline"
                    >
                      {o.code}
                    </Link>
                  </td>
                  <td className="px-5 py-2">{o.patient_name}</td>
                  <td className="px-5 py-2 text-xs text-slate-500">{o.order_date}</td>
                  <td className="px-5 py-2">
                    <StatusBadge status={o.status} label={o.status_label} />
                  </td>
                  <td className="px-5 py-2 text-center">
                    {o.abnormal_count > 0 ? (
                      <span className="inline-flex items-center justify-center min-w-[28px] h-6 px-2 rounded-full bg-red-100 text-red-700 text-xs font-medium">
                        {o.abnormal_count}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionCard>

      {/* Active IPD admissions */}
      <SectionCard title="Active IPD Patients" countLabel={data.active_ipd_admissions.length}>
        {data.active_ipd_admissions.length === 0 ? (
          <Empty>No patients currently admitted under your care.</Empty>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-5 py-2 text-left font-medium">Code</th>
                <th className="px-5 py-2 text-left font-medium">Patient</th>
                <th className="px-5 py-2 text-left font-medium">Bed</th>
                <th className="px-5 py-2 text-left font-medium">Diagnosis</th>
                <th className="px-5 py-2 text-right font-medium">Stay</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.active_ipd_admissions.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="px-5 py-2 font-mono text-xs">
                    <Link
                      href={`/dashboard/ipd/admissions/${a.id}`}
                      className="text-sky-700 hover:underline"
                    >
                      {a.code}
                    </Link>
                  </td>
                  <td className="px-5 py-2">{a.patient_name}</td>
                  <td className="px-5 py-2 font-mono text-xs">{a.bed_code}</td>
                  <td className="px-5 py-2 max-w-md truncate" title={a.admission_diagnosis}>
                    {a.admission_diagnosis}
                  </td>
                  <td className="px-5 py-2 text-right text-xs text-slate-600">
                    {a.stay_days}d
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionCard>

      {/* Recent prescriptions */}
      <SectionCard
        title="Recent Prescriptions (Last 7 days)"
        countLabel={data.recent_prescriptions.length}
      >
        {data.recent_prescriptions.length === 0 ? (
          <Empty>No prescriptions in the last 7 days.</Empty>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-5 py-2 text-left font-medium">Date</th>
                <th className="px-5 py-2 text-left font-medium">Patient</th>
                <th className="px-5 py-2 text-left font-medium">Consultation</th>
                <th className="px-5 py-2 text-right font-medium">Items</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.recent_prescriptions.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-5 py-2 text-xs text-slate-500 font-mono">
                    {p.created_at?.replace("T", " ").substring(0, 16)}
                  </td>
                  <td className="px-5 py-2">{p.patient_name}</td>
                  <td className="px-5 py-2 font-mono text-xs">
                    <Link
                      href={`/dashboard/opd/${p.consultation}`}
                      className="text-sky-700 hover:underline"
                    >
                      {p.consultation_code}
                    </Link>
                  </td>
                  <td className="px-5 py-2 text-right">{p.item_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionCard>
    </div>
  );
}

function CountCard({
  title, count, tone, subtitle, href,
}: {
  title: string;
  count: number;
  tone: "sky" | "amber" | "indigo" | "emerald" | "blue";
  subtitle?: string;
  href?: string;
}) {
  const tones = {
    sky: "border-sky-200 bg-sky-50",
    amber: "border-amber-200 bg-amber-50",
    indigo: "border-indigo-200 bg-indigo-50",
    emerald: "border-emerald-200 bg-emerald-50",
    blue: "border-blue-200 bg-blue-50",
  };
  const accents = {
    sky: "text-sky-700",
    amber: "text-amber-700",
    indigo: "text-indigo-700",
    emerald: "text-emerald-700",
    blue: "text-blue-700",
  };
  const inner = (
    <div className={`rounded-lg border px-4 py-3 ${tones[tone]} h-full`}>
      <div className="text-xs uppercase tracking-wide text-slate-500">{title}</div>
      <div className={`text-2xl font-semibold mt-1 ${accents[tone]}`}>{count}</div>
      {subtitle && <div className="text-xs text-slate-500 mt-0.5">{subtitle}</div>}
    </div>
  );
  return href ? (
    <Link href={href} className="block hover:opacity-90 transition">
      {inner}
    </Link>
  ) : (
    inner
  );
}

function SectionCard({
  title, countLabel, children,
}: { title: string; countLabel: number; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-800">
          {title}
          <span className="ml-2 text-sm font-normal text-slate-500">
            ({countLabel})
          </span>
        </h2>
      </div>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="p-8 text-center text-slate-400 text-sm">{children}</div>;
}

function StatusBadge({ status, label }: { status: string; label: string }) {
  const tone =
    status === "COMPLETED" || status === "REPORTED" ? "bg-emerald-100 text-emerald-800"
    : status === "DRAFT" ? "bg-slate-100 text-slate-700"
    : status === "ORDERED" ? "bg-amber-100 text-amber-800"
    : status === "COLLECTED" ? "bg-blue-100 text-blue-800"
    : status === "IN_PROGRESS" ? "bg-indigo-100 text-indigo-800"
    : status === "ARRIVED" || status === "BOOKED" ? "bg-sky-100 text-sky-800"
    : status === "CANCELLED" || status === "NO_SHOW" ? "bg-slate-100 text-slate-500 line-through"
    : "bg-slate-100 text-slate-700";
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${tone}`}>
      {label}
    </span>
  );
}
