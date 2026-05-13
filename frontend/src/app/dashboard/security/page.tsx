"use client";
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, RefreshCw, Plus, AlertTriangle, Shield, ChevronDown, ChevronUp, CheckCircle2, XCircle, Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";
function hdrs(){ const t=useAuthStore.getState().token; return {"Content-Type":"application/json",...(t?{Authorization:`Bearer ${t}`}:{})}; }
async function get<T>(p:string):Promise<T>{ const r=await fetch(`${BASE}${p}`,{headers:hdrs(),cache:"no-store"}); if(!r.ok)throw new Error(`${r.status}`); const j=await r.json(); return (j?.results??j) as T; }

type IncidentLevel = "low"|"medium"|"high"|"critical";
type IncidentStatus = "open"|"investigating"|"resolved"|"closed";
type GuardStatus = "on_duty"|"off_duty"|"break";

interface SecurityGuard { id:number; name:string; badge_no:string; post:string; shift:string; status:GuardStatus; phone:string; in_time:string; }
interface VisitorLog { id:number; pass_no:string; visitor_name:string; phone:string; purpose:string; patient_mrn:string|null; patient_name:string|null; ward:string|null; badge_issued:string; checked_in:string; checked_out:string|null; status:"inside"|"exited"|"overstay"; }
interface Incident { id:number; inc_no:string; title:string; location:string; description:string; reported_by:string; reported_at:string; level:IncidentLevel; status:IncidentStatus; assigned_to:string; resolved_at:string|null; action_taken:string; }
interface SecurityStats { guards_on_duty:number; total_posts:number; visitors_inside:number; visitors_today:number; open_incidents:number; overstay_visitors:number; }

const STATS:SecurityStats={guards_on_duty:8,total_posts:10,visitors_inside:34,visitors_today:87,open_incidents:2,overstay_visitors:3};
const GUARDS:SecurityGuard[]=[
  {id:1,name:"Vikram Singh",     badge_no:"SEC-001",post:"Main Gate",            shift:"Morning (06:00–14:00)",status:"on_duty",  phone:"9811111111",in_time:"05:55"},
  {id:2,name:"Ajay Kumar",       badge_no:"SEC-002",post:"Emergency Entrance",   shift:"Morning (06:00–14:00)",status:"on_duty",  phone:"9822222222",in_time:"05:58"},
  {id:3,name:"Suresh Pal",       badge_no:"SEC-003",post:"ICU Floor",            shift:"Morning (08:00–16:00)",status:"on_duty",  phone:"9833333333",in_time:"07:52"},
  {id:4,name:"Ratan Lal",        badge_no:"SEC-004",post:"OT Block",             shift:"Morning (08:00–16:00)",status:"break",    phone:"9844444444",in_time:"08:00"},
  {id:5,name:"Deepak Negi",      badge_no:"SEC-005",post:"Pharmacy",             shift:"Morning (08:00–16:00)",status:"on_duty",  phone:"9855555555",in_time:"08:05"},
  {id:6,name:"Harish Rawat",     badge_no:"SEC-006",post:"Parking & Gate 2",     shift:"Morning (06:00–14:00)",status:"on_duty",  phone:"9866666666",in_time:"06:00"},
  {id:7,name:"Mohan Bisht",      badge_no:"SEC-007",post:"Maternity Block",      shift:"Night (22:00–06:00)",  status:"off_duty", phone:"9877777777",in_time:"—"},
  {id:8,name:"Ramesh Thapa",     badge_no:"SEC-008",post:"CCTV Control Room",    shift:"Morning (08:00–16:00)",status:"on_duty",  phone:"9888888888",in_time:"08:00"},
];
const VISITORS:VisitorLog[]=[
  {id:1,pass_no:"VP/0512/001",visitor_name:"Rekha Sharma",    phone:"9811234567",purpose:"Patient visit",  patient_mrn:"MRN-00801",patient_name:"Bharat Singh",  ward:"Ward A-12",badge_issued:"V-14",checked_in:"09:05",checked_out:null,      status:"inside"},
  {id:2,pass_no:"VP/0512/004",visitor_name:"Anand Verma",     phone:"9822345678",purpose:"Patient visit",  patient_mrn:"MRN-00692",patient_name:"Rohit Malhotra",ward:"Surgical C-04",badge_issued:"V-07",checked_in:"10:30",checked_out:null,   status:"inside"},
  {id:3,pass_no:"VP/0512/008",visitor_name:"Meera Patel",     phone:"9833456789",purpose:"Patient visit",  patient_mrn:"MRN-00478",patient_name:"Meena Sharma",  ward:"Ortho C-09",badge_issued:"V-22",checked_in:"11:00",checked_out:null,     status:"inside"},
  {id:4,pass_no:"VP/0512/011",visitor_name:"Delivery — Pharma",phone:"9800000001",purpose:"Vendor delivery",patient_mrn:null,     patient_name:null,             ward:null,        badge_issued:"T-03",checked_in:"11:30",checked_out:"12:15",   status:"exited"},
  {id:5,pass_no:"VP/0512/014",visitor_name:"Suresh Naik",     phone:"9844567890",purpose:"Patient visit",  patient_mrn:"MRN-00589",patient_name:"Hamid Khan",    ward:"ICU-5",     badge_issued:"V-31",checked_in:"09:00",checked_out:null,      status:"overstay"},
  {id:6,pass_no:"VP/0512/017",visitor_name:"Lata Deshpande",  phone:"9855678901",purpose:"Patient visit",  patient_mrn:"MRN-00712",patient_name:"Lata's relative",ward:"Surgical",badge_issued:"V-18",checked_in:"10:00",checked_out:null,      status:"overstay"},
  {id:7,pass_no:"VP/0512/021",visitor_name:"Amit Roy",        phone:"9866789012",purpose:"Vendor — IT",    patient_mrn:null,      patient_name:null,             ward:null,        badge_issued:"T-07",checked_in:"13:00",checked_out:null,      status:"inside"},
];
const INCIDENTS:Incident[]=[
  {id:1,inc_no:"INC/0512/001",title:"Visitor argument at reception",location:"Main Reception",description:"Two visitors got into a verbal argument over waiting time at OPD counter. Escalated briefly before security intervened.",reported_by:"Receptionist Priya",reported_at:"10:45",level:"medium",status:"resolved",assigned_to:"Vikram Singh",resolved_at:"11:00",action_taken:"Visitors counselled and separated. No physical altercation."},
  {id:2,inc_no:"INC/0512/002",title:"Unattended bag in corridor",location:"OPD Corridor A",description:"An unattended bag found near OPD waiting area. CCTV review initiated. Bag found to belong to a patient's attendant.",reported_by:"Guard Suresh Pal",reported_at:"12:15",level:"high",status:"resolved",assigned_to:"Ramesh Thapa",resolved_at:"12:40",action_taken:"Bag identified and returned. Owner counselled about leaving items unattended."},
  {id:3,inc_no:"INC/0512/003",title:"Unauthorised person in ICU",location:"ICU Floor",description:"Unidentified individual attempted to enter ICU without visitor pass. Was challenged and asked to leave. Claims to be patient's relative.",reported_by:"Guard Suresh Pal",reported_at:"13:30",level:"high",status:"investigating",assigned_to:"Suresh Pal",resolved_at:null,action_taken:"Person detained at security desk. Identity verification in progress."},
  {id:4,inc_no:"INC/0511/008",title:"Vehicle blocking emergency bay",location:"Emergency Entrance",description:"Private vehicle blocking the emergency ambulance bay for ~20 minutes.",reported_by:"Guard Ajay Kumar",reported_at:"2026-05-11 19:30",level:"medium",status:"closed",assigned_to:"Ajay Kumar",resolved_at:"2026-05-11 19:52",action_taken:"Vehicle owner traced and asked to move. Warning issued."},
];

const ISC:Record<IncidentLevel,{cls:string;dot:string}>={
  low:     {cls:"bg-slate-100 text-slate-600",   dot:"bg-slate-400"},
  medium:  {cls:"bg-amber-100 text-amber-700",   dot:"bg-amber-500"},
  high:    {cls:"bg-orange-100 text-orange-700", dot:"bg-orange-500"},
  critical:{cls:"bg-red-100 text-red-700",       dot:"bg-red-500"},
};
const ISTATUS:Record<IncidentStatus,{label:string;cls:string}>={
  open:        {label:"Open",        cls:"bg-red-100 text-red-700"},
  investigating:{label:"Investigating",cls:"bg-blue-100 text-blue-700"},
  resolved:    {label:"Resolved",    cls:"bg-green-100 text-green-700"},
  closed:      {label:"Closed",      cls:"bg-slate-100 text-slate-600"},
};
const GSC:Record<GuardStatus,{label:string;cls:string;dot:string}>={
  on_duty: {label:"On Duty", cls:"bg-green-100 text-green-700", dot:"bg-green-500"},
  break:   {label:"Break",   cls:"bg-amber-100 text-amber-700", dot:"bg-amber-500"},
  off_duty:{label:"Off Duty",cls:"bg-slate-100 text-slate-600", dot:"bg-slate-400"},
};
const VSC:{inside:{cls:string;label:string};exited:{cls:string;label:string};overstay:{cls:string;label:string}}={
  inside:  {cls:"bg-green-100 text-green-700",   label:"Inside"},
  exited:  {cls:"bg-slate-100 text-slate-600",   label:"Exited"},
  overstay:{cls:"bg-red-100 text-red-700",       label:"Overstay"},
};

export default function SecurityPage(){
  const [visitors,setVisitors]=useState<VisitorLog[]>(VISITORS);
  const [incidents,setIncidents]=useState<Incident[]>(INCIDENTS);
  const [guards]=useState<SecurityGuard[]>(GUARDS);
  const [tab,setTab]=useState<"visitors"|"incidents"|"guards">("visitors");
  const [q,setQ]=useState("");
  const [expanded,setExpanded]=useState<number|null>(null);
  const [error,setError]=useState<string|null>(null);

  const fetchData=useCallback(async()=>{
    try{
      const[v,inc]=await Promise.allSettled([get<VisitorLog[]>("/security/visitors/today/"),get<Incident[]>("/security/incidents/")]);
      if(v.status==="fulfilled"&&(v.value as VisitorLog[]).length>0) setVisitors(v.value as VisitorLog[]);
      if(inc.status==="fulfilled"&&(inc.value as Incident[]).length>0) setIncidents(inc.value as Incident[]);
      setError(null);
    }catch{setError("Showing demo data.");}
  },[]);
  useEffect(()=>{fetchData();},[fetchData]);

  const checkout=(id:number)=>setVisitors(p=>p.map(v=>v.id===id?{...v,status:"exited",checked_out:new Date().toTimeString().slice(0,5)}:v));
  const resolveInc=(id:number)=>setIncidents(p=>p.map(i=>i.id===id?{...i,status:"resolved",resolved_at:new Date().toTimeString().slice(0,5)}:i));

  const overstay=visitors.filter(v=>v.status==="overstay");
  const openInc=incidents.filter(i=>i.status==="open"||i.status==="investigating");

  return(
    <div className="space-y-5 pb-8">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div><h2 className="text-2xl font-bold">Security</h2><p className="text-sm text-muted-foreground">Guards deployment, visitor management, and incident tracking</p></div>
        <div className="flex gap-2">
          <button onClick={fetchData} className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"><RefreshCw className="h-3.5 w-3.5"/>Refresh</button>
          <Button className="gap-2"><Plus className="h-4 w-4"/>Log Visitor</Button>
        </div>
      </div>
      {error&&<div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 text-sm text-amber-800"><AlertTriangle className="h-4 w-4 shrink-0"/>Showing demo data.</div>}

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[{l:"Guards on Duty",v:`${STATS.guards_on_duty}/${STATS.total_posts}`,c:"border-l-blue-500"},
          {l:"Visitors Inside",v:STATS.visitors_inside,c:"border-l-green-500"},
          {l:"Visitors Today",v:STATS.visitors_today,c:"border-l-teal-500"},
          {l:"Overstay",v:STATS.overstay_visitors,c:"border-l-amber-500"},
          {l:"Open Incidents",v:STATS.open_incidents,c:"border-l-red-500"},
          {l:"Posts Unmanned",v:STATS.total_posts-STATS.guards_on_duty,c:"border-l-orange-500"},
        ].map(s=><div key={s.l} className={cn("rounded-xl border bg-background px-4 py-3 border-l-[3px]",s.c)}><p className="text-2xl font-bold">{s.v}</p><p className="text-xs text-muted-foreground mt-0.5">{s.l}</p></div>)}
      </div>

      {(overstay.length>0||openInc.length>0)&&(
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 space-y-2">
          {overstay.length>0&&<p className="text-[12px] font-semibold text-red-700">⏰ Overstay visitors: {overstay.map(v=>v.visitor_name).join(", ")}</p>}
          {openInc.length>0&&<p className="text-[12px] font-semibold text-red-700">⚠ Active incidents: {openInc.map(i=>i.title).join(" · ")}</p>}
        </div>
      )}

      <div className="flex items-center gap-4 border-b">
        {([["visitors",`Visitors (${visitors.length})`],["incidents",`Incidents (${incidents.length})`],["guards","Guards"]] as const).map(([v,l])=>(
          <button key={v} onClick={()=>setTab(v)} className={cn("py-2.5 px-1 text-sm font-medium border-b-2 -mb-px transition-colors",tab===v?"border-primary text-primary":"border-transparent text-muted-foreground hover:text-foreground")}>{l}</button>
        ))}
      </div>

      {tab==="visitors"&&(
        <>
          <div className="relative max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/><Input value={q} onChange={e=>setQ(e.target.value)} className="pl-9" placeholder="Search visitor name or patient…"/></div>
          <Card><CardContent className="p-0"><div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-[11px] text-muted-foreground">
                <th className="px-4 py-3 text-left font-medium">Visitor</th>
                <th className="px-3 py-3 text-left font-medium">Purpose / Patient</th>
                <th className="px-3 py-3 text-left font-medium">Pass</th>
                <th className="px-3 py-3 text-center font-medium">In</th>
                <th className="px-3 py-3 text-center font-medium">Out</th>
                <th className="px-3 py-3 text-left font-medium">Status</th>
                <th className="px-3 py-3 text-left font-medium">Action</th>
              </tr></thead>
              <tbody>
                {visitors.filter(v=>!q||v.visitor_name.toLowerCase().includes(q.toLowerCase())||v.patient_name?.toLowerCase().includes(q.toLowerCase())).map(v=>{
                  const sc=VSC[v.status];
                  return(
                    <tr key={v.id} className={cn("border-b last:border-0 hover:bg-muted/30",v.status==="overstay"&&"bg-red-50/30")}>
                      <td className="px-4 py-3"><p className="font-medium">{v.visitor_name}</p><p className="text-[11px] text-muted-foreground">{v.phone}</p></td>
                      <td className="px-3 py-3 text-[12px]"><p>{v.purpose}</p>{v.patient_name&&<p className="text-muted-foreground">{v.patient_name} · {v.ward}</p>}</td>
                      <td className="px-3 py-3"><span className="font-mono text-[12px] bg-muted px-2 py-0.5 rounded">{v.badge_issued}</span><p className="text-[10px] text-muted-foreground mt-0.5">{v.pass_no}</p></td>
                      <td className="px-3 py-3 text-center font-mono text-[12px] text-green-600">{v.checked_in}</td>
                      <td className="px-3 py-3 text-center font-mono text-[12px] text-muted-foreground">{v.checked_out??"—"}</td>
                      <td className="px-3 py-3"><span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium",sc.cls)}>{sc.label}</span></td>
                      <td className="px-3 py-3">
                        {v.status!=="exited"&&<button onClick={()=>checkout(v.id)} className="flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-[10px] text-muted-foreground hover:bg-muted"><CheckCircle2 className="h-3 w-3"/>Check Out</button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div></CardContent></Card>
        </>
      )}

      {tab==="incidents"&&(
        <div className="space-y-2">
          {incidents.map(inc=>{const exp=expanded===inc.id;const lc=ISC[inc.level];const sc=ISTATUS[inc.status];return(
            <Card key={inc.id} className={cn("overflow-hidden",inc.level==="high"&&inc.status!=="closed"&&"border-orange-200",inc.level==="critical"&&"border-red-300")}>
              <CardContent className="p-0">
                <div className="flex items-center gap-4 p-4 cursor-pointer hover:bg-muted/20" onClick={()=>setExpanded(exp?null:inc.id)}>
                  <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",lc.cls.split(" ")[0])}><Shield className={cn("h-5 w-5",lc.cls.split(" ")[1])}/></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-[14px]">{inc.title}</p>
                      <span className="font-mono text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{inc.inc_no}</span>
                      <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",lc.cls)}><span className={cn("h-1.5 w-1.5 rounded-full",lc.dot)}/>{inc.level.toUpperCase()}</span>
                      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium",sc.cls)}>{sc.label}</span>
                    </div>
                    <div className="flex flex-wrap gap-3 mt-1 text-[12px] text-muted-foreground">
                      <span>{inc.location}</span><span>· Reported by {inc.reported_by}</span><span>· {inc.reported_at}</span>
                    </div>
                  </div>
                  <div className="shrink-0">
                    {(inc.status==="open"||inc.status==="investigating")&&<button onClick={e=>{e.stopPropagation();resolveInc(inc.id);}} className="flex items-center gap-1 rounded-md bg-green-600 px-2.5 py-1.5 text-[11px] text-white font-medium hover:bg-green-700"><CheckCircle2 className="h-3 w-3"/>Resolve</button>}
                  </div>
                  {exp?<ChevronUp className="h-4 w-4 text-muted-foreground shrink-0"/>:<ChevronDown className="h-4 w-4 text-muted-foreground shrink-0"/>}
                </div>
                {exp&&(
                  <div className="border-t bg-muted/20 p-4 space-y-3 text-[12px]">
                    <div><p className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wide mb-1">Description</p><p>{inc.description}</p></div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div><p className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wide mb-1">Assigned To</p><p>{inc.assigned_to}</p></div>
                      <div><p className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wide mb-1">Resolved At</p><p>{inc.resolved_at??"Pending"}</p></div>
                    </div>
                    {inc.action_taken&&<div><p className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wide mb-1">Action Taken</p><p className="text-green-700">{inc.action_taken}</p></div>}
                  </div>
                )}
              </CardContent>
            </Card>
          );})}
        </div>
      )}

      {tab==="guards"&&(
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {guards.map(g=>{const sc=GSC[g.status];return(
            <Card key={g.id} className={cn("overflow-hidden",g.status==="on_duty"&&"border-green-200")}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold">{g.name}</p>
                    <p className="text-[11px] font-mono text-muted-foreground">{g.badge_no}</p>
                  </div>
                  <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium",sc.cls)}>
                    <span className={cn("h-1.5 w-1.5 rounded-full",sc.dot)}/>{sc.label}
                  </span>
                </div>
                <div className="space-y-1 text-[12px] text-muted-foreground">
                  <p><span className="font-medium text-foreground">Post:</span> {g.post}</p>
                  <p><span className="font-medium text-foreground">Shift:</span> {g.shift}</p>
                  <p><span className="font-medium text-foreground">Phone:</span> {g.phone}</p>
                  {g.in_time!=="—"&&<p><span className="font-medium text-foreground">In:</span> {g.in_time}</p>}
                </div>
              </CardContent>
            </Card>
          );})}
        </div>
      )}
    </div>
  );
}