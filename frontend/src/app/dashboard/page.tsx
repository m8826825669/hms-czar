"use client";

import { useDashboard } from "@/hooks/use-dashboard";
import { useAuthStore } from "@/stores/auth-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  Activity, BedDouble, UserPlus, Receipt,
  Ambulance, Pill, FlaskConical, ArrowDownToLine,
  RefreshCw, AlertCircle, AlertTriangle, Info, CheckCircle2,
  Stethoscope, TrendingUp, TrendingDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Colour palette ───────────────────────────────────────────────────────────
const COLORS = {
  blue:   "#378ADD",
  teal:   "#1D9E75",
  amber:  "#BA7517",
  purple: "#534AB7",
  coral:  "#D85A30",
  green:  "#639922",
  red:    "#E24B4A",
};

const REVENUE_COLORS = [
  COLORS.purple, COLORS.teal, COLORS.amber, COLORS.blue, COLORS.coral,
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number) {
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(1)}L`;
  if (n >= 1_000)   return `₹${(n / 1_000).toFixed(0)}K`;
  return `₹${n}`;
}
function pct(n: number, d: number) { return d > 0 ? Math.round((n / d) * 100) : 0; }
function delta(a: number, b: number) {
  if (!b) return null;
  const p = Math.round(((a - b) / b) * 100);
  return { pct: Math.abs(p), up: p >= 0 };
}
function initials(name: string) {
  return name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
}

// ─── Small reusable pieces ────────────────────────────────────────────────────
const AVATAR_COLORS = [
  "bg-blue-100 text-blue-700",
  "bg-purple-100 text-purple-700",
  "bg-teal-100 text-teal-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
];

function Avatar({ name, idx = 0 }: { name: string; idx?: number }) {
  return (
    <span className={cn(
      "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-medium",
      AVATAR_COLORS[idx % AVATAR_COLORS.length]
    )}>
      {initials(name)}
    </span>
  );
}

const STATUS_MAP = {
  waiting:    { label: "Waiting",    class: "bg-amber-100 text-amber-800" },
  in_consult: { label: "In consult", class: "bg-blue-100 text-blue-800"   },
  done:       { label: "Done",       class: "bg-green-100 text-green-800"  },
  billing:    { label: "Billing",    class: "bg-slate-100 text-slate-700"  },
  pending:    { label: "Pending",    class: "bg-amber-100 text-amber-800"  },
  ongoing:    { label: "Ongoing",    class: "bg-blue-100 text-blue-800"    },
  cancelled:  { label: "Cancelled",  class: "bg-red-100 text-red-800"      },
};

function StatusPill({ status }: { status: string }) {
  const s = STATUS_MAP[status as keyof typeof STATUS_MAP] ?? { label: status, class: "bg-slate-100 text-slate-700" };
  return (
    <span className={cn("inline-block rounded-full px-2 py-0.5 text-[11px] font-medium", s.class)}>
      {s.label}
    </span>
  );
}

const ALERT_META = {
  critical: { Icon: AlertCircle,   color: "text-red-600",   dot: "bg-red-500",    bg: "hover:bg-red-50/50"    },
  warning:  { Icon: AlertTriangle, color: "text-amber-600", dot: "bg-amber-500",  bg: "hover:bg-amber-50/50"  },
  info:     { Icon: Info,          color: "text-blue-600",  dot: "bg-blue-500",   bg: "hover:bg-blue-50/50"   },
  success:  { Icon: CheckCircle2,  color: "text-green-600", dot: "bg-green-500",  bg: "hover:bg-green-50/50"  },
};

const WARD_COLOR = { normal: "#639922", warning: "#BA7517", critical: "#E24B4A" };

// ─── Stat Card ────────────────────────────────────────────────────────────────
interface StatCardProps {
  title:    string;
  value:    string | number;
  subValue?:string;
  icon:     React.ElementType;
  color:    string;
  delta?:   { pct: number; up: boolean } | null;
  loading?: boolean;
}
function StatCard({ title, value, subValue, icon: Icon, color, delta: d, loading }: StatCardProps) {
  return (
    <Card className={cn("relative overflow-hidden border-l-[3px]")} style={{ borderLeftColor: color }}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-4 px-4">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {loading ? (
          <Skeleton className="h-8 w-24 mb-1" />
        ) : (
          <div className="text-2xl font-bold tracking-tight">{value}</div>
        )}
        <div className="flex items-center gap-2 mt-1">
          {subValue && <p className="text-[11px] text-muted-foreground">{subValue}</p>}
          {d && (
            <span className={cn(
              "flex items-center gap-0.5 text-[11px] font-medium",
              d.up ? "text-green-600" : "text-red-600"
            )}>
              {d.up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {d.pct}%
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function DashboardPage() {
  const user = useAuthStore(s => s.user);
  const { data, loading, error, refresh } = useDashboard(30_000);
  const { stats, wards, opd, ot, alerts, monthly, weekly, revenue } = data;

  const opdDelta     = delta(stats.opd_today,     stats.opd_yesterday);
  const revDelta     = delta(stats.revenue_today, stats.revenue_yesterday);
  const ipd_pct      = pct(stats.ipd_census, stats.ipd_capacity);

  return (
    <div className="space-y-5 pb-8">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Welcome, {user?.full_name || user?.username}
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {user?.hospital?.name} ·{" "}
            {new Date().toLocaleDateString("en-IN", {
              weekday: "long", year: "numeric", month: "long", day: "numeric",
            })}
          </p>
        </div>
        <button
          onClick={refresh}
          className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {/* ── KPI Row 1 ────────────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="OPD Today"
          value={stats.opd_today}
          subValue={`vs ${stats.opd_yesterday} yesterday`}
          icon={UserPlus}
          color={COLORS.blue}
          delta={opdDelta}
          loading={loading}
        />
        <StatCard
          title="IPD Census"
          value={`${stats.ipd_census} / ${stats.ipd_capacity}`}
          subValue={`${ipd_pct}% occupancy`}
          icon={BedDouble}
          color={COLORS.teal}
          loading={loading}
        />
        <StatCard
          title="OT Scheduled"
          value={stats.ot_scheduled}
          subValue={`${stats.ot_completed} done · ${stats.ot_ongoing} ongoing · ${stats.ot_scheduled - stats.ot_completed - stats.ot_ongoing} pending`}
          icon={Activity}
          color={COLORS.amber}
          loading={loading}
        />
        <StatCard
          title="Today's Revenue"
          value={fmt(stats.revenue_today)}
          subValue={`Target ${fmt(stats.revenue_target)}`}
          icon={Receipt}
          color={COLORS.purple}
          delta={revDelta}
          loading={loading}
        />
      </div>

      {/* ── KPI Row 2 ────────────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Emergency"      value={stats.emergency_today}  subValue="Admissions today"             icon={Ambulance}     color={COLORS.coral}  loading={loading} />
        <StatCard title="Pharmacy Bills" value={stats.pharmacy_bills}   subValue="Bills raised today"          icon={Pill}          color={COLORS.green}  loading={loading} />
        <StatCard title="Lab Orders"     value={stats.lab_orders}       subValue={`${stats.lab_pending} pending results`} icon={FlaskConical}  color={COLORS.blue}   loading={loading} />
        <StatCard title="Discharges"     value={stats.discharges_today} subValue={`${stats.discharge_pending} summaries pending`} icon={ArrowDownToLine} color={COLORS.teal} loading={loading} />
      </div>

      {/* ── Charts Row ───────────────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">

        {/* OPD 7-day bar */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">OPD visits — last 7 days</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 mb-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: COLORS.blue }} />New patients</span>
              <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: COLORS.teal }} />Follow-up</span>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={weekly} margin={{ top: 0, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Bar dataKey="new_patients" name="New" fill={COLORS.blue}  radius={[3,3,0,0]} />
                <Bar dataKey="followup"     name="Follow-up" fill={COLORS.teal} radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Revenue donut */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Revenue breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie
                  data={revenue} cx="50%" cy="50%"
                  innerRadius={45} outerRadius={72}
                  dataKey="value" nameKey="label"
                  paddingAngle={2}
                >
                  {revenue.map((_, i) => (
                    <Cell key={i} fill={REVENUE_COLORS[i % REVENUE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: number, name: string, { payload }: any) =>
                    [`${v}% (${fmt(payload.amount)})`, name]}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-2 grid grid-cols-1 gap-y-1">
              {revenue.map((r, i) => (
                <div key={r.label} className="flex items-center justify-between text-[11px]">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="inline-block h-2 w-2 rounded-sm" style={{ background: REVENUE_COLORS[i] }} />
                    {r.label}
                  </span>
                  <span className="font-medium">{r.value}% · {fmt(r.amount)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Ward Occupancy + Recent OPD ──────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">

        {/* Ward occupancy */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Ward occupancy</CardTitle>
              <span className="text-[11px] text-muted-foreground">Live</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {wards.map(w => {
              const p = pct(w.occupied, w.capacity);
              return (
                <div key={w.id}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[13px]">{w.name}</span>
                    <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      {w.occupied}/{w.capacity}
                      <span className={cn(
                        "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                        w.status === "critical" ? "bg-red-100 text-red-700"
                          : w.status === "warning" ? "bg-amber-100 text-amber-700"
                          : "bg-green-100 text-green-700"
                      )}>{p}%</span>
                    </span>
                  </div>
                  <Progress
                    value={p}
                    className="h-1.5"
                    style={{ "--progress-color": WARD_COLOR[w.status] } as React.CSSProperties}
                  />
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Recent OPD */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Recent OPD queue</CardTitle>
              <span className="text-[11px] text-muted-foreground">Today</span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b text-[11px] text-muted-foreground">
                  <th className="px-4 py-2 text-left font-medium">Patient</th>
                  <th className="px-2 py-2 text-left font-medium">Token</th>
                  <th className="px-2 py-2 text-left font-medium">Doctor</th>
                  <th className="px-4 py-2 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {opd.map((p, i) => (
                  <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <Avatar name={p.full_name} idx={i} />
                        <div>
                          <div className="font-medium leading-tight">{p.full_name}</div>
                          <div className="text-[10px] text-muted-foreground">{p.mrn}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-2.5 font-semibold text-blue-600">#{p.token_number}</td>
                    <td className="px-2 py-2.5 text-muted-foreground">{p.doctor_name}</td>
                    <td className="px-4 py-2.5"><StatusPill status={p.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      {/* ── OT Schedule + Alerts ─────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">

        {/* OT Schedule */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">OT schedule</CardTitle>
              <span className="text-[11px] text-muted-foreground">
                {new Date().toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"numeric" })}
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b text-[11px] text-muted-foreground">
                  <th className="px-4 py-2 text-left font-medium">OT</th>
                  <th className="px-2 py-2 text-left font-medium">Procedure</th>
                  <th className="px-2 py-2 text-left font-medium">Surgeon</th>
                  <th className="px-2 py-2 text-left font-medium">Time</th>
                  <th className="px-4 py-2 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {ot.map(e => (
                  <tr key={e.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2.5 font-semibold">{e.ot_name}</td>
                    <td className="px-2 py-2.5">{e.procedure}</td>
                    <td className="px-2 py-2.5 text-muted-foreground text-[11px]">{e.surgeon}</td>
                    <td className="px-2 py-2.5 text-muted-foreground text-[11px] whitespace-nowrap">{e.start_time}–{e.end_time}</td>
                    <td className="px-4 py-2.5"><StatusPill status={e.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Alerts */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Alerts & tasks</CardTitle>
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0.5">
                {alerts.filter(a => a.level === "critical").length} critical
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="divide-y p-0">
            {alerts.map(a => {
              const m = ALERT_META[a.level];
              return (
                <div key={a.id} className={cn("flex items-start gap-3 px-4 py-3 transition-colors", m.bg)}>
                  <span className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", m.dot)} />
                  <div className="min-w-0">
                    <p className={cn("text-[13px] font-medium leading-snug", m.color)}>{a.title}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{a.message}</p>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* ── Monthly Trend ────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Monthly trend — admissions & revenue</CardTitle>
            <span className="text-[11px] text-muted-foreground">Jan – May 2026</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-5 mb-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: COLORS.purple }} />IPD admissions</span>
            <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: COLORS.teal }} />OPD visits (÷10)</span>
            <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: COLORS.amber }} />Revenue (₹L)</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthly} margin={{ top: 4, right: 24, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="left"  tick={{ fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: COLORS.amber }}
                     tickFormatter={v => `₹${v}L`} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }}
                formatter={(v: number, name: string) =>
                  name === "Revenue (₹L)" ? [`₹${v}L`, name] : [v, name]} />
              <Bar yAxisId="left"  dataKey="ipd_admissions" name="IPD admissions"  fill={COLORS.purple} radius={[3,3,0,0]} />
              <Bar yAxisId="left"  dataKey="opd_visits"     name="OPD visits (÷10)" fill={COLORS.teal}   radius={[3,3,0,0]}
                   data={monthly.map(m => ({ ...m, opd_visits: Math.round(m.opd_visits / 10) }))} />
              <Line yAxisId="right" type="monotone" dataKey="revenue" name="Revenue (₹L)"
                    stroke={COLORS.amber} strokeWidth={2} dot={{ r: 4, fill: COLORS.amber }} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

    </div>
  );
}