"use client";
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RefreshCw, Plus, AlertTriangle, MapPin, Phone, Clock, ChevronDown, ChevronUp, Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";
function hdrs(){ const t=useAuthStore.getState().token; return {"Content-Type":"application/json",...(t?{Authorization:`Bearer ${t}`}:{})}; }
async function get<T>(p:string):Promise<T>{ const r=await fetch(`${BASE}${p}`,{headers:hdrs(),cache:"no-store"}); if(!r.ok)throw new Error(`${r.status}`); const j=await r.json(); return (j?.results??j) as T; }

type AmbStatus = "available"|"dispatched"|"on_scene"|"transporting"|"returning"|"maintenance";
type CallStatus = "pending"|"dispatched"|"completed"|"cancelled";

interface Ambulance { id:number; reg_no:string; type:"BLS"|"ALS"|"Patient Transport"; driver:string; paramedic:string; phone:string; status:AmbStatus; location:string; last_service:string; }
interface AmbCall { id:number; call_no:string; caller_name:string; caller_phone:string; pickup_address:string; destination:string; patient_name:string; condition:string; ambulance_no:string; driver:string; dispatched_at:string|null; reached_at:string|null; completed_at:string|null; status:CallStatus; priority:"emergency"|"urgent"|"routine"; distance_km:number; }
interface AmbStats { total_vehicles:number; available:number; dispatched:number; calls_today:number; completed_today:number; avg_response_min:number; }

const STATS:AmbStats={total_vehicles:5,available:3,dispatched:2,calls_today:14,completed_today:11,avg_response_min:8};
const VEHICLES:Ambulance[]=[
  {id:1,reg_no:"HR-01-AB-1234",type:"ALS",driver:"Ramesh Yadav",   paramedic:"EMT Suresh",  phone:"9811111111",status:"dispatched",  location:"MG Road, Gurugram",   last_service:"2026-04-20"},
  {id:2,reg_no:"HR-01-AB-1235",type:"ALS",driver:"Dinesh Kumar",   paramedic:"EMT Priya",   phone:"9822222222",status:"transporting",location:"NH-48, Delhi Border",  last_service:"2026-05-01"},
  {id:3,reg_no:"HR-01-AB-1236",type:"BLS",driver:"Mahesh Singh",   paramedic:"EMT Rajan",   phone:"9833333333",status:"available",   location:"Hospital Base",        last_service:"2026-05-10"},
  {id:4,reg_no:"HR-01-AB-1237",type:"BLS",driver:"Vikas Gupta",    paramedic:"EMT Kavita",  phone:"9844444444",status:"available",   location:"Hospital Base",        last_service:"2026-04-28"},
  {id:5,reg_no:"HR-01-AB-1238",type:"Patient Transport",driver:"Ajay Sharma",paramedic:"—",phone:"9855555555",status:"available",   location:"Hospital Base",        last_service:"2026-05-05"},
];
const CALLS:AmbCall[]=[
  {id:1,call_no:"AMB/0512/001",caller_name:"Ritu Sharma",   caller_phone:"9876543210",pickup_address:"Sector 14, Gurugram",     destination:"City General Hospital",patient_name:"Mohan Sharma",  condition:"Chest pain, SOB",        ambulance_no:"HR-01-AB-1234",driver:"Ramesh Yadav", dispatched_at:"08:12",reached_at:"08:22",completed_at:"08:58",status:"completed", priority:"emergency",distance_km:6.2},
  {id:2,call_no:"AMB/0512/004",caller_name:"Suresh Nair",   caller_phone:"9812345678",pickup_address:"DLF Phase 2, Gurugram",  destination:"City General Hospital",patient_name:"Priya Nair",    condition:"RTA — head injury",       ambulance_no:"HR-01-AB-1235",driver:"Dinesh Kumar",dispatched_at:"11:45",reached_at:"11:58",completed_at:null,       status:"dispatched",priority:"emergency",distance_km:8.4},
  {id:3,call_no:"AMB/0512/007",caller_name:"Geeta Verma",   caller_phone:"9834567890",pickup_address:"Old Gurugram Bus Stand",destination:"City General Hospital",patient_name:"Ramesh Verma",  condition:"Unconscious, diabetic",   ambulance_no:"HR-01-AB-1234",driver:"Ramesh Yadav", dispatched_at:"13:20",reached_at:null,        completed_at:null,       status:"dispatched",priority:"emergency",distance_km:4.1},
  {id:4,call_no:"AMB/0512/009",caller_name:"Dr. Roy (ICU)", caller_phone:"9899999999",pickup_address:"City General Hospital",  destination:"AIIMS Delhi (Referral)",patient_name:"Hamid Khan",   condition:"Post-MI, critical transfer",ambulance_no:"HR-01-AB-1235",driver:"Dinesh Kumar",dispatched_at:"14:00",reached_at:"14:00",completed_at:null,       status:"dispatched",priority:"emergency",distance_km:32},
  {id:5,call_no:"AMB/0512/011",caller_name:"Anjali Mishra", caller_phone:"9867890123",pickup_address:"Sushant Lok, Gurugram", destination:"City General Hospital",patient_name:"Sunita Mishra", condition:"Labour pains, 36 weeks",  ambulance_no:"—",            driver:"Pending",     dispatched_at:null,   reached_at:null,        completed_at:null,       status:"pending",   priority:"urgent",  distance_km:5.8},
];

const ASC:Record<AmbStatus,{label:string;cls:string;dot:string}>={
  available:   {label:"Available",   cls:"bg-green-100 text-green-700", dot:"bg-green-500"},
  dispatched:  {label:"Dispatched",  cls:"bg-blue-100 text-blue-700",   dot:"bg-blue-500"},
  on_scene:    {label:"On Scene",    cls:"bg-purple-100 text-purple-700",dot:"bg-purple-500"},
  transporting:{label:"Transporting",cls:"bg-amber-100 text-amber-700", dot:"bg-amber-500"},
  returning:   {label:"Returning",   cls:"bg-teal-100 text-teal-700",   dot:"bg-teal-500"},
  maintenance: {label:"Maintenance", cls:"bg-red-100 text-red-700",     dot:"bg-red-500"},
};
const CSC:Record<CallStatus,{label:string;cls:string}>={
  pending:   {label:"Pending",   cls:"bg-amber-100 text-amber-700"},
  dispatched:{label:"Dispatched",cls:"bg-blue-100 text-blue-700"},
  completed: {label:"Completed", cls:"bg-green-100 text-green-700"},
  cancelled: {label:"Cancelled", cls:"bg-red-100 text-red-700"},
};
const PRI={emergency:{cls:"bg-red-100 text-red-700 font-bold"},urgent:{cls:"bg-amber-100 text-amber-700"},routine:{cls:"bg-slate-100 text-slate-600"}};

export default function AmbulancePage(){
  const [calls,setCalls]=useState<AmbCall[]>(CALLS);
  const [vehicles]=useState<Ambulance[]>(VEHICLES);
  const [tab,setTab]=useState<"calls"|"fleet">("calls");
  const [expanded,setExpanded]=useState<number|null>(null);
  const [error,setError]=useState<string|null>(null);

  const fetchData=useCallback(async()=>{
    try{const[c]=await Promise.allSettled([get<AmbCall[]>("/ambulance/calls/today/")]);if(c.status==="fulfilled"&&(c.value as AmbCall[]).length>0)setCalls(c.value as AmbCall[]);setError(null);}
    catch{setError("Showing demo data.");}
  },[]);
  useEffect(()=>{fetchData();},[fetchData]);

  const dispatch=(id:number)=>setCalls(p=>p.map(c=>c.id===id?{...c,status:"dispatched",dispatched_at:new Date().toTimeString().slice(0,5)}:c));

  return(
    <div className="space-y-5 pb-8">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div><h2 className="text-2xl font-bold">Ambulance Services</h2><p className="text-sm text-muted-foreground">Fleet management, dispatch, and call tracking</p></div>
        <div className="flex gap-2">
          <button onClick={fetchData} className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"><RefreshCw className="h-3.5 w-3.5"/>Refresh</button>
          <Button className="gap-2"><Plus className="h-4 w-4"/>Log Call</Button>
        </div>
      </div>
      {error&&<div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 text-sm text-amber-800"><AlertTriangle className="h-4 w-4 shrink-0"/>Showing demo data.</div>}

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[{label:"Total Vehicles",value:STATS.total_vehicles,color:"border-l-blue-500"},{label:"Available",value:STATS.available,color:"border-l-green-500"},{label:"Dispatched",value:STATS.dispatched,color:"border-l-amber-500"},{label:"Calls Today",value:STATS.calls_today,color:"border-l-purple-500"},{label:"Completed",value:STATS.completed_today,color:"border-l-teal-500"},{label:"Avg Response (min)",value:STATS.avg_response_min,color:"border-l-red-500"}].map(s=>(
          <div key={s.label} className={cn("rounded-xl border bg-background px-4 py-3 border-l-[3px]",s.color)}><p className="text-2xl font-bold">{s.value}</p><p className="text-xs text-muted-foreground mt-0.5">{s.label}</p></div>
        ))}
      </div>

      <div className="flex items-center gap-4 border-b">
        {([["calls","Today's Calls"],["fleet","Fleet Status"]] as const).map(([v,l])=>(
          <button key={v} onClick={()=>setTab(v)} className={cn("py-2.5 px-1 text-sm font-medium border-b-2 -mb-px transition-colors",tab===v?"border-primary text-primary":"border-transparent text-muted-foreground hover:text-foreground")}>{l}</button>
        ))}
      </div>

      {tab==="calls"?(
        <div className="space-y-2">
          {calls.map((c)=>{const exp=expanded===c.id;const sc=CSC[c.status];const pc=PRI[c.priority];return(
            <Card key={c.id} className="overflow-hidden">
              <CardContent className="p-0">
                <div className="flex items-center gap-4 p-4 cursor-pointer hover:bg-muted/20" onClick={()=>setExpanded(exp?null:c.id)}>
                  <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",c.priority==="emergency"?"bg-red-100":"bg-amber-100")}>
                    <Radio className={cn("h-5 w-5",c.priority==="emergency"?"text-red-600":"text-amber-600")}/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-[14px]">{c.patient_name}</p>
                      <span className="font-mono text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{c.call_no}</span>
                      <span className={cn("rounded-full px-2 py-0.5 text-[11px]",sc.cls)}>{sc.label}</span>
                      <span className={cn("rounded-full px-2 py-0.5 text-[11px] uppercase tracking-wide",pc.cls)}>{c.priority}</span>
                    </div>
                    <div className="flex flex-wrap gap-3 mt-1 text-[12px] text-muted-foreground">
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3"/>{c.pickup_address}</span>
                      <span>→ {c.destination}</span>
                      <span className="font-medium text-foreground">· {c.condition}</span>
                    </div>
                    <div className="flex flex-wrap gap-3 mt-1 text-[12px] text-muted-foreground">
                      <span>{c.ambulance_no!=="—"?c.ambulance_no:"No vehicle assigned"}</span>
                      {c.dispatched_at&&<span>· Dispatched {c.dispatched_at}</span>}
                      {c.reached_at&&<span>· Reached {c.reached_at}</span>}
                      {c.completed_at&&<span>· Done {c.completed_at}</span>}
                      <span>· {c.distance_km} km</span>
                    </div>
                  </div>
                  <div className="shrink-0">
                    {c.status==="pending"&&<button onClick={e=>{e.stopPropagation();dispatch(c.id);}} className="flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-[11px] font-medium text-primary-foreground hover:bg-primary/90">Dispatch</button>}
                  </div>
                  {exp?<ChevronUp className="h-4 w-4 text-muted-foreground shrink-0"/>:<ChevronDown className="h-4 w-4 text-muted-foreground shrink-0"/>}
                </div>
                {exp&&(
                  <div className="border-t bg-muted/20 p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-[12px]">
                    <div><p className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wide mb-1">Caller</p><p>{c.caller_name} · {c.caller_phone}</p></div>
                    <div><p className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wide mb-1">Driver</p><p>{c.driver}</p></div>
                    <div><p className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wide mb-1">Condition</p><p>{c.condition}</p></div>
                    <div><p className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wide mb-1">Distance</p><p>{c.distance_km} km</p></div>
                  </div>
                )}
              </CardContent>
            </Card>
          );})}
        </div>
      ):(
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {vehicles.map(v=>{const sc=ASC[v.status];return(
            <Card key={v.id} className={cn("overflow-hidden",v.status==="available"&&"border-green-200")}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div><p className="font-bold text-base">{v.reg_no}</p><p className="text-xs text-muted-foreground">{v.type}</p></div>
                  <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium",sc.cls)}>
                    <span className={cn("h-1.5 w-1.5 rounded-full",sc.dot)}/>{sc.label}
                  </span>
                </div>
                <div className="space-y-1.5 text-[12px] text-muted-foreground">
                  <p className="flex items-center gap-1.5"><span className="font-medium text-foreground">Driver:</span>{v.driver}</p>
                  <p className="flex items-center gap-1.5"><span className="font-medium text-foreground">Paramedic:</span>{v.paramedic}</p>
                  <p className="flex items-center gap-1"><Phone className="h-3 w-3"/>{v.phone}</p>
                  <p className="flex items-center gap-1"><MapPin className="h-3 w-3"/>{v.location}</p>
                  <p>Last service: {v.last_service}</p>
                </div>
              </CardContent>
            </Card>
          );})}
        </div>
      )}
    </div>
  );
}