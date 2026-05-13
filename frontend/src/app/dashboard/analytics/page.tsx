"use client";
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertTriangle, TrendingUp, TrendingDown, Users, BedDouble, IndianRupee, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";
function hdrs() { const t = useAuthStore.getState().token; return { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) }; }
async function get<T>(p: string): Promise<T> { const r = await fetch(`${BASE}${p}`, { headers: hdrs(), cache: "no-store" }); if (!r.ok) throw new Error(`${r.status}`); const j = await r.json(); return (j?.results ?? j) as T; }

function fmt(n: number) { return n >= 100000 ? `₹${(n/100000).toFixed(1)}L` : n >= 1000 ? `₹${(n/1000).toFixed(0)}K` : `₹${n}`; }
function delta(v: number, p: number) { const d = Math.round(((v-p)/p)*100); return { d: Math.abs(d), up: d >= 0 }; }

// ── Mock data ──────────────────────────────────────────────────────────────────
const MONTHLY = [
  { month:"Jan", opd:2810, ipd:310, revenue:4200000, collections:3800000, occupancy:68 },
  { month:"Feb", opd:2650, ipd:295, revenue:3900000, collections:3500000, occupancy:64 },
  { month:"Mar", opd:3100, ipd:342, revenue:4800000, collections:4300000, occupancy:72 },
  { month:"Apr", opd:3450, ipd:388, revenue:5500000, collections:4900000, occupancy:78 },
  { month:"May", opd:3800, ipd:421, revenue:6100000, collections:5500000, occupancy:82 },
];
const DAILY_OPD = [
  { day:"Mon", opd:131, emergency:12 }, { day:"Tue", opd:152, emergency:18 },
  { day:"Wed", opd:138, emergency:15 }, { day:"Thu", opd:165, emergency:22 },
  { day:"Fri", opd:143, emergency:16 }, { day:"Sat", opd:98,  emergency:28 },
  { day:"Sun", opd:72,  emergency:34 },
];
const DEPT_REVENUE = [
  { dept:"OPD",      revenue:1952000, pct:32 }, { dept:"IPD",      revenue:1708000, pct:28 },
  { dept:"OT",       revenue:1342000, pct:22 }, { dept:"Lab",      revenue:610000,  pct:10 },
  { dept:"Pharmacy", revenue:488000,  pct:8  },
];
const WARD_TREND = [
  { week:"W1", general:72, icu:85, surgical:68, maternity:55 },
  { week:"W2", general:76, icu:88, surgical:74, maternity:60 },
  { week:"W3", general:78, icu:82, surgical:76, maternity:62 },
  { week:"W4", general:80, icu:90, surgical:78, maternity:65 },
];
const TOP_DIAGNOSES = [
  { name:"Hypertension",           count:142 }, { name:"Type 2 Diabetes",        count:118 },
  { name:"COPD",                   count:86  }, { name:"CAD",                    count:74  },
  { name:"Acute Respiratory Inf.", count:68  }, { name:"Dengue Fever",           count:62  },
  { name:"Ortho — Fractures",      count:54  }, { name:"Acute Appendicitis",     count:48  },
];
const DOCTOR_PERF = [
  { name:"Dr. Sharma",  dept:"Gen Med",     opd:312, ipd:28,  avg_rating:4.6, revenue:1240000 },
  { name:"Dr. Mehta",   dept:"Gynaecology", opd:198, ipd:42,  avg_rating:4.8, revenue:1680000 },
  { name:"Dr. Gupta",   dept:"Cardiology",  opd:164, ipd:38,  avg_rating:4.7, revenue:2100000 },
  { name:"Dr. Patel",   dept:"Ortho",       opd:142, ipd:22,  avg_rating:4.5, revenue:1840000 },
  { name:"Dr. Arora",   dept:"Surgery",     opd:88,  ipd:48,  avg_rating:4.9, revenue:2640000 },
];
const COLORS = ["#534AB7","#1D9E75","#BA7517","#378ADD","#D85A30","#639922"];
const KPI_CUR  = { opd:3800, ipd:421, revenue:6100000, occupancy:82, nps:62, avg_los:4.2 };
const KPI_PREV = { opd:3450, ipd:388, revenue:5500000, occupancy:78, nps:59, avg_los:4.8 };

function KpiCard({ label, value, prev, icon: Icon, color, format = "number" }: {
  label: string; value: number; prev: number; icon: React.ElementType; color: string; format?: "number"|"currency"|"percent"|"decimal";
}) {
  const { d, up } = delta(value, prev);
  const display = format === "currency" ? fmt(value) : format === "percent" ? `${value}%` : format === "decimal" ? value.toFixed(1) : value.toLocaleString();
  return (
    <div className={cn("rounded-xl border bg-background px-5 py-4 border-l-[3px]", color)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-2xl font-bold">{display}</p>
          <p className="text-sm font-medium mt-0.5 text-muted-foreground">{label}</p>
        </div>
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl opacity-20")}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
      <div className={cn("flex items-center gap-1 mt-2 text-[12px] font-medium", up ? "text-green-600" : "text-red-600")}>
        {up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
        {d}% vs last month
      </div>
    </div>
  );
}

type Period = "7d"|"1m"|"3m"|"6m"|"1y";

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>("1m");
  const [error, setError]   = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try { setError(null); } catch { setError("Showing demo data."); }
  }, []);
  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="space-y-5 pb-8">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div><h2 className="text-2xl font-bold">Analytics</h2><p className="text-sm text-muted-foreground">Hospital performance, trends, and key metrics</p></div>
        <div className="flex gap-2 items-center">
          <div className="flex rounded-md border overflow-hidden text-xs">
            {(["7d","1m","3m","6m","1y"] as Period[]).map(p => (
              <button key={p} onClick={() => setPeriod(p)} className={cn("px-3 py-2 font-medium transition-colors", period === p ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted")}>{p}</button>
            ))}
          </div>
          <button onClick={fetchData} className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"><RefreshCw className="h-3.5 w-3.5" />Refresh</button>
        </div>
      </div>
      {error && <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 text-sm text-amber-800"><AlertTriangle className="h-4 w-4 shrink-0" />Showing demo data.</div>}

      {/* KPI row */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="OPD Visits"     value={KPI_CUR.opd}       prev={KPI_PREV.opd}       icon={Users}       color="border-l-blue-500"   />
        <KpiCard label="IPD Admissions" value={KPI_CUR.ipd}       prev={KPI_PREV.ipd}       icon={BedDouble}   color="border-l-purple-500" />
        <KpiCard label="Revenue"        value={KPI_CUR.revenue}   prev={KPI_PREV.revenue}   icon={IndianRupee} color="border-l-green-500"  format="currency" />
        <KpiCard label="Bed Occupancy"  value={KPI_CUR.occupancy} prev={KPI_PREV.occupancy} icon={Activity}    color="border-l-amber-500"  format="percent" />
        <KpiCard label="NPS Score"      value={KPI_CUR.nps}       prev={KPI_PREV.nps}       icon={TrendingUp}  color="border-l-teal-500"   />
        <KpiCard label="Avg LOS (days)" value={KPI_CUR.avg_los}   prev={KPI_PREV.avg_los}   icon={Activity}    color="border-l-red-500"    format="decimal" />
      </div>

      {/* Revenue + OPD trend */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Monthly Revenue vs Collections (₹L)</CardTitle></CardHeader>
          <CardContent>
            <div className="flex gap-4 mb-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#534AB7]" />Revenue billed</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#1D9E75]" />Collected</span>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={MONTHLY} margin={{ top:4, right:8, left:-16, bottom:0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize:11 }} />
                <YAxis tick={{ fontSize:11 }} tickFormatter={v => `${(v/100000).toFixed(0)}L`} />
                <Tooltip formatter={(v:number) => [fmt(v)]} contentStyle={{ fontSize:12, borderRadius:8 }} />
                <Bar dataKey="revenue"     name="Revenue"    fill="#534AB7" radius={[3,3,0,0]} />
                <Bar dataKey="collections" name="Collected"  fill="#1D9E75" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">OPD & IPD Monthly Trend</CardTitle></CardHeader>
          <CardContent>
            <div className="flex gap-4 mb-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#378ADD]" />OPD visits</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#D85A30]" />IPD admissions</span>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={MONTHLY} margin={{ top:4, right:8, left:-16, bottom:0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize:11 }} />
                <YAxis yAxisId="l" tick={{ fontSize:11 }} />
                <YAxis yAxisId="r" orientation="right" tick={{ fontSize:11 }} />
                <Tooltip contentStyle={{ fontSize:12, borderRadius:8 }} />
                <Area yAxisId="l" type="monotone" dataKey="opd" name="OPD"   stroke="#378ADD" fill="#378ADD20" strokeWidth={2} />
                <Area yAxisId="r" type="monotone" dataKey="ipd" name="IPD"   stroke="#D85A30" fill="#D85A3020" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* OPD by day + Revenue breakdown */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">OPD + Emergency by Weekday</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={DAILY_OPD} margin={{ top:4, right:8, left:-16, bottom:0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tick={{ fontSize:11 }} />
                <YAxis tick={{ fontSize:11 }} />
                <Tooltip contentStyle={{ fontSize:12, borderRadius:8 }} />
                <Bar dataKey="opd"       name="OPD"       fill="#378ADD" radius={[3,3,0,0]} />
                <Bar dataKey="emergency" name="Emergency" fill="#E24B4A" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Revenue by Department</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={DEPT_REVENUE} cx="50%" cy="50%" innerRadius={40} outerRadius={72} dataKey="revenue" nameKey="dept" paddingAngle={2}>
                  {DEPT_REVENUE.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <Tooltip formatter={(v:number) => [fmt(v)]} contentStyle={{ fontSize:12, borderRadius:8 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-2 space-y-1">
              {DEPT_REVENUE.map((d, i) => (
                <div key={d.dept} className="flex items-center justify-between text-[11px]">
                  <span className="flex items-center gap-1.5 text-muted-foreground"><span className="h-2 w-2 rounded-sm" style={{ background: COLORS[i] }} />{d.dept}</span>
                  <span className="font-medium">{d.pct}% · {fmt(d.revenue)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Ward Occupancy % (4-week trend)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={WARD_TREND} margin={{ top:4, right:8, left:-16, bottom:0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="week" tick={{ fontSize:11 }} />
                <YAxis domain={[40,100]} tick={{ fontSize:11 }} tickFormatter={v=>`${v}%`} />
                <Tooltip formatter={(v:number) => [`${v}%`]} contentStyle={{ fontSize:12, borderRadius:8 }} />
                <Line type="monotone" dataKey="general"   name="General"   stroke="#378ADD" strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="icu"       name="ICU"       stroke="#E24B4A" strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="surgical"  name="Surgical"  stroke="#1D9E75" strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="maternity" name="Maternity" stroke="#BA7517" strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top diagnoses + Doctor performance */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Top Diagnoses (MTD)</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2.5">
              {TOP_DIAGNOSES.map((d, i) => (
                <div key={d.name} className="flex items-center gap-3">
                  <span className="text-[11px] text-muted-foreground w-4 text-right shrink-0">{i+1}</span>
                  <div className="flex-1">
                    <div className="flex justify-between text-[12px] mb-1">
                      <span className="font-medium">{d.name}</span>
                      <span className="text-muted-foreground">{d.count}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full" style={{ width:`${Math.round(d.count/TOP_DIAGNOSES[0].count*100)}%`, background: COLORS[i % COLORS.length] }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Doctor Performance (MTD)</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead><tr className="border-b text-[11px] text-muted-foreground">
                  <th className="px-4 py-2.5 text-left font-medium">Doctor</th>
                  <th className="px-3 py-2.5 text-right font-medium">OPD</th>
                  <th className="px-3 py-2.5 text-right font-medium">IPD</th>
                  <th className="px-3 py-2.5 text-right font-medium">Rating</th>
                  <th className="px-3 py-2.5 text-right font-medium">Revenue</th>
                </tr></thead>
                <tbody>
                  {DOCTOR_PERF.map((d, i) => (
                    <tr key={d.name} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-2.5">
                        <p className="font-medium">{d.name}</p>
                        <p className="text-[10px] text-muted-foreground">{d.dept}</p>
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold">{d.opd}</td>
                      <td className="px-3 py-2.5 text-right">{d.ipd}</td>
                      <td className="px-3 py-2.5 text-right">
                        <span className="font-semibold text-amber-600">★ {d.avg_rating}</span>
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold text-green-600">{fmt(d.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}