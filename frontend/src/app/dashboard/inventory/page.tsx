"use client";
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, RefreshCw, Plus, AlertTriangle, Package, TrendingDown, ChevronDown, ChevronUp, Edit2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";
function hdrs(){ const t=useAuthStore.getState().token; return {"Content-Type":"application/json",...(t?{Authorization:`Bearer ${t}`}:{})}; }
async function get<T>(p:string):Promise<T>{ const r=await fetch(`${BASE}${p}`,{headers:hdrs(),cache:"no-store"}); if(!r.ok)throw new Error(`${r.status}`); const j=await r.json(); return (j?.results??j) as T; }

type StockStatus = "ok"|"low"|"critical"|"out_of_stock"|"expired";
type Category = "Medical Supplies"|"Surgical Consumables"|"PPE"|"Diagnostics"|"Office & Admin"|"Housekeeping Supplies"|"Linen"|"Dietary Supplies";

interface InventoryItem {
  id: number; code: string; name: string; category: Category;
  unit: string; current_stock: number; min_level: number; max_level: number;
  reorder_qty: number; unit_cost: number; total_value: number;
  location: string; supplier: string; expiry: string | null;
  last_received: string; last_issued: string | null; status: StockStatus;
}
interface StockMovement {
  id: number; item_name: string; type: "receipt"|"issue"|"return"|"adjustment";
  qty: number; unit: string; reference: string; department: string;
  moved_by: string; moved_at: string; notes: string;
}
interface InventoryStats {
  total_items: number; low_stock: number; out_of_stock: number;
  expiring_soon: number; total_value: number; movements_today: number;
}

const STATS: InventoryStats = {
  total_items: 284, low_stock: 18, out_of_stock: 3,
  expiring_soon: 7, total_value: 2840000, movements_today: 64,
};

const ITEMS: InventoryItem[] = [
  { id:1,  code:"MS-001", name:"Disposable Gloves (L)",       category:"PPE",                  unit:"Box (100)",    current_stock:48,  min_level:20,  max_level:200, reorder_qty:100, unit_cost:180,   total_value:8640,   location:"Store A-1", supplier:"Ansell India",    expiry:null,         last_received:"2026-05-01", last_issued:"2026-05-12", status:"ok"          },
  { id:2,  code:"MS-002", name:"Surgical Masks (3-ply)",       category:"PPE",                  unit:"Box (50)",     current_stock:12,  min_level:20,  max_level:150, reorder_qty:80,  unit_cost:120,   total_value:1440,   location:"Store A-1", supplier:"3M India",        expiry:null,         last_received:"2026-04-20", last_issued:"2026-05-12", status:"low"         },
  { id:3,  code:"MS-003", name:"IV Cannula (18G)",             category:"Medical Supplies",     unit:"Pcs",          current_stock:340, min_level:100, max_level:500, reorder_qty:200, unit_cost:22,    total_value:7480,   location:"Store B-2", supplier:"BD India",        expiry:"2028-03-31", last_received:"2026-04-15", last_issued:"2026-05-12", status:"ok"          },
  { id:4,  code:"MS-004", name:"IV Cannula (20G)",             category:"Medical Supplies",     unit:"Pcs",          current_stock:28,  min_level:100, max_level:500, reorder_qty:200, unit_cost:22,    total_value:616,    location:"Store B-2", supplier:"BD India",        expiry:"2028-03-31", last_received:"2026-03-10", last_issued:"2026-05-12", status:"critical"    },
  { id:5,  code:"MS-005", name:"Surgical Gloves (7.5)",        category:"Surgical Consumables", unit:"Pair",         current_stock:180, min_level:50,  max_level:300, reorder_qty:150, unit_cost:28,    total_value:5040,   location:"OT Store",  supplier:"Ansell India",    expiry:"2028-06-30", last_received:"2026-05-05", last_issued:"2026-05-12", status:"ok"          },
  { id:6,  code:"MS-006", name:"Sterile Gauze 10×10cm",        category:"Surgical Consumables", unit:"Pack (12)",    current_stock:95,  min_level:50,  max_level:300, reorder_qty:150, unit_cost:45,    total_value:4275,   location:"Store B-1", supplier:"Mediline India",  expiry:"2028-12-31", last_received:"2026-04-28", last_issued:"2026-05-12", status:"ok"          },
  { id:7,  code:"MS-007", name:"Suction Catheter (12Fr)",      category:"Medical Supplies",     unit:"Pcs",          current_stock:8,   min_level:20,  max_level:100, reorder_qty:60,  unit_cost:35,    total_value:280,    location:"ICU Store", supplier:"Romsons",         expiry:"2028-09-30", last_received:"2026-03-20", last_issued:"2026-05-11", status:"critical"    },
  { id:8,  code:"MS-008", name:"Ryle's Tube (14Fr)",           category:"Medical Supplies",     unit:"Pcs",          current_stock:0,   min_level:10,  max_level:50,  reorder_qty:30,  unit_cost:42,    total_value:0,      location:"Store B-3", supplier:"Romsons",         expiry:"2028-06-30", last_received:"2026-02-15", last_issued:"2026-05-10", status:"out_of_stock"},
  { id:9,  code:"MS-009", name:"Pulse Oximeter Probe (Adult)", category:"Diagnostics",          unit:"Pcs",          current_stock:22,  min_level:10,  max_level:40,  reorder_qty:20,  unit_cost:380,   total_value:8360,   location:"Store C-1", supplier:"Nellcor",         expiry:null,         last_received:"2026-04-01", last_issued:"2026-05-08", status:"ok"          },
  { id:10, code:"MS-010", name:"Urinary Catheter (14Fr Foley)",category:"Medical Supplies",     unit:"Pcs",          current_stock:45,  min_level:30,  max_level:150, reorder_qty:80,  unit_cost:65,    total_value:2925,   location:"Store B-2", supplier:"Romsons",         expiry:"2028-08-31", last_received:"2026-04-10", last_issued:"2026-05-11", status:"ok"          },
  { id:11, code:"HS-001", name:"Disinfectant (Phenyl 1L)",     category:"Housekeeping Supplies",unit:"Bottle",       current_stock:14,  min_level:20,  max_level:100, reorder_qty:60,  unit_cost:95,    total_value:1330,   location:"HK Store",  supplier:"Dabur",           expiry:"2027-12-31", last_received:"2026-04-25", last_issued:"2026-05-12", status:"low"         },
  { id:12, code:"HS-002", name:"Sodium Hypochlorite 1%",       category:"Housekeeping Supplies",unit:"Litre",        current_stock:38,  min_level:20,  max_level:100, reorder_qty:60,  unit_cost:40,    total_value:1520,   location:"HK Store",  supplier:"Local Supplier",  expiry:"2026-08-31", last_received:"2026-04-20", last_issued:"2026-05-12", status:"ok"          },
  { id:13, code:"LN-001", name:"Cotton Bed Sheet",             category:"Linen",                unit:"Pcs",          current_stock:120, min_level:80,  max_level:300, reorder_qty:100, unit_cost:280,   total_value:33600,  location:"Linen Store",supplier:"Trident Group",   expiry:null,         last_received:"2026-03-01", last_issued:"2026-05-12", status:"ok"          },
  { id:14, code:"PPE-001",name:"N95 Respirator",               category:"PPE",                  unit:"Pcs",          current_stock:6,   min_level:20,  max_level:100, reorder_qty:60,  unit_cost:220,   total_value:1320,   location:"Store A-1", supplier:"3M India",        expiry:"2026-06-30", last_received:"2026-01-15", last_issued:"2026-05-10", status:"critical"    },
];

const MOVEMENTS: StockMovement[] = [
  { id:1, item_name:"IV Cannula (18G)",       type:"issue",    qty:40,  unit:"Pcs",       reference:"REQ/0512/041",department:"General Ward",   moved_by:"Sr. Anita", moved_at:"09:00", notes:"" },
  { id:2, item_name:"Surgical Masks (3-ply)", type:"issue",    qty:5,   unit:"Box (50)",  reference:"REQ/0512/042",department:"OPD",            moved_by:"Ravi",      moved_at:"09:30", notes:"" },
  { id:3, item_name:"Sterile Gauze 10×10cm",  type:"issue",    qty:12,  unit:"Pack",      reference:"REQ/0512/043",department:"OT-1",           moved_by:"Sr. Asha",  moved_at:"10:00", notes:"" },
  { id:4, item_name:"Disposable Gloves (L)",  type:"receipt",  qty:20,  unit:"Box (100)", reference:"PO/2026/0489", department:"Central Store",  moved_by:"Store Mgr", moved_at:"10:45", notes:"GRN recorded" },
  { id:5, item_name:"Urinary Catheter 14Fr",  type:"issue",    qty:6,   unit:"Pcs",       reference:"REQ/0512/044",department:"Surgical Ward",  moved_by:"Sr. Pooja", moved_at:"11:00", notes:"" },
  { id:6, item_name:"Suction Catheter 12Fr",  type:"issue",    qty:4,   unit:"Pcs",       reference:"REQ/0512/045",department:"ICU",            moved_by:"Sr. Seema", moved_at:"11:30", notes:"Low stock warning raised" },
  { id:7, item_name:"Disinfectant (Phenyl)",  type:"issue",    qty:3,   unit:"Bottle",    reference:"REQ/0512/046",department:"Housekeeping",   moved_by:"Mohan HK",  moved_at:"12:00", notes:"" },
  { id:8, item_name:"Cotton Bed Sheet",       type:"return",   qty:5,   unit:"Pcs",       reference:"RET/0512/012",department:"Laundry",        moved_by:"Seema HK",  moved_at:"13:00", notes:"Returned after washing" },
];

const SSC: Record<StockStatus, { label: string; cls: string }> = {
  ok:            { label: "OK",            cls: "bg-green-100 text-green-700"  },
  low:           { label: "Low",           cls: "bg-amber-100 text-amber-700"  },
  critical:      { label: "Critical",      cls: "bg-red-100 text-red-700"      },
  out_of_stock:  { label: "Out of Stock",  cls: "bg-red-200 text-red-800 font-bold" },
  expired:       { label: "Expired",       cls: "bg-slate-100 text-slate-600"  },
};
const MTC: Record<string, string> = {
  issue:      "bg-amber-100 text-amber-700",
  receipt:    "bg-green-100 text-green-700",
  return:     "bg-blue-100 text-blue-700",
  adjustment: "bg-purple-100 text-purple-700",
};
const CATEGORIES: string[] = ["All", "Medical Supplies", "Surgical Consumables", "PPE", "Diagnostics", "Housekeeping Supplies", "Linen", "Dietary Supplies"];

function fmt(n: number) { return `₹${n.toLocaleString("en-IN")}`; }
function pct(a: number, b: number) { return b > 0 ? Math.round((a / b) * 100) : 0; }
function stockBar(cur: number, min: number, max: number) {
  const p = pct(cur, max);
  const color = cur === 0 ? "bg-red-500" : cur < min ? "bg-amber-500" : "bg-green-500";
  return { p, color };
}

export default function InventoryPage() {
  const [items, setItems]     = useState<InventoryItem[]>(ITEMS);
  const [movements]           = useState<StockMovement[]>(MOVEMENTS);
  const [tab, setTab]         = useState<"stock" | "movements">("stock");
  const [q, setQ]             = useState("");
  const [catFilter, setCat]   = useState("All");
  const [statFilter, setStat] = useState<StockStatus | "all">("all");
  const [error, setError]     = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [d] = await Promise.allSettled([get<InventoryItem[]>("/inventory/items/")]);
      if (d.status === "fulfilled" && (d.value as InventoryItem[]).length > 0) setItems(d.value as InventoryItem[]);
      setError(null);
    } catch { setError("Showing demo data."); }
  }, []);
  useEffect(() => { fetchData(); }, [fetchData]);

  const alertItems = items.filter(i => i.status !== "ok");

  const displayed = items.filter(i => {
    const mq = !q || i.name.toLowerCase().includes(q.toLowerCase()) || i.code.toLowerCase().includes(q.toLowerCase()) || i.supplier.toLowerCase().includes(q.toLowerCase());
    const mc = catFilter === "All" || i.category === catFilter;
    const ms = statFilter === "all" || i.status === statFilter;
    return mq && mc && ms;
  });

  const totalValue = items.reduce((s, i) => s + i.total_value, 0);

  return (
    <div className="space-y-5 pb-8">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div><h2 className="text-2xl font-bold">Inventory</h2><p className="text-sm text-muted-foreground">Stock management, issue/receipt tracking, and reorder management</p></div>
        <div className="flex gap-2">
          <button onClick={fetchData} className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"><RefreshCw className="h-3.5 w-3.5" />Refresh</button>
          <Button className="gap-2"><Plus className="h-4 w-4" />Add Item</Button>
        </div>
      </div>
      {error && <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 text-sm text-amber-800"><AlertTriangle className="h-4 w-4 shrink-0" />Showing demo data.</div>}

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "Total Items",     value: STATS.total_items,             color: "border-l-blue-500"   },
          { label: "Total Value",     value: fmt(totalValue),               color: "border-l-green-500"  },
          { label: "Low Stock",       value: STATS.low_stock,               color: "border-l-amber-500"  },
          { label: "Out of Stock",    value: STATS.out_of_stock,            color: "border-l-red-500"    },
          { label: "Expiring Soon",   value: STATS.expiring_soon,           color: "border-l-orange-500" },
          { label: "Movements Today", value: STATS.movements_today,         color: "border-l-teal-500"   },
        ].map(s => (
          <div key={s.label} className={cn("rounded-xl border bg-background px-4 py-3 border-l-[3px]", s.color)}>
            <p className="text-xl font-bold">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Alert banner */}
      {alertItems.length > 0 && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4">
          <p className="text-sm font-semibold text-red-700 flex items-center gap-2 mb-2"><TrendingDown className="h-4 w-4" />{alertItems.length} items need attention</p>
          <div className="flex flex-wrap gap-2">
            {alertItems.map(i => (
              <span key={i.id} className={cn("rounded-full px-2.5 py-1 text-[11px] font-medium", SSC[i.status].cls)}>
                {i.name} ({i.current_stock} {i.unit})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-4 border-b">
        {([["stock", "Stock Register"], ["movements", "Today's Movements"]] as const).map(([v, l]) => (
          <button key={v} onClick={() => setTab(v)} className={cn("py-2.5 px-1 text-sm font-medium border-b-2 -mb-px transition-colors", tab === v ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>{l}</button>
        ))}
      </div>

      {tab === "stock" ? (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={q} onChange={e => setQ(e.target.value)} className="pl-9" placeholder="Search item name, code, or supplier…" />
            </div>
            <select value={catFilter} onChange={e => setCat(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2">
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
            <div className="flex rounded-md border overflow-hidden text-xs">
              {(["all", "critical", "low", "out_of_stock"] as const).map(v => (
                <button key={v} onClick={() => setStat(v)} className={cn("px-3 py-2 font-medium transition-colors", statFilter === v ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted")}>
                  {v === "all" ? "All" : v === "out_of_stock" ? "Out of Stock" : v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Showing {displayed.length} of {items.length} items</p>

          <Card><CardContent className="p-0"><div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-[11px] text-muted-foreground">
                <th className="px-4 py-3 text-left font-medium">Item</th>
                <th className="px-3 py-3 text-left font-medium">Category</th>
                <th className="px-3 py-3 text-left font-medium">Stock Level</th>
                <th className="px-3 py-3 text-right font-medium">Current</th>
                <th className="px-3 py-3 text-right font-medium">Min</th>
                <th className="px-3 py-3 text-right font-medium">Unit Cost</th>
                <th className="px-3 py-3 text-right font-medium">Value</th>
                <th className="px-3 py-3 text-left font-medium">Location</th>
                <th className="px-3 py-3 text-left font-medium">Expiry</th>
                <th className="px-3 py-3 text-left font-medium">Status</th>
              </tr></thead>
              <tbody>
                {displayed.map(item => {
                  const sc = SSC[item.status];
                  const bar = stockBar(item.current_stock, item.min_level, item.max_level);
                  return (
                    <tr key={item.id} className={cn("border-b last:border-0 hover:bg-muted/30", item.status === "out_of_stock" && "bg-red-50/30")}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-[13px]">{item.name}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">{item.code} · {item.supplier}</p>
                      </td>
                      <td className="px-3 py-3 text-[11px] text-muted-foreground">{item.category}</td>
                      <td className="px-3 py-3 min-w-[100px]">
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className={cn("h-full rounded-full", bar.color)} style={{ width: `${bar.p}%` }} />
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{bar.p}% of max</p>
                      </td>
                      <td className={cn("px-3 py-3 text-right font-bold", item.status === "out_of_stock" ? "text-red-600" : item.status === "critical" ? "text-red-500" : item.status === "low" ? "text-amber-600" : "text-green-600")}>
                        {item.current_stock} {item.unit}
                      </td>
                      <td className="px-3 py-3 text-right text-[12px] text-muted-foreground">{item.min_level}</td>
                      <td className="px-3 py-3 text-right text-[12px]">{fmt(item.unit_cost)}</td>
                      <td className="px-3 py-3 text-right text-[12px] font-medium">{fmt(item.total_value)}</td>
                      <td className="px-3 py-3 text-[11px] font-mono text-muted-foreground">{item.location}</td>
                      <td className="px-3 py-3 text-[11px] text-muted-foreground">{item.expiry ?? "—"}</td>
                      <td className="px-3 py-3"><span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", sc.cls)}>{sc.label}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div></CardContent></Card>
        </>
      ) : (
        <Card><CardContent className="p-0"><div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-[11px] text-muted-foreground">
              <th className="px-4 py-3 text-left font-medium">Item</th>
              <th className="px-3 py-3 text-left font-medium">Type</th>
              <th className="px-3 py-3 text-right font-medium">Qty</th>
              <th className="px-3 py-3 text-left font-medium">Department</th>
              <th className="px-3 py-3 text-left font-medium">Reference</th>
              <th className="px-3 py-3 text-left font-medium">By</th>
              <th className="px-3 py-3 text-left font-medium">Time</th>
              <th className="px-3 py-3 text-left font-medium">Notes</th>
            </tr></thead>
            <tbody>
              {movements.map(m => (
                <tr key={m.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{m.item_name}</td>
                  <td className="px-3 py-3"><span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium capitalize", MTC[m.type])}>{m.type}</span></td>
                  <td className={cn("px-3 py-3 text-right font-bold", m.type === "issue" ? "text-amber-600" : "text-green-600")}>
                    {m.type === "issue" ? "−" : "+"}{m.qty} {m.unit}
                  </td>
                  <td className="px-3 py-3 text-[12px]">{m.department}</td>
                  <td className="px-3 py-3 text-[11px] font-mono text-muted-foreground">{m.reference}</td>
                  <td className="px-3 py-3 text-[12px] text-muted-foreground">{m.moved_by}</td>
                  <td className="px-3 py-3 text-[12px]">{m.moved_at}</td>
                  <td className="px-3 py-3 text-[11px] text-muted-foreground">{m.notes || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div></CardContent></Card>
      )}
    </div>
  );
}