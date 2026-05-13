"use client";
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Bell, RefreshCw, CheckCheck, Search, AlertTriangle,
  AlertCircle, Info, CheckCircle2, Stethoscope, Pill,
  BedDouble, FlaskConical, IndianRupee, Shield, Ambulance,
  Users, Wrench, X, Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";
function hdrs() { const t = useAuthStore.getState().token; return { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) }; }
async function get<T>(p: string): Promise<T> { const r = await fetch(`${BASE}${p}`, { headers: hdrs(), cache: "no-store" }); if (!r.ok) throw new Error(`${r.status}`); const j = await r.json(); return (j?.results ?? j) as T; }
async function post<T>(p: string, b: unknown = {}): Promise<T> { const r = await fetch(`${BASE}${p}`, { method: "POST", headers: hdrs(), body: JSON.stringify(b) }); if (!r.ok) throw new Error(`${r.status}`); return r.json(); }

// ── Types ──────────────────────────────────────────────────────────────────────
type NotifLevel    = "critical" | "warning" | "info" | "success";
type NotifCategory = "Clinical" | "Pharmacy" | "Lab" | "IPD" | "Billing" | "Security" | "Ambulance" | "HR" | "Maintenance" | "System";

interface HmsNotification {
  id:         number;
  title:      string;
  message:    string;
  level:      NotifLevel;
  category:   NotifCategory;
  module:     string;
  is_read:    boolean;
  action_url: string | null;
  created_at: string;
}

// ── Mock data ──────────────────────────────────────────────────────────────────
const MOCK: HmsNotification[] = [
  { id:1,  title:"ICU Bed 3 — Critical vitals",                    message:"Patient MRN-00341 O₂ sat dropped to 88%. Immediate attention required.",                               level:"critical", category:"Clinical",     module:"ICU",           is_read:false, action_url:"/dashboard/ipd",           created_at:"2026-05-12 14:32" },
  { id:2,  title:"Blood stock critical — B− group",                 message:"Only 2 units of B− Packed RBC remaining. Reorder immediately.",                                        level:"critical", category:"Lab",          module:"Blood Bank",    is_read:false, action_url:"/dashboard/blood-bank",    created_at:"2026-05-12 14:15" },
  { id:3,  title:"Unauthorised access attempt — ICU",               message:"Unidentified individual tried to enter ICU without pass. Security investigating.",                      level:"critical", category:"Security",     module:"Security",      is_read:false, action_url:"/dashboard/security",      created_at:"2026-05-12 13:30" },
  { id:4,  title:"OT-2 CABG case — pre-op check pending",          message:"Patient Hamid Khan (MRN-00589) CABG scheduled 15:00. Pre-op checklist incomplete.",                    level:"warning",  category:"Clinical",     module:"OT",            is_read:false, action_url:"/dashboard/ot",            created_at:"2026-05-12 13:00" },
  { id:5,  title:"Insurance pre-auth pending — Savita Rao",         message:"HDFC Ergo pre-auth for C-Section (CLAIM/0512/003) awaiting response since 13:00.",                     level:"warning",  category:"Billing",      module:"Insurance",     is_read:false, action_url:"/dashboard/insurance",     created_at:"2026-05-12 13:05" },
  { id:6,  title:"Pharmacy — Atorvastatin 40mg critical stock",     message:"Only 180 tabs remaining (min: 200). Patient prescriptions may be affected.",                           level:"warning",  category:"Pharmacy",     module:"Pharmacy",      is_read:false, action_url:"/dashboard/pharmacy",      created_at:"2026-05-12 12:45" },
  { id:7,  title:"5 discharge summaries overdue",                   message:"Ward A patients MRN-00387, MRN-00412 and 3 others awaiting discharge summary since 10:00 AM.",         level:"warning",  category:"Clinical",     module:"IPD",           is_read:false, action_url:"/dashboard/ipd",           created_at:"2026-05-12 12:30" },
  { id:8,  title:"Lab TAT exceeded — 23 orders pending",            message:"Average turnaround time exceeded by 40 minutes. Urgent orders affected.",                              level:"warning",  category:"Lab",          module:"Laboratory",    is_read:true,  action_url:"/dashboard/laboratory",    created_at:"2026-05-12 12:00" },
  { id:9,  title:"Ambulance call dispatched — emergency",           message:"AMB/0512/007 dispatched for MRN-00156. ETA 8 minutes. O₂ cylinder loaded.",                          level:"info",     category:"Ambulance",    module:"Ambulance",     is_read:true,  action_url:"/dashboard/ambulance",     created_at:"2026-05-12 11:55" },
  { id:10, title:"New complaint escalated — Priya Devi",            message:"CMP/0512/002 escalated to HOD Gynaecology. Staff behaviour complaint.",                               level:"warning",  category:"Clinical",     module:"Complaints",    is_read:false, action_url:"/dashboard/patient-engagement", created_at:"2026-05-12 11:30" },
  { id:11, title:"IV Cannula (20G) stock critical",                 message:"Only 28 units remaining against minimum level of 100. Reorder required urgently.",                    level:"warning",  category:"Pharmacy",     module:"Inventory",     is_read:true,  action_url:"/dashboard/inventory",     created_at:"2026-05-12 11:00" },
  { id:12, title:"Ryle's Tube (14Fr) — out of stock",              message:"Zero units remaining. Pending patient NGT feeding order in ICU.",                                       level:"critical", category:"Pharmacy",     module:"Inventory",     is_read:false, action_url:"/dashboard/inventory",     created_at:"2026-05-12 10:45" },
  { id:13, title:"Autoclave malfunction — CSSD",                    message:"OT-sterilisation autoclave pressure gauge fault. Service ticket SVC/0512/002 raised.",                level:"warning",  category:"Maintenance",  module:"Assets",        is_read:true,  action_url:"/dashboard/assets",        created_at:"2026-05-12 10:30" },
  { id:14, title:"AMC renewal due — Infusion Pump & Cardiac Monitor",message:"2 assets with AMC expiry within 30 days. Renewal required to maintain warranty.",                   level:"info",     category:"Maintenance",  module:"Assets",        is_read:true,  action_url:"/dashboard/assets",        created_at:"2026-05-12 10:00" },
  { id:15, title:"Payroll — 24 employees pending disbursement",     message:"May 2026 payroll. 24 employees in pending/processed state awaiting payment approval.",                level:"info",     category:"HR",           module:"Payroll",       is_read:true,  action_url:"/dashboard/payroll",       created_at:"2026-05-12 09:30" },
  { id:16, title:"Appointment booked — Dr. Sharma (Token #147)",    message:"Ramesh Kumar (MRN-00482) booked OPD slot. Consultation fee ₹400 collected.",                        level:"success",  category:"Clinical",     module:"Reception",     is_read:true,  action_url:"/dashboard/reception",     created_at:"2026-05-12 09:22" },
  { id:17, title:"Discharge completed — Rohit Malhotra",            message:"MRN-00692 discharged from Surgical Ward C-04. Insurance claim CLAIM/0512/001 approved.",             level:"success",  category:"IPD",          module:"IPD",           is_read:true,  action_url:"/dashboard/ipd",           created_at:"2026-05-12 09:00" },
  { id:18, title:"Blood bank — 4 units received",                   message:"4 units A+ Packed RBC received from AIIMS Blood Bank. Stock updated.",                               level:"success",  category:"Lab",          module:"Blood Bank",    is_read:true,  action_url:"/dashboard/blood-bank",    created_at:"2026-05-12 08:45" },
  { id:19, title:"New employee joined — Dr. Vikram Nair",           message:"EMP-186 joined as Nephrologist effective 2026-05-12. Credentials verified.",                          level:"success",  category:"HR",           module:"HR",            is_read:true,  action_url:"/dashboard/hr",            created_at:"2026-05-12 08:30" },
  { id:20, title:"Server disk RAID warning — IT",                   message:"Hospital server main RAID array degraded. Dell support ticket raised. Backup running.",              level:"warning",  category:"System",       module:"System",        is_read:true,  action_url:"/dashboard/assets",        created_at:"2026-05-12 08:00" },
];

// ── Config ─────────────────────────────────────────────────────────────────────
const LEVEL_CFG: Record<NotifLevel, { icon: React.ReactNode; dot: string; bg: string; border: string; label: string }> = {
  critical: { icon: <AlertCircle  className="h-4 w-4" />, dot: "bg-red-500",    bg: "bg-red-50",    border: "border-red-200",    label: "Critical" },
  warning:  { icon: <AlertTriangle className="h-4 w-4"/>, dot: "bg-amber-500",  bg: "bg-amber-50",  border: "border-amber-200",  label: "Warning"  },
  info:     { icon: <Info          className="h-4 w-4" />, dot: "bg-blue-500",   bg: "bg-blue-50",   border: "border-blue-200",   label: "Info"     },
  success:  { icon: <CheckCircle2  className="h-4 w-4" />, dot: "bg-green-500",  bg: "bg-green-50",  border: "border-green-200",  label: "Success"  },
};
const LEVEL_ICON_COLOR: Record<NotifLevel, string> = {
  critical: "text-red-600",
  warning:  "text-amber-600",
  info:     "text-blue-600",
  success:  "text-green-600",
};
const CAT_ICON: Record<NotifCategory, React.ReactNode> = {
  Clinical:    <Stethoscope className="h-3.5 w-3.5" />,
  Pharmacy:    <Pill         className="h-3.5 w-3.5" />,
  Lab:         <FlaskConical className="h-3.5 w-3.5" />,
  IPD:         <BedDouble    className="h-3.5 w-3.5" />,
  Billing:     <IndianRupee  className="h-3.5 w-3.5" />,
  Security:    <Shield       className="h-3.5 w-3.5" />,
  Ambulance:   <Ambulance    className="h-3.5 w-3.5" />,
  HR:          <Users        className="h-3.5 w-3.5" />,
  Maintenance: <Wrench       className="h-3.5 w-3.5" />,
  System:      <Bell         className="h-3.5 w-3.5" />,
};
const CATEGORIES: string[] = ["All", "Clinical", "Pharmacy", "Lab", "IPD", "Billing", "Security", "Ambulance", "HR", "Maintenance", "System"];

// ── Page ───────────────────────────────────────────────────────────────────────
export default function NotificationsPage() {
  const [notifs, setNotifs]       = useState<HmsNotification[]>(MOCK);
  const [q, setQ]                 = useState("");
  const [levelFilter, setLevel]   = useState<NotifLevel | "all">("all");
  const [catFilter, setCat]       = useState("All");
  const [showUnread, setUnread]   = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [n] = await Promise.allSettled([get<HmsNotification[]>("/notifications/")]);
      if (n.status === "fulfilled" && (n.value as HmsNotification[]).length > 0) setNotifs(n.value as HmsNotification[]);
      setError(null);
    } catch { setError("Showing demo data."); }
  }, []);
  useEffect(() => { fetchData(); }, [fetchData]);

  const markRead    = (id: number)  => setNotifs(p => p.map(n => n.id === id ? { ...n, is_read: true }   : n));
  const dismiss     = (id: number)  => setNotifs(p => p.filter(n => n.id !== id));
  const markAllRead = ()            => setNotifs(p => p.map(n => ({ ...n, is_read: true })));
  const clearRead   = ()            => setNotifs(p => p.filter(n => !n.is_read));

  const displayed = notifs.filter(n => {
    const mq = !q || n.title.toLowerCase().includes(q.toLowerCase()) || n.message.toLowerCase().includes(q.toLowerCase()) || n.module.toLowerCase().includes(q.toLowerCase());
    const ml = levelFilter === "all" || n.level === levelFilter;
    const mc = catFilter   === "All" || n.category === catFilter;
    const mu = !showUnread  || !n.is_read;
    return mq && ml && mc && mu;
  });

  const unreadCount    = notifs.filter(n => !n.is_read).length;
  const criticalCount  = notifs.filter(n => n.level === "critical" && !n.is_read).length;
  const warningCount   = notifs.filter(n => n.level === "warning"  && !n.is_read).length;

  return (
    <div className="space-y-5 pb-8">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="h-6 w-6" />
            Notifications
            {unreadCount > 0 && (
              <span className="inline-flex items-center justify-center h-6 min-w-[24px] rounded-full bg-primary text-primary-foreground text-xs font-bold px-1.5">
                {unreadCount}
              </span>
            )}
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">All system alerts, clinical events, and module notifications</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchData}    className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"><RefreshCw className="h-3.5 w-3.5" />Refresh</button>
          <button onClick={clearRead}    className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"><X className="h-3.5 w-3.5" />Clear Read</button>
          <Button variant="outline" onClick={markAllRead} className="gap-2 text-xs">
            <CheckCheck className="h-4 w-4" />Mark All Read
          </Button>
        </div>
      </div>

      {error && <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 text-sm text-amber-800"><AlertTriangle className="h-4 w-4 shrink-0" />Showing demo data.</div>}

      {/* Summary pills */}
      <div className="flex flex-wrap gap-3">
        {criticalCount > 0 && (
          <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-2.5">
            <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
            <span className="text-sm font-semibold text-red-700">{criticalCount} critical unread</span>
          </div>
        )}
        {warningCount > 0 && (
          <div className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-4 py-2.5">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            <span className="text-sm font-semibold text-amber-700">{warningCount} warnings unread</span>
          </div>
        )}
        {unreadCount === 0 && (
          <div className="flex items-center gap-2 rounded-xl bg-green-50 border border-green-200 px-4 py-2.5">
            <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
            <span className="text-sm font-semibold text-green-700">All caught up!</span>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={e => setQ(e.target.value)} className="pl-9" placeholder="Search notifications…" />
        </div>

        {/* Level filter */}
        <div className="flex rounded-md border overflow-hidden text-xs">
          {(["all","critical","warning","info","success"] as const).map(v => (
            <button key={v} onClick={() => setLevel(v)} className={cn("px-3 py-2 font-medium transition-colors capitalize", levelFilter === v ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted")}>
              {v === "all" ? `All (${notifs.length})` : `${v.charAt(0).toUpperCase() + v.slice(1)} (${notifs.filter(n => n.level === v).length})`}
            </button>
          ))}
        </div>

        {/* Category filter */}
        <select value={catFilter} onChange={e => setCat(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2">
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>

        {/* Unread toggle */}
        <button onClick={() => setUnread(u => !u)}
          className={cn("flex items-center gap-1.5 rounded-md border px-3 py-2 text-xs font-medium transition-colors",
            showUnread ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground hover:bg-muted")}>
          <Filter className="h-3.5 w-3.5" />
          Unread only
        </button>
      </div>

      <p className="text-xs text-muted-foreground">
        Showing {displayed.length} of {notifs.length} notifications
        {unreadCount > 0 && <span className="ml-2 text-primary font-medium">{unreadCount} unread</span>}
      </p>

      {/* Notification list */}
      {displayed.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border bg-background py-20 text-muted-foreground">
          <Bell className="h-12 w-12 mb-3 opacity-20" />
          <p className="text-sm font-medium">No notifications</p>
          <p className="text-xs mt-1">You're all caught up!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {displayed.map(n => {
            const lc = LEVEL_CFG[n.level];
            const ic = LEVEL_ICON_COLOR[n.level];
            return (
              <div
                key={n.id}
                onClick={() => !n.is_read && markRead(n.id)}
                className={cn(
                  "group relative flex items-start gap-4 rounded-xl border p-4 transition-all",
                  !n.is_read
                    ? cn("cursor-pointer", lc.bg, lc.border)
                    : "bg-background border-border opacity-70 hover:opacity-90",
                )}
              >
                {/* Level icon */}
                <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", !n.is_read ? "bg-white/70" : "bg-muted", ic)}>
                  {lc.icon}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {!n.is_read && (
                        <span className={cn("h-2 w-2 rounded-full shrink-0 mt-1.5", lc.dot)} />
                      )}
                      <p className={cn("text-[14px] font-semibold leading-snug", !n.is_read ? "text-foreground" : "text-foreground/80")}>
                        {n.title}
                      </p>
                    </div>
                    {/* Dismiss */}
                    <button
                      onClick={e => { e.stopPropagation(); dismiss(n.id); }}
                      className="shrink-0 rounded p-1 opacity-0 group-hover:opacity-100 hover:bg-black/10 transition-all"
                    >
                      <X className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </div>

                  <p className="text-[12px] text-muted-foreground mt-0.5 leading-relaxed">{n.message}</p>

                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    {/* Category badge */}
                    <span className="inline-flex items-center gap-1 rounded-full bg-background/80 border px-2 py-0.5 text-[11px] text-muted-foreground">
                      {CAT_ICON[n.category]}
                      {n.category} · {n.module}
                    </span>
                    <span className="text-[11px] text-muted-foreground">{n.created_at}</span>
                    {!n.is_read && (
                      <button
                        onClick={e => { e.stopPropagation(); markRead(n.id); }}
                        className="text-[11px] text-primary font-medium hover:underline"
                      >
                        Mark as read
                      </button>
                    )}
                    {n.action_url && (
                      <a href={n.action_url} onClick={e => { e.stopPropagation(); markRead(n.id); }}
                        className="text-[11px] text-primary font-medium hover:underline">
                        View →
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}