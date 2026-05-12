"use client";
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, RefreshCw, Plus, AlertTriangle, Pill, ChevronDown, ChevronUp, Package, ShoppingCart, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";
function hdrs(){ const t=useAuthStore.getState().token; return {"Content-Type":"application/json",...(t?{Authorization:`Bearer ${t}`}:{})}; }
async function get<T>(p:string):Promise<T>{ const r=await fetch(`${BASE}${p}`,{headers:hdrs(),cache:"no-store"}); if(!r.ok)throw new Error(`${r.status}`); const j=await r.json(); return (j?.results??j) as T; }

type BillStatus = "pending"|"dispensed"|"partial"|"cancelled";
interface PharmacyBill { id:number; bill_no:string; mrn:string; patient_name:string; doctor_name:string; department:string; items_count:number; total_amount:number; discount:number; net_amount:number; status:BillStatus; created_at:string; dispensed_at:string|null; items:{name:string;qty:number;unit:string;rate:number;amount:number;}[]; }
interface DrugStock { id:number; name:string; category:string; form:string; strength:string; stock:number; unit:string; min_level:number; expiry:string; location:string; status:"ok"|"low"|"critical"|"expired"; }
interface PharmacyStats { bills_today:number; revenue_today:number; pending_bills:number; low_stock:number; expired_items:number; items_dispensed:number; }

const STATS:PharmacyStats={bills_today:312,revenue_today:48600,pending_bills:14,low_stock:8,expired_items:2,items_dispensed:1847};
const BILLS:PharmacyBill[]=[
  {id:1,bill_no:"RX/0512/001",mrn:"MRN-00482",patient_name:"Ramesh Kumar",  doctor_name:"Dr. Sharma",department:"General OPD",items_count:3,total_amount:340, discount:0, net_amount:340, status:"dispensed",created_at:"09:22",dispensed_at:"09:28",
   items:[{name:"Paracetamol 500mg",qty:15,unit:"Tab",rate:1.5,amount:22.5},{name:"ORS Sachet",qty:5,unit:"Pkt",rate:8,amount:40},{name:"Cetirizine 10mg",qty:10,unit:"Tab",rate:2.5,amount:25}]},
  {id:2,bill_no:"RX/0512/002",mrn:"MRN-00389",patient_name:"Priya Devi",    doctor_name:"Dr. Mehta", department:"Gynaecology", items_count:2,total_amount:210, discount:10,net_amount:189, status:"dispensed",created_at:"09:45",dispensed_at:"09:52",
   items:[{name:"Ferrous Sulphate + Folic Acid",qty:30,unit:"Tab",rate:3,amount:90},{name:"Calcium 500mg",qty:30,unit:"Tab",rate:4,amount:120}]},
  {id:3,bill_no:"RX/0512/012",mrn:"MRN-00501",patient_name:"Arun Singh",    doctor_name:"Dr. Gupta", department:"Cardiology",  items_count:3,total_amount:780, discount:0, net_amount:780, status:"dispensed",created_at:"10:05",dispensed_at:"10:15",
   items:[{name:"Aspirin 75mg",qty:30,unit:"Tab",rate:2,amount:60},{name:"Atorvastatin 40mg",qty:30,unit:"Tab",rate:8,amount:240},{name:"Metoprolol 25mg",qty:60,unit:"Tab",rate:8,amount:480}]},
  {id:4,bill_no:"RX/0512/031",mrn:"MRN-00271",patient_name:"Sunita Joshi",  doctor_name:"Dr. Sharma",department:"General OPD",items_count:2,total_amount:185, discount:0, net_amount:185, status:"pending",  created_at:"11:08",dispensed_at:null,
   items:[{name:"Amoxicillin 500mg",qty:21,unit:"Cap",rate:5,amount:105},{name:"Ibuprofen 400mg",qty:20,unit:"Tab",rate:4,amount:80}]},
  {id:5,bill_no:"RX/0512/043",mrn:"MRN-00156",patient_name:"Dinesh Pandey", doctor_name:"Dr. Kumar", department:"Neurology",   items_count:3,total_amount:1240,discount:0, net_amount:1240,status:"pending",  created_at:"11:35",dispensed_at:null,
   items:[{name:"Betahistine 16mg",qty:30,unit:"Tab",rate:12,amount:360},{name:"Ondansetron 4mg",qty:10,unit:"Tab",rate:8,amount:80},{name:"Amlodipine 5mg",qty:30,unit:"Tab",rate:8,amount:240}]},
  {id:6,bill_no:"RX/0512/058",mrn:"MRN-00605",patient_name:"Lalita Verma",  doctor_name:"Dr. Rao",   department:"Dermatology", items_count:2,total_amount:560, discount:5, net_amount:532, status:"pending",  created_at:"12:14",dispensed_at:null,
   items:[{name:"Betamethasone Cream 0.05%",qty:2,unit:"Tube",rate:120,amount:240},{name:"Cetirizine 10mg",qty:30,unit:"Tab",rate:2.5,amount:75}]},
];
const STOCKS:DrugStock[]=[
  {id:1, name:"Paracetamol 500mg",      category:"Analgesic",    form:"Tablet",  strength:"500mg",  stock:4800, unit:"Tab",min_level:1000,expiry:"2027-03-31",location:"R-A1",status:"ok"},
  {id:2, name:"Amoxicillin 500mg",      category:"Antibiotic",   form:"Capsule", strength:"500mg",  stock:420,  unit:"Cap",min_level:500, expiry:"2026-11-30",location:"R-B2",status:"low"},
  {id:3, name:"Metformin 500mg",        category:"Antidiabetic", form:"Tablet",  strength:"500mg",  stock:2100, unit:"Tab",min_level:500, expiry:"2027-06-30",location:"R-C1",status:"ok"},
  {id:4, name:"Amlodipine 5mg",         category:"Antihypert.",  form:"Tablet",  strength:"5mg",    stock:380,  unit:"Tab",min_level:500, expiry:"2026-12-31",location:"R-A3",status:"low"},
  {id:5, name:"Atorvastatin 40mg",      category:"Lipid-lower.", form:"Tablet",  strength:"40mg",   stock:180,  unit:"Tab",min_level:200, expiry:"2027-01-31",location:"R-A4",status:"critical"},
  {id:6, name:"Ceftriaxone 1g Inj.",    category:"Antibiotic",   form:"Injection",strength:"1g",    stock:62,   unit:"Vial",min_level:30, expiry:"2026-09-30",location:"F-B1",status:"ok"},
  {id:7, name:"Normal Saline 500ml",    category:"IV Fluid",     form:"Infusion",strength:"0.9%",   stock:140,  unit:"Bag", min_level:100,expiry:"2027-08-31",location:"S-C2",status:"ok"},
  {id:8, name:"Insulin Glargine 100U",  category:"Antidiabetic", form:"Injection",strength:"100U/mL",stock:18,  unit:"Vial",min_level:20, expiry:"2026-08-31",location:"F-A1",status:"critical"},
  {id:9, name:"Ranitidine 150mg",       category:"Antacid",      form:"Tablet",  strength:"150mg",  stock:85,   unit:"Tab",min_level:200, expiry:"2026-04-30",location:"R-D2",status:"expired"},
  {id:10,name:"Ondansetron 4mg",        category:"Antiemetic",   form:"Tablet",  strength:"4mg",    stock:320,  unit:"Tab",min_level:100, expiry:"2027-02-28",location:"R-D3",status:"ok"},
];

const BSC:Record<BillStatus,{label:string;cls:string}>={
  pending:  {label:"Pending",   cls:"bg-amber-100 text-amber-700"},
  dispensed:{label:"Dispensed", cls:"bg-green-100 text-green-700"},
  partial:  {label:"Partial",   cls:"bg-blue-100 text-blue-700"},
  cancelled:{label:"Cancelled", cls:"bg-red-100 text-red-700"},
};
const SSC:{ok:{cls:string;label:string};low:{cls:string;label:string};critical:{cls:string;label:string};expired:{cls:string;label:string}} = {
  ok:      {label:"OK",       cls:"bg-green-100 text-green-700"},
  low:     {label:"Low",      cls:"bg-amber-100 text-amber-700"},
  critical:{label:"Critical", cls:"bg-red-100 text-red-700"},
  expired: {label:"Expired",  cls:"bg-slate-100 text-slate-600 line-through"},
};
const AV=["bg-blue-100 text-blue-700","bg-purple-100 text-purple-700","bg-teal-100 text-teal-700","bg-amber-100 text-amber-700","bg-rose-100 text-rose-700"];
function ini(n:string){return n.split(" ").slice(0,2).map(w=>w[0]).join("").toUpperCase();}
function fmt(n:number){return `₹${n.toLocaleString("en-IN")}`;}

export default function PharmacyPage(){
  const [stats] = useState<PharmacyStats>(STATS);
  const [bills,setBills]=useState<PharmacyBill[]>(BILLS);
  const [stocks]=useState<DrugStock[]>(STOCKS);
  const [tab,setTab]=useState<"bills"|"inventory">("bills");
  const [q,setQ]=useState("");
  const [expanded,setExpanded]=useState<number|null>(null);
  const [error,setError]=useState<string|null>(null);

  const fetchData=useCallback(async()=>{
    try{
      const[s,b]=await Promise.allSettled([get<PharmacyStats>("/pharmacy/stats/"),get<PharmacyBill[]>("/pharmacy/bills/today/")]);
      setError(null);
    }catch{setError("Showing demo data.");}
  },[]);
  useEffect(()=>{fetchData();},[fetchData]);

  const dispense=(id:number)=>setBills(p=>p.map(b=>b.id===id?{...b,status:"dispensed",dispensed_at:new Date().toTimeString().slice(0,5)}:b));

  const filteredBills=bills.filter(b=>!q||b.patient_name.toLowerCase().includes(q.toLowerCase())||b.bill_no.toLowerCase().includes(q.toLowerCase())||b.mrn.toLowerCase().includes(q.toLowerCase()));
  const filteredStocks=stocks.filter(s=>!q||s.name.toLowerCase().includes(q.toLowerCase())||s.category.toLowerCase().includes(q.toLowerCase()));
  const alertStocks=stocks.filter(s=>s.status==="low"||s.status==="critical"||s.status==="expired");

  return(
    <div className="space-y-5 pb-8">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div><h2 className="text-2xl font-bold">Pharmacy</h2><p className="text-sm text-muted-foreground">Bills, dispensing, and inventory management</p></div>
        <div className="flex gap-2">
          <button onClick={fetchData} className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"><RefreshCw className="h-3.5 w-3.5"/>Refresh</button>
          <Button className="gap-2"><Plus className="h-4 w-4"/>New Bill</Button>
        </div>
      </div>
      {error&&<div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 text-sm text-amber-800"><AlertTriangle className="h-4 w-4 shrink-0"/>Showing demo data.</div>}

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          {label:"Bills Today",      value:stats.bills_today,    color:"border-l-blue-500"},
          {label:"Revenue Today",    value:fmt(stats.revenue_today),color:"border-l-green-500"},
          {label:"Pending Bills",    value:stats.pending_bills,  color:"border-l-amber-500"},
          {label:"Items Dispensed",  value:stats.items_dispensed,color:"border-l-teal-500"},
          {label:"Low Stock Items",  value:stats.low_stock,      color:"border-l-orange-500"},
          {label:"Expired Items",    value:stats.expired_items,  color:"border-l-red-500"},
        ].map(s=>(
          <div key={s.label} className={cn("rounded-xl border bg-background px-4 py-3 border-l-[3px]",s.color)}>
            <p className="text-xl font-bold">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Low stock alert */}
      {alertStocks.length>0&&(
        <div className="rounded-lg bg-red-50 border border-red-200 p-4">
          <p className="text-sm font-semibold text-red-700 flex items-center gap-2 mb-2"><TrendingDown className="h-4 w-4"/>Stock Alerts — {alertStocks.length} items need attention</p>
          <div className="flex flex-wrap gap-2">{alertStocks.map(s=>(
            <span key={s.id} className={cn("rounded-full px-2.5 py-1 text-[12px] font-medium",SSC[s.status].cls)}>
              {s.name} ({s.stock} {s.unit})
            </span>
          ))}</div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-4 border-b">
        <button onClick={()=>setTab("bills")} className={cn("py-2.5 px-1 text-sm font-medium border-b-2 -mb-px transition-colors",tab==="bills"?"border-primary text-primary":"border-transparent text-muted-foreground hover:text-foreground")}>
          Bills & Dispensing
        </button>
        <button onClick={()=>setTab("inventory")} className={cn("py-2.5 px-1 text-sm font-medium border-b-2 -mb-px transition-colors",tab==="inventory"?"border-primary text-primary":"border-transparent text-muted-foreground hover:text-foreground")}>
          Inventory ({stocks.length} items)
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
        <Input value={q} onChange={e=>setQ(e.target.value)} className="pl-9" placeholder={tab==="bills"?"Search by patient, MRN, or bill no…":"Search drug name or category…"}/>
      </div>

      {tab==="bills"?(
        <div className="space-y-2">
          {filteredBills.map((b,i)=>{const exp=expanded===b.id; const sc=BSC[b.status]; return(
            <Card key={b.id} className="overflow-hidden">
              <CardContent className="p-0">
                <div className="flex items-center gap-4 p-4 cursor-pointer hover:bg-muted/20" onClick={()=>setExpanded(exp?null:b.id)}>
                  <span className={cn("inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold",AV[i%AV.length])}>{ini(b.patient_name)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-[14px]">{b.patient_name}</p>
                      <span className="font-mono text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{b.bill_no}</span>
                      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium",sc.cls)}>{sc.label}</span>
                    </div>
                    <div className="flex flex-wrap gap-3 mt-1 text-[12px] text-muted-foreground">
                      <span>{b.mrn}</span><span>· {b.doctor_name}</span><span>· {b.items_count} items</span><span>· {b.created_at}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-base">{fmt(b.net_amount)}</p>
                    {b.discount>0&&<p className="text-[11px] text-green-600">-{fmt(b.discount)} off</p>}
                  </div>
                  {exp?<ChevronUp className="h-4 w-4 text-muted-foreground shrink-0"/>:<ChevronDown className="h-4 w-4 text-muted-foreground shrink-0"/>}
                </div>
                {exp&&(
                  <div className="border-t bg-muted/20 p-4">
                    <table className="w-full text-[12px] mb-3">
                      <thead><tr className="border-b text-[11px] text-muted-foreground"><th className="py-1.5 text-left font-medium">Medicine</th><th className="py-1.5 text-right font-medium">Qty</th><th className="py-1.5 text-right font-medium">Rate</th><th className="py-1.5 text-right font-medium">Amount</th></tr></thead>
                      <tbody>{b.items.map((item,j)=><tr key={j} className="border-b last:border-0"><td className="py-1.5">{item.name}</td><td className="py-1.5 text-right">{item.qty} {item.unit}</td><td className="py-1.5 text-right">{fmt(item.rate)}</td><td className="py-1.5 text-right font-medium">{fmt(item.amount)}</td></tr>)}</tbody>
                    </table>
                    <div className="flex justify-between items-center">
                      <div className="text-[12px] text-muted-foreground">Net: <span className="font-bold text-foreground text-base">{fmt(b.net_amount)}</span></div>
                      {b.status==="pending"&&<button onClick={()=>dispense(b.id)} className="rounded-md bg-primary px-4 py-1.5 text-xs text-primary-foreground font-medium hover:bg-primary/90">Dispense All</button>}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );})}
        </div>
      ):(
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b text-[11px] text-muted-foreground">
                  <th className="px-4 py-3 text-left font-medium">Drug Name</th>
                  <th className="px-3 py-3 text-left font-medium">Category</th>
                  <th className="px-3 py-3 text-left font-medium">Form</th>
                  <th className="px-3 py-3 text-right font-medium">Stock</th>
                  <th className="px-3 py-3 text-right font-medium">Min Level</th>
                  <th className="px-3 py-3 text-left font-medium">Expiry</th>
                  <th className="px-3 py-3 text-left font-medium">Location</th>
                  <th className="px-3 py-3 text-left font-medium">Status</th>
                </tr></thead>
                <tbody>
                  {filteredStocks.map((s,i)=>{const ss=SSC[s.status]; return(
                    <tr key={s.id} className={cn("border-b last:border-0 hover:bg-muted/30",s.status==="expired"&&"opacity-60")}>
                      <td className="px-4 py-3 font-medium">{s.name}</td>
                      <td className="px-3 py-3 text-[12px] text-muted-foreground">{s.category}</td>
                      <td className="px-3 py-3 text-[12px]">{s.form}</td>
                      <td className="px-3 py-3 text-right font-semibold">{s.stock} {s.unit}</td>
                      <td className="px-3 py-3 text-right text-[12px] text-muted-foreground">{s.min_level}</td>
                      <td className="px-3 py-3 text-[12px]">{s.expiry}</td>
                      <td className="px-3 py-3 text-[12px] font-mono">{s.location}</td>
                      <td className="px-3 py-3"><span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium",ss.cls)}>{ss.label}</span></td>
                    </tr>
                  );})}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}