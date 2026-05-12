"use client";
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, RefreshCw, Plus, AlertTriangle, Wrench, CheckCircle2, Clock, ChevronDown, ChevronUp, Edit2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";
function hdrs(){ const t=useAuthStore.getState().token; return {"Content-Type":"application/json",...(t?{Authorization:`Bearer ${t}`}:{})}; }
async function get<T>(p:string):Promise<T>{ const r=await fetch(`${BASE}${p}`,{headers:hdrs(),cache:"no-store"}); if(!r.ok)throw new Error(`${r.status}`); const j=await r.json(); return (j?.results??j) as T; }

type AssetStatus = "active"|"under_maintenance"|"amc_due"|"condemned"|"spare";
type AssetCategory = "Medical Equipment"|"Diagnostic Equipment"|"IT & Computers"|"Furniture"|"Infrastructure"|"Support Equipment";

interface Asset {
  id: number; asset_code: string; name: string; category: AssetCategory;
  make: string; model: string; serial_no: string; department: string;
  location: string; purchase_date: string; purchase_cost: number;
  amc_vendor: string; amc_expiry: string | null; last_service: string | null;
  next_service: string | null; status: AssetStatus;
  condition: "excellent"|"good"|"fair"|"poor"; warranty_expiry: string | null;
}
interface ServiceTicket {
  id: number; ticket_no: string; asset_name: string; asset_code: string;
  issue: string; priority: "low"|"medium"|"high"|"critical";
  raised_by: string; department: string; assigned_to: string;
  raised_at: string; resolved_at: string | null;
  status: "open"|"in_progress"|"resolved"|"closed";
}
interface AssetStats {
  total_assets: number; active: number; under_maintenance: number;
  amc_due_soon: number; condemned: number; open_tickets: number;
}

const STATS: AssetStats = { total_assets: 312, active: 289, under_maintenance: 8, amc_due_soon: 14, condemned: 4, open_tickets: 11 };

const ASSETS: Asset[] = [
  { id:1,  asset_code:"ME-001", name:"Ventilator",                category:"Medical Equipment",   make:"Drager",      model:"Evita V800",    serial_no:"EV800-2019-0041", department:"ICU",          location:"ICU Bed 1-5",   purchase_date:"2019-04-01", purchase_cost:1800000, amc_vendor:"Drager India",    amc_expiry:"2026-08-31", last_service:"2026-02-10", next_service:"2026-08-10", status:"active",            condition:"good",      warranty_expiry:null           },
  { id:2,  asset_code:"ME-002", name:"Cardiac Monitor (Bedside)", category:"Medical Equipment",   make:"Philips",     model:"IntelliVue MX40",serial_no:"MX40-2021-0218", department:"ICU",          location:"ICU Bed 1-10",  purchase_date:"2021-06-01", purchase_cost:420000,  amc_vendor:"Philips India",   amc_expiry:"2026-06-30", last_service:"2026-01-15", next_service:"2026-07-15", status:"amc_due",           condition:"good",      warranty_expiry:null           },
  { id:3,  asset_code:"ME-003", name:"Anaesthesia Workstation",   category:"Medical Equipment",   make:"GE Healthcare",model:"Aisys CS2",     serial_no:"AISYS-2020-002",  department:"OT",           location:"OT-1",          purchase_date:"2020-01-15", purchase_cost:2200000, amc_vendor:"GE Healthcare",   amc_expiry:"2026-12-31", last_service:"2026-03-01", next_service:"2026-09-01", status:"active",            condition:"excellent", warranty_expiry:null           },
  { id:4,  asset_code:"DE-001", name:"Ultrasound Machine",        category:"Diagnostic Equipment",make:"Samsung",     model:"HERA W10",      serial_no:"HW10-2022-0089",  department:"Radiology",    location:"USG Room 1",    purchase_date:"2022-03-10", purchase_cost:980000,  amc_vendor:"Samsung Medison", amc_expiry:"2027-03-31", last_service:"2025-12-01", next_service:"2026-06-01", status:"under_maintenance", condition:"fair",      warranty_expiry:null           },
  { id:5,  asset_code:"DE-002", name:"X-Ray Machine (Digital)",   category:"Diagnostic Equipment",make:"Siemens",     model:"Ysio Max",      serial_no:"YM-2018-0012",    department:"Radiology",    location:"X-Ray Room",    purchase_date:"2018-09-01", purchase_cost:3500000, amc_vendor:"Siemens Healthineers",amc_expiry:"2026-09-30",last_service:"2026-01-20",next_service:"2026-07-20",  status:"active",            condition:"good",      warranty_expiry:null           },
  { id:6,  asset_code:"ME-004", name:"Defibrillator",             category:"Medical Equipment",   make:"Philips",     model:"HeartStart XL+",serial_no:"HSXL-2020-0045", department:"Emergency",    location:"Emergency Bay", purchase_date:"2020-07-01", purchase_cost:280000,  amc_vendor:"Philips India",   amc_expiry:"2026-07-31", last_service:"2026-02-05", next_service:"2026-08-05", status:"active",            condition:"excellent", warranty_expiry:null           },
  { id:7,  asset_code:"ME-005", name:"Infusion Pump",             category:"Medical Equipment",   make:"BD",          model:"Alaris GP",     serial_no:"AGP-2021-0134",   department:"ICU",          location:"ICU / Wards",   purchase_date:"2021-01-10", purchase_cost:85000,   amc_vendor:"BD India",        amc_expiry:"2026-01-31", last_service:"2025-10-01", next_service:"2026-04-01", status:"amc_due",           condition:"good",      warranty_expiry:null           },
  { id:8,  asset_code:"IT-001", name:"Hospital Server (Main)",    category:"IT & Computers",      make:"Dell",        model:"PowerEdge R750", serial_no:"PE-2023-0002",    department:"IT",           location:"Server Room",   purchase_date:"2023-03-01", purchase_cost:450000,  amc_vendor:"Dell Technologies",amc_expiry:"2026-03-31",last_service:"2026-03-10", next_service:"2026-09-10", status:"active",            condition:"excellent", warranty_expiry:"2026-03-31"   },
  { id:9,  asset_code:"ME-006", name:"ECG Machine (12-lead)",     category:"Medical Equipment",   make:"GE Healthcare",model:"MAC 5500 HD",   serial_no:"MAC-2019-0078",   department:"Cardiology",   location:"OPD Cardio",    purchase_date:"2019-11-01", purchase_cost:180000,  amc_vendor:"GE Healthcare",   amc_expiry:"2026-11-30", last_service:"2026-01-10", next_service:"2026-07-10", status:"active",            condition:"good",      warranty_expiry:null           },
  { id:10, asset_code:"ME-007", name:"Autoclave (Large)",         category:"Support Equipment",   make:"Tuttnauer",   model:"2840M",         serial_no:"TUT-2017-0003",   department:"CSSD",         location:"CSSD Room",     purchase_date:"2017-05-01", purchase_cost:320000,  amc_vendor:"Local Service",   amc_expiry:null,          last_service:"2026-04-01", next_service:"2026-10-01", status:"under_maintenance", condition:"fair",      warranty_expiry:null           },
];

const TICKETS: ServiceTicket[] = [
  { id:1, ticket_no:"SVC/0512/001", asset_name:"Ultrasound Machine",   asset_code:"DE-001", issue:"Display flickering, probe connectivity intermittent",priority:"high",    raised_by:"Dr. Sharma",  department:"Radiology",  assigned_to:"Biomedical Engg", raised_at:"09:00", resolved_at:null,   status:"in_progress" },
  { id:2, ticket_no:"SVC/0512/002", asset_name:"Autoclave (Large)",    asset_code:"ME-007", issue:"Pressure gauge malfunction — not reaching sterilisation pressure",priority:"critical",raised_by:"CSSD Staff",department:"CSSD",    assigned_to:"External Vendor", raised_at:"09:30", resolved_at:null,   status:"in_progress" },
  { id:3, ticket_no:"SVC/0512/003", asset_name:"Cardiac Monitor #7",   asset_code:"ME-002", issue:"SpO2 probe alarm false triggering",                priority:"medium",  raised_by:"Sr. Seema",   department:"ICU",        assigned_to:"Biomedical Engg", raised_at:"10:00", resolved_at:null,   status:"open"        },
  { id:4, ticket_no:"SVC/0512/004", asset_name:"Infusion Pump #12",    asset_code:"ME-005", issue:"Battery not holding charge — needs replacement",   priority:"medium",  raised_by:"Sr. Anita",   department:"Ward A",     assigned_to:"Biomedical Engg", raised_at:"10:45", resolved_at:null,   status:"open"        },
  { id:5, ticket_no:"SVC/0512/005", asset_name:"Hospital Server",      asset_code:"IT-001", issue:"Disk array warning — RAID degraded",               priority:"critical",raised_by:"IT Admin",    department:"IT",         assigned_to:"Dell Technologies",raised_at:"11:00",resolved_at:null,   status:"in_progress" },
  { id:6, ticket_no:"SVC/0412/018", asset_name:"X-Ray Machine",        asset_code:"DE-002", issue:"Routine quarterly PPM",                            priority:"low",     raised_by:"Supervisor",  department:"Radiology",  assigned_to:"Siemens Team",    raised_at:"2026-04-12",resolved_at:"2026-04-14",status:"resolved" },
];

const ASC: Record<AssetStatus, { label: string; cls: string; dot: string }> = {
  active:            { label: "Active",            cls: "bg-green-100 text-green-700",  dot: "bg-green-500"  },
  under_maintenance: { label: "Under Maintenance", cls: "bg-blue-100 text-blue-700",   dot: "bg-blue-500"   },
  amc_due:           { label: "AMC Due",           cls: "bg-amber-100 text-amber-700", dot: "bg-amber-500"  },
  condemned:         { label: "Condemned",         cls: "bg-red-100 text-red-700",     dot: "bg-red-500"    },
  spare:             { label: "Spare",             cls: "bg-slate-100 text-slate-600", dot: "bg-slate-400"  },
};
const TKS: Record<string, { label: string; cls: string }> = {
  open:        { label: "Open",        cls: "bg-amber-100 text-amber-700"  },
  in_progress: { label: "In Progress", cls: "bg-blue-100 text-blue-700"    },
  resolved:    { label: "Resolved",    cls: "bg-green-100 text-green-700"  },
  closed:      { label: "Closed",      cls: "bg-slate-100 text-slate-600"  },
};
const TPRI: Record<string, string> = {
  low:      "bg-slate-100 text-slate-600",
  medium:   "bg-amber-100 text-amber-700",
  high:     "bg-orange-100 text-orange-700",
  critical: "bg-red-100 text-red-700 font-bold",
};
const COND: Record<string, string> = {
  excellent: "text-green-600", good: "text-teal-600", fair: "text-amber-600", poor: "text-red-600",
};
const CATS = ["All", "Medical Equipment", "Diagnostic Equipment", "IT & Computers", "Furniture", "Infrastructure", "Support Equipment"];

function fmt(n: number) { return `₹${n.toLocaleString("en-IN")}`; }

export default function AssetsPage() {
  const [assets, setAssets]   = useState<Asset[]>(ASSETS);
  const [tickets]              = useState<ServiceTicket[]>(TICKETS);
  const [tab, setTab]          = useState<"assets" | "service">("assets");
  const [q, setQ]              = useState("");
  const [catFilter, setCat]    = useState("All");
  const [statFilter, setStat]  = useState<AssetStatus | "all">("all");
  const [expanded, setExpanded]= useState<number | null>(null);
  const [error, setError]      = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [d] = await Promise.allSettled([get<Asset[]>("/assets/")]);
      if (d.status === "fulfilled" && (d.value as Asset[]).length > 0) setAssets(d.value as Asset[]);
      setError(null);
    } catch { setError("Showing demo data."); }
  }, []);
  useEffect(() => { fetchData(); }, [fetchData]);

  const amcAlert = assets.filter(a => a.status === "amc_due");
  const openTickets = tickets.filter(t => t.status === "open" || t.status === "in_progress");

  const displayed = assets.filter(a => {
    const mq = !q || a.name.toLowerCase().includes(q.toLowerCase()) || a.asset_code.toLowerCase().includes(q.toLowerCase()) || a.department.toLowerCase().includes(q.toLowerCase()) || a.make.toLowerCase().includes(q.toLowerCase());
    const mc = catFilter === "All" || a.category === catFilter;
    const ms = statFilter === "all" || a.status === statFilter;
    return mq && mc && ms;
  });

  const totalValue = assets.reduce((s, a) => s + a.purchase_cost, 0);

  return (
    <div className="space-y-5 pb-8">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div><h2 className="text-2xl font-bold">Assets & Equipment</h2><p className="text-sm text-muted-foreground">Asset register, AMC tracking, and service management</p></div>
        <div className="flex gap-2">
          <button onClick={fetchData} className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"><RefreshCw className="h-3.5 w-3.5" />Refresh</button>
          <Button className="gap-2"><Plus className="h-4 w-4" />Add Asset</Button>
        </div>
      </div>
      {error && <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 text-sm text-amber-800"><AlertTriangle className="h-4 w-4 shrink-0" />Showing demo data.</div>}

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "Total Assets",      value: STATS.total_assets,       color: "border-l-blue-500"   },
          { label: "Asset Value",       value: fmt(totalValue),          color: "border-l-green-500"  },
          { label: "Active",            value: STATS.active,             color: "border-l-teal-500"   },
          { label: "Under Maintenance", value: STATS.under_maintenance,  color: "border-l-purple-500" },
          { label: "AMC Due Soon",      value: STATS.amc_due_soon,       color: "border-l-amber-500"  },
          { label: "Open Tickets",      value: STATS.open_tickets,       color: "border-l-red-500"    },
        ].map(s => (
          <div key={s.label} className={cn("rounded-xl border bg-background px-4 py-3 border-l-[3px]", s.color)}>
            <p className="text-xl font-bold">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Alert banners */}
      {amcAlert.length > 0 && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
          <p className="text-sm font-semibold text-amber-800 flex items-center gap-2 mb-2"><Wrench className="h-4 w-4" />AMC renewal due — {amcAlert.length} assets</p>
          <div className="flex flex-wrap gap-2">
            {amcAlert.map(a => <span key={a.id} className="rounded-full px-2.5 py-1 text-[11px] font-medium bg-amber-100 text-amber-800">{a.name} ({a.amc_expiry})</span>)}
          </div>
        </div>
      )}
      {openTickets.length > 0 && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4">
          <p className="text-sm font-semibold text-red-700 flex items-center gap-2 mb-2"><AlertTriangle className="h-4 w-4" />{openTickets.length} open service tickets</p>
          <div className="flex flex-wrap gap-2">
            {openTickets.filter(t => t.priority === "critical").map(t => <span key={t.id} className="rounded-full px-2.5 py-1 text-[11px] font-medium bg-red-100 text-red-700">🔴 {t.asset_name}</span>)}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-4 border-b">
        {([["assets", `Asset Register (${assets.length})`], ["service", `Service Tickets (${tickets.length})`]] as const).map(([v, l]) => (
          <button key={v} onClick={() => setTab(v)} className={cn("py-2.5 px-1 text-sm font-medium border-b-2 -mb-px transition-colors", tab === v ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>{l}</button>
        ))}
      </div>

      {tab === "assets" ? (
        <>
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={q} onChange={e => setQ(e.target.value)} className="pl-9" placeholder="Search by name, code, department, or make…" />
            </div>
            <select value={catFilter} onChange={e => setCat(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2">
              {CATS.map(c => <option key={c}>{c}</option>)}
            </select>
            <div className="flex rounded-md border overflow-hidden text-xs">
              {(["all", "active", "under_maintenance", "amc_due", "condemned"] as const).map(v => (
                <button key={v} onClick={() => setStat(v)} className={cn("px-3 py-2 font-medium transition-colors", statFilter === v ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted")}>
                  {v === "all" ? "All" : v === "under_maintenance" ? "Maintenance" : v === "amc_due" ? "AMC Due" : v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            {displayed.map(asset => {
              const exp = expanded === asset.id;
              const sc = ASC[asset.status];
              return (
                <Card key={asset.id} className={cn("overflow-hidden", asset.status === "under_maintenance" && "border-blue-200", asset.status === "amc_due" && "border-amber-200")}>
                  <CardContent className="p-0">
                    <div className="flex items-center gap-4 p-4 cursor-pointer hover:bg-muted/20" onClick={() => setExpanded(exp ? null : asset.id)}>
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                        <Wrench className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-[14px]">{asset.name}</p>
                          <span className="font-mono text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{asset.asset_code}</span>
                          <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium", sc.cls)}>
                            <span className={cn("h-1.5 w-1.5 rounded-full", sc.dot)} />{sc.label}
                          </span>
                          <span className={cn("text-[11px] font-medium capitalize", COND[asset.condition])}>● {asset.condition}</span>
                        </div>
                        <div className="flex flex-wrap gap-3 mt-1 text-[12px] text-muted-foreground">
                          <span>{asset.make} {asset.model}</span>
                          <span>· {asset.department}</span>
                          <span>· {asset.location}</span>
                          <span>· {asset.category}</span>
                        </div>
                      </div>
                      <div className="text-right text-[12px] shrink-0">
                        <p className="font-semibold">{fmt(asset.purchase_cost)}</p>
                        <p className="text-muted-foreground">{asset.purchase_date}</p>
                      </div>
                      {exp ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                    </div>
                    {exp && (
                      <div className="border-t bg-muted/20 p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-[12px]">
                        <div><p className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wide mb-1">Serial No</p><p className="font-mono">{asset.serial_no}</p></div>
                        <div><p className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wide mb-1">AMC Vendor</p><p>{asset.amc_vendor}</p></div>
                        <div><p className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wide mb-1">AMC Expiry</p><p className={asset.status === "amc_due" ? "text-amber-600 font-semibold" : ""}>{asset.amc_expiry ?? "—"}</p></div>
                        <div><p className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wide mb-1">Warranty Expiry</p><p>{asset.warranty_expiry ?? "—"}</p></div>
                        <div><p className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wide mb-1">Last Service</p><p>{asset.last_service ?? "—"}</p></div>
                        <div><p className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wide mb-1">Next Service</p><p className={asset.next_service && new Date(asset.next_service) < new Date() ? "text-red-600 font-semibold" : ""}>{asset.next_service ?? "—"}</p></div>
                        <div className="flex gap-2 col-span-2">
                          <button className="flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"><Edit2 className="h-3 w-3" />Edit</button>
                          <button className="flex items-center gap-1 rounded-md border border-blue-200 px-3 py-1.5 text-xs text-blue-600 hover:bg-blue-50"><Wrench className="h-3 w-3" />Raise Ticket</button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      ) : (
        <div className="space-y-2">
          {tickets.map(t => {
            const sc = TKS[t.status];
            const pc = TPRI[t.priority];
            return (
              <Card key={t.id} className={cn("overflow-hidden", t.priority === "critical" && (t.status === "open" || t.status === "in_progress") && "border-red-200")}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", t.priority === "critical" ? "bg-red-100" : t.priority === "high" ? "bg-orange-100" : "bg-muted")}>
                      <Wrench className={cn("h-5 w-5", t.priority === "critical" ? "text-red-600" : t.priority === "high" ? "text-orange-600" : "text-muted-foreground")} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-[14px]">{t.asset_name}</p>
                        <span className="font-mono text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{t.ticket_no}</span>
                        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", sc.cls)}>{sc.label}</span>
                        <span className={cn("rounded-full px-2 py-0.5 text-[11px] uppercase tracking-wide", pc)}>{t.priority}</span>
                      </div>
                      <p className="text-[13px] text-muted-foreground mt-1">{t.issue}</p>
                      <div className="flex flex-wrap gap-3 mt-1.5 text-[11px] text-muted-foreground">
                        <span>{t.asset_code}</span>
                        <span>· {t.department}</span>
                        <span>· Raised by {t.raised_by}</span>
                        <span>· {t.raised_at}</span>
                        <span>· Assigned: {t.assigned_to}</span>
                        {t.resolved_at && <span className="text-green-600">· Resolved {t.resolved_at}</span>}
                      </div>
                    </div>
                    {(t.status === "open" || t.status === "in_progress") && (
                      <button className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground font-medium hover:bg-primary/90 shrink-0">
                        {t.status === "open" ? "Assign" : "Resolve"}
                      </button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}