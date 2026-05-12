"use client";
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RefreshCw, Plus, AlertTriangle, Activity, Clock, CheckCircle2, XCircle, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";
function hdrs(){ const t=useAuthStore.getState().token; return {"Content-Type":"application/json",...(t?{Authorization:`Bearer ${t}`}:{})}; }
async function get<T>(p:string):Promise<T>{ const r=await fetch(`${BASE}${p}`,{headers:hdrs(),cache:"no-store"}); if(!r.ok)throw new Error(`${r.status}`); const j=await r.json(); return (j?.results??j) as T; }

type OtStatus = "scheduled"|"pre_op"|"in_progress"|"completed"|"postponed"|"cancelled";
interface OtCase { id:number; ot_name:string; case_no:string; mrn:string; patient_name:string; age:number; gender:string; procedure:string; surgery_type:string; surgeon:string; anaesthetist:string; scrub_nurse:string; scheduled_start:string; scheduled_end:string; actual_start:string|null; actual_end:string|null; status:OtStatus; blood_reserved:string; icu_post_op:boolean; notes:string; }
interface OtStats { total_today:number; completed:number; in_progress:number; scheduled:number; postponed:number; ot_available:number; ot_occupied:number; }

const STATS:OtStats={total_today:9,completed:3,in_progress:2,scheduled:4,postponed:0,ot_available:1,ot_occupied:2};
const CASES:OtCase[]=[
  {id:1,ot_name:"OT-1",case_no:"OT/2026/0512/001",mrn:"MRN-00341",patient_name:"Suresh Kumar",  age:42,gender:"M",procedure:"Appendectomy (Laparoscopic)",surgery_type:"Emergency",surgeon:"Dr. S. Arora",   anaesthetist:"Dr. P. Roy",   scrub_nurse:"Sr. Asha",  scheduled_start:"08:00",scheduled_end:"10:00",actual_start:"08:05",actual_end:"09:52",  status:"completed", blood_reserved:"2U Packed RBC",icu_post_op:false,notes:"Uneventful. Patient shifted to recovery."},
  {id:2,ot_name:"OT-2",case_no:"OT/2026/0512/002",mrn:"MRN-00478",patient_name:"Meena Sharma",  age:58,gender:"F",procedure:"Total Knee Replacement (R)",  surgery_type:"Elective", surgeon:"Dr. P. Patel",  anaesthetist:"Dr. V. Menon",  scrub_nurse:"Sr. Rita",  scheduled_start:"09:30",scheduled_end:"13:30",actual_start:"09:35",actual_end:null,      status:"in_progress",blood_reserved:"3U Packed RBC",icu_post_op:false,notes:"Tourniquet on at 09:45."},
  {id:3,ot_name:"OT-1",case_no:"OT/2026/0512/003",mrn:"MRN-00234",patient_name:"Vikram Nair",   age:51,gender:"M",procedure:"Laparoscopic Cholecystectomy",surgery_type:"Elective", surgeon:"Dr. S. Arora",   anaesthetist:"Dr. P. Roy",   scrub_nurse:"Sr. Asha",  scheduled_start:"11:00",scheduled_end:"13:00",actual_start:"11:10",actual_end:null,      status:"in_progress",blood_reserved:"Nil",          icu_post_op:false,notes:"Procedure ongoing."},
  {id:4,ot_name:"OT-3",case_no:"OT/2026/0512/004",mrn:"MRN-00621",patient_name:"Savita Rao",    age:34,gender:"F",procedure:"Lower Segment C-Section",     surgery_type:"Emergency",surgeon:"Dr. S. Mehta",  anaesthetist:"Dr. V. Menon",  scrub_nurse:"Sr. Divya", scheduled_start:"14:00",scheduled_end:"16:00",actual_start:null,         actual_end:null,      status:"scheduled",  blood_reserved:"2U Packed RBC",icu_post_op:false,notes:"FD. Fetal distress noted."},
  {id:5,ot_name:"OT-2",case_no:"OT/2026/0512/005",mrn:"MRN-00589",patient_name:"Hamid Khan",    age:61,gender:"M",procedure:"CABG (On-pump)",                surgery_type:"Emergency",surgeon:"Dr. R. Kapoor",anaesthetist:"Dr. A. Verma",  scrub_nurse:"Sr. Pooja", scheduled_start:"15:00",scheduled_end:"20:00",actual_start:null,         actual_end:null,      status:"scheduled",  blood_reserved:"6U Packed RBC",icu_post_op:true, notes:"Cardiac ICU bed reserved post-op."},
  {id:6,ot_name:"OT-1",case_no:"OT/2026/0512/006",mrn:"MRN-00712",patient_name:"Lata Deshpande",age:45,gender:"F",procedure:"Thyroidectomy (Total)",        surgery_type:"Elective", surgeon:"Dr. S. Arora",   anaesthetist:"Dr. P. Roy",   scrub_nurse:"Sr. Asha",  scheduled_start:"14:30",scheduled_end:"17:00",actual_start:null,         actual_end:null,      status:"scheduled",  blood_reserved:"2U Packed RBC",icu_post_op:false,notes:"Pre-op vocal cord assessment done."},
  {id:7,ot_name:"OT-3",case_no:"OT/2026/0512/007",mrn:"MRN-00145",patient_name:"Ratan Gupta",   age:70,gender:"M",procedure:"TURP",                         surgery_type:"Elective", surgeon:"Dr. N. Joshi",   anaesthetist:"Dr. V. Menon",  scrub_nurse:"Sr. Rita",  scheduled_start:"16:30",scheduled_end:"18:30",actual_start:null,         actual_end:null,      status:"scheduled",  blood_reserved:"1U Packed RBC",icu_post_op:false,notes:"Spinal anaesthesia planned."},
  {id:8,ot_name:"OT-1",case_no:"OT/2026/0512/008",mrn:"MRN-00387",patient_name:"Nirmala Verma", age:60,gender:"F",procedure:"Debridement (Diabetic Foot)",  surgery_type:"Elective", surgeon:"Dr. P. Patel",  anaesthetist:"Dr. P. Roy",   scrub_nurse:"Sr. Asha",  scheduled_start:"08:00",scheduled_end:"09:30",actual_start:"08:00",actual_end:"09:28",  status:"completed",  blood_reserved:"Nil",          icu_post_op:false,notes:"Wound clean. Dressing applied."},
  {id:9,ot_name:"OT-3",case_no:"OT/2026/0512/009",mrn:"MRN-00503",patient_name:"Rajan Pillai",  age:73,gender:"M",procedure:"Craniotomy — Evacuation SDH",  surgery_type:"Emergency",surgeon:"Dr. P. Nair",   anaesthetist:"Dr. A. Verma",  scrub_nurse:"Sr. Pooja", scheduled_start:"06:30",scheduled_end:"09:30",actual_start:"06:30",actual_end:"09:15",  status:"completed",  blood_reserved:"4U Packed RBC",icu_post_op:true, notes:"Transferred to neuro-ICU post-op."},
];

const SC:Record<OtStatus,{label:string;cls:string;dot:string}> = {
  scheduled:   {label:"Scheduled",   cls:"bg-blue-100 text-blue-700",    dot:"bg-blue-500"},
  pre_op:      {label:"Pre-Op",      cls:"bg-amber-100 text-amber-700",  dot:"bg-amber-500"},
  in_progress: {label:"In Progress", cls:"bg-purple-100 text-purple-700",dot:"bg-purple-500"},
  completed:   {label:"Completed",   cls:"bg-green-100 text-green-700",  dot:"bg-green-500"},
  postponed:   {label:"Postponed",   cls:"bg-orange-100 text-orange-700",dot:"bg-orange-500"},
  cancelled:   {label:"Cancelled",   cls:"bg-red-100 text-red-700",      dot:"bg-red-500"},
};
const TC = { Emergency:{cls:"bg-red-100 text-red-700"}, Elective:{cls:"bg-teal-100 text-teal-700"} };
const AV=["bg-blue-100 text-blue-700","bg-purple-100 text-purple-700","bg-teal-100 text-teal-700","bg-amber-100 text-amber-700","bg-rose-100 text-rose-700"];
function ini(n:string){return n.split(" ").slice(0,2).map(w=>w[0]).join("").toUpperCase();}

export default function OtPage(){
  const [cases,setCases]=useState<OtCase[]>(CASES);
  const [stats,setStats]=useState<OtStats>(STATS);
  const [filterOt,setFilterOt]=useState("All");
  const [filterStatus,setFilterStatus]=useState<"all"|OtStatus>("all");
  const [error,setError]=useState<string|null>(null);
  const [expanded,setExpanded]=useState<number|null>(null);

  const fetchData=useCallback(async()=>{
    try{
      const[s,c]=await Promise.allSettled([get<OtStats>("/ot/stats/"),get<OtCase[]>("/ot/schedule/today/")]);
      if(s.status==="fulfilled") setStats(s.value);
      if(c.status==="fulfilled"&&(c.value as OtCase[]).length>0) setCases(c.value as OtCase[]);
      setError(null);
    }catch{setError("Showing demo data.");}
  },[]);
  useEffect(()=>{fetchData();},[fetchData]);

  const OT_NAMES=["All",...Array.from(new Set(cases.map(c=>c.ot_name)))];
  const displayed=cases.filter(c=>{
    const mo=filterOt==="All"||c.ot_name===filterOt;
    const ms=filterStatus==="all"||c.status===filterStatus;
    return mo&&ms;
  });

  return(
    <div className="space-y-5 pb-8">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div><h2 className="text-2xl font-bold">Operation Theatre</h2><p className="text-sm text-muted-foreground">OT schedule, surgical cases, and theatre management</p></div>
        <div className="flex gap-2">
          <button onClick={fetchData} className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"><RefreshCw className="h-3.5 w-3.5"/>Refresh</button>
          <Button className="gap-2"><Plus className="h-4 w-4"/>Schedule Case</Button>
        </div>
      </div>
      {error&&<div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 text-sm text-amber-800"><AlertTriangle className="h-4 w-4 shrink-0"/>Showing demo data.</div>}

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {[
          {label:"Cases Today",  value:stats.total_today,   color:"border-l-blue-500"},
          {label:"Completed",    value:stats.completed,     color:"border-l-green-500"},
          {label:"In Progress",  value:stats.in_progress,   color:"border-l-purple-500"},
          {label:"Scheduled",    value:stats.scheduled,     color:"border-l-amber-500"},
          {label:"Postponed",    value:stats.postponed,     color:"border-l-orange-500"},
          {label:"OT Available", value:stats.ot_available,  color:"border-l-teal-500"},
          {label:"OT Occupied",  value:stats.ot_occupied,   color:"border-l-red-500"},
        ].map(s=>(
          <div key={s.label} className={cn("rounded-xl border bg-background px-4 py-3 border-l-[3px]",s.color)}>
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* OT status cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        {["OT-1","OT-2","OT-3"].map(ot=>{
          const cur=cases.find(c=>c.ot_name===ot&&c.status==="in_progress");
          const next=cases.find(c=>c.ot_name===ot&&c.status==="scheduled");
          return(
            <div key={ot} className={cn("rounded-xl border p-4",cur?"border-purple-300 bg-purple-50":"border-green-200 bg-green-50/40")}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-sm">{ot}</span>
                <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold",cur?"bg-purple-100 text-purple-700":"bg-green-100 text-green-700")}>
                  {cur?"● In Use":"● Available"}
                </span>
              </div>
              {cur?(
                <div>
                  <p className="text-sm font-medium">{cur.procedure}</p>
                  <p className="text-[12px] text-muted-foreground">{cur.surgeon}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">Started {cur.actual_start} · Est. end {cur.scheduled_end}</p>
                </div>
              ):(
                <div>
                  {next?<><p className="text-sm font-medium">{next.procedure}</p><p className="text-[12px] text-muted-foreground">Next: {next.scheduled_start} · {next.surgeon}</p></>
                  :<p className="text-[12px] text-muted-foreground">No pending cases</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex rounded-md border overflow-hidden text-xs">
          {OT_NAMES.map(o=>(
            <button key={o} onClick={()=>setFilterOt(o)} className={cn("px-3 py-2 font-medium transition-colors",filterOt===o?"bg-primary text-primary-foreground":"bg-background text-muted-foreground hover:bg-muted")}>{o}</button>
          ))}
        </div>
        <div className="flex rounded-md border overflow-hidden text-xs">
          {(["all","scheduled","in_progress","completed","postponed"] as const).map(v=>(
            <button key={v} onClick={()=>setFilterStatus(v)} className={cn("px-3 py-2 font-medium transition-colors",filterStatus===v?"bg-primary text-primary-foreground":"bg-background text-muted-foreground hover:bg-muted")}>
              {v==="all"?"All":v==="in_progress"?"In Progress":v.charAt(0).toUpperCase()+v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Case list */}
      <div className="space-y-2">
        {displayed.map((c,i)=>{
          const sc=SC[c.status]; const exp=expanded===c.id;
          const tc2=TC[c.surgery_type as keyof typeof TC]??{cls:"bg-slate-100 text-slate-600"};
          return(
            <Card key={c.id} className={cn("overflow-hidden",c.status==="in_progress"&&"border-purple-200",c.status==="completed"&&"opacity-80")}>
              <CardContent className="p-0">
                <div className="flex items-center gap-4 p-4 cursor-pointer hover:bg-muted/20" onClick={()=>setExpanded(exp?null:c.id)}>
                  <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xs font-bold",AV[i%AV.length])}>{ini(c.patient_name)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-[14px]">{c.procedure}</p>
                      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium",sc.cls)}>{sc.label}</span>
                      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium",tc2.cls)}>{c.surgery_type}</span>
                      {c.icu_post_op&&<span className="rounded-full px-2 py-0.5 text-[11px] font-medium bg-red-100 text-red-700">ICU Post-Op</span>}
                    </div>
                    <div className="flex flex-wrap gap-3 mt-1 text-[12px] text-muted-foreground">
                      <span className="font-medium text-foreground">{c.patient_name}</span>
                      <span>· {c.mrn} · {c.age}y</span>
                      <span>· {c.ot_name}</span>
                      <span>· {c.case_no}</span>
                    </div>
                  </div>
                  <div className="text-right text-[12px] shrink-0">
                    <p className="font-semibold">{c.actual_start??c.scheduled_start} → {c.actual_end??c.scheduled_end}</p>
                    <p className="text-muted-foreground">{c.surgeon}</p>
                  </div>
                  {exp?<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-muted-foreground shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7"/></svg>
                     :<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-muted-foreground shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>}
                </div>
                {exp&&(
                  <div className="border-t bg-muted/20 p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-[12px]">
                    <div><p className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wide mb-1">Surgeon</p><p>{c.surgeon}</p></div>
                    <div><p className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wide mb-1">Anaesthetist</p><p>{c.anaesthetist}</p></div>
                    <div><p className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wide mb-1">Scrub Nurse</p><p>{c.scrub_nurse}</p></div>
                    <div><p className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wide mb-1">Blood Reserved</p><p>{c.blood_reserved}</p></div>
                    {c.notes&&<div className="col-span-2 md:col-span-4"><p className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wide mb-1">Notes</p><p className="text-muted-foreground">{c.notes}</p></div>}
                    <div className="flex gap-2">
                      {c.status==="scheduled"&&<button onClick={()=>setCases(p=>p.map(x=>x.id===c.id?{...x,status:"in_progress",actual_start:new Date().toTimeString().slice(0,5)}:x))} className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground font-medium hover:bg-primary/90">Start Case</button>}
                      {c.status==="in_progress"&&<button onClick={()=>setCases(p=>p.map(x=>x.id===c.id?{...x,status:"completed",actual_end:new Date().toTimeString().slice(0,5)}:x))} className="rounded-md bg-green-600 px-3 py-1.5 text-xs text-white font-medium hover:bg-green-700">Mark Complete</button>}
                    </div>
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