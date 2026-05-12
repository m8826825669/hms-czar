"use client";
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Plus, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";
function hdrs(){ const t=useAuthStore.getState().token; return {"Content-Type":"application/json",...(t?{Authorization:`Bearer ${t}`}:{})}; }
async function get<T>(p:string):Promise<T>{ const r=await fetch(`${BASE}${p}`,{headers:hdrs(),cache:"no-store"}); if(!r.ok)throw new Error(`${r.status}`); const j=await r.json(); return (j?.results??j) as T; }

type TaskStatus = "pending"|"in_progress"|"completed"|"escalated";
type Priority = "routine"|"urgent"|"critical";
interface HkTask { id:number; task_no:string; location:string; task_type:string; description:string; assigned_to:string; priority:Priority; status:TaskStatus; requested_by:string; requested_at:string; started_at:string|null; completed_at:string|null; notes:string; }
interface HkStats { tasks_today:number; completed:number; in_progress:number; pending:number; escalated:number; avg_completion_min:number; }

const STATS:HkStats={tasks_today:62,completed:44,in_progress:9,pending:8,escalated:1,avg_completion_min:22};
const TASKS:HkTask[]=[
  {id:1, task_no:"HK/0512/001",location:"OT-1",              task_type:"Terminal Cleaning",description:"Full terminal clean post surgery",       assigned_to:"Ramesh HK",  priority:"critical",status:"completed",  requested_by:"Sr. Asha",  requested_at:"10:05",started_at:"10:10",completed_at:"10:48",notes:"Completed before next case"},
  {id:2, task_no:"HK/0512/004",location:"ICU Bed 3",         task_type:"Bed Sanitation",   description:"Full bed clean — patient transferred",  assigned_to:"Sunita HK",  priority:"urgent",  status:"completed",  requested_by:"Sr. Seema", requested_at:"11:00",started_at:"11:05",completed_at:"11:25",notes:""},
  {id:3, task_no:"HK/0512/007",location:"OPD Toilet Block",  task_type:"Routine Clean",    description:"Scheduled floor & toilet cleaning",      assigned_to:"Mohan HK",   priority:"routine", status:"in_progress",requested_by:"Supervisor",requested_at:"12:00",started_at:"12:05",completed_at:null,      notes:""},
  {id:4, task_no:"HK/0512/009",location:"General Ward A-18", task_type:"Spill Management", description:"Blood spill on floor near bed A-18",     assigned_to:"Ramesh HK",  priority:"critical",status:"in_progress",requested_by:"Sr. Anita", requested_at:"12:30",started_at:"12:32",completed_at:null,      notes:"Bio-hazard kit in use"},
  {id:5, task_no:"HK/0512/012",location:"Maternity Ward",    task_type:"Routine Clean",    description:"Post-delivery bed and room clean",       assigned_to:"Sunita HK",  priority:"urgent",  status:"in_progress",requested_by:"Sr. Divya", requested_at:"13:00",started_at:"13:10",completed_at:null,      notes:""},
  {id:6, task_no:"HK/0512/015",location:"Reception Area",    task_type:"Floor Mopping",    description:"Wet floor near entrance",                assigned_to:"Geeta HK",   priority:"urgent",  status:"pending",    requested_by:"Reception", requested_at:"13:15",started_at:null,    completed_at:null,      notes:""},
  {id:7, task_no:"HK/0512/018",location:"Surgical Ward C-04",task_type:"Bed Sanitation",   description:"Discharge clean for new admission",      assigned_to:"Mohan HK",   priority:"urgent",  status:"pending",    requested_by:"Sr. Pooja", requested_at:"13:30",started_at:null,    completed_at:null,      notes:""},
  {id:8, task_no:"HK/0512/021",location:"Lab Corridor",      task_type:"Waste Disposal",   description:"Biomedical waste bin full — urgent",     assigned_to:"Unassigned", priority:"critical",status:"escalated",  requested_by:"Lab Staff", requested_at:"13:45",started_at:null,    completed_at:null,      notes:"Escalated to Supervisor"},
  {id:9, task_no:"HK/0512/023",location:"Pharmacy",          task_type:"Routine Clean",    description:"End of shift cleaning",                  assigned_to:"Geeta HK",   priority:"routine", status:"pending",    requested_by:"Supervisor",requested_at:"14:00",started_at:null,    completed_at:null,      notes:""},
];
const SC:Record<TaskStatus,{label:string;cls:string}>={
  pending:    {label:"Pending",     cls:"bg-amber-100 text-amber-700"},
  in_progress:{label:"In Progress", cls:"bg-blue-100 text-blue-700"},
  completed:  {label:"Completed",   cls:"bg-green-100 text-green-700"},
  escalated:  {label:"Escalated",   cls:"bg-red-100 text-red-700"},
};
const PC:Record<Priority,string>={
  routine:"bg-slate-100 text-slate-600",
  urgent:"bg-amber-100 text-amber-700",
  critical:"bg-red-100 text-red-700 font-bold",
};
const TC_COLORS:Record<string,string>={
  "Terminal Cleaning":"bg-purple-100 text-purple-700","Bed Sanitation":"bg-blue-100 text-blue-700",
  "Routine Clean":"bg-green-100 text-green-700","Spill Management":"bg-red-100 text-red-700",
  "Floor Mopping":"bg-teal-100 text-teal-700","Waste Disposal":"bg-orange-100 text-orange-700","Bio-hazard":"bg-red-200 text-red-800",
};

export default function HousekeepingPage(){
  const [tasks,setTasks]=useState<HkTask[]>(TASKS);
  const [filter,setFilter]=useState<"all"|TaskStatus>("all");
  const [priorityFilter,setPriorityFilter]=useState<"all"|Priority>("all");
  const [error,setError]=useState<string|null>(null);

  const fetchData=useCallback(async()=>{
    try{const[t]=await Promise.allSettled([get<HkTask[]>("/housekeeping/tasks/today/")]);if(t.status==="fulfilled"&&(t.value as HkTask[]).length>0)setTasks(t.value as HkTask[]);setError(null);}
    catch{setError("Showing demo data.");}
  },[]);
  useEffect(()=>{fetchData();},[fetchData]);

  const start=(id:number)=>setTasks(p=>p.map(t=>t.id===id?{...t,status:"in_progress",started_at:new Date().toTimeString().slice(0,5)}:t));
  const complete=(id:number)=>setTasks(p=>p.map(t=>t.id===id?{...t,status:"completed",completed_at:new Date().toTimeString().slice(0,5)}:t));

  const displayed=tasks.filter(t=>{
    const ms=filter==="all"||t.status===filter;
    const mp=priorityFilter==="all"||t.priority===priorityFilter;
    return ms&&mp;
  });

  return(
    <div className="space-y-5 pb-8">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div><h2 className="text-2xl font-bold">Housekeeping</h2><p className="text-sm text-muted-foreground">Cleaning tasks, sanitation, waste management, and shift tracking</p></div>
        <div className="flex gap-2">
          <button onClick={fetchData} className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"><RefreshCw className="h-3.5 w-3.5"/>Refresh</button>
          <Button className="gap-2"><Plus className="h-4 w-4"/>New Task</Button>
        </div>
      </div>
      {error&&<div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 text-sm text-amber-800"><AlertTriangle className="h-4 w-4 shrink-0"/>Showing demo data.</div>}

      {tasks.some(t=>t.status==="escalated")&&(
        <div className="rounded-lg bg-red-50 border border-red-200 p-4">
          <p className="text-sm font-semibold text-red-700 mb-1">⚠ Escalated tasks require supervisor attention</p>
          {tasks.filter(t=>t.status==="escalated").map(t=><p key={t.id} className="text-[12px] text-red-600">{t.location} — {t.task_type}: {t.notes}</p>)}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[{label:"Total Tasks",value:STATS.tasks_today,color:"border-l-blue-500"},{label:"Completed",value:STATS.completed,color:"border-l-green-500"},{label:"In Progress",value:STATS.in_progress,color:"border-l-purple-500"},{label:"Pending",value:STATS.pending,color:"border-l-amber-500"},{label:"Escalated",value:STATS.escalated,color:"border-l-red-500"},{label:"Avg Time (min)",value:STATS.avg_completion_min,color:"border-l-teal-500"}].map(s=>(
          <div key={s.label} className={cn("rounded-xl border bg-background px-4 py-3 border-l-[3px]",s.color)}><p className="text-2xl font-bold">{s.value}</p><p className="text-xs text-muted-foreground mt-0.5">{s.label}</p></div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex rounded-md border overflow-hidden text-xs">
          {(["all","pending","in_progress","completed","escalated"] as const).map(v=>(
            <button key={v} onClick={()=>setFilter(v)} className={cn("px-3 py-2 font-medium transition-colors",filter===v?"bg-primary text-primary-foreground":"bg-background text-muted-foreground hover:bg-muted")}>
              {v==="all"?"All":v==="in_progress"?"In Progress":v.charAt(0).toUpperCase()+v.slice(1)} ({v==="all"?tasks.length:tasks.filter(t=>t.status===v).length})
            </button>
          ))}
        </div>
        <div className="flex rounded-md border overflow-hidden text-xs">
          {(["all","critical","urgent","routine"] as const).map(v=>(
            <button key={v} onClick={()=>setPriorityFilter(v)} className={cn("px-3 py-2 font-medium transition-colors",priorityFilter===v?"bg-primary text-primary-foreground":"bg-background text-muted-foreground hover:bg-muted")}>
              {v==="all"?"All Priority":v.charAt(0).toUpperCase()+v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <Card><CardContent className="p-0"><div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b text-[11px] text-muted-foreground">
            <th className="px-4 py-3 text-left font-medium">Location</th>
            <th className="px-3 py-3 text-left font-medium">Task</th>
            <th className="px-3 py-3 text-left font-medium">Assigned To</th>
            <th className="px-3 py-3 text-left font-medium">Priority</th>
            <th className="px-3 py-3 text-left font-medium">Requested</th>
            <th className="px-3 py-3 text-left font-medium">Time</th>
            <th className="px-3 py-3 text-left font-medium">Status</th>
            <th className="px-3 py-3 text-left font-medium">Action</th>
          </tr></thead>
          <tbody>
            {displayed.map(t=>{const sc=SC[t.status];const pc=PC[t.priority];const tc=TC_COLORS[t.task_type]??"bg-slate-100 text-slate-600";return(
              <tr key={t.id} className={cn("border-b last:border-0 hover:bg-muted/30",t.status==="escalated"&&"bg-red-50/40")}>
                <td className="px-4 py-3"><p className="font-medium text-[13px]">{t.location}</p><p className="text-[10px] text-muted-foreground font-mono">{t.task_no}</p></td>
                <td className="px-3 py-3"><span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium",tc)}>{t.task_type}</span><p className="text-[11px] text-muted-foreground mt-0.5">{t.description}</p></td>
                <td className="px-3 py-3 text-[12px]">{t.assigned_to}</td>
                <td className="px-3 py-3"><span className={cn("rounded-full px-2 py-0.5 text-[11px] uppercase tracking-wide",pc)}>{t.priority}</span></td>
                <td className="px-3 py-3 text-[12px] text-muted-foreground"><p>{t.requested_by}</p><p>{t.requested_at}</p></td>
                <td className="px-3 py-3 text-[12px]">
                  {t.started_at&&<p className="text-blue-600">▶ {t.started_at}</p>}
                  {t.completed_at&&<p className="text-green-600">✓ {t.completed_at}</p>}
                  {!t.started_at&&<p className="text-muted-foreground">—</p>}
                </td>
                <td className="px-3 py-3"><span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium",sc.cls)}>{sc.label}</span></td>
                <td className="px-3 py-3">
                  {t.status==="pending"&&<button onClick={()=>start(t.id)} className="flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1.5 text-[11px] text-white font-medium hover:bg-blue-700"><Clock className="h-3 w-3"/>Start</button>}
                  {t.status==="in_progress"&&<button onClick={()=>complete(t.id)} className="flex items-center gap-1 rounded-md bg-green-600 px-2.5 py-1.5 text-[11px] text-white font-medium hover:bg-green-700"><CheckCircle2 className="h-3 w-3"/>Done</button>}
                </td>
              </tr>
            );})}
          </tbody>
        </table>
      </div></CardContent></Card>
    </div>
  );
}