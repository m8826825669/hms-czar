"use client";
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, RefreshCw, AlertTriangle, CheckCircle2, XCircle, Clock, LogIn, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";
function hdrs(){ const t=useAuthStore.getState().token; return {"Content-Type":"application/json",...(t?{Authorization:`Bearer ${t}`}:{})}; }
async function get<T>(p:string):Promise<T>{ const r=await fetch(`${BASE}${p}`,{headers:hdrs(),cache:"no-store"}); if(!r.ok)throw new Error(`${r.status}`); const j=await r.json(); return (j?.results??j) as T; }

type AttStatus = "present"|"absent"|"half_day"|"on_leave"|"holiday"|"week_off";
interface AttRecord {
  id:number; emp_code:string; name:string; designation:string; department:string;
  shift:string; status:AttStatus; in_time:string|null; out_time:string|null;
  hours_worked:number; overtime_hrs:number; late_by_min:number;
  early_leaving_min:number; remarks:string;
}
interface AttStats { total:number; present:number; absent:number; on_leave:number; half_day:number; late_arrivals:number; }

const TODAY=new Date().toLocaleDateString("en-IN",{weekday:"long",year:"numeric",month:"long",day:"numeric"});
const STATS:AttStats={total:184,present:162,absent:8,on_leave:8,half_day:4,late_arrivals:12};
const RECORDS:AttRecord[]=[
  {id:1, emp_code:"EMP-001",name:"Dr. Arvind Sharma",    designation:"Senior Physician",  department:"General Medicine", shift:"Morning (08:00–16:00)",status:"present",in_time:"07:55",out_time:null,     hours_worked:0,overtime_hrs:0,late_by_min:0,  early_leaving_min:0,remarks:""},
  {id:2, emp_code:"EMP-002",name:"Dr. Sneha Mehta",      designation:"Gynaecologist",     department:"Gynaecology",      shift:"Morning (09:00–17:00)",status:"present",in_time:"08:58",out_time:null,     hours_worked:0,overtime_hrs:0,late_by_min:0,  early_leaving_min:0,remarks:""},
  {id:3, emp_code:"EMP-015",name:"Sr. Kavya Reddy",      designation:"Staff Nurse",       department:"ICU",              shift:"Night (20:00–08:00)", status:"present",in_time:"19:52",out_time:"08:05",   hours_worked:12,overtime_hrs:0,late_by_min:0, early_leaving_min:0,remarks:"Night shift completed"},
  {id:4, emp_code:"EMP-031",name:"Ravi Kumar",            designation:"Pharmacist",        department:"Pharmacy",         shift:"Morning (08:00–16:00)",status:"present",in_time:"08:14",out_time:null,     hours_worked:0,overtime_hrs:0,late_by_min:14, early_leaving_min:0,remarks:"Late arrival"},
  {id:5, emp_code:"EMP-042",name:"Meena Iyer",            designation:"Lab Technician",    department:"Laboratory",       shift:"Morning (08:00–16:00)",status:"on_leave",in_time:null,out_time:null,       hours_worked:0,overtime_hrs:0,late_by_min:0,  early_leaving_min:0,remarks:"Sick leave"},
  {id:6, emp_code:"EMP-058",name:"Ramesh Yadav",          designation:"Ambulance Driver",  department:"Ambulance",        shift:"Morning (06:00–14:00)",status:"present",in_time:"05:58",out_time:null,     hours_worked:0,overtime_hrs:0,late_by_min:0,  early_leaving_min:0,remarks:""},
  {id:7, emp_code:"EMP-073",name:"Priya Sharma",          designation:"Receptionist",      department:"Reception",        shift:"Morning (08:00–16:00)",status:"present",in_time:"08:22",out_time:null,     hours_worked:0,overtime_hrs:0,late_by_min:22, early_leaving_min:0,remarks:"Late — traffic cited"},
  {id:8, emp_code:"EMP-089",name:"Anil Gupta",            designation:"Records Officer",   department:"Medical Records",  shift:"Morning (09:00–17:00)",status:"half_day",in_time:"09:05",out_time:"13:10", hours_worked:4,overtime_hrs:0,late_by_min:5,  early_leaving_min:230,remarks:"Personal work — half day approved"},
  {id:9, emp_code:"EMP-102",name:"Sunita Devi",           designation:"Ward Attendant",    department:"Housekeeping",     shift:"Morning (07:00–15:00)",status:"present",in_time:"06:55",out_time:null,     hours_worked:0,overtime_hrs:0,late_by_min:0,  early_leaving_min:0,remarks:""},
  {id:10,emp_code:"EMP-115",name:"Dr. Kiran Rao",         designation:"Dermatologist",     department:"Dermatology",      shift:"Morning (10:00–16:00)",status:"on_leave",in_time:null,out_time:null,       hours_worked:0,overtime_hrs:0,late_by_min:0,  early_leaving_min:0,remarks:"Casual leave approved"},
  {id:11,emp_code:"EMP-128",name:"Mohan HK",              designation:"Housekeeping Staff",department:"Housekeeping",     shift:"Morning (07:00–15:00)",status:"absent",in_time:null,out_time:null,         hours_worked:0,overtime_hrs:0,late_by_min:0,  early_leaving_min:0,remarks:"Absent — no intimation"},
  {id:12,emp_code:"EMP-134",name:"Geeta HK",              designation:"Housekeeping Staff",department:"Housekeeping",     shift:"Morning (07:00–15:00)",status:"present",in_time:"07:02",out_time:null,     hours_worked:0,overtime_hrs:0,late_by_min:0,  early_leaving_min:0,remarks:""},
];

const ASC:Record<AttStatus,{label:string;cls:string;icon:React.ReactNode}>={
  present:  {label:"Present",  cls:"bg-green-100 text-green-700", icon:<CheckCircle2 className="h-3 w-3"/>},
  absent:   {label:"Absent",   cls:"bg-red-100 text-red-700",     icon:<XCircle className="h-3 w-3"/>},
  half_day: {label:"Half Day", cls:"bg-amber-100 text-amber-700", icon:<Clock className="h-3 w-3"/>},
  on_leave: {label:"On Leave", cls:"bg-blue-100 text-blue-700",   icon:<Clock className="h-3 w-3"/>},
  holiday:  {label:"Holiday",  cls:"bg-purple-100 text-purple-700",icon:<CheckCircle2 className="h-3 w-3"/>},
  week_off: {label:"Week Off", cls:"bg-slate-100 text-slate-600", icon:<CheckCircle2 className="h-3 w-3"/>},
};
const SHIFTS=["All","Morning (08:00–16:00)","Morning (09:00–17:00)","Morning (06:00–14:00)","Night (20:00–08:00)"];
const AV=["bg-blue-100 text-blue-700","bg-purple-100 text-purple-700","bg-teal-100 text-teal-700","bg-amber-100 text-amber-700","bg-rose-100 text-rose-700"];
function ini(n:string){return n.split(" ").filter(w=>!["Dr.","Sr."].includes(w)).slice(0,2).map(w=>w[0]).join("").toUpperCase();}

export default function AttendancePage(){
  const [records,setRecords]=useState<AttRecord[]>(RECORDS);
  const [q,setQ]=useState("");
  const [statusFilter,setStatus]=useState<AttStatus|"all">("all");
  const [shift,setShift]=useState("All");
  const [error,setError]=useState<string|null>(null);

  const fetchData=useCallback(async()=>{
    try{const[a]=await Promise.allSettled([get<AttRecord[]>("/attendance/today/")]);
      if(a.status==="fulfilled"&&(a.value as AttRecord[]).length>0)setRecords(a.value as AttRecord[]);
      setError(null);}catch{setError("Showing demo data.");}
  },[]);
  useEffect(()=>{fetchData();},[fetchData]);

  const markOut=(id:number)=>setRecords(p=>p.map(r=>r.id===id?{...r,out_time:new Date().toTimeString().slice(0,5)}:r));
  const markPresent=(id:number)=>setRecords(p=>p.map(r=>r.id===id?{...r,status:"present",in_time:new Date().toTimeString().slice(0,5)}:r));

  const displayed=records.filter(r=>{
    const mq=!q||r.name.toLowerCase().includes(q.toLowerCase())||r.emp_code.toLowerCase().includes(q.toLowerCase())||r.department.toLowerCase().includes(q.toLowerCase());
    const ms=statusFilter==="all"||r.status===statusFilter;
    const msh=shift==="All"||r.shift===shift;
    return mq&&ms&&msh;
  });

  const lateArrivals=records.filter(r=>r.late_by_min>0);

  return(
    <div className="space-y-5 pb-8">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div><h2 className="text-2xl font-bold">Attendance</h2><p className="text-sm text-muted-foreground">{TODAY}</p></div>
        <div className="flex gap-2">
          <button onClick={fetchData} className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"><RefreshCw className="h-3.5 w-3.5"/>Refresh</button>
        </div>
      </div>
      {error&&<div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 text-sm text-amber-800"><AlertTriangle className="h-4 w-4 shrink-0"/>Showing demo data.</div>}

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[{l:"Total",v:STATS.total,c:"border-l-blue-500"},{l:"Present",v:STATS.present,c:"border-l-green-500"},
          {l:"Absent",v:STATS.absent,c:"border-l-red-500"},{l:"On Leave",v:STATS.on_leave,c:"border-l-amber-500"},
          {l:"Half Day",v:STATS.half_day,c:"border-l-purple-500"},{l:"Late Arrivals",v:STATS.late_arrivals,c:"border-l-orange-500"},
        ].map(s=><div key={s.l} className={cn("rounded-xl border bg-background px-4 py-3 border-l-[3px]",s.c)}><p className="text-2xl font-bold">{s.v}</p><p className="text-xs text-muted-foreground mt-0.5">{s.l}</p></div>)}
      </div>

      {/* Attendance rate */}
      <div className="rounded-xl border bg-background p-4">
        <div className="flex justify-between text-[12px] mb-2">
          <span className="font-medium">Today's attendance rate</span>
          <span className="font-bold text-green-600">{Math.round(STATS.present/STATS.total*100)}%</span>
        </div>
        <div className="h-2.5 rounded-full bg-muted overflow-hidden flex">
          <div className="h-full bg-green-500" style={{width:`${Math.round(STATS.present/STATS.total*100)}%`}}/>
          <div className="h-full bg-amber-400" style={{width:`${Math.round(STATS.on_leave/STATS.total*100)}%`}}/>
          <div className="h-full bg-red-400"   style={{width:`${Math.round(STATS.absent/STATS.total*100)}%`}}/>
        </div>
        <div className="flex gap-4 mt-2 text-[11px] text-muted-foreground">
          {[{l:"Present",c:"bg-green-500"},{l:"On Leave",c:"bg-amber-400"},{l:"Absent",c:"bg-red-400"}].map(s=>(
            <span key={s.l} className="flex items-center gap-1"><span className={cn("h-2 w-2 rounded-full",s.c)}/>{s.l}</span>
          ))}
        </div>
      </div>

      {lateArrivals.length>0&&(
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
          <p className="text-[12px] font-semibold text-amber-800 mb-1.5">⏰ Late arrivals today ({lateArrivals.length})</p>
          <div className="flex flex-wrap gap-2">{lateArrivals.map(r=><span key={r.id} className="rounded-full px-2.5 py-1 text-[11px] bg-amber-100 text-amber-800">{r.name} (+{r.late_by_min} min)</span>)}</div>
        </div>
      )}

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/><Input value={q} onChange={e=>setQ(e.target.value)} className="pl-9" placeholder="Search by name, code, or department…"/></div>
        <select value={shift} onChange={e=>setShift(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2">
          {SHIFTS.map(s=><option key={s}>{s}</option>)}
        </select>
        <div className="flex rounded-md border overflow-hidden text-xs">
          {(["all","present","absent","on_leave","half_day"] as const).map(v=>(
            <button key={v} onClick={()=>setStatus(v)} className={cn("px-3 py-2 font-medium transition-colors",statusFilter===v?"bg-primary text-primary-foreground":"bg-background text-muted-foreground hover:bg-muted")}>
              {v==="all"?"All":v==="on_leave"?"On Leave":v==="half_day"?"Half Day":v.charAt(0).toUpperCase()+v.slice(1)} ({v==="all"?records.length:records.filter(r=>r.status===v).length})
            </button>
          ))}
        </div>
      </div>

      <Card><CardContent className="p-0"><div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b text-[11px] text-muted-foreground">
            <th className="px-4 py-3 text-left font-medium">Employee</th>
            <th className="px-3 py-3 text-left font-medium">Shift</th>
            <th className="px-3 py-3 text-center font-medium">In</th>
            <th className="px-3 py-3 text-center font-medium">Out</th>
            <th className="px-3 py-3 text-center font-medium">Hours</th>
            <th className="px-3 py-3 text-left font-medium">Status</th>
            <th className="px-3 py-3 text-left font-medium">Remarks</th>
            <th className="px-3 py-3 text-left font-medium">Action</th>
          </tr></thead>
          <tbody>
            {displayed.map((r,i)=>{const sc=ASC[r.status];return(
              <tr key={r.id} className={cn("border-b last:border-0 hover:bg-muted/30",r.status==="absent"&&"bg-red-50/20",r.status==="on_leave"&&"bg-blue-50/20")}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <span className={cn("inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",AV[i%AV.length])}>{ini(r.name)}</span>
                    <div><p className="font-medium text-[13px]">{r.name}</p><p className="text-[10px] text-muted-foreground">{r.emp_code} · {r.department}</p></div>
                  </div>
                </td>
                <td className="px-3 py-3 text-[11px] text-muted-foreground">{r.shift.split(" ")[0]}<br/><span className="text-[10px]">{r.shift.split(" ").slice(1).join(" ")}</span></td>
                <td className="px-3 py-3 text-center">
                  {r.in_time?(<span className={cn("font-mono text-[12px] font-medium",r.late_by_min>0?"text-amber-600":"text-green-600")}>{r.in_time}{r.late_by_min>0&&<span className="text-[10px]"> +{r.late_by_min}m</span>}</span>):
                  <span className="text-muted-foreground text-[12px]">—</span>}
                </td>
                <td className="px-3 py-3 text-center font-mono text-[12px]">{r.out_time?<span className="text-blue-600">{r.out_time}</span>:<span className="text-muted-foreground">—</span>}</td>
                <td className="px-3 py-3 text-center text-[12px]">{r.hours_worked>0?`${r.hours_worked}h`:"—"}</td>
                <td className="px-3 py-3"><span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",sc.cls)}>{sc.icon}{sc.label}</span></td>
                <td className="px-3 py-3 text-[11px] text-muted-foreground max-w-[140px] truncate">{r.remarks||"—"}</td>
                <td className="px-3 py-3">
                  {r.status==="absent"&&<button onClick={()=>markPresent(r.id)} className="flex items-center gap-1 rounded-md bg-green-600 px-2.5 py-1.5 text-[10px] text-white font-medium hover:bg-green-700"><LogIn className="h-3 w-3"/>Mark In</button>}
                  {r.status==="present"&&!r.out_time&&<button onClick={()=>markOut(r.id)} className="flex items-center gap-1 rounded-md border border-blue-200 px-2.5 py-1.5 text-[10px] text-blue-600 hover:bg-blue-50"><LogOut className="h-3 w-3"/>Mark Out</button>}
                </td>
              </tr>
            );})}
          </tbody>
        </table>
      </div></CardContent></Card>
    </div>
  );
}