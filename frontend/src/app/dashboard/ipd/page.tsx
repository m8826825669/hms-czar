"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, RefreshCw, UserPlus, BedDouble, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";
function hdrs(){ const t=useAuthStore.getState().token; return {"Content-Type":"application/json",...(t?{Authorization:`Bearer ${t}`}:{})}; }
async function get<T>(p:string):Promise<T>{ const r=await fetch(`${BASE}${p}`,{headers:hdrs(),cache:"no-store"}); if(!r.ok)throw new Error(`${r.status}`); const j=await r.json(); return (j?.results??j) as T; }

type IpdStatus = "admitted"|"under_treatment"|"stable"|"critical"|"pre_discharge"|"discharged";
interface IpdPatient { id:number; mrn:string; patient_name:string; age:number; gender:string; phone:string; ward:string; bed_no:string; admitted_on:string; days_admitted:number; diagnosis:string; consultant:string; status:IpdStatus; diet:string; nurse:string; }
interface IpdStats { total_admitted:number; critical:number; stable:number; pre_discharge:number; total_beds:number; available_beds:number; avg_los:number; }

const STATS:IpdStats={total_admitted:83,critical:6,stable:61,pre_discharge:5,total_beds:120,available_beds:37,avg_los:4.2};
const PATIENTS:IpdPatient[]=[
  {id:1, mrn:"MRN-00801",patient_name:"Bharat Singh",   age:55,gender:"M",phone:"9811234567",ward:"General Ward",    bed_no:"A-12",admitted_on:"2026-05-09",days_admitted:3, diagnosis:"Typhoid Fever",          consultant:"Dr. Sharma",  status:"under_treatment",diet:"Liquid",       nurse:"Nurse Anita"},
  {id:2, mrn:"MRN-00734",patient_name:"Kamla Devi",     age:68,gender:"F",phone:"9822345678",ward:"General Ward",    bed_no:"A-18",admitted_on:"2026-05-10",days_admitted:2, diagnosis:"COPD Exacerbation",      consultant:"Dr. Kumar",   status:"stable",         diet:"Normal",       nurse:"Nurse Reena"},
  {id:3, mrn:"MRN-00692",patient_name:"Rohit Malhotra", age:42,gender:"M",phone:"9833456789",ward:"Surgical Ward",   bed_no:"C-04",admitted_on:"2026-05-08",days_admitted:4, diagnosis:"Post-op Appendectomy",   consultant:"Dr. Arora",   status:"pre_discharge",  diet:"Soft",         nurse:"Nurse Pooja"},
  {id:4, mrn:"MRN-00621",patient_name:"Savita Rao",     age:34,gender:"F",phone:"9844567890",ward:"Maternity",       bed_no:"D-07",admitted_on:"2026-05-12",days_admitted:0, diagnosis:"Normal Delivery (G2P2)", consultant:"Dr. Mehta",   status:"stable",         diet:"Normal",       nurse:"Nurse Divya"},
  {id:5, mrn:"MRN-00589",patient_name:"Hamid Khan",     age:61,gender:"M",phone:"9855678901",ward:"ICU",             bed_no:"ICU-3",admitted_on:"2026-05-11",days_admitted:1, diagnosis:"Acute MI",               consultant:"Dr. Gupta",   status:"critical",       diet:"IV Fluids",    nurse:"Nurse Seema"},
  {id:6, mrn:"MRN-00541",patient_name:"Geeta Kumari",   age:45,gender:"F",phone:"9866789012",ward:"General Ward",    bed_no:"A-22",admitted_on:"2026-05-07",days_admitted:5, diagnosis:"Dengue Fever",           consultant:"Dr. Sharma",  status:"under_treatment",diet:"Liquid",       nurse:"Nurse Anita"},
  {id:7, mrn:"MRN-00503",patient_name:"Rajan Pillai",   age:73,gender:"M",phone:"9877890123",ward:"ICU",             bed_no:"ICU-5",admitted_on:"2026-05-10",days_admitted:2, diagnosis:"CVA (Stroke)",           consultant:"Dr. Nair",    status:"critical",       diet:"NG Tube",      nurse:"Nurse Seema"},
  {id:8, mrn:"MRN-00478",patient_name:"Shalini Mishra", age:29,gender:"F",phone:"9888901234",ward:"Maternity",       bed_no:"D-11",admitted_on:"2026-05-11",days_admitted:1, diagnosis:"Post C-Section",         consultant:"Dr. Mehta",   status:"stable",         diet:"Soft",         nurse:"Nurse Divya"},
  {id:9, mrn:"MRN-00412",patient_name:"Vijay Tiwari",   age:50,gender:"M",phone:"9899012345",ward:"Surgical Ward",   bed_no:"C-09",admitted_on:"2026-05-09",days_admitted:3, diagnosis:"Cholecystectomy",        consultant:"Dr. Arora",   status:"under_treatment",diet:"Liquid",       nurse:"Nurse Pooja"},
  {id:10,mrn:"MRN-00387",patient_name:"Nirmala Verma",  age:60,gender:"F",phone:"9810123456",ward:"General Ward",    bed_no:"A-31",admitted_on:"2026-05-05",days_admitted:7, diagnosis:"Diabetic Foot",          consultant:"Dr. Patel",   status:"pre_discharge",  diet:"Diabetic",     nurse:"Nurse Reena"},
];

const SC:Record<IpdStatus,{label:string;cls:string}> = {
  admitted:        {label:"Admitted",         cls:"bg-blue-100 text-blue-700"},
  under_treatment: {label:"Under Treatment",  cls:"bg-purple-100 text-purple-700"},
  stable:          {label:"Stable",           cls:"bg-green-100 text-green-700"},
  critical:        {label:"Critical",         cls:"bg-red-100 text-red-700"},
  pre_discharge:   {label:"Pre-Discharge",    cls:"bg-amber-100 text-amber-700"},
  discharged:      {label:"Discharged",       cls:"bg-slate-100 text-slate-600"},
};
const WARDS=["All","General Ward","Surgical Ward","Maternity","ICU","Paediatrics","Private Rooms"];
const AV=["bg-blue-100 text-blue-700","bg-purple-100 text-purple-700","bg-teal-100 text-teal-700","bg-amber-100 text-amber-700","bg-rose-100 text-rose-700"];
function ini(n:string){return n.split(" ").slice(0,2).map(w=>w[0]).join("").toUpperCase();}

export default function IpdPage(){
  const [stats,setStats]=useState<IpdStats>(STATS);
  const [patients,setPatients]=useState<IpdPatient[]>(PATIENTS);
  const [q,setQ]=useState("");
  const [ward,setWard]=useState("All");
  const [status,setStatus]=useState<IpdStatus|"all">("all");
  const [error,setError]=useState<string|null>(null);
  const [expanded,setExpanded]=useState<number|null>(null);

  const fetchData=useCallback(async()=>{
    try{
      const[s,p]=await Promise.allSettled([get<IpdStats>("/ipd/stats/"),get<IpdPatient[]>("/ipd/patients/")]);
      if(s.status==="fulfilled") setStats(s.value);
      if(p.status==="fulfilled"&&(p.value as IpdPatient[]).length>0) setPatients(p.value as IpdPatient[]);
      setError(null);
    }catch{setError("Showing demo data.");}
  },[]);
  useEffect(()=>{fetchData();},[fetchData]);

  const displayed=patients.filter(p=>{
    const mq=!q||p.patient_name.toLowerCase().includes(q.toLowerCase())||p.mrn.toLowerCase().includes(q.toLowerCase())||p.diagnosis.toLowerCase().includes(q.toLowerCase());
    const mw=ward==="All"||p.ward===ward;
    const ms=status==="all"||p.status===status;
    return mq&&mw&&ms;
  });

  return(
    <div className="space-y-5 pb-8">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div><h2 className="text-2xl font-bold">IPD</h2><p className="text-sm text-muted-foreground">Inpatient census, ward management, and discharge planning</p></div>
        <div className="flex gap-2">
          <button onClick={fetchData} className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"><RefreshCw className="h-3.5 w-3.5"/>Refresh</button>
          {/* Bug class instance #7: this button was a dead <Button> with
              no onClick. The destination /dashboard/ipd/admissions/new
              already exists; we just weren't linking to it. */}
          <Link href="/dashboard/ipd/admissions/new">
            <Button className="gap-2"><UserPlus className="h-4 w-4"/>Admit Patient</Button>
          </Link>
        </div>
      </div>
      {error&&<div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 text-sm text-amber-800"><AlertTriangle className="h-4 w-4 shrink-0"/>{error}</div>}

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-7">
        {[
          {label:"Admitted",       value:stats.total_admitted,  color:"border-l-blue-500"},
          {label:"Critical",       value:stats.critical,        color:"border-l-red-500"},
          {label:"Stable",         value:stats.stable,          color:"border-l-green-500"},
          {label:"Pre-Discharge",  value:stats.pre_discharge,   color:"border-l-amber-500"},
          {label:"Total Beds",     value:stats.total_beds,      color:"border-l-slate-400"},
          {label:"Available Beds", value:stats.available_beds,  color:"border-l-teal-500"},
          {label:"Avg LOS (days)", value:stats.avg_los,         color:"border-l-purple-500"},
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
          <Input value={q} onChange={e=>setQ(e.target.value)} className="pl-9" placeholder="Search patient, MRN, or diagnosis…"/>
        </div>
        <select value={ward} onChange={e=>setWard(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2">
          {WARDS.map(w=><option key={w}>{w}</option>)}
        </select>
        <div className="flex rounded-md border overflow-hidden text-xs">
          {(["all","critical","under_treatment","stable","pre_discharge"] as const).map(v=>(
            <button key={v} onClick={()=>setStatus(v)} className={cn("px-3 py-2 font-medium transition-colors",status===v?"bg-primary text-primary-foreground":"bg-background text-muted-foreground hover:bg-muted")}>
              {v==="all"?"All":v==="under_treatment"?"In Treatment":v==="pre_discharge"?"Pre-DC":v.charAt(0).toUpperCase()+v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">Showing {displayed.length} of {patients.length} patients</p>

      {/* Patient cards */}
      <div className="space-y-2">
        {displayed.length===0?(
          <div className="flex flex-col items-center py-16 text-muted-foreground border rounded-xl"><BedDouble className="h-10 w-10 mb-2 opacity-20"/><p className="text-sm">No patients found</p></div>
        ):displayed.map((p,i)=>{
          const sc=SC[p.status]; const exp=expanded===p.id;
          return(
            <Card key={p.id} className="overflow-hidden">
              <CardContent className="p-0">
                <div className="flex items-center gap-4 p-4 cursor-pointer hover:bg-muted/20" onClick={()=>setExpanded(exp?null:p.id)}>
                  <span className={cn("inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold",AV[i%AV.length])}>{ini(p.patient_name)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-[14px]">{p.patient_name}</p>
                      <span className="text-[11px] text-muted-foreground font-mono">{p.mrn}</span>
                      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium",sc.cls)}>{sc.label}</span>
                      {p.status==="critical"&&<span className="rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-bold text-white animate-pulse">⚠ CRITICAL</span>}
                    </div>
                    <div className="flex flex-wrap gap-3 mt-1 text-[12px] text-muted-foreground">
                      <span>{p.age}y {p.gender==="M"?"Male":"Female"}</span>
                      <span>· {p.ward} · Bed {p.bed_no}</span>
                      <span>· Day {p.days_admitted}</span>
                      <span className="font-medium text-foreground">· {p.diagnosis}</span>
                    </div>
                  </div>
                  <div className="text-right text-[12px] text-muted-foreground shrink-0">
                    <p className="font-medium">{p.consultant}</p>
                    <p>Admitted {p.admitted_on}</p>
                  </div>
                  {exp?<ChevronUp className="h-4 w-4 text-muted-foreground shrink-0"/>:<ChevronDown className="h-4 w-4 text-muted-foreground shrink-0"/>}
                </div>
                {exp&&(
                  <div className="border-t bg-muted/20 px-4 py-3 grid grid-cols-2 md:grid-cols-4 gap-4 text-[12px]">
                    <div><p className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wide mb-1">Phone</p><p>{p.phone}</p></div>
                    <div><p className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wide mb-1">Nurse In-charge</p><p>{p.nurse}</p></div>
                    <div><p className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wide mb-1">Diet</p><p>{p.diet}</p></div>
                    <div className="flex gap-2">
                      {p.status==="pre_discharge"&&<button className="rounded-md bg-amber-600 px-3 py-1.5 text-xs text-white font-medium hover:bg-amber-700">Discharge</button>}
                      <button className="rounded-md border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted">View EMR</button>
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