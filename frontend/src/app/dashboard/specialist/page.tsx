"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Search, UserPlus, X, Phone, Mail, IndianRupee,
  Stethoscope, Calendar, Users, AlertTriangle,
  CheckCircle2, Clock, RefreshCw, Edit2, Trash2,
  ChevronDown, ChevronUp, Radio,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  specialistApi,
  type Doctor, type DoctorForm, type DoctorStatus, type Specialty,
} from "@/lib/api/specialist";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const STATUS_CFG: Record<DoctorStatus, { label: string; dot: string; badge: string }> = {
  active:   { label:"Active",   dot:"bg-green-500", badge:"bg-green-100 text-green-700"  },
  inactive: { label:"Inactive", dot:"bg-slate-400", badge:"bg-slate-100 text-slate-600"  },
  on_leave: { label:"On Leave", dot:"bg-amber-500", badge:"bg-amber-100 text-amber-700"  },
};
const AVATAR_COLORS = [
  "bg-blue-100 text-blue-700","bg-purple-100 text-purple-700",
  "bg-teal-100 text-teal-700","bg-rose-100 text-rose-700","bg-amber-100 text-amber-700",
];
function initials(n: string) { return n.replace("Dr. ","").split(" ").slice(0,2).map(w=>w[0]).join("").toUpperCase(); }
function Avatar({ name, idx=0, size="lg" }: { name:string; idx?:number; size?:"sm"|"lg" }) {
  const s = size==="lg" ? "h-14 w-14 text-lg" : "h-8 w-8 text-xs";
  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-semibold", s, AVATAR_COLORS[idx%AVATAR_COLORS.length])}>
      {initials(name)}
    </span>
  );
}

// ─── Modal wrapper ─────────────────────────────────────────────────────────────
function Modal({ open, onClose, title, children, width="max-w-2xl" }:{
  open:boolean; onClose:()=>void; title:string; children:React.ReactNode; width?:string;
}) {
  useEffect(()=>{
    const h=(e:KeyboardEvent)=>{ if(e.key==="Escape") onClose(); };
    document.addEventListener("keydown",h);
    return ()=>document.removeEventListener("keydown",h);
  },[onClose]);
  if(!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose}/>
      <div className={cn("relative z-10 w-full bg-background rounded-xl border shadow-xl",width)}>
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-base font-semibold">{title}</h3>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-muted"><X className="h-4 w-4"/></button>
        </div>
        <div className="px-6 py-5 max-h-[80vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

// ─── Confirm dialog ───────────────────────────────────────────────────────────
function ConfirmModal({ open, onClose, onConfirm, message }:{
  open:boolean; onClose:()=>void; onConfirm:()=>void; message:string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose}/>
      <div className="relative z-10 w-full max-w-sm bg-background rounded-xl border shadow-xl p-6">
        <p className="text-sm text-muted-foreground mb-4">{message}</p>
        <div className="flex justify-end gap-3">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" size="sm" onClick={onConfirm}>Delete</Button>
        </div>
      </div>
    </div>
  );
}

// ─── Add / Edit Doctor Form ────────────────────────────────────────────────────
const EMPTY_FORM: DoctorForm = {
  full_name:"", registration_number:"", specialty_id:"",
  qualification:"", department:"", phone:"", email:"",
  opd_fee:"", emergency_fee:"", status:"active", on_call:false,
};

// HOISTED from inside DoctorFormModal to module scope to prevent focus
// loss on each keystroke. (Bug class instance #1, same root cause as
// the reception form: F-defined-inside-component made a new component
// identity per render, React unmounted/remounted the subtree on every
// state update.)
const F = ({ label, id, req=false, half=true, children }:{label:string;id:string;req?:boolean;half?:boolean;children:React.ReactNode}) => (
  <div className={cn("space-y-1.5", half ? "" : "col-span-2")}>
    <Label htmlFor={id} className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
      {label}{req&&<span className="text-red-500 ml-0.5">*</span>}
    </Label>
    {children}
  </div>
);

function DoctorFormModal({ open, onClose, onSaved, specialties, editing }:{
  open:boolean; onClose:()=>void; onSaved:(d:Doctor)=>void;
  specialties:Specialty[]; editing:Doctor|null;
}) {
  const [form, setForm] = useState<DoctorForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(()=>{
    if (editing) {
      setForm({
        full_name: editing.full_name, registration_number: editing.registration_number,
        specialty_id: editing.specialty_id, qualification: editing.qualification,
        department: editing.department, phone: editing.phone, email: editing.email,
        opd_fee: editing.opd_fee, emergency_fee: editing.emergency_fee,
        status: editing.status, on_call: editing.on_call,
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setError("");
  }, [editing, open]);

  const set = <K extends keyof DoctorForm>(k:K, v:DoctorForm[K]) => setForm(f=>({...f,[k]:v}));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      let saved: Doctor;
      if (editing) {
        saved = await specialistApi.update(editing.id, form);
      } else {
        saved = await specialistApi.create(form);
      }
      onSaved(saved);
    } catch(err: any) {
      // Optimistic mock save during development
      const mock: Doctor = {
        id: editing?.id ?? Date.now(),
        full_name: form.full_name,
        registration_number: form.registration_number,
        specialty: specialties.find(s=>s.id===form.specialty_id)?.name ?? "",
        specialty_id: Number(form.specialty_id),
        qualification: form.qualification,
        department: form.department,
        phone: form.phone,
        email: form.email,
        opd_fee: Number(form.opd_fee),
        emergency_fee: Number(form.emergency_fee),
        status: form.status,
        on_call: form.on_call,
        availability: [],
        joined_date: new Date().toISOString().split("T")[0],
        patients_today: 0,
        total_patients: editing?.total_patients ?? 0,
      };
      onSaved(mock);
    } finally { setLoading(false); }
  };

  const sel = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <Modal open={open} onClose={onClose} title={editing ? "Edit Doctor" : "Add Doctor"}>
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            <AlertTriangle className="h-4 w-4 shrink-0"/>{error}
          </div>
        )}
        <div>
          <p className="text-sm font-medium mb-3 pb-2 border-b">Basic Details</p>
          <div className="grid grid-cols-2 gap-4">
            <F label="Full Name" id="fn" req half={false}>
              <Input id="fn" value={form.full_name} onChange={e=>set("full_name",e.target.value)} required placeholder="Dr. Arvind Sharma"/>
            </F>
            <F label="Registration Number" id="reg" req>
              <Input id="reg" value={form.registration_number} onChange={e=>set("registration_number",e.target.value)} required placeholder="MCI-2019-04821"/>
            </F>
            <F label="Speciality" id="spec" req>
              <select id="spec" className={sel} value={form.specialty_id} onChange={e=>set("specialty_id",Number(e.target.value))} required>
                <option value="">Select speciality…</option>
                {specialties.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </F>
            <F label="Qualification" id="qual" req>
              <Input id="qual" value={form.qualification} onChange={e=>set("qualification",e.target.value)} required placeholder="MBBS, MD (Gen Med)"/>
            </F>
            <F label="Department" id="dept" half={false}>
              <Input id="dept" value={form.department} onChange={e=>set("department",e.target.value)} placeholder="OPD – General Medicine"/>
            </F>
          </div>
        </div>

        <div>
          <p className="text-sm font-medium mb-3 pb-2 border-b">Contact & Fees</p>
          <div className="grid grid-cols-2 gap-4">
            <F label="Phone" id="ph" req>
              <Input id="ph" type="tel" value={form.phone} onChange={e=>set("phone",e.target.value)} required placeholder="9876540001"/>
            </F>
            <F label="Email" id="em">
              <Input id="em" type="email" value={form.email} onChange={e=>set("email",e.target.value)} placeholder="doctor@hospital.in"/>
            </F>
            <F label="OPD Fee (₹)" id="fee" req>
              <Input id="fee" type="number" min="0" value={form.opd_fee} onChange={e=>set("opd_fee",Number(e.target.value))} required placeholder="500"/>
            </F>
            <F label="Emergency Fee (₹)" id="efee">
              <Input id="efee" type="number" min="0" value={form.emergency_fee} onChange={e=>set("emergency_fee",Number(e.target.value))} placeholder="1000"/>
            </F>
          </div>
        </div>

        <div>
          <p className="text-sm font-medium mb-3 pb-2 border-b">Status</p>
          <div className="grid grid-cols-2 gap-4">
            <F label="Status" id="status">
              <select id="status" className={sel} value={form.status} onChange={e=>set("status",e.target.value as DoctorStatus)}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="on_leave">On Leave</option>
              </select>
            </F>
            <F label="On-Call Duty" id="oncall">
              <div className="flex items-center gap-3 h-10">
                <button type="button" onClick={()=>set("on_call",!form.on_call)}
                  className={cn("relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:ring-2",
                    form.on_call ? "bg-primary" : "bg-muted")}>
                  <span className={cn("inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                    form.on_call ? "translate-x-6" : "translate-x-1")}/>
                </button>
                <span className="text-sm text-muted-foreground">{form.on_call ? "On call tonight" : "Not on call"}</span>
              </div>
            </F>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2 border-t">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={loading}>
            {loading ? "Saving…" : editing ? "Save Changes" : "Add Doctor"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Doctor Card ───────────────────────────────────────────────────────────────
function DoctorCard({ doc, idx, onEdit, onDelete, onToggleOnCall }:{
  doc:Doctor; idx:number; onEdit:()=>void; onDelete:()=>void; onToggleOnCall:(v:boolean)=>void;
}) {
  const [expanded, setExpanded] = useState(false);
  const sc = STATUS_CFG[doc.status];
  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-md">
      <CardContent className="p-0">
        {/* Main row */}
        <div className="flex gap-4 p-5">
          <Avatar name={doc.full_name} idx={idx} size="lg"/>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-base leading-tight">{doc.full_name}</h3>
                  <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium", sc.badge)}>
                    <span className={cn("h-1.5 w-1.5 rounded-full", sc.dot)}/>
                    {sc.label}
                  </span>
                  {doc.on_call && (
                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium bg-red-100 text-red-700">
                      <Radio className="h-2.5 w-2.5"/> On Call
                    </span>
                  )}
                </div>
                <p className="text-sm text-primary font-medium mt-0.5">{doc.specialty}</p>
                <p className="text-xs text-muted-foreground">{doc.qualification}</p>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">{doc.registration_number}</p>
              </div>
              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={onEdit}
                  className="flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted transition-colors">
                  <Edit2 className="h-3 w-3"/>Edit
                </button>
                <button onClick={onDelete}
                  className="flex items-center gap-1 rounded-md border border-red-200 px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50 transition-colors">
                  <Trash2 className="h-3 w-3"/>Remove
                </button>
              </div>
            </div>

            {/* Info chips */}
            <div className="flex flex-wrap items-center gap-3 mt-3 text-[12px] text-muted-foreground">
              <span className="flex items-center gap-1"><Phone className="h-3 w-3"/>{doc.phone}</span>
              <span className="flex items-center gap-1"><Mail className="h-3 w-3"/>{doc.email}</span>
              <span className="flex items-center gap-1"><IndianRupee className="h-3 w-3"/>OPD ₹{doc.opd_fee}</span>
              {doc.emergency_fee > 0 &&
                <span className="flex items-center gap-1"><IndianRupee className="h-3 w-3"/>Emg ₹{doc.emergency_fee}</span>}
            </div>

            {/* Stats + toggle */}
            <div className="flex items-center gap-4 mt-3 flex-wrap">
              <span className="flex items-center gap-1 text-[12px] text-muted-foreground">
                <Users className="h-3 w-3"/>{doc.patients_today} today · {doc.total_patients.toLocaleString()} total
              </span>
              <span className="flex items-center gap-1 text-[12px] text-muted-foreground">
                <Calendar className="h-3 w-3"/>Joined {doc.joined_date}
              </span>
              {/* On-call toggle */}
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-[11px] text-muted-foreground">On-call</span>
                <button type="button" onClick={()=>onToggleOnCall(!doc.on_call)}
                  className={cn("relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                    doc.on_call ? "bg-red-500" : "bg-muted")}>
                  <span className={cn("inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform",
                    doc.on_call ? "translate-x-[18px]" : "translate-x-[2px]")}/>
                </button>
              </div>
              {/* Expand availability */}
              {doc.availability.length > 0 && (
                <button onClick={()=>setExpanded(e=>!e)}
                  className="flex items-center gap-1 text-[11px] text-primary hover:underline">
                  <Clock className="h-3 w-3"/>Schedule
                  {expanded ? <ChevronUp className="h-3 w-3"/> : <ChevronDown className="h-3 w-3"/>}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Availability expandable */}
        {expanded && doc.availability.length > 0 && (
          <div className="border-t bg-muted/30 px-5 py-3">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Weekly Schedule</p>
            <div className="flex flex-wrap gap-2">
              {doc.availability.map((s,i)=>(
                <div key={i} className="flex items-center gap-2 rounded-lg border bg-background px-3 py-1.5 text-[12px]">
                  <span className="font-semibold w-6">{s.day}</span>
                  <span className="text-muted-foreground">{s.start_time}–{s.end_time}</span>
                  <span className="text-[10px] text-muted-foreground">·{s.max_patients} pts</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function SpecialistPage() {
  const [doctors,     setDoctors]     = useState<Doctor[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string|null>(null);
  const [q,           setQ]           = useState("");
  const [filterSpec,  setFilterSpec]  = useState("");
  const [filterStatus,setFilterStatus]= useState<DoctorStatus|"all">("all");
  const [showForm,    setShowForm]    = useState(false);
  const [editing,     setEditing]     = useState<Doctor|null>(null);
  const [delTarget,   setDelTarget]   = useState<Doctor|null>(null);
  const searchTimer = useRef<NodeJS.Timeout>();

  const fetchAll = useCallback(async () => {
    try {
      const [docs, specs] = await Promise.allSettled([
        specialistApi.list(),
        specialistApi.specialties(),
      ]);
      if (docs.status   === "fulfilled" && docs.value.length   > 0) setDoctors(docs.value);
      if (specs.status  === "fulfilled" && specs.value.length  > 0) setSpecialties(specs.value);
      setError(null);
    } catch {
      setError("Showing demo data — Django API not reachable.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Client-side search + filter
  const displayed = doctors.filter(d => {
    const matchQ = !q ||
      d.full_name.toLowerCase().includes(q.toLowerCase()) ||
      d.registration_number.toLowerCase().includes(q.toLowerCase()) ||
      d.specialty.toLowerCase().includes(q.toLowerCase()) ||
      d.department.toLowerCase().includes(q.toLowerCase());
    const matchSpec   = !filterSpec   || d.specialty === filterSpec;
    const matchStatus = filterStatus === "all" || d.status === filterStatus;
    return matchQ && matchSpec && matchStatus;
  });

  const handleSaved = (doc: Doctor) => {
    setDoctors(prev => editing
      ? prev.map(d => d.id === doc.id ? doc : d)
      : [doc, ...prev]
    );
    setShowForm(false);
    setEditing(null);
  };

  const handleDelete = () => {
    if (!delTarget) return;
    specialistApi.delete(delTarget.id).catch(()=>{});
    setDoctors(prev => prev.filter(d => d.id !== delTarget.id));
    setDelTarget(null);
  };

  const handleToggleOnCall = (id: number, v: boolean) => {
    specialistApi.toggleOnCall(id, v).catch(()=>{});
    setDoctors(prev => prev.map(d => d.id === id ? {...d, on_call:v} : d));
  };

  // Summary stats
  const total    = doctors.length;
  const active   = doctors.filter(d=>d.status==="active").length;
  const onCall   = doctors.filter(d=>d.on_call).length;
  const onLeave  = doctors.filter(d=>d.status==="on_leave").length;
  const todayPts = doctors.reduce((s,d)=>s+d.patients_today,0);

  return (
    <div className="space-y-5 pb-8">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Specialists / Doctors</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Doctor directory · slots · fees · on-call roster
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchAll}
            className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted transition-colors">
            <RefreshCw className="h-3.5 w-3.5"/>Refresh
          </button>
          <Button onClick={()=>{ setEditing(null); setShowForm(true); }} className="gap-2">
            <UserPlus className="h-4 w-4"/>Add Doctor
          </Button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0"/>{error}
        </div>
      )}

      {/* Summary stats */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label:"Total Doctors",   value:total,   color:"border-l-blue-500"   },
          { label:"Active",          value:active,  color:"border-l-green-500"  },
          { label:"On Call Tonight", value:onCall,  color:"border-l-red-500"    },
          { label:"On Leave",        value:onLeave, color:"border-l-amber-500"  },
          { label:"Patients Today",  value:todayPts,color:"border-l-purple-500" },
        ].map(s=>(
          <div key={s.label} className={cn("rounded-xl border bg-background px-4 py-3 border-l-[3px]",s.color)}>
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search + filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
          <Input value={q} onChange={e=>setQ(e.target.value)}
            className="pl-9" placeholder="Search by name, reg. number, or specialty…"/>
        </div>
        <select value={filterSpec} onChange={e=>setFilterSpec(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <option value="">All specialities</option>
          {specialties.map(s=><option key={s.id} value={s.name}>{s.name}</option>)}
        </select>
        <div className="flex rounded-md border overflow-hidden">
          {(["all","active","on_leave","inactive"] as const).map(v=>(
            <button key={v} onClick={()=>setFilterStatus(v)}
              className={cn("px-3 py-2 text-xs font-medium transition-colors",
                filterStatus===v ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted")}>
              {v==="all" ? "All" : v==="on_leave" ? "On Leave" : v.charAt(0).toUpperCase()+v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      <p className="text-xs text-muted-foreground">
        Showing {displayed.length} of {doctors.length} doctor{doctors.length!==1?"s":""}
        {q && ` matching "${q}"`}
      </p>

      {/* Doctor cards */}
      {displayed.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border bg-background py-20 text-muted-foreground">
          <Stethoscope className="h-12 w-12 mb-3 opacity-20"/>
          <p className="text-sm font-medium">No doctors found</p>
          <p className="text-xs mt-1">Try different search terms or clear the filters</p>
          <Button variant="outline" className="mt-4 gap-2" onClick={()=>{ setQ(""); setFilterSpec(""); setFilterStatus("all"); }}>
            Clear filters
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {displayed.map((doc, i) => (
            <DoctorCard
              key={doc.id}
              doc={doc}
              idx={i}
              onEdit={()=>{ setEditing(doc); setShowForm(true); }}
              onDelete={()=>setDelTarget(doc)}
              onToggleOnCall={(v)=>handleToggleOnCall(doc.id,v)}
            />
          ))}
        </div>
      )}

      {/* Add / Edit modal */}
      <DoctorFormModal
        open={showForm}
        onClose={()=>{ setShowForm(false); setEditing(null); }}
        onSaved={handleSaved}
        specialties={specialties}
        editing={editing}
      />

      {/* Delete confirm */}
      <ConfirmModal
        open={!!delTarget}
        onClose={()=>setDelTarget(null)}
        onConfirm={handleDelete}
        message={`Remove Dr. ${delTarget?.full_name} from the system? This cannot be undone.`}
      />
    </div>
  );
}