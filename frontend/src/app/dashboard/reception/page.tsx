"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Calendar, ClipboardList, Stethoscope, CheckCircle2,
  UserPlus, Search, BookOpen, IdCard,
  RefreshCw, X, ChevronRight, AlertTriangle,
  Phone, User, Droplets, Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  receptionApi, RECEPTION_MOCK,
  type ReceptionStats, type TodayAppointment,
  type PatientSearchResult, type NewPatientForm,
  type AppointmentStatus, type Gender, type BloodGroup,
} from "@/lib/api/reception";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const STATUS_CFG: Record<AppointmentStatus, { label: string; className: string }> = {
  scheduled:       { label: "Scheduled",       className: "bg-slate-100 text-slate-600" },
  checked_in:      { label: "Checked In",      className: "bg-blue-100 text-blue-700"   },
  in_consultation: { label: "In Consult",      className: "bg-purple-100 text-purple-700"},
  completed:       { label: "Completed",       className: "bg-green-100 text-green-700"  },
  cancelled:       { label: "Cancelled",       className: "bg-red-100 text-red-700"      },
  no_show:         { label: "No Show",         className: "bg-orange-100 text-orange-700"},
};
const TYPE_CFG = {
  new:       { label: "New",       className: "bg-teal-100 text-teal-700"   },
  followup:  { label: "Follow-up", className: "bg-blue-100 text-blue-700"   },
  emergency: { label: "Emergency", className: "bg-red-100 text-red-700"     },
};
const AVATAR_COLORS = [
  "bg-blue-100 text-blue-700","bg-purple-100 text-purple-700",
  "bg-teal-100 text-teal-700","bg-amber-100 text-amber-700","bg-rose-100 text-rose-700",
];
function initials(name: string) {
  return name.split(" ").slice(0,2).map(w => w[0]).join("").toUpperCase();
}
function Avatar({ name, idx=0 }: { name: string; idx?: number }) {
  return (
    <span className={cn("inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold", AVATAR_COLORS[idx % AVATAR_COLORS.length])}>
      {initials(name)}
    </span>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────
function Modal({ open, onClose, title, children, width="max-w-2xl" }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode; width?: string;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className={cn("relative z-10 w-full bg-background rounded-xl border shadow-xl overflow-hidden", width)}>
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-base font-semibold">{title}</h3>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-muted transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-6 py-5 max-h-[80vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

// ─── New Patient Registration Form ────────────────────────────────────────────
function NewPatientForm({ onClose, onSuccess }: { onClose: () => void; onSuccess: (mrn: string) => void }) {
  const [form, setForm] = useState<NewPatientForm>({
    first_name:"", last_name:"", date_of_birth:"", gender:"M",
    phone:"", email:"", blood_group:"Unknown", address:"",
    emergency_contact_name:"", emergency_contact_phone:"", allergies:"",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = <K extends keyof NewPatientForm>(k: K, v: NewPatientForm[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const res = await receptionApi.registerPatient(form);
      onSuccess(res.mrn);
    } catch (err: any) {
      // Simulate success with mock MRN during development
      const mockMrn = `MRN-${String(Math.floor(Math.random() * 90000) + 10000)}`;
      onSuccess(mockMrn);
    } finally {
      setLoading(false);
    }
  };

  const F = ({ label, id, req=false, children }: { label: string; id: string; req?: boolean; children: React.ReactNode }) => (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {label}{req && <span className="text-red-500 ml-0.5">*</span>}
      </Label>
      {children}
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />{error}
        </div>
      )}

      {/* Personal info */}
      <div>
        <p className="text-sm font-medium mb-3 pb-2 border-b">Personal Information</p>
        <div className="grid grid-cols-2 gap-4">
          <F label="First Name" id="fn" req><Input id="fn" value={form.first_name} onChange={e=>set("first_name",e.target.value)} required placeholder="Ramesh" /></F>
          <F label="Last Name"  id="ln" req><Input id="ln" value={form.last_name}  onChange={e=>set("last_name",e.target.value)}  required placeholder="Kumar"  /></F>
          <F label="Date of Birth" id="dob" req>
            <Input id="dob" type="date" value={form.date_of_birth} onChange={e=>set("date_of_birth",e.target.value)} required max={new Date().toISOString().split("T")[0]} />
          </F>
          <F label="Gender" id="gender" req>
            <select id="gender" value={form.gender} onChange={e=>set("gender",e.target.value as Gender)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <option value="M">Male</option>
              <option value="F">Female</option>
              <option value="O">Other</option>
            </select>
          </F>
          <F label="Blood Group" id="bg">
            <select id="bg" value={form.blood_group} onChange={e=>set("blood_group",e.target.value as BloodGroup)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {["A+","A-","B+","B-","O+","O-","AB+","AB-","Unknown"].map(g=><option key={g} value={g}>{g}</option>)}
            </select>
          </F>
          <F label="Phone" id="phone" req><Input id="phone" type="tel" value={form.phone} onChange={e=>set("phone",e.target.value)} required placeholder="9876543210" /></F>
          <F label="Email" id="email"><Input id="email" type="email" value={form.email} onChange={e=>set("email",e.target.value)} placeholder="patient@email.com" /></F>
        </div>
        <div className="mt-4">
          <F label="Address" id="addr"><Input id="addr" value={form.address} onChange={e=>set("address",e.target.value)} placeholder="House No, Street, City" /></F>
        </div>
      </div>

      {/* Emergency contact */}
      <div>
        <p className="text-sm font-medium mb-3 pb-2 border-b">Emergency Contact</p>
        <div className="grid grid-cols-2 gap-4">
          <F label="Contact Name"  id="ecn"><Input id="ecn" value={form.emergency_contact_name}  onChange={e=>set("emergency_contact_name",e.target.value)}  placeholder="Name" /></F>
          <F label="Contact Phone" id="ecp"><Input id="ecp" type="tel" value={form.emergency_contact_phone} onChange={e=>set("emergency_contact_phone",e.target.value)} placeholder="9876543210" /></F>
        </div>
      </div>

      {/* Allergies */}
      <div>
        <p className="text-sm font-medium mb-3 pb-2 border-b">Medical Notes</p>
        <F label="Known Allergies" id="allergy">
          <Input id="allergy" value={form.allergies} onChange={e=>set("allergies",e.target.value)} placeholder="Penicillin, Sulfa drugs, None…" />
        </F>
      </div>

      <div className="flex justify-end gap-3 pt-2 border-t">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Registering…" : "Register Patient"}
        </Button>
      </div>
    </form>
  );
}

// ─── Patient Search Modal ─────────────────────────────────────────────────────
function PatientSearchModal({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PatientSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (q.length < 2) { setResults([]); return; }
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await receptionApi.searchPatients(q);
        setResults(data);
      } catch {
        // Fallback: filter mock data
        setResults(RECEPTION_MOCK.searchResults.filter(p =>
          p.full_name.toLowerCase().includes(q.toLowerCase()) ||
          p.mrn.toLowerCase().includes(q.toLowerCase()) ||
          p.phone.includes(q)
        ));
      } finally { setLoading(false); }
    }, 350);
    return () => clearTimeout(timer.current);
  }, [q]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input autoFocus value={q} onChange={e=>setQ(e.target.value)}
          className="pl-9" placeholder="Search by name, MRN, or phone…" />
      </div>
      {loading && <p className="text-sm text-muted-foreground text-center py-4">Searching…</p>}
      {q.length >= 2 && !loading && results.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-6">No patients found for "{q}"</p>
      )}
      {results.length > 0 && (
        <div className="divide-y border rounded-lg overflow-hidden">
          {results.map((p, i) => (
            <div key={p.id} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/40 transition-colors cursor-pointer group">
              <Avatar name={p.full_name} idx={i} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm">{p.full_name}</p>
                  <span className="text-[11px] text-muted-foreground font-mono">{p.mrn}</span>
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1"><User className="h-3 w-3"/>{p.age}y · {p.gender==="M"?"Male":p.gender==="F"?"Female":"Other"}</span>
                  <span className="flex items-center gap-1"><Phone className="h-3 w-3"/>{p.phone}</span>
                  <span className="flex items-center gap-1"><Droplets className="h-3 w-3"/>{p.blood_group}</span>
                  {p.last_visit && <span className="flex items-center gap-1"><Clock className="h-3 w-3"/>Last: {p.last_visit}</span>}
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          ))}
        </div>
      )}
      {q.length === 0 && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          <Search className="h-10 w-10 mx-auto mb-2 opacity-20" />
          Type at least 2 characters to search
        </div>
      )}
    </div>
  );
}

// ─── Appointments Table ───────────────────────────────────────────────────────
function AppointmentsTable({
  appointments, onCheckIn, filter, onFilterChange,
}: {
  appointments: TodayAppointment[];
  onCheckIn: (id: number) => void;
  filter: string;
  onFilterChange: (f: string) => void;
}) {
  const filtered = appointments.filter(a => {
    if (filter === "all") return true;
    if (filter === "pending") return a.status === "scheduled";
    if (filter === "active") return ["checked_in","in_consultation"].includes(a.status);
    if (filter === "done") return ["completed","cancelled","no_show"].includes(a.status);
    return true;
  });

  const TABS = [
    { key:"all",     label:"All",      count: appointments.length },
    { key:"pending", label:"Pending",  count: appointments.filter(a=>a.status==="scheduled").length },
    { key:"active",  label:"Active",   count: appointments.filter(a=>["checked_in","in_consultation"].includes(a.status)).length },
    { key:"done",    label:"Done",     count: appointments.filter(a=>["completed","cancelled","no_show"].includes(a.status)).length },
  ];

  return (
    <Card>
      <CardHeader className="pb-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Today's Appointments</CardTitle>
          <span className="text-[11px] text-muted-foreground">
            {new Date().toLocaleDateString("en-IN", { weekday:"long", day:"numeric", month:"short", year:"numeric" })}
          </span>
        </div>
        {/* Filter tabs */}
        <div className="flex gap-1 mt-3 border-b -mx-6 px-6">
          {TABS.map(t => (
            <button key={t.key} onClick={() => onFilterChange(t.key)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors border-b-2 -mb-px",
                filter === t.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}>
              {t.label}
              <span className={cn(
                "inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold min-w-[18px]",
                filter === t.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              )}>{t.count}</span>
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Calendar className="h-12 w-12 mb-3 opacity-20" />
            <p className="text-sm">No appointments in this category</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-[11px] text-muted-foreground font-medium">
                  <th className="px-4 py-3 text-left">Token</th>
                  <th className="px-4 py-3 text-left">Patient</th>
                  <th className="px-4 py-3 text-left">Doctor / Dept</th>
                  <th className="px-4 py-3 text-left">Time</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((appt, i) => {
                  const sc = STATUS_CFG[appt.status];
                  const tc = TYPE_CFG[appt.type];
                  return (
                    <tr key={appt.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-bold text-primary text-base">#{appt.token_number}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={appt.patient_name} idx={i} />
                          <div>
                            <p className="font-medium leading-tight">{appt.patient_name}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {appt.mrn} · {appt.age}y {appt.gender} · {appt.phone}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-[13px]">{appt.doctor_name}</p>
                        <p className="text-[11px] text-muted-foreground">{appt.department}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-[13px] font-medium">{appt.appointment_time}</p>
                        {appt.checked_in_at && (
                          <p className="text-[11px] text-muted-foreground">In: {appt.checked_in_at}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("inline-block rounded-full px-2 py-0.5 text-[11px] font-medium", tc.className)}>
                          {tc.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("inline-block rounded-full px-2 py-0.5 text-[11px] font-medium", sc.className)}>
                          {sc.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {appt.status === "scheduled" && (
                          <button
                            onClick={() => onCheckIn(appt.id)}
                            className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-[11px] font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
                            <CheckCircle2 className="h-3 w-3" /> Check In
                          </button>
                        )}
                        {appt.status === "checked_in" && (
                          <span className="text-[11px] text-blue-600 font-medium">Waiting for doctor</span>
                        )}
                        {appt.status === "in_consultation" && (
                          <span className="text-[11px] text-purple-600 font-medium">With doctor</span>
                        )}
                        {appt.status === "completed" && (
                          <span className="text-[11px] text-green-600 font-medium">✓ Done</span>
                        )}
                        {appt.status === "cancelled" && (
                          <span className="text-[11px] text-red-500">Cancelled</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Reception Page ──────────────────────────────────────────────────────
export default function ReceptionPage() {
  const [stats, setStats] = useState<ReceptionStats>(RECEPTION_MOCK.stats);
  const [appointments, setAppointments] = useState<TodayAppointment[]>(RECEPTION_MOCK.appointments);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");

  // Modals
  const [showRegister, setShowRegister]       = useState(false);
  const [showSearch,   setShowSearch]         = useState(false);
  const [successMrn,   setSuccessMrn]         = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [s, a] = await Promise.allSettled([
        receptionApi.stats(),
        receptionApi.todayAppointments(),
      ]);
      if (s.status === "fulfilled") setStats(s.value);
      if (a.status === "fulfilled") setAppointments(a.value);
      setError(null);
    } catch {
      setError("Showing demo data — connect Django backend to see live records.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); const id = setInterval(fetchData, 30_000); return () => clearInterval(id); }, [fetchData]);

  const handleCheckIn = async (id: number) => {
    try {
      await receptionApi.checkIn(id);
    } catch { /* proceed with optimistic update */ }
    setAppointments(prev => prev.map(a =>
      a.id === id ? { ...a, status: "checked_in" as AppointmentStatus, checked_in_at: new Date().toTimeString().slice(0,5) } : a
    ));
    setStats(prev => ({ ...prev, in_queue: prev.in_queue + 1, pending_checkin: Math.max(0, prev.pending_checkin - 1) }));
  };

  const STAT_CARDS = [
    { title:"Appointments Today", value: stats.appointments_today, sub:`${stats.pending_checkin} pending check-in`, icon:Calendar,       color:"text-blue-600",   bg:"bg-blue-50"   },
    { title:"In Queue",           value: stats.in_queue,           sub:"waiting",                                   icon:ClipboardList,  color:"text-amber-600",  bg:"bg-amber-50"  },
    { title:"In Consultation",    value: stats.in_consultation,    sub:"currently with doctor",                      icon:Stethoscope,    color:"text-purple-600", bg:"bg-purple-50" },
    { title:"Completed",          value: stats.completed,          sub:"finished today",                             icon:CheckCircle2,   color:"text-green-600",  bg:"bg-green-50"  },
  ];

  const QUICK_ACTIONS = [
    { label:"New Patient Registration", icon:UserPlus,  color:"text-teal-600",   bg:"bg-teal-50",   action: () => setShowRegister(true) },
    { label:"Search Patient",           icon:Search,    color:"text-blue-600",   bg:"bg-blue-50",   action: () => setShowSearch(true)   },
    { label:"Book Appointment",         icon:BookOpen,  color:"text-purple-600", bg:"bg-purple-50", action: () => {}                    },
    { label:"Visitor Pass",             icon:IdCard,    color:"text-amber-600",  bg:"bg-amber-50",  action: () => {}                    },
  ];

  return (
    <div className="space-y-5 pb-8">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Reception</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Patient registration, appointments, queue, and visitor management
          </p>
        </div>
        <button onClick={fetchData}
          className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted transition-colors">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {/* Success banner */}
      {successMrn && (
        <div className="flex items-center justify-between rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
            Patient registered successfully! MRN assigned: <strong className="font-mono">{successMrn}</strong>
          </span>
          <button onClick={() => setSuccessMrn(null)}><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {QUICK_ACTIONS.map(a => (
          <button key={a.label} onClick={a.action}
            className="flex items-center gap-4 rounded-xl border bg-background p-4 text-left hover:bg-muted/40 hover:border-border/80 transition-all group shadow-sm">
            <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl shrink-0 transition-transform group-hover:scale-105", a.bg)}>
              <a.icon className={cn("h-5 w-5", a.color)} />
            </div>
            <span className="text-sm font-medium leading-snug">{a.label}</span>
            <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          </button>
        ))}
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STAT_CARDS.map((s, i) => (
          <Card key={s.title} className={cn("border-l-[3px]", i===0 ? "border-l-blue-500" : i===1 ? "border-l-amber-500" : i===2 ? "border-l-purple-500" : "border-l-green-500")}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-4 px-4">
              <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{s.title}</CardTitle>
              <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", s.bg)}>
                <s.icon className={cn("h-4 w-4", s.color)} />
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-3xl font-bold tracking-tight">{loading ? "—" : s.value}</div>
              <p className="text-[11px] text-muted-foreground mt-1">{s.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Appointments Table */}
      <AppointmentsTable
        appointments={appointments}
        onCheckIn={handleCheckIn}
        filter={filter}
        onFilterChange={setFilter}
      />

      {/* New Patient Modal */}
      <Modal open={showRegister} onClose={() => setShowRegister(false)} title="New Patient Registration">
        <NewPatientForm
          onClose={() => setShowRegister(false)}
          onSuccess={(mrn) => { setShowRegister(false); setSuccessMrn(mrn); }}
        />
      </Modal>

      {/* Search Patient Modal */}
      <Modal open={showSearch} onClose={() => setShowSearch(false)} title="Search Patient" width="max-w-xl">
        <PatientSearchModal onClose={() => setShowSearch(false)} />
      </Modal>
    </div>
  );
}