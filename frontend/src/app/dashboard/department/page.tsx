"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Search, Plus, X, Building2, Users, BedDouble,
  Phone, MapPin, User, RefreshCw, Edit2, Trash2,
  AlertTriangle, ChevronDown, ChevronUp, Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  departmentApi, DEPARTMENT_MOCK,
  type Department, type DepartmentForm, type DeptStatus,
} from "@/lib/api/department";

// ── Constants ─────────────────────────────────────────────────────────────────
// Map of UI-friendly badge styling per Department.type. The keys cover
// both the mock data's legacy values ("OPD", "IPD", "Diagnostic", ...)
// AND the real backend serializer's enum values ("CLINICAL", "WARD",
// "DIAGNOSTIC", "PHARMACY", "OT", "ADMIN", "SUPPORT"). Without this
// coverage the page crashed on real data because lookups returned
// undefined and tc.badge / tc.dot referenced undefined.
const TYPE_CFG: Record<string, { badge: string; dot: string }> = {
  // Mock-data values (kept for back-compat with DEPARTMENT_MOCK)
  OPD:        { badge: "bg-blue-100 text-blue-700",   dot: "bg-blue-500"   },
  IPD:        { badge: "bg-purple-100 text-purple-700",dot: "bg-purple-500" },
  Diagnostic: { badge: "bg-teal-100 text-teal-700",   dot: "bg-teal-500"   },
  Support:    { badge: "bg-amber-100 text-amber-700",  dot: "bg-amber-500"  },
  Admin:      { badge: "bg-slate-100 text-slate-600",  dot: "bg-slate-400"  },
  // Real backend Department.TYPES values (apps/department/models.py)
  CLINICAL:   { badge: "bg-blue-100 text-blue-700",   dot: "bg-blue-500"   },
  DIAGNOSTIC: { badge: "bg-teal-100 text-teal-700",   dot: "bg-teal-500"   },
  PHARMACY:   { badge: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  WARD:       { badge: "bg-purple-100 text-purple-700",dot: "bg-purple-500" },
  OT:         { badge: "bg-rose-100 text-rose-700",   dot: "bg-rose-500"   },
  ADMIN:      { badge: "bg-slate-100 text-slate-600",  dot: "bg-slate-400"  },
  SUPPORT:    { badge: "bg-amber-100 text-amber-700",  dot: "bg-amber-500"  },
};
const STATUS_CFG: Record<DeptStatus, { badge: string; dot: string }> = {
  active:   { badge: "bg-green-100 text-green-700", dot: "bg-green-500" },
  inactive: { badge: "bg-slate-100 text-slate-500", dot: "bg-slate-400" },
};
const DEPT_TYPES = ["OPD","IPD","Diagnostic","Support","Admin"];
const AVATAR_BG  = ["bg-blue-100 text-blue-700","bg-purple-100 text-purple-700",
  "bg-teal-100 text-teal-700","bg-rose-100 text-rose-700","bg-amber-100 text-amber-700"];

function pct(a: number, b: number) { return b > 0 ? Math.round((a / b) * 100) : 0; }
function occupancyColor(p: number) {
  if (p >= 90) return "bg-red-500";
  if (p >= 70) return "bg-amber-500";
  return "bg-green-500";
}

// ── Modal ──────────────────────────────────────────────────────────────────────
function Modal({ open, onClose, title, children, width = "max-w-2xl" }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode; width?: string;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className={cn("relative z-10 w-full bg-background rounded-xl border shadow-xl", width)}>
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-base font-semibold">{title}</h3>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="px-6 py-5 max-h-[80vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

// ── Confirm delete ─────────────────────────────────────────────────────────────
function ConfirmModal({ open, onClose, onConfirm, name }: {
  open: boolean; onClose: () => void; onConfirm: () => void; name: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm bg-background rounded-xl border shadow-xl p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
            <Trash2 className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <p className="font-semibold text-sm">Delete Department</p>
            <p className="text-sm text-muted-foreground mt-1">
              Remove <strong>{name}</strong>? This action cannot be undone.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" size="sm" onClick={onConfirm}>Delete</Button>
        </div>
      </div>
    </div>
  );
}

// ── Department form ────────────────────────────────────────────────────────────
const EMPTY: DepartmentForm = {
  name:"", code:"", type:"OPD", head_doctor:"", extension:"",
  location:"", beds:"", status:"active", description:"", services:"",
};

// HOISTED to module scope to prevent focus loss on each keystroke. (Bug
// class instance #1, same root cause as the reception and specialist
// forms: F-defined-inside-component made a new component identity per
// render, React unmounted/remounted the subtree on every state update.)
const F = ({ label, id, req = false, full = false, children }: {
  label: string; id: string; req?: boolean; full?: boolean; children: React.ReactNode;
}) => (
  <div className={cn("space-y-1.5", full && "col-span-2")}>
    <Label htmlFor={id} className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
      {label}{req && <span className="text-red-500 ml-0.5">*</span>}
    </Label>
    {children}
  </div>
);

function DeptFormModal({ open, onClose, onSaved, editing }: {
  open: boolean; onClose: () => void; onSaved: (d: Department) => void; editing: Department | null;
}) {
  const [form, setForm] = useState<DepartmentForm>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (editing) {
      // Defensive ?? defaults: real backend Department doesn't have all
      // of these fields (head_doctor is FK, no extension, no services).
      // Use empty strings so the form opens without crashing.
      setForm({
        name: editing.name ?? "", code: editing.code ?? "",
        type: editing.type ?? "OPD",
        head_doctor: editing.head_doctor ?? "",
        extension: editing.extension ?? "",
        location: editing.location ?? "",
        beds: editing.beds ?? "",
        status: editing.status ?? "active",
        description: editing.description ?? "",
        services: (editing.services ?? []).join(", "),
      });
    } else {
      setForm(EMPTY);
    }
    setError("");
  }, [editing, open]);

  const set = <K extends keyof DepartmentForm>(k: K, v: DepartmentForm[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      let saved: Department;
      if (editing) {
        saved = await departmentApi.update(editing.id, form);
      } else {
        saved = await departmentApi.create(form);
      }
      onSaved(saved);
    } catch (err: unknown) {
      // The previous code fabricated a fake Department object with
      // Date.now() as id and called onSaved(fake) — making the user
      // think a department was created/updated when the API rejected
      // their request. Same disease as the fake-MRN bug. Surface the
      // real error so the user can fix the form or retry.
      const e = err as { response?: { data?: { detail?: string } | string }; message?: string };
      const detail = e?.response?.data;
      const message = (typeof detail === "object" && detail?.detail)
        || (typeof detail === "string" ? detail : null)
        || e?.message
        || "Save failed. Please try again.";
      setError(typeof message === "string" ? message : JSON.stringify(message));
    } finally { setLoading(false); }
  };

  const sel = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <Modal open={open} onClose={onClose} title={editing ? "Edit Department" : "Add Department"}>
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            <AlertTriangle className="h-4 w-4 shrink-0" />{error}
          </div>
        )}

        <div>
          <p className="text-sm font-medium mb-3 pb-2 border-b">Basic Information</p>
          <div className="grid grid-cols-2 gap-4">
            <F label="Department Name" id="dn" req full>
              <Input id="dn" value={form.name} onChange={e => set("name", e.target.value)} required placeholder="General Medicine" />
            </F>
            <F label="Code" id="code" req>
              <Input id="code" value={form.code} onChange={e => set("code", e.target.value)} required placeholder="GM-001" />
            </F>
            <F label="Type" id="type" req>
              <select id="type" className={sel} value={form.type} onChange={e => set("type", e.target.value)} required>
                {DEPT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </F>
            <F label="Head of Department" id="hod" full>
              <Input id="hod" value={form.head_doctor} onChange={e => set("head_doctor", e.target.value)} placeholder="Dr. Arvind Sharma" />
            </F>
            <F label="Extension (Phone)" id="ext">
              <Input id="ext" value={form.extension} onChange={e => set("extension", e.target.value)} placeholder="101" />
            </F>
            <F label="Location / Floor" id="loc">
              <Input id="loc" value={form.location} onChange={e => set("location", e.target.value)} placeholder="Block A, Ground Floor" />
            </F>
            <F label="Total Beds (0 if OPD)" id="beds">
              <Input id="beds" type="number" min="0" value={form.beds} onChange={e => set("beds", Number(e.target.value))} placeholder="0" />
            </F>
            <F label="Status" id="status">
              <select id="status" className={sel} value={form.status} onChange={e => set("status", e.target.value as DeptStatus)}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </F>
          </div>
        </div>

        <div>
          <p className="text-sm font-medium mb-3 pb-2 border-b">Details</p>
          <div className="space-y-4">
            <F label="Description" id="desc">
              <textarea id="desc" rows={2} value={form.description}
                onChange={e => set("description", e.target.value)}
                placeholder="Brief description of the department…"
                className="flex min-h-[76px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none" />
            </F>
            <F label="Services offered (comma separated)" id="services">
              <Input id="services" value={form.services} onChange={e => set("services", e.target.value)}
                placeholder="OPD Consultations, Referrals, Health Check-ups" />
            </F>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2 border-t">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={loading}>
            {loading ? "Saving…" : editing ? "Save Changes" : "Add Department"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ── Department Card ────────────────────────────────────────────────────────────
function DeptCard({ dept, idx, onEdit, onDelete }: {
  dept: Department; idx: number; onEdit: () => void; onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const tc = TYPE_CFG[dept.type]   ?? TYPE_CFG.Admin;
  // Real backend Department has `is_active: boolean`, not a `status` enum.
  // Treat either as a source: status="active" OR is_active=true.
  // Falls back to the inactive style for missing/unknown values so the
  // page can't crash on undefined.badge again.
  const isActive = (dept as { is_active?: boolean }).is_active === true
                    || dept.status === "active";
  const sc = (isActive ? STATUS_CFG.active : STATUS_CFG.inactive);
  const bedPct = pct(dept.occupied_beds, dept.beds);

  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-md">
      <CardContent className="p-0">
        <div className="flex gap-4 p-5">
          {/* Icon */}
          <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-lg font-bold", AVATAR_BG[idx % AVATAR_BG.length])}>
            <Building2 className="h-5 w-5" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-[15px] leading-tight">{dept.name}</h3>
                  <span className="font-mono text-[11px] text-muted-foreground bg-muted rounded px-1.5 py-0.5">{dept.code}</span>
                  <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium", tc.badge)}>
                    <span className={cn("h-1.5 w-1.5 rounded-full", tc.dot)} />{dept.type}
                  </span>
                  <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium", sc.badge)}>
                    <span className={cn("h-1.5 w-1.5 rounded-full", sc.dot)} />
                    {isActive ? "Active" : "Inactive"}
                  </span>
                </div>
                {dept.description && (
                  <p className="text-xs text-muted-foreground mt-1.5 max-w-xl line-clamp-2">{dept.description}</p>
                )}
              </div>
              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={onEdit}
                  className="flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted transition-colors">
                  <Edit2 className="h-3 w-3" />Edit
                </button>
                <button onClick={onDelete}
                  className="flex items-center gap-1 rounded-md border border-red-200 px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50 transition-colors">
                  <Trash2 className="h-3 w-3" />Remove
                </button>
              </div>
            </div>

            {/* Info row */}
            <div className="flex flex-wrap gap-4 mt-3 text-[12px] text-muted-foreground">
              {dept.head_doctor && (
                <span className="flex items-center gap-1"><User className="h-3 w-3" />{dept.head_doctor}</span>
              )}
              {dept.extension && (
                <span className="flex items-center gap-1"><Phone className="h-3 w-3" />Ext {dept.extension}</span>
              )}
              {dept.location && (
                <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{dept.location}</span>
              )}
              <span className="flex items-center gap-1"><Users className="h-3 w-3" />{dept.staff_count} staff</span>
              {dept.beds > 0 && (
                <span className="flex items-center gap-1"><BedDouble className="h-3 w-3" />{dept.occupied_beds}/{dept.beds} beds</span>
              )}
            </div>

            {/* Bed occupancy bar (IPD only) */}
            {dept.beds > 0 && (
              <div className="mt-3 flex items-center gap-3">
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", occupancyColor(bedPct))}
                    style={{ width: `${bedPct}%` }}
                  />
                </div>
                <span className={cn("text-[11px] font-semibold min-w-[36px] text-right",
                  bedPct >= 90 ? "text-red-600" : bedPct >= 70 ? "text-amber-600" : "text-green-600")}>
                  {bedPct}%
                </span>
              </div>
            )}

            {/* Services toggle. Real backend Department has no `services`
                array — it's a mock-only field. `?? []` keeps the page
                from crashing when an item from the real serializer has
                no services. */}
            {(dept.services ?? []).length > 0 && (
              <button onClick={() => setExpanded(e => !e)}
                className="flex items-center gap-1 mt-2 text-[11px] text-primary hover:underline">
                <Layers className="h-3 w-3" />
                {(dept.services ?? []).length} services
                {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
            )}
          </div>
        </div>

        {/* Services expanded */}
        {expanded && (
          <div className="border-t bg-muted/30 px-5 py-3">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Services Offered</p>
            <div className="flex flex-wrap gap-2">
              {(dept.services ?? []).map((s, i) => (
                <span key={i} className="rounded-full border bg-background px-3 py-1 text-[12px] text-muted-foreground">
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function DepartmentPage() {
  const [departments, setDepartments] = useState<Department[]>(DEPARTMENT_MOCK);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [q,           setQ]           = useState("");
  const [typeFilter,  setTypeFilter]  = useState("All");
  const [showForm,    setShowForm]    = useState(false);
  const [editing,     setEditing]     = useState<Department | null>(null);
  const [delTarget,   setDelTarget]   = useState<Department | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const data = await departmentApi.list();
      // Removed the `if (data.length > 0)` prefer-mock-over-empty guard.
      // An empty list from the API is now honored — a hospital with no
      // departments configured should see "no departments" not the
      // demo data. Note: this page's UI still expects a fabricated
      // Department shape (services array, beds, etc.) that the real
      // serializer doesn't emit. Field-shape mismatch will surface
      // here — track in the follow-up bundle for this module.
      setDepartments(data);
      setError(null);
    } catch (e) {
      // Surface the real error rather than the misleading "Showing
      // demo data" message. If demo data IS in fact what's being
      // shown (because data hasn't loaded yet), the error banner
      // makes that explicit.
      console.error("Department list fetch failed:", e);
      const msg = e instanceof Error ? e.message : "Failed to load departments.";
      setError(`Could not load departments: ${msg}`);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const displayed = departments.filter(d => {
    const matchQ = !q
      || d.name.toLowerCase().includes(q.toLowerCase())
      || d.code.toLowerCase().includes(q.toLowerCase())
      || d.head_doctor.toLowerCase().includes(q.toLowerCase())
      || d.type.toLowerCase().includes(q.toLowerCase());
    const matchType = typeFilter === "All" || d.type === typeFilter;
    return matchQ && matchType;
  });

  const handleSaved = (dept: Department) => {
    setDepartments(prev => editing
      ? prev.map(d => d.id === dept.id ? dept : d)
      : [dept, ...prev]
    );
    setShowForm(false);
    setEditing(null);
  };

  const handleDelete = async () => {
    if (!delTarget) return;
    try {
      await departmentApi.delete(delTarget.id);
    } catch (e) {
      // The previous code did `.catch(() => {})` — swallowing failures
      // silently. The user clicked delete, the API failed (network,
      // permission, FK constraint, whatever), but the list still
      // removed the item locally. On refresh the department was back.
      // The user's mental model was wrong without any signal.
      console.error("Department delete failed:", e);
      const msg = e instanceof Error ? e.message : "Delete failed.";
      setError(`Could not delete ${delTarget.name}: ${msg}`);
      setDelTarget(null);
      return;
    }
    setDepartments(prev => prev.filter(d => d.id !== delTarget.id));
    setDelTarget(null);
  };

  // Summary counts. Real backend Department has neither `beds` nor
  // `occupied_beds` nor `staff_count` — those were mock-only fields. The
  // `?? 0` keeps the summary numbers from rendering as NaN. (The
  // page needs a proper rewrite to compute real counts from related
  // models; this is a defensive bridge.)
  const total      = departments.length;
  const active     = departments.filter(d =>
    (d as { is_active?: boolean }).is_active === true || d.status === "active"
  ).length;
  const totalBeds  = departments.reduce((s, d) => s + (d.beds ?? 0), 0);
  const occupiedB  = departments.reduce((s, d) => s + (d.occupied_beds ?? 0), 0);
  const totalStaff = departments.reduce((s, d) => s + (d.staff_count ?? 0), 0);

  const TYPE_TABS = ["All", ...DEPT_TYPES];

  return (
    <div className="space-y-5 pb-8">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Departments</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Hospital department directory · beds · staff · services
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchAll}
            className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted transition-colors">
            <RefreshCw className="h-3.5 w-3.5" />Refresh
          </button>
          <Button onClick={() => { setEditing(null); setShowForm(true); }} className="gap-2">
            <Plus className="h-4 w-4" />Add Department
          </Button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />{error}
        </div>
      )}

      {/* Summary stats */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label:"Total Departments",  value: total,                   color:"border-l-blue-500"   },
          { label:"Active",             value: active,                  color:"border-l-green-500"  },
          { label:"Total Beds (IPD)",   value: totalBeds,               color:"border-l-purple-500" },
          { label:"Occupied Beds",      value: `${occupiedB}/${totalBeds}`, color:"border-l-amber-500"  },
          { label:"Total Staff",        value: totalStaff,              color:"border-l-teal-500"   },
        ].map(s => (
          <div key={s.label} className={cn("rounded-xl border bg-background px-4 py-3 border-l-[3px]", s.color)}>
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search + Type filter */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={e => setQ(e.target.value)}
            className="pl-9" placeholder="Search by name, code, HOD, or type…" />
        </div>
        <div className="flex rounded-md border overflow-hidden">
          {TYPE_TABS.map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={cn("px-3 py-2 text-xs font-medium transition-colors",
                typeFilter === t
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground hover:bg-muted")}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Showing {displayed.length} of {departments.length} department{departments.length !== 1 ? "s" : ""}
        {q && ` matching "${q}"`}
      </p>

      {/* Department cards */}
      {displayed.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border bg-background py-20 text-muted-foreground">
          <Building2 className="h-12 w-12 mb-3 opacity-20" />
          <p className="text-sm font-medium">No departments found</p>
          <Button variant="outline" className="mt-4" onClick={() => { setQ(""); setTypeFilter("All"); }}>
            Clear filters
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {displayed.map((dept, i) => (
            <DeptCard
              key={dept.id}
              dept={dept}
              idx={i}
              onEdit={() => { setEditing(dept); setShowForm(true); }}
              onDelete={() => setDelTarget(dept)}
            />
          ))}
        </div>
      )}

      <DeptFormModal
        open={showForm}
        onClose={() => { setShowForm(false); setEditing(null); }}
        onSaved={handleSaved}
        editing={editing}
      />

      <ConfirmModal
        open={!!delTarget}
        onClose={() => setDelTarget(null)}
        onConfirm={handleDelete}
        name={delTarget?.name ?? ""}
      />
    </div>
  );
}