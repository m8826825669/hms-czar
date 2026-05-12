"use client";
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Plus, AlertTriangle, Flame, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";
function hdrs(){ const t=useAuthStore.getState().token; return {"Content-Type":"application/json",...(t?{Authorization:`Bearer ${t}`}:{})}; }
async function get<T>(p:string):Promise<T>{ const r=await fetch(`${BASE}${p}`,{headers:hdrs(),cache:"no-store"}); if(!r.ok)throw new Error(`${r.status}`); const j=await r.json(); return (j?.results??j) as T; }

type GasType = "Oxygen"|"Nitrous Oxide"|"CO2"|"Entonox"|"Medical Air"|"Nitrogen";
type CylStatus = "full"|"in_use"|"empty"|"under_refill";
interface CylinderStock { id:number; gas_type:GasType; size:string; full:number; in_use:number; empty:number; under_refill:number; min_full:number; location:string; }
interface GasRequest { id:number; req_no:string; ward:string; gas_type:GasType; cylinders:number; size:string; purpose:string; requested_by:string; requested_at:string; fulfilled_at:string|null; status:"pending"|"fulfilled"|"partial"; }
interface GasStats { oxygen_full:number; oxygen_critical:boolean; total_cylinders:number; requests_today:number; fulfilled_today:number; pending_requests:number; }

const STATS:GasStats={oxygen_full:48,oxygen_critical:false,total_cylinders:186,requests_today:22,fulfilled_today:18,pending_requests:4};
const STOCK:CylinderStock[]=[
  {id:1,gas_type:"Oxygen",       size:"B-Type (46L)", full:48,in_use:32,empty:12,under_refill:8,  min_full:20,location:"Gas Bank A"},
  {id:2,gas_type:"Oxygen",       size:"D-Type (6.8L)",full:24,in_use:18,empty:6, under_refill:4,  min_full:10,location:"Ward Store"},
  {id:3,gas_type:"Nitrous Oxide",size:"B-Type (46L)", full:12,in_use:4, empty:2, under_refill:0,  min_full:5, location:"OT Store"},
  {id:4,gas_type:"CO2",          size:"E-Type (9L)",  full:8, in_use:2, empty:1, under_refill:0,  min_full:3, location:"Endoscopy"},
  {id:5,gas_type:"Entonox",      size:"CD-Type(23L)", full:6, in_use:2, empty:1, under_refill:2,  min_full:4, location:"Labour Room"},
  {id:6,gas_type:"Medical Air",  size:"G-Type (68L)", full:4, in_use:3, empty:2, under_refill:1,  min_full:4, location:"ICU"},
  {id:7,gas_type:"Nitrogen",     size:"G-Type (68L)", full:3, in_use:1, empty:0, under_refill:0,  min_full:2, location:"OT Store"},
];
const REQUESTS:GasRequest[]=[
  {id:1,req_no:"GAS/0512/001",ward:"ICU",          gas_type:"Oxygen",        cylinders:4,size:"B-Type",purpose:"Patient support",        requested_by:"Sr. Seema",  requested_at:"08:00",fulfilled_at:"08:20",status:"fulfilled"},
  {id:2,req_no:"GAS/0512/003",ward:"OT-2",         gas_type:"Nitrous Oxide", cylinders:2,size:"B-Type",purpose:"Anaesthesia",             requested_by:"Dr. Roy",    requested_at:"09:00",fulfilled_at:"09:10",status:"fulfilled"},
  {id:3,req_no:"GAS/0512/007",ward:"Labour Room",  gas_type:"Entonox",       cylinders:1,size:"CD-Type",purpose:"Labour analgesia",       requested_by:"Sr. Divya",  requested_at:"11:30",fulfilled_at:"11:45",status:"fulfilled"},
  {id:4,req_no:"GAS/0512/011",ward:"General Ward A",gas_type:"Oxygen",       cylinders:3,size:"D-Type",purpose:"Patients on O2 support",  requested_by:"Sr. Anita",  requested_at:"13:00",fulfilled_at:null,   status:"pending"},
  {id:5,req_no:"GAS/0512/013",ward:"Surgical Ward",gas_type:"Oxygen",        cylinders:2,size:"B-Type",purpose:"Post-op patient",         requested_by:"Sr. Pooja",  requested_at:"13:45",fulfilled_at:null,   status:"pending"},
  {id:6,req_no:"GAS/0512/015",ward:"Endoscopy",    gas_type:"CO2",           cylinders:1,size:"E-Type",purpose:"Insufflation",            requested_by:"Dr. Nair",   requested_at:"14:00",fulfilled_at:null,   status:"pending"},
  {id:7,req_no:"GAS/0512/017",ward:"ICU",          gas_type:"Medical Air",   cylinders:1,size:"G-Type",purpose:"Ventilator drive gas",    requested_by:"Sr. Seema",  requested_at:"14:30",fulfilled_at:null,   status:"pending"},
];
const GAS_COLORS:Record<GasType,string>={
  "Oxygen":"bg-blue-100 text-blue-700","Nitrous Oxide":"bg-purple-100 text-purple-700","CO2":"bg-slate-100 text-slate-600",
  "Entonox":"bg-teal-100 text-teal-700","Medical Air":"bg-cyan-100 text-cyan-700","Nitrogen":"bg-amber-100 text-amber-700",
};
const RSC:{pending:{label:string;cls:string};fulfilled:{label:string;cls:string};partial:{label:string;cls:string}}={
  pending:  {label:"Pending",   cls:"bg-amber-100 text-amber-700"},
  fulfilled:{label:"Fulfilled", cls:"bg-green-100 text-green-700"},
  partial:  {label:"Partial",   cls:"bg-blue-100 text-blue-700"},
};

export default function GasCylinderPage(){
  const [requests,setRequests]=useState<GasRequest[]>(REQUESTS);
  const [tab,setTab]=useState<"stock"|"requests">("stock");
  const [error,setError]=useState<string|null>(null);

  const fetchData=useCallback(async()=>{
    try{const[r]=await Promise.allSettled([get<GasRequest[]>("/gas-cylinder/requests/today/")]);if(r.status==="fulfilled"&&(r.value as GasRequest[]).length>0)setRequests(r.value as GasRequest[]);setError(null);}
    catch{setError("Showing demo data.");}
  },[]);
  useEffect(()=>{fetchData();},[fetchData]);

  const fulfill=(id:number)=>setRequests(p=>p.map(r=>r.id===id?{...r,status:"fulfilled",fulfilled_at:new Date().toTimeString().slice(0,5)}:r));

  const criticalStock=STOCK.filter(s=>s.full<s.min_full);

  return(
    <div className="space-y-5 pb-8">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div><h2 className="text-2xl font-bold">Gas & Cylinders</h2><p className="text-sm text-muted-foreground">Medical gas inventory, cylinder tracking, and ward requests</p></div>
        <div className="flex gap-2">
          <button onClick={fetchData} className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"><RefreshCw className="h-3.5 w-3.5"/>Refresh</button>
          <Button className="gap-2"><Plus className="h-4 w-4"/>New Request</Button>
        </div>
      </div>
      {error&&<div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 text-sm text-amber-800"><AlertTriangle className="h-4 w-4 shrink-0"/>Showing demo data.</div>}

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[{label:"O₂ Full (B-Type)",value:STATS.oxygen_full,color:"border-l-blue-500"},{label:"Total Cylinders",value:STATS.total_cylinders,color:"border-l-teal-500"},{label:"Requests Today",value:STATS.requests_today,color:"border-l-purple-500"},{label:"Fulfilled",value:STATS.fulfilled_today,color:"border-l-green-500"},{label:"Pending",value:STATS.pending_requests,color:"border-l-amber-500"},{label:"Critical Stock",value:criticalStock.length,color:"border-l-red-500"}].map(s=>(
          <div key={s.label} className={cn("rounded-xl border bg-background px-4 py-3 border-l-[3px]",s.color)}><p className="text-2xl font-bold">{s.value}</p><p className="text-xs text-muted-foreground mt-0.5">{s.label}</p></div>
        ))}
      </div>

      {criticalStock.length>0&&(
        <div className="rounded-lg bg-red-50 border border-red-200 p-4">
          <p className="text-sm font-semibold text-red-700 flex items-center gap-2 mb-2"><TrendingDown className="h-4 w-4"/>Low cylinder stock — reorder needed</p>
          <div className="flex flex-wrap gap-2">{criticalStock.map(s=><span key={s.id} className={cn("rounded-full px-2.5 py-1 text-[12px] font-medium",GAS_COLORS[s.gas_type])}>{s.gas_type} {s.size}: {s.full} full (min {s.min_full})</span>)}</div>
        </div>
      )}

      <div className="flex items-center gap-4 border-b">
        {([["stock","Stock Overview"],["requests","Ward Requests"]] as const).map(([v,l])=>(
          <button key={v} onClick={()=>setTab(v)} className={cn("py-2.5 px-1 text-sm font-medium border-b-2 -mb-px transition-colors",tab===v?"border-primary text-primary":"border-transparent text-muted-foreground hover:text-foreground")}>{l}</button>
        ))}
      </div>

      {tab==="stock"?(
        <Card><CardContent className="p-0"><div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-[11px] text-muted-foreground">
              <th className="px-4 py-3 text-left font-medium">Gas Type</th>
              <th className="px-3 py-3 text-left font-medium">Size</th>
              <th className="px-3 py-3 text-right font-medium">Full</th>
              <th className="px-3 py-3 text-right font-medium">In Use</th>
              <th className="px-3 py-3 text-right font-medium">Empty</th>
              <th className="px-3 py-3 text-right font-medium">Refilling</th>
              <th className="px-3 py-3 text-right font-medium">Min Full</th>
              <th className="px-3 py-3 text-left font-medium">Location</th>
            </tr></thead>
            <tbody>{STOCK.map(s=>{const isLow=s.full<s.min_full;return(
              <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="px-4 py-3"><span className={cn("rounded-full px-2 py-0.5 text-[12px] font-medium",GAS_COLORS[s.gas_type])}>{s.gas_type}</span></td>
                <td className="px-3 py-3 text-[12px] text-muted-foreground">{s.size}</td>
                <td className={cn("px-3 py-3 text-right font-bold",isLow?"text-red-600":"text-green-600")}>{s.full}</td>
                <td className="px-3 py-3 text-right text-amber-600 font-semibold">{s.in_use}</td>
                <td className="px-3 py-3 text-right text-muted-foreground">{s.empty}</td>
                <td className="px-3 py-3 text-right text-blue-600">{s.under_refill}</td>
                <td className="px-3 py-3 text-right text-muted-foreground">{s.min_full}</td>
                <td className="px-3 py-3 text-[12px] text-muted-foreground">{s.location}</td>
              </tr>
            );})}
            </tbody>
          </table>
        </div></CardContent></Card>
      ):(
        <div className="space-y-2">
          {requests.map(r=>{const sc=RSC[r.status];const gc=GAS_COLORS[r.gas_type];return(
            <Card key={r.id} className="overflow-hidden">
              <CardContent className="p-4 flex items-center gap-4">
                <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",gc.split(" ")[0])}><Flame className={cn("h-5 w-5",gc.split(" ")[1])}/></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold">{r.ward}</p>
                    <span className="font-mono text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{r.req_no}</span>
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium",gc)}>{r.gas_type}</span>
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium",sc.cls)}>{sc.label}</span>
                  </div>
                  <div className="flex flex-wrap gap-3 mt-1 text-[12px] text-muted-foreground">
                    <span className="font-medium text-foreground">{r.cylinders} cyl ({r.size})</span>
                    <span>· {r.purpose}</span><span>· {r.requested_by}</span><span>· {r.requested_at}</span>
                    {r.fulfilled_at&&<span className="text-green-600">· Fulfilled {r.fulfilled_at}</span>}
                  </div>
                </div>
                {r.status==="pending"&&<button onClick={()=>fulfill(r.id)} className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground font-medium hover:bg-primary/90 shrink-0">Fulfill</button>}
              </CardContent>
            </Card>
          );})}
        </div>
      )}
    </div>
  );
}