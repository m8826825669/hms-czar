"use client";
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Plus, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";
function hdrs(){ const t=useAuthStore.getState().token; return {"Content-Type":"application/json",...(t?{Authorization:`Bearer ${t}`}:{})}; }
async function get<T>(p:string):Promise<T>{ const r=await fetch(`${BASE}${p}`,{headers:hdrs(),cache:"no-store"}); if(!r.ok)throw new Error(`${r.status}`); const j=await r.json(); return (j?.results??j) as T; }

type LaundryStatus = "collected"|"washing"|"drying"|"folded"|"delivered"|"pending_collection";
interface LaundryRequest { id:number; req_no:string; ward:string; category:string; items:{name:string;qty:number;}[]; total_pieces:number; collected_at:string|null; expected_delivery:string; delivered_at:string|null; status:LaundryStatus; collected_by:string; notes:string; }
interface LaundryStats { requests_today:number; delivered:number; in_process:number; pending_collection:number; total_pieces:number; }

const STATS:LaundryStats={requests_today:28,delivered:19,in_process:6,pending_collection:3,total_pieces:412};
const REQUESTS:LaundryRequest[]=[
  {id:1, req_no:"LDY/0512/001",ward:"General Ward A", category:"Bed Linen",   items:[{name:"Bed Sheets",qty:20},{name:"Pillow Covers",qty:20},{name:"Blankets",qty:5}], total_pieces:45, collected_at:"07:30",expected_delivery:"13:00",delivered_at:"12:55",status:"delivered",         collected_by:"Ravi Kumar",  notes:""},
  {id:2, req_no:"LDY/0512/002",ward:"ICU",            category:"OT Linen",    items:[{name:"OT Gowns",qty:12},{name:"Draping Sheets",qty:8},{name:"Towels",qty:10}],   total_pieces:30, collected_at:"07:45",expected_delivery:"12:00",delivered_at:"11:50",status:"delivered",         collected_by:"Seema Devi",  notes:"Sterilised separately"},
  {id:3, req_no:"LDY/0512/003",ward:"Maternity",      category:"Bed Linen",   items:[{name:"Bed Sheets",qty:15},{name:"Baby Wraps",qty:10},{name:"Towels",qty:8}],     total_pieces:33, collected_at:"08:00",expected_delivery:"14:00",delivered_at:null,    status:"folded",            collected_by:"Ravi Kumar",  notes:""},
  {id:4, req_no:"LDY/0512/004",ward:"Surgical Ward",  category:"Staff Uniform",items:[{name:"Scrubs (Top)",qty:12},{name:"Scrubs (Bottom)",qty:12},{name:"Caps",qty:12}],total_pieces:36,collected_at:"08:15",expected_delivery:"14:00",delivered_at:null,    status:"drying",            collected_by:"Seema Devi",  notes:""},
  {id:5, req_no:"LDY/0512/005",ward:"OPD",            category:"Patient Gown",items:[{name:"Patient Gowns",qty:25}],                                                    total_pieces:25, collected_at:"09:00",expected_delivery:"15:00",delivered_at:null,    status:"washing",           collected_by:"Ravi Kumar",  notes:""},
  {id:6, req_no:"LDY/0512/006",ward:"Paediatrics",    category:"Bed Linen",   items:[{name:"Bed Sheets",qty:12},{name:"Baby Cot Sheets",qty:8}],                       total_pieces:20, collected_at:"09:30",expected_delivery:"15:30",delivered_at:null,    status:"washing",           collected_by:"Seema Devi",  notes:""},
  {id:7, req_no:"LDY/0512/007",ward:"General Ward B", category:"Bed Linen",   items:[{name:"Bed Sheets",qty:18},{name:"Pillow Covers",qty:18}],                        total_pieces:36, collected_at:null,    expected_delivery:"16:00",delivered_at:null,    status:"pending_collection",collected_by:"—",          notes:""},
  {id:8, req_no:"LDY/0512/008",ward:"Emergency",      category:"Assorted",    items:[{name:"OT Gowns",qty:6},{name:"Bed Sheets",qty:10},{name:"Towels",qty:8}],        total_pieces:24, collected_at:null,    expected_delivery:"16:00",delivered_at:null,    status:"pending_collection",collected_by:"—",          notes:"Urgent"},
];
const SC:Record<LaundryStatus,{label:string;cls:string;step:number}>={
  pending_collection:{label:"Pending Pickup",cls:"bg-slate-100 text-slate-600",step:0},
  collected:         {label:"Collected",     cls:"bg-blue-100 text-blue-700",  step:1},
  washing:           {label:"Washing",       cls:"bg-cyan-100 text-cyan-700",  step:2},
  drying:            {label:"Drying",        cls:"bg-amber-100 text-amber-700",step:3},
  folded:            {label:"Folded",        cls:"bg-purple-100 text-purple-700",step:4},
  delivered:         {label:"Delivered",     cls:"bg-green-100 text-green-700",step:5},
};
const STEPS:LaundryStatus[]=["collected","washing","drying","folded","delivered"];

export default function LaundryPage(){
  const [requests,setRequests]=useState<LaundryRequest[]>(REQUESTS);
  const [filter,setFilter]=useState<"all"|LaundryStatus>("all");
  const [error,setError]=useState<string|null>(null);

  const fetchData=useCallback(async()=>{
    try{const[r]=await Promise.allSettled([get<LaundryRequest[]>("/laundry/requests/today/")]);if(r.status==="fulfilled"&&(r.value as LaundryRequest[]).length>0)setRequests(r.value as LaundryRequest[]);setError(null);}
    catch{setError("Showing demo data.");}
  },[]);
  useEffect(()=>{fetchData();},[fetchData]);

  const advance=(id:number)=>setRequests(p=>p.map(r=>{
    if(r.id!==id)return r;
    const steps:LaundryStatus[]=["pending_collection","collected","washing","drying","folded","delivered"];
    const idx=steps.indexOf(r.status);
    const next=steps[Math.min(idx+1,steps.length-1)] as LaundryStatus;
    return{...r,status:next,...(next==="delivered"?{delivered_at:new Date().toTimeString().slice(0,5)}:{})};
  }));

  const displayed=requests.filter(r=>filter==="all"||r.status===filter);

  return(
    <div className="space-y-5 pb-8">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div><h2 className="text-2xl font-bold">Laundry Services</h2><p className="text-sm text-muted-foreground">Linen management, washing, and delivery tracking</p></div>
        <div className="flex gap-2">
          <button onClick={fetchData} className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"><RefreshCw className="h-3.5 w-3.5"/>Refresh</button>
          <Button className="gap-2"><Plus className="h-4 w-4"/>New Request</Button>
        </div>
      </div>
      {error&&<div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 text-sm text-amber-800"><AlertTriangle className="h-4 w-4 shrink-0"/>Showing demo data.</div>}

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {[{label:"Requests Today",value:STATS.requests_today,color:"border-l-blue-500"},{label:"Delivered",value:STATS.delivered,color:"border-l-green-500"},{label:"In Process",value:STATS.in_process,color:"border-l-amber-500"},{label:"Pending Pickup",value:STATS.pending_collection,color:"border-l-red-500"},{label:"Total Pieces",value:STATS.total_pieces,color:"border-l-teal-500"}].map(s=>(
          <div key={s.label} className={cn("rounded-xl border bg-background px-4 py-3 border-l-[3px]",s.color)}><p className="text-2xl font-bold">{s.value}</p><p className="text-xs text-muted-foreground mt-0.5">{s.label}</p></div>
        ))}
      </div>

      <div className="flex rounded-md border overflow-hidden w-fit text-xs">
        {(["all","pending_collection","washing","folded","delivered"] as const).map(v=>(
          <button key={v} onClick={()=>setFilter(v)} className={cn("px-3 py-2 font-medium transition-colors",filter===v?"bg-primary text-primary-foreground":"bg-background text-muted-foreground hover:bg-muted")}>
            {v==="all"?"All":v==="pending_collection"?"Pickup":v.charAt(0).toUpperCase()+v.slice(1)} ({v==="all"?requests.length:requests.filter(r=>r.status===v).length})
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {displayed.map(r=>{const sc=SC[r.status];const step=sc.step;return(
          <Card key={r.id} className="overflow-hidden">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap mb-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold">{r.ward}</p>
                    <span className="font-mono text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{r.req_no}</span>
                    <span className="rounded-full px-2 py-0.5 text-[11px] font-medium bg-blue-100 text-blue-700">{r.category}</span>
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium",sc.cls)}>{sc.label}</span>
                  </div>
                  <div className="flex flex-wrap gap-3 mt-1.5 text-[12px] text-muted-foreground">
                    <span><span className="font-medium text-foreground">{r.total_pieces}</span> pieces total</span>
                    {r.collected_at&&<span>Collected: {r.collected_at}</span>}
                    <span>Expected: {r.expected_delivery}</span>
                    {r.delivered_at&&<span className="text-green-600">Delivered: {r.delivered_at}</span>}
                    {r.notes&&<span className="text-amber-600">· {r.notes}</span>}
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {r.items.map((item,i)=><span key={i} className="rounded border bg-muted/30 px-2 py-0.5 text-[11px]">{item.name} ×{item.qty}</span>)}
                  </div>
                </div>
                {r.status!=="delivered"&&(
                  <button onClick={()=>advance(r.id)} className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground font-medium hover:bg-primary/90 shrink-0">
                    {r.status==="pending_collection"?"Mark Collected":r.status==="collected"?"Start Washing":r.status==="washing"?"Mark Drying":r.status==="drying"?"Mark Folded":"Mark Delivered"}
                  </button>
                )}
              </div>
              {/* Progress tracker */}
              <div className="flex items-center gap-0 mt-2">
                {STEPS.map((s,i)=>{const active=SC[s].step<=step&&step>0;const done=SC[s].step<step;return(
                  <div key={s} className="flex items-center flex-1">
                    <div className={cn("flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold shrink-0",done||active?"bg-primary text-primary-foreground":"bg-muted text-muted-foreground")}>{i+1}</div>
                    <div className="text-[10px] text-muted-foreground ml-1 hidden sm:block">{SC[s].label}</div>
                    {i<STEPS.length-1&&<div className={cn("flex-1 h-0.5 mx-1",done?"bg-primary":"bg-muted")}/>}
                  </div>
                );})}
              </div>
            </CardContent>
          </Card>
        );})}
      </div>
    </div>
  );
}