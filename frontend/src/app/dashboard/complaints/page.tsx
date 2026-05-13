"use client";
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Search, RefreshCw, Plus, AlertTriangle, MessageSquare,
  Star, ThumbsUp, ThumbsDown, ChevronDown, ChevronUp,
  CheckCircle2, Clock, TrendingUp, TrendingDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";
function hdrs() { const t = useAuthStore.getState().token; return { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) }; }
async function get<T>(p: string): Promise<T> { const r = await fetch(`${BASE}${p}`, { headers: hdrs(), cache: "no-store" }); if (!r.ok) throw new Error(`${r.status}`); const j = await r.json(); return (j?.results ?? j) as T; }

// ── Types ──────────────────────────────────────────────────────────────────────
type ComplaintStatus   = "open" | "acknowledged" | "in_progress" | "resolved" | "closed" | "escalated";
type ComplaintCategory = "Staff Behaviour" | "Waiting Time" | "Cleanliness" | "Food" | "Billing" | "Clinical Care" | "Facilities" | "Other";
type NpsCategory       = "promoter" | "passive" | "detractor";

interface Complaint {
  id: number; comp_no: string; mrn: string; patient_name: string; phone: string;
  department: string; category: ComplaintCategory; subject: string; description: string;
  priority: "low" | "medium" | "high" | "critical";
  status: ComplaintStatus; assigned_to: string;
  submitted_at: string; acknowledged_at: string | null; resolved_at: string | null;
  resolution_notes: string; satisfaction_rating: number | null;
}
interface NpsSurvey {
  id: number; mrn: string; patient_name: string; department: string;
  visit_type: string; score: number; category: NpsCategory;
  feedback: string; submitted_at: string;
  ratings: { doctor: number; nurse: number; cleanliness: number; food: number; billing: number; };
}
interface NpsStats {
  total_responses: number; nps_score: number;
  promoters: number; passives: number; detractors: number;
  avg_rating: number; response_rate: number;
  trend: { month: string; nps: number; responses: number }[];
  by_dept: { dept: string; nps: number; responses: number }[];
}
interface ComplaintStats {
  total: number; open: number; in_progress: number; resolved_today: number;
  escalated: number; avg_resolution_hrs: number;
  by_category: { category: string; count: number }[];
}

// ── Mock data ──────────────────────────────────────────────────────────────────
const NPS_STATS: NpsStats = {
  total_responses: 284, nps_score: 62, promoters: 198, passives: 54, detractors: 32,
  avg_rating: 4.2, response_rate: 68,
  trend: [
    { month: "Jan", nps: 54, responses: 210 },
    { month: "Feb", nps: 58, responses: 198 },
    { month: "Mar", nps: 61, responses: 241 },
    { month: "Apr", nps: 59, responses: 267 },
    { month: "May", nps: 62, responses: 284 },
  ],
  by_dept: [
    { dept: "Cardiology",     nps: 74, responses: 42 },
    { dept: "General OPD",    nps: 58, responses: 98 },
    { dept: "Gynaecology",    nps: 71, responses: 38 },
    { dept: "Orthopaedics",   nps: 65, responses: 34 },
    { dept: "ICU",            nps: 80, responses: 18 },
    { dept: "Emergency",      nps: 48, responses: 54 },
  ],
};

const COMP_STATS: ComplaintStats = {
  total: 38, open: 12, in_progress: 8, resolved_today: 4, escalated: 2, avg_resolution_hrs: 18,
  by_category: [
    { category: "Waiting Time",    count: 11 },
    { category: "Staff Behaviour", count: 8  },
    { category: "Cleanliness",     count: 6  },
    { category: "Billing",         count: 5  },
    { category: "Clinical Care",   count: 4  },
    { category: "Facilities",      count: 3  },
    { category: "Food",            count: 1  },
  ],
};

const COMPLAINTS: Complaint[] = [
  { id:1,  comp_no:"CMP/0512/001", mrn:"MRN-00482", patient_name:"Ramesh Kumar",    phone:"9876543210", department:"General OPD",  category:"Waiting Time",    subject:"Waited 2+ hours for OPD token",               description:"I had a scheduled appointment at 10 AM but was called only at 12:30 PM. No explanation was given. Staff at counter were dismissive when asked.",                                                   priority:"high",     status:"in_progress", assigned_to:"OPD Manager",      submitted_at:"2026-05-12 11:00", acknowledged_at:"2026-05-12 11:15", resolved_at:null,                resolution_notes:"", satisfaction_rating:null },
  { id:2,  comp_no:"CMP/0512/002", mrn:"MRN-00389", patient_name:"Priya Devi",      phone:"9812345678", department:"Gynaecology",   category:"Staff Behaviour", subject:"Rude behaviour by ward staff",                 description:"The ward nurse on duty was extremely rude and dismissive during night rounds. She refused to answer queries and spoke disrespectfully.",                                                           priority:"high",     status:"escalated",   assigned_to:"HOD Gynaecology",  submitted_at:"2026-05-12 08:30", acknowledged_at:"2026-05-12 08:45", resolved_at:null,                resolution_notes:"", satisfaction_rating:null },
  { id:3,  comp_no:"CMP/0512/003", mrn:"MRN-00271", patient_name:"Sunita Joshi",    phone:"9871234567", department:"Billing",       category:"Billing",         subject:"Incorrect bill raised — overcharged",           description:"My bill included charges for tests that were not conducted. I was charged for an MRI that was cancelled. Despite informing billing desk, no correction was made immediately.",                   priority:"medium",   status:"open",        assigned_to:"Billing Manager",  submitted_at:"2026-05-12 13:00", acknowledged_at:null,               resolved_at:null,                resolution_notes:"", satisfaction_rating:null },
  { id:4,  comp_no:"CMP/0512/004", mrn:"MRN-00501", patient_name:"Arun Singh",      phone:"9898989898", department:"Cardiology",    category:"Cleanliness",     subject:"Toilet block near OPD not clean",              description:"The toilets near cardiology OPD were not cleaned since morning. There was no hand wash available and the floor was wet and slippery.",                                                          priority:"medium",   status:"resolved",    assigned_to:"Housekeeping HoD", submitted_at:"2026-05-11 14:00", acknowledged_at:"2026-05-11 14:10", resolved_at:"2026-05-11 15:30",  resolution_notes:"Toilet cleaned immediately. Housekeeping schedule revised.", satisfaction_rating:4 },
  { id:5,  comp_no:"CMP/0512/005", mrn:"MRN-00605", patient_name:"Lalita Verma",    phone:"9845671234", department:"Dietary",       category:"Food",            subject:"Cold food served — unacceptable quality",      description:"The lunch served today was cold and tasteless. The dal was watery and the chapati was hard. Patient is elderly and specifically requested warm food.",                                           priority:"low",      status:"resolved",    assigned_to:"Dietary Supervisor",submitted_at:"2026-05-12 13:30", acknowledged_at:"2026-05-12 13:35", resolved_at:"2026-05-12 14:00",  resolution_notes:"Fresh meal sent. Apology conveyed. Kitchen supervisor informed.", satisfaction_rating:3 },
  { id:6,  comp_no:"CMP/0511/018", mrn:"MRN-00198", patient_name:"Mohan Kaul",      phone:"9823456789", department:"Orthopaedics",  category:"Clinical Care",   subject:"Post-surgery instructions not explained",       description:"After knee replacement surgery, no written instructions were provided for home care. The physiotherapist did not explain the exercises. Very anxious about recovery.",                           priority:"high",     status:"open",        assigned_to:"Dr. Patel",        submitted_at:"2026-05-11 16:00", acknowledged_at:null,               resolved_at:null,                resolution_notes:"", satisfaction_rating:null },
  { id:7,  comp_no:"CMP/0511/020", mrn:"MRN-00312", patient_name:"Suresh Nair",     phone:"9867890123", department:"Emergency",     category:"Waiting Time",    subject:"Long wait at emergency despite critical state", description:"Patient arrived with chest pain and was made to wait at triage for 25 minutes before a doctor saw him. The attendant had to argue to get priority.",                                         priority:"critical",  status:"acknowledged",assigned_to:"Emergency HOD",   submitted_at:"2026-05-11 20:00", acknowledged_at:"2026-05-11 20:30", resolved_at:null,                resolution_notes:"Under investigation. Triage nurse counselled.", satisfaction_rating:null },
  { id:8,  comp_no:"CMP/0510/012", mrn:"MRN-00156", patient_name:"Dinesh Pandey",   phone:"9890123456", department:"Pharmacy",      category:"Facilities",      subject:"Wheelchair not available at pharmacy exit",    description:"After collecting medicines, elderly patient had no wheelchair available at the pharmacy exit for 30 minutes. Staff unhelpful.",                                                                  priority:"medium",   status:"closed",      assigned_to:"Admin Manager",    submitted_at:"2026-05-10 11:00", acknowledged_at:"2026-05-10 11:15", resolved_at:"2026-05-10 12:30",  resolution_notes:"Two additional wheelchairs deployed at pharmacy. SOP updated.", satisfaction_rating:5 },
];

const SURVEYS: NpsSurvey[] = [
  { id:1, mrn:"MRN-00341", patient_name:"Suresh Kumar",   department:"Surgical",    visit_type:"IPD", score:9,  category:"promoter",  feedback:"Excellent care by Dr. Arora and the surgical team. Nurses were attentive. Very happy with the outcome.",                                   submitted_at:"2026-05-12 10:00", ratings:{doctor:5,nurse:5,cleanliness:4,food:3,billing:4} },
  { id:2, mrn:"MRN-00621", patient_name:"Savita Rao",     department:"Maternity",   visit_type:"IPD", score:10, category:"promoter",  feedback:"Dr. Mehta and the maternity team were outstanding. Very smooth delivery experience. Clean ward and good food.",                               submitted_at:"2026-05-12 09:00", ratings:{doctor:5,nurse:5,cleanliness:5,food:4,billing:4} },
  { id:3, mrn:"MRN-00482", patient_name:"Ramesh Kumar",   department:"General OPD", visit_type:"OPD", score:5,  category:"detractor", feedback:"Long waiting time is unacceptable. Almost 2.5 hours for consultation. Doctor was good but the system is very slow.",                       submitted_at:"2026-05-12 12:00", ratings:{doctor:4,nurse:3,cleanliness:3,food:0,billing:2} },
  { id:4, mrn:"MRN-00501", patient_name:"Arun Singh",     department:"Cardiology",  visit_type:"OPD", score:8,  category:"promoter",  feedback:"Dr. Gupta is excellent. Very thorough examination and detailed explanation. Waiting time was a bit long but overall good.",                  submitted_at:"2026-05-12 11:00", ratings:{doctor:5,nurse:4,cleanliness:4,food:0,billing:4} },
  { id:5, mrn:"MRN-00692", patient_name:"Rohit Malhotra", department:"Surgical",    visit_type:"IPD", score:7,  category:"passive",   feedback:"Surgery went well. Post-op care was good. Food could be better. Billing process was a bit confusing.",                                         submitted_at:"2026-05-11 14:00", ratings:{doctor:5,nurse:4,cleanliness:4,food:2,billing:3} },
  { id:6, mrn:"MRN-00312", patient_name:"Suresh Nair",    department:"Emergency",   visit_type:"Emergency",score:4,category:"detractor",feedback:"Made to wait too long in emergency with chest pain. Very stressful. Doctor was good once we got in but the wait was unacceptable.",       submitted_at:"2026-05-11 22:00", ratings:{doctor:4,nurse:2,cleanliness:3,food:0,billing:3} },
  { id:7, mrn:"MRN-00478", patient_name:"Meena Sharma",   department:"Orthopaedics",visit_type:"IPD", score:9,  category:"promoter",  feedback:"Dr. Patel is a wonderful surgeon. Highly skilled and compassionate. Physiotherapy team was also very helpful.",                                submitted_at:"2026-05-11 16:00", ratings:{doctor:5,nurse:4,cleanliness:4,food:3,billing:4} },
];

// ── Helpers ────────────────────────────────────────────────────────────────────
const CSC: Record<ComplaintStatus, { label: string; cls: string }> = {
  open:         { label: "Open",         cls: "bg-red-100 text-red-700"       },
  acknowledged: { label: "Acknowledged", cls: "bg-blue-100 text-blue-700"     },
  in_progress:  { label: "In Progress",  cls: "bg-purple-100 text-purple-700" },
  resolved:     { label: "Resolved",     cls: "bg-green-100 text-green-700"   },
  closed:       { label: "Closed",       cls: "bg-slate-100 text-slate-600"   },
  escalated:    { label: "Escalated",    cls: "bg-orange-100 text-orange-700" },
};
const PRI: Record<string, string> = {
  low:      "bg-slate-100 text-slate-600",
  medium:   "bg-amber-100 text-amber-700",
  high:     "bg-orange-100 text-orange-700",
  critical: "bg-red-100 text-red-700 font-bold",
};
const CAT_COLORS: Record<ComplaintCategory, string> = {
  "Staff Behaviour": "bg-red-100 text-red-700",
  "Waiting Time":    "bg-amber-100 text-amber-700",
  "Cleanliness":     "bg-blue-100 text-blue-700",
  "Food":            "bg-green-100 text-green-700",
  "Billing":         "bg-purple-100 text-purple-700",
  "Clinical Care":   "bg-orange-100 text-orange-700",
  "Facilities":      "bg-teal-100 text-teal-700",
  "Other":           "bg-slate-100 text-slate-600",
};
const NPS_COLOR = (s: number) => s >= 9 ? "text-green-600" : s >= 7 ? "text-amber-600" : "text-red-600";
const NPS_BG    = (s: number) => s >= 9 ? "bg-green-100"  : s >= 7 ? "bg-amber-100"   : "bg-red-100";
const AV = ["bg-blue-100 text-blue-700","bg-purple-100 text-purple-700","bg-teal-100 text-teal-700","bg-amber-100 text-amber-700","bg-rose-100 text-rose-700"];
function ini(n: string) { return n.trim().split(" ").filter(Boolean).slice(0, 2).map((w: string) => w[0]).join("").toUpperCase(); }

function StarBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className="w-20 text-muted-foreground">{label}</span>
      <div className="flex gap-0.5">
        {[1,2,3,4,5].map(i => (
          <Star key={i} className={cn("h-3 w-3", i <= value ? "fill-amber-400 text-amber-400" : "text-slate-200")} />
        ))}
      </div>
      <span className="font-medium">{value > 0 ? value : "N/A"}</span>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function ComplaintsNpsPage() {
  const [complaints, setComplaints] = useState<Complaint[]>(COMPLAINTS);
  const [surveys]                    = useState<NpsSurvey[]>(SURVEYS);
  const [tab, setTab]                = useState<"complaints" | "nps">("complaints");
  const [q, setQ]                    = useState("");
  const [statusFilter, setStatus]    = useState<ComplaintStatus | "all">("all");
  const [expanded, setExpanded]      = useState<number | null>(null);
  const [error, setError]            = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [c, s] = await Promise.allSettled([
        get<Complaint[]>("/patient-engagement/complaints/"),
        get<NpsSurvey[]>("/patient-engagement/nps/"),
      ]);
      if (c.status === "fulfilled" && (c.value as Complaint[]).length > 0) setComplaints(c.value as Complaint[]);
      setError(null);
    } catch { setError("Showing demo data."); }
  }, []);
  useEffect(() => { fetchData(); }, [fetchData]);

  const acknowledge = (id: number) => setComplaints(p => p.map(c => c.id === id ? { ...c, status: "acknowledged", acknowledged_at: new Date().toLocaleString("en-IN") } : c));
  const resolve     = (id: number) => setComplaints(p => p.map(c => c.id === id ? { ...c, status: "resolved",     resolved_at:    new Date().toLocaleString("en-IN"), resolution_notes: "Resolved by admin." } : c));
  const escalate    = (id: number) => setComplaints(p => p.map(c => c.id === id ? { ...c, status: "escalated" } : c));

  const displayed = complaints.filter(c => {
    const mq = !q || c.patient_name.toLowerCase().includes(q.toLowerCase()) || c.comp_no.toLowerCase().includes(q.toLowerCase()) || c.subject.toLowerCase().includes(q.toLowerCase()) || c.department.toLowerCase().includes(q.toLowerCase());
    const ms = statusFilter === "all" || c.status === statusFilter;
    return mq && ms;
  });

  const openCount     = complaints.filter(c => c.status === "open" || c.status === "escalated").length;
  const promoterPct   = Math.round(NPS_STATS.promoters  / NPS_STATS.total_responses * 100);
  const detractorPct  = Math.round(NPS_STATS.detractors / NPS_STATS.total_responses * 100);

  return (
    <div className="space-y-5 pb-8">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold">Patient Engagement</h2>
          <p className="text-sm text-muted-foreground">Complaints, feedback, and NPS (Net Promoter Score)</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchData} className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"><RefreshCw className="h-3.5 w-3.5" />Refresh</button>
          <Button className="gap-2"><Plus className="h-4 w-4" />Log Complaint</Button>
        </div>
      </div>

      {error && <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 text-sm text-amber-800"><AlertTriangle className="h-4 w-4 shrink-0" />Showing demo data.</div>}

      {/* Top-level stats */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-background px-5 py-4 border-l-[3px] border-l-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-3xl font-bold text-blue-600">{NPS_STATS.nps_score}</p>
              <p className="text-sm font-medium mt-0.5">NPS Score</p>
              <p className="text-xs text-muted-foreground">+4 vs last month</p>
            </div>
            <div className="text-right">
              <TrendingUp className="h-8 w-8 text-blue-300" />
            </div>
          </div>
          <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden flex">
            <div className="h-full bg-green-500" style={{ width: `${promoterPct}%` }} />
            <div className="h-full bg-amber-400" style={{ width: `${Math.round(NPS_STATS.passives / NPS_STATS.total_responses * 100)}%` }} />
            <div className="h-full bg-red-400"   style={{ width: `${detractorPct}%` }} />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
            <span className="text-green-600">P {promoterPct}%</span>
            <span className="text-amber-600">N {Math.round(NPS_STATS.passives / NPS_STATS.total_responses * 100)}%</span>
            <span className="text-red-600">D {detractorPct}%</span>
          </div>
        </div>
        <div className="rounded-xl border bg-background px-5 py-4 border-l-[3px] border-l-green-500">
          <p className="text-3xl font-bold">{NPS_STATS.avg_rating}<span className="text-lg text-muted-foreground">/5</span></p>
          <p className="text-sm font-medium mt-0.5">Avg Patient Rating</p>
          <div className="flex gap-0.5 mt-1.5">
            {[1,2,3,4,5].map(i => <Star key={i} className={cn("h-4 w-4", i <= Math.round(NPS_STATS.avg_rating) ? "fill-amber-400 text-amber-400" : "text-slate-200")} />)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">{NPS_STATS.total_responses} responses · {NPS_STATS.response_rate}% rate</p>
        </div>
        <div className="rounded-xl border bg-background px-5 py-4 border-l-[3px] border-l-red-500">
          <p className="text-3xl font-bold text-red-600">{openCount}</p>
          <p className="text-sm font-medium mt-0.5">Open Complaints</p>
          <p className="text-xs text-muted-foreground mt-0.5">{COMP_STATS.escalated} escalated · {COMP_STATS.in_progress} in progress</p>
          <p className="text-xs text-muted-foreground">Avg resolution: {COMP_STATS.avg_resolution_hrs}h</p>
        </div>
        <div className="rounded-xl border bg-background px-5 py-4 border-l-[3px] border-l-teal-500">
          <p className="text-3xl font-bold">{COMP_STATS.total}</p>
          <p className="text-sm font-medium mt-0.5">Total Complaints (MTD)</p>
          <p className="text-xs text-muted-foreground mt-0.5">{COMP_STATS.resolved_today} resolved today</p>
          <p className="text-xs text-green-600 font-medium">↑ Resolution rate 72%</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-4 border-b">
        {([["complaints", `Complaints (${complaints.length})`], ["nps", `NPS & Feedback (${surveys.length})`]] as const).map(([v, l]) => (
          <button key={v} onClick={() => setTab(v)} className={cn("py-2.5 px-1 text-sm font-medium border-b-2 -mb-px transition-colors", tab === v ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>{l}</button>
        ))}
      </div>

      {/* ── COMPLAINTS TAB ──────────────────────────────────────────────────── */}
      {tab === "complaints" && (
        <>
          {/* Category chart */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardContent className="pt-4 px-4 pb-2">
                <p className="text-sm font-medium mb-3">Complaints by category (MTD)</p>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={COMP_STATS.by_category} layout="vertical" margin={{ left: 80, right: 16, top: 0, bottom: 0 }}>
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="category" tick={{ fontSize: 11 }} width={80} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Bar dataKey="count" name="Complaints" fill="#F59E0B" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 px-4">
                <p className="text-sm font-medium mb-3">Status summary</p>
                <div className="space-y-2.5">
                  {(["open","acknowledged","in_progress","resolved","escalated","closed"] as ComplaintStatus[]).map(s => {
                    const cnt = complaints.filter(c => c.status === s).length;
                    const sc  = CSC[s];
                    return (
                      <div key={s} className="flex items-center justify-between">
                        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", sc.cls)}>{sc.label}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className="h-full bg-primary rounded-full" style={{ width: `${Math.round(cnt / complaints.length * 100)}%` }} />
                          </div>
                          <span className="text-[12px] font-semibold w-4 text-right">{cnt}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={q} onChange={e => setQ(e.target.value)} className="pl-9" placeholder="Search by patient, subject, or department…" />
            </div>
            <div className="flex rounded-md border overflow-hidden text-xs">
              {(["all","open","escalated","in_progress","resolved","closed"] as const).map(v => (
                <button key={v} onClick={() => setStatus(v)} className={cn("px-3 py-2 font-medium transition-colors", statusFilter === v ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted")}>
                  {v === "all" ? "All" : v === "in_progress" ? "In Progress" : v.charAt(0).toUpperCase() + v.slice(1)}
                  {" "}({v === "all" ? complaints.length : complaints.filter(c => c.status === v).length})
                </button>
              ))}
            </div>
          </div>

          {/* Complaint cards */}
          <div className="space-y-2">
            {displayed.map((comp, i) => {
              const exp = expanded === comp.id;
              const sc  = CSC[comp.status];
              const cc  = CAT_COLORS[comp.category];
              return (
                <Card key={comp.id} className={cn("overflow-hidden",
                  comp.status === "escalated" && "border-orange-300",
                  comp.priority === "critical" && "border-red-300")}>
                  <CardContent className="p-0">
                    <div className="flex items-center gap-4 p-4 cursor-pointer hover:bg-muted/20" onClick={() => setExpanded(exp ? null : comp.id)}>
                      <span className={cn("inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold", AV[i % AV.length])}>{ini(comp.patient_name)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-[14px]">{comp.subject}</p>
                          <span className="font-mono text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{comp.comp_no}</span>
                          <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", sc.cls)}>{sc.label}</span>
                          <span className={cn("rounded-full px-2 py-0.5 text-[11px] uppercase tracking-wide", PRI[comp.priority])}>{comp.priority}</span>
                          <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", cc)}>{comp.category}</span>
                        </div>
                        <div className="flex flex-wrap gap-3 mt-1 text-[12px] text-muted-foreground">
                          <span className="font-medium text-foreground">{comp.patient_name}</span>
                          <span>· {comp.department}</span>
                          <span>· {comp.submitted_at}</span>
                          <span>· Assigned: {comp.assigned_to}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {comp.status === "open" && (
                          <button onClick={e => { e.stopPropagation(); acknowledge(comp.id); }} className="flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1.5 text-[11px] text-white font-medium hover:bg-blue-700"><Clock className="h-3 w-3" />Acknowledge</button>
                        )}
                        {(comp.status === "acknowledged" || comp.status === "in_progress") && (
                          <button onClick={e => { e.stopPropagation(); resolve(comp.id); }} className="flex items-center gap-1 rounded-md bg-green-600 px-2.5 py-1.5 text-[11px] text-white font-medium hover:bg-green-700"><CheckCircle2 className="h-3 w-3" />Resolve</button>
                        )}
                        {(comp.status === "open" || comp.status === "acknowledged") && (
                          <button onClick={e => { e.stopPropagation(); escalate(comp.id); }} className="flex items-center gap-1 rounded-md border border-orange-300 px-2.5 py-1.5 text-[11px] text-orange-600 hover:bg-orange-50">Escalate</button>
                        )}
                      </div>
                      {exp ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                    </div>
                    {exp && (
                      <div className="border-t bg-muted/20 p-4 space-y-3">
                        <div>
                          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Patient Description</p>
                          <p className="text-[13px] text-foreground leading-relaxed">{comp.description}</p>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-[12px]">
                          <div><p className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wide mb-1">MRN</p><p className="font-mono">{comp.mrn}</p></div>
                          <div><p className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wide mb-1">Phone</p><p>{comp.phone}</p></div>
                          <div><p className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wide mb-1">Acknowledged</p><p>{comp.acknowledged_at ?? "—"}</p></div>
                          <div><p className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wide mb-1">Resolved</p><p>{comp.resolved_at ?? "—"}</p></div>
                        </div>
                        {comp.resolution_notes && (
                          <div className="rounded-lg bg-green-50 border border-green-100 p-3 text-[12px] text-green-800">
                            <span className="font-semibold">Resolution: </span>{comp.resolution_notes}
                          </div>
                        )}
                        {comp.satisfaction_rating && (
                          <div className="flex items-center gap-2 text-[12px]">
                            <span className="text-muted-foreground">Patient satisfaction after resolution:</span>
                            <div className="flex gap-0.5">
                              {[1,2,3,4,5].map(i => <Star key={i} className={cn("h-3.5 w-3.5", i <= comp.satisfaction_rating! ? "fill-amber-400 text-amber-400" : "text-slate-200")} />)}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {/* ── NPS TAB ────────────────────────────────────────────────────────── */}
      {tab === "nps" && (
        <>
          {/* Charts row */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardContent className="pt-4 px-4 pb-2">
                <p className="text-sm font-medium mb-3">NPS trend — Jan to May 2026</p>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={NPS_STATS.trend} margin={{ top: 4, right: 16, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} domain={[40, 80]} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Line type="monotone" dataKey="nps" name="NPS Score" stroke="#378ADD" strokeWidth={2} dot={{ r: 4, fill: "#378ADD" }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 px-4 pb-2">
                <p className="text-sm font-medium mb-3">NPS by department</p>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={NPS_STATS.by_dept} layout="vertical" margin={{ left: 80, right: 16, top: 0, bottom: 0 }}>
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="dept" tick={{ fontSize: 11 }} width={80} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Bar dataKey="nps" name="NPS Score" radius={[0, 4, 4, 0]}
                      fill="#1D9E75"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* NPS legend */}
          <div className="flex gap-4 text-[12px]">
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-green-500" />Promoters (9–10) — {NPS_STATS.promoters} ({promoterPct}%)</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-amber-400" />Passives (7–8) — {NPS_STATS.passives} ({Math.round(NPS_STATS.passives / NPS_STATS.total_responses * 100)}%)</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-red-400" />Detractors (0–6) — {NPS_STATS.detractors} ({detractorPct}%)</span>
          </div>

          {/* Survey cards */}
          <div className="space-y-2">
            {surveys.map((sv, i) => {
              const exp = expanded === sv.id + 1000;
              return (
                <Card key={sv.id} className={cn("overflow-hidden",
                  sv.category === "promoter"  && "border-green-200",
                  sv.category === "detractor" && "border-red-200")}>
                  <CardContent className="p-0">
                    <div className="flex items-center gap-4 p-4 cursor-pointer hover:bg-muted/20" onClick={() => setExpanded(exp ? null : sv.id + 1000)}>
                      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg font-black", NPS_BG(sv.score), NPS_COLOR(sv.score))}>
                        {sv.score}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-[14px]">{sv.patient_name}</p>
                          <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium capitalize",
                            sv.category === "promoter"  ? "bg-green-100 text-green-700" :
                            sv.category === "passive"   ? "bg-amber-100 text-amber-700" :
                            "bg-red-100 text-red-700")}>
                            {sv.category === "promoter" ? "😊 Promoter" : sv.category === "passive" ? "😐 Passive" : "😞 Detractor"}
                          </span>
                          <span className="text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{sv.visit_type}</span>
                        </div>
                        <p className="text-[12px] text-muted-foreground mt-1 line-clamp-1">"{sv.feedback}"</p>
                        <div className="flex flex-wrap gap-3 mt-1 text-[11px] text-muted-foreground">
                          <span>{sv.mrn}</span><span>· {sv.department}</span><span>· {sv.submitted_at}</span>
                        </div>
                      </div>
                      {exp ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                    </div>
                    {exp && (
                      <div className="border-t bg-muted/20 p-4 space-y-3">
                        <div>
                          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Feedback</p>
                          <p className="text-[13px] leading-relaxed">"{sv.feedback}"</p>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Category Ratings</p>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            <StarBar label="Doctor"      value={sv.ratings.doctor}      />
                            <StarBar label="Nurse"       value={sv.ratings.nurse}        />
                            <StarBar label="Cleanliness" value={sv.ratings.cleanliness}  />
                            {sv.ratings.food > 0 && <StarBar label="Food"  value={sv.ratings.food}    />}
                            <StarBar label="Billing"     value={sv.ratings.billing}      />
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}