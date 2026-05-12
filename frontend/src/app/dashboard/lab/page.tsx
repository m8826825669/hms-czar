"use client";
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, RefreshCw, Plus, AlertTriangle, FlaskConical, ChevronDown, ChevronUp, CheckCircle2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";
function hdrs(){ const t=useAuthStore.getState().token; return {"Content-Type":"application/json",...(t?{Authorization:`Bearer ${t}`}:{})}; }
async function get<T>(p:string):Promise<T>{ const r=await fetch(`${BASE}${p}`,{headers:hdrs(),cache:"no-store"}); if(!r.ok)throw new Error(`${r.status}`); const j=await r.json(); return (j?.results??j) as T; }

type LabStatus = "sample_pending"|"processing"|"completed"|"reported"|"cancelled";
interface LabOrder { id:number; lab_no:string; mrn:string; patient_name:string; age:number; gender:string; doctor_name:string; department:string; tests:{name:string;category:string;status:LabStatus;result?:string;reference?:string;flag?:"H"|"L"|"N";}[]; priority:"routine"|"urgent"|"stat"; ordered_at:string; sample_collected_at:string|null; reported_at:string|null; overall_status:LabStatus; }
interface LabStats { orders_today:number; pending_collection:number; processing:number; completed_today:number; tat_avg_min:number; urgent_pending:number; }

const STATS:LabStats={orders_today:89,pending_collection:8,processing:23,completed_today:58,tat_avg_min:72,urgent_pending:5};
const ORDERS:LabOrder[]=[
  {id:1,lab_no:"LAB/0512/001",mrn:"MRN-00482",patient_name:"Ramesh Kumar",  age:45,gender:"M",doctor_name:"Dr. Sharma",department:"General OPD",priority:"routine",ordered_at:"09:25",sample_collected_at:"09:35",reported_at:"10:50",overall_status:"reported",
   tests:[{name:"CBC",category:"Haematology",status:"reported",result:"WBC 8.2, Hb 13.4, Plt 2.1L",reference:"WBC 4-11, Hb 13-17",flag:"N"},{name:"CRP",category:"Biochemistry",status:"reported",result:"24 mg/L",reference:"<5 mg/L",flag:"H"},{name:"ESR",category:"Haematology",status:"reported",result:"38 mm/hr",reference:"<20 mm/hr",flag:"H"}]},
  {id:2,lab_no:"LAB/0512/008",mrn:"MRN-00501",patient_name:"Arun Singh",    age:58,gender:"M",doctor_name:"Dr. Gupta", department:"Cardiology", priority:"urgent", ordered_at:"10:08",sample_collected_at:"10:12",reported_at:"11:05",overall_status:"reported",
   tests:[{name:"Troponin I",category:"Biochemistry",status:"reported",result:"0.04 ng/mL",reference:"<0.04 ng/mL",flag:"N"},{name:"LDH",category:"Biochemistry",status:"reported",result:"190 U/L",reference:"100-190 U/L",flag:"N"},{name:"Lipid Profile",category:"Biochemistry",status:"reported",result:"TC 210, LDL 138, HDL 42",reference:"TC <200, LDL <130",flag:"H"}]},
  {id:3,lab_no:"LAB/0512/019",mrn:"MRN-00589",patient_name:"Hamid Khan",    age:61,gender:"M",doctor_name:"Dr. Gupta", department:"ICU",        priority:"stat",   ordered_at:"11:30",sample_collected_at:"11:32",reported_at:null,overall_status:"processing",
   tests:[{name:"ABG",category:"Blood Gas",status:"processing"},{name:"Serum Electrolytes",category:"Biochemistry",status:"completed",result:"Na 136, K 3.8, Cl 102"},{name:"Serum Creatinine",category:"Biochemistry",status:"completed",result:"1.4 mg/dL",reference:"0.7-1.3 mg/dL",flag:"H"}]},
  {id:4,lab_no:"LAB/0512/027",mrn:"MRN-00271",patient_name:"Sunita Joshi",  age:27,gender:"F",doctor_name:"Dr. Sharma",department:"General OPD",priority:"routine",ordered_at:"11:40",sample_collected_at:"11:52",reported_at:null,overall_status:"processing",
   tests:[{name:"Urine R/M",category:"Urinalysis",status:"processing"},{name:"Urine Culture",category:"Microbiology",status:"sample_pending"}]},
  {id:5,lab_no:"LAB/0512/034",mrn:"MRN-00156",patient_name:"Dinesh Pandey", age:67,gender:"M",doctor_name:"Dr. Kumar",department:"Neurology",  priority:"stat",   ordered_at:"11:52",sample_collected_at:null,reported_at:null,overall_status:"sample_pending",
   tests:[{name:"PT/INR",category:"Coagulation",status:"sample_pending"},{name:"aPTT",category:"Coagulation",status:"sample_pending"},{name:"Platelet Count",category:"Haematology",status:"sample_pending"}]},
  {id:6,lab_no:"LAB/0512/041",mrn:"MRN-00605",patient_name:"Lalita Verma",  age:41,gender:"F",doctor_name:"Dr. Rao",  department:"Dermatology",priority:"routine",ordered_at:"12:18",sample_collected_at:null,reported_at:null,overall_status:"sample_pending",
   tests:[{name:"KOH Mount",category:"Microbiology",status:"sample_pending"},{name:"IgE Total",category:"Immunology",status:"sample_pending"}]},
];
const LSC:Record<LabStatus,{label:string;cls:string}>={
  sample_pending:{label:"Sample Pending",cls:"bg-slate-100 text-slate-600"},
  processing:    {label:"Processing",    cls:"bg-blue-100 text-blue-700"},
  completed:     {label:"Completed",     cls:"bg-teal-100 text-teal-700"},
  reported:      {label:"Reported",      cls:"bg-green-100 text-green-700"},
  cancelled:     {label:"Cancelled",     cls:"bg-red-100 text-red-700"},
};
const PRI={routine:{cls:"bg-slate-100 text-slate-600"},urgent:{cls:"bg-amber-100 text-amber-700"},stat:{cls:"bg-red-100 text-red-700 font-bold"}};
const AV=["bg-blue-100 text-blue-700","bg-purple-100 text-purple-700","bg-teal-100 text-teal-700","bg-amber-100 text-amber-700","bg-rose-100 text-rose-700"];
function ini(n:string){return n.split(" ").slice(0,2).map(w=>w[0]).join("").toUpperCase();}

export default function LaboratoryPage(){
  const [orders,setOrders]=useState<LabOrder[]>(ORDERS);
  const [q,setQ]=useState("");
  const [filter,setFilter]=useState<"all"|LabStatus>("all");
  const [expanded,setExpanded]=useState<number|null>(null);
  const [error,setError]=useState<string|null>(null);

  const fetchData=useCallback(async()=>{
    try{
      const[o]=await Promise.allSettled([get<LabOrder[]>("/lab/orders/today/")]);
      if(o.status==="fulfilled"&&(o.value as LabOrder[]).length>0) setOrders(o.value as LabOrder[]);
      setError(null);
    }catch{setError("Showing demo data.");}
  },[]);
  useEffect(()=>{fetchData();},[fetchData]);

  const collectSample=(id:number)=>setOrders(p=>p.map(o=>o.id===id?{...o,overall_status:"processing",sample_collected_at:new Date().toTimeString().slice(0,5)}:o));

  const displayed=orders.filter(o=>{
    const mq=!q||o.patient_name.toLowerCase().includes(q.toLowerCase())||o.lab_no.toLowerCase().includes(q.toLowerCase())||o.mrn.toLowerCase().includes(q.toLowerCase());
    const ms=filter==="all"||o.overall_status===filter;
    return mq&&ms;
  });

  const counts:Record<string,number>={all:orders.length,sample_pending:orders.filter(o=>o.overall_status==="sample_pending").length,processing:orders.filter(o=>o.overall_status==="processing").length,reported:orders.filter(o=>o.overall_status==="reported").length};

  return(
    <div className="space-y-5 pb-8">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div><h2 className="text-2xl font-bold">Laboratory</h2><p className="text-sm text-muted-foreground">Test orders, sample collection, results, and reporting</p></div>
        <div className="flex gap-2">
          <button onClick={fetchData} className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"><RefreshCw className="h-3.5 w-3.5"/>Refresh</button>
          <Button className="gap-2"><Plus className="h-4 w-4"/>New Order</Button>
        </div>
      </div>
      {error&&<div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 text-sm text-amber-800"><AlertTriangle className="h-4 w-4 shrink-0"/>Showing demo data.</div>}

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          {label:"Orders Today",      value:STATS.orders_today,        color:"border-l-blue-500"},
          {label:"Sample Pending",    value:STATS.pending_collection,  color:"border-l-slate-400"},
          {label:"Processing",        value:STATS.processing,          color:"border-l-purple-500"},
          {label:"Completed",         value:STATS.completed_today,     color:"border-l-green-500"},
          {label:"Avg TAT (min)",     value:STATS.tat_avg_min,         color:"border-l-amber-500"},
          {label:"Urgent Pending",    value:STATS.urgent_pending,      color:"border-l-red-500"},
        ].map(s=>(
          <div key={s.label} className={cn("rounded-xl border bg-background px-4 py-3 border-l-[3px]",s.color)}>
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
          <Input value={q} onChange={e=>setQ(e.target.value)} className="pl-9" placeholder="Search patient, MRN, or lab no…"/>
        </div>
        <div className="flex rounded-md border overflow-hidden text-xs">
          {(["all","sample_pending","processing","reported"] as const).map(v=>(
            <button key={v} onClick={()=>setFilter(v)} className={cn("px-3 py-2 font-medium transition-colors",filter===v?"bg-primary text-primary-foreground":"bg-background text-muted-foreground hover:bg-muted")}>
              {v==="all"?"All":v==="sample_pending"?"Sample Pending":v.charAt(0).toUpperCase()+v.slice(1)}
              {" "}<span className="opacity-60">({counts[v]??0})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Orders */}
      <div className="space-y-2">
        {displayed.map((o,i)=>{
          const exp=expanded===o.id; const sc=LSC[o.overall_status]; const pc=PRI[o.priority];
          return(
            <Card key={o.id} className="overflow-hidden">
              <CardContent className="p-0">
                <div className="flex items-center gap-4 p-4 cursor-pointer hover:bg-muted/20" onClick={()=>setExpanded(exp?null:o.id)}>
                  <span className={cn("inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold",AV[i%AV.length])}>{ini(o.patient_name)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-[14px]">{o.patient_name}</p>
                      <span className="font-mono text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{o.lab_no}</span>
                      <span className={cn("rounded-full px-2 py-0.5 text-[11px]",sc.cls)}>{sc.label}</span>
                      <span className={cn("rounded-full px-2 py-0.5 text-[11px] uppercase tracking-wide",pc.cls)}>{o.priority}</span>
                    </div>
                    <div className="flex flex-wrap gap-3 mt-1 text-[12px] text-muted-foreground">
                      <span>{o.mrn}</span><span>· {o.doctor_name}</span><span>· {o.tests.length} test{o.tests.length>1?"s":""}</span><span>· Ordered {o.ordered_at}</span>
                      {o.sample_collected_at&&<span>· Collected {o.sample_collected_at}</span>}
                      {o.reported_at&&<span>· Reported {o.reported_at}</span>}
                    </div>
                  </div>
                  <div className="shrink-0">
                    {o.overall_status==="sample_pending"&&(
                      <button onClick={e=>{e.stopPropagation();collectSample(o.id);}} className="flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-[11px] font-medium text-primary-foreground hover:bg-primary/90">
                        <FlaskConical className="h-3 w-3"/>Collect
                      </button>
                    )}
                  </div>
                  {exp?<ChevronUp className="h-4 w-4 text-muted-foreground shrink-0"/>:<ChevronDown className="h-4 w-4 text-muted-foreground shrink-0"/>}
                </div>
                {exp&&(
                  <div className="border-t bg-muted/20 p-4">
                    <table className="w-full text-[12px]">
                      <thead><tr className="border-b text-[11px] text-muted-foreground"><th className="py-1.5 text-left font-medium">Test</th><th className="py-1.5 text-left font-medium">Category</th><th className="py-1.5 text-left font-medium">Result</th><th className="py-1.5 text-left font-medium">Reference</th><th className="py-1.5 text-center font-medium">Flag</th><th className="py-1.5 text-left font-medium">Status</th></tr></thead>
                      <tbody>{o.tests.map((t,j)=>(
                        <tr key={j} className="border-b last:border-0">
                          <td className="py-2 font-medium">{t.name}</td>
                          <td className="py-2 text-muted-foreground">{t.category}</td>
                          <td className="py-2">{t.result??"—"}</td>
                          <td className="py-2 text-muted-foreground">{t.reference??"—"}</td>
                          <td className="py-2 text-center">
                            {t.flag==="H"&&<span className="rounded px-1.5 py-0.5 text-[10px] font-bold bg-red-100 text-red-700">H</span>}
                            {t.flag==="L"&&<span className="rounded px-1.5 py-0.5 text-[10px] font-bold bg-blue-100 text-blue-700">L</span>}
                            {t.flag==="N"&&<span className="text-green-600 text-[10px]">✓</span>}
                          </td>
                          <td className="py-2"><span className={cn("rounded-full px-2 py-0.5 text-[11px]",LSC[t.status].cls)}>{LSC[t.status].label}</span></td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}