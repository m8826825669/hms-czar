"use client";
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, RefreshCw, UserPlus, Clock, CheckCircle2, AlertTriangle, Stethoscope, ChevronRight, X, Users, CalendarCheck, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";
function hdrs() { const t=useAuthStore.getState().token; return { "Content-Type":"application/json", ...(t?{Authorization:`Bearer ${t}`}:{}) }; }
async function get<T>(p:string):Promise<T> { const r=await fetch(`${BASE}${p}`,{headers:hdrs(),cache:"no-store"}); if(!r.ok)throw new Error(`${r.status}`); const j=await r.json(); return (j?.results??j) as T; }

type OpdStatus = "waiting"|"in_consultation"|"completed"|"cancelled"|"no_show";
interface OpdToken { id:number; token:number; mrn:string; patient_name:string; age:number; gender:string; phone:string; doctor_name:string; department:string; type:"new"|"followup"|"emergency"; status:OpdStatus; checked_in:string; called_at:string|null; completed_at:string|null; chief_complaint:string; }
interface OpdStats { total_today:number; waiting:number; in_consultation:number; completed:number; cancelled:number; avg_wait_min:number; }

const MOCK_STATS:OpdStats = { total_today:147, waiting:6, in_consultation:4, completed:131, cancelled:6, avg_wait_min:18 };
const MOCK_TOKENS:OpdToken[] = [
  { id:1,  token:1,   mrn:"MRN-00482", patient_name:"Ramesh Kumar",   age:45,gender:"M",phone:"9876543210",doctor_name:"Dr. Sharma",  department:"General OPD",  type:"new",      status:"completed",      checked_in:"08:52",called_at:"09:05",completed_at:"09:22",chief_complaint:"Fever and body ache" },
  { id:2,  token:2,   mrn:"MRN-00389", patient_name:"Priya Devi",     age:32,gender:"F",phone:"9812345678",doctor_name:"Dr. Mehta",   department:"Gynaecology",  type:"followup", status:"completed",      checked_in:"09:10",called_at:"09:28",completed_at:"09:45",chief_complaint:"Follow-up ANC" },
  { id:3,  token:3,   mrn:"MRN-00501", patient_name:"Arun Singh",     age:58,gender:"M",phone:"9898989898",doctor_name:"Dr. Gupta",   department:"Cardiology",   type:"followup", status:"completed",      checked_in:"09:22",called_at:"09:40",completed_at:"10:05",chief_complaint:"BP review" },
  { id:4,  token:4,   mrn:"MRN-00271", patient_name:"Sunita Joshi",   age:27,gender:"F",phone:"9871234567",doctor_name:"Dr. Sharma",  department:"General OPD",  type:"new",      status:"in_consultation",checked_in:"09:40",called_at:"10:55",completed_at:null,   chief_complaint:"Cold and cough" },
  { id:5,  token:5,   mrn:"MRN-00198", patient_name:"Mohan Kaul",     age:62,gender:"M",phone:"9823456789",doctor_name:"Dr. Patel",   department:"Orthopaedics", type:"followup", status:"in_consultation",checked_in:"09:55",called_at:"11:10",completed_at:null,   chief_complaint:"Knee pain review" },
  { id:6,  token:6,   mrn:"MRN-00605", patient_name:"Lalita Verma",   age:41,gender:"F",phone:"9845671234",doctor_name:"Dr. Rao",    department:"Dermatology",  type:"new",      status:"waiting",        checked_in:"10:08",called_at:null,    completed_at:null,   chief_complaint:"Skin rash" },
  { id:7,  token:7,   mrn:"MRN-00312", patient_name:"Suresh Nair",    age:35,gender:"M",phone:"9867890123",doctor_name:"Dr. Gupta",   department:"Cardiology",   type:"followup", status:"waiting",        checked_in:"10:25",called_at:null,    completed_at:null,   chief_complaint:"ECG follow-up" },
  { id:8,  token:8,   mrn:"MRN-00567", patient_name:"Deepa Iyer",     age:29,gender:"F",phone:"9856789012",doctor_name:"Dr. Mehta",   department:"Gynaecology",  type:"new",      status:"waiting",        checked_in:"10:40",called_at:null,    completed_at:null,   chief_complaint:"Irregular periods" },
  { id:9,  token:9,   mrn:"MRN-00423", patient_name:"Prakash Tiwari", age:50,gender:"M",phone:"9834567890",doctor_name:"Dr. Sharma",  department:"General OPD",  type:"followup", status:"waiting",        checked_in:"10:55",called_at:null,    completed_at:null,   chief_complaint:"Diabetes review" },
  { id:10, token:10,  mrn:"MRN-00711", patient_name:"Kavitha Rao",    age:38,gender:"F",phone:"9878901234",doctor_name:"Dr. Patel",   department:"Orthopaedics", type:"new",      status:"waiting",        checked_in:"11:10",called_at:null,    completed_at:null,   chief_complaint:"Shoulder pain" },
  { id:11, token:11,  mrn:"MRN-00156", patient_name:"Dinesh Pandey",  age:67,gender:"M",phone:"9890123456",doctor_name:"Dr. Kumar",   department:"Neurology",    type:"emergency",status:"waiting",        checked_in:"11:25",called_at:null,    completed_at:null,   chief_complaint:"Sudden giddiness" },
];

const SC:Record<OpdStatus,{label:string;cls:string}> = {
  waiting:         {label:"Waiting",         cls:"bg-amber-100 text-amber-700"},
  in_consultation: {label:"In Consult",      cls:"bg-purple-100 text-purple-700"},
  completed:       {label:"Completed",       cls:"bg-green-100 text-green-700"},
  cancelled:       {label:"Cancelled",       cls:"bg-red-100 text-red-700"},
  no_show:         {label:"No Show",         cls:"bg-slate-100 text-slate-600"},
};
const TC = { new:{cls:"bg-teal-100 text-teal-700",label:"New"}, followup:{cls:"bg-blue-100 text-blue-700",label:"Follow-up"}, emergency:{cls:"bg-red-100 text-red-700",label:"Emergency"} };
const AV = ["bg-blue-100 text-blue-700","bg-purple-100 text-purple-700","bg-teal-100 text-teal-700","bg-amber-100 text-amber-700","bg-rose-100 text-rose-700"];
function ini(n:string){return n.split(" ").slice(0,2).map(w=>w[0]).join("").toUpperCase();}

export default function OpdPage() {
  const [stats, setStats]   = useState<OpdStats>(MOCK_STATS);
  const [tokens, setTokens] = useState<OpdToken[]>(MOCK_TOKENS);
  const [q, setQ]           = useState("");
  const [tab, setTab]       = useState<"all"|OpdStatus>("all");
  const [error, setError]   = useState<string|null>(null);

  const fetchData = useCallback(async()=>{
    try {
      const [s,t] = await Promise.allSettled([get<OpdStats>("/opd/stats/"), get<OpdToken[]>("/opd/tokens/today/")]);
      if(s.status==="fulfilled") setStats(s.value);
      if(t.status==="fulfilled"&&(t.value as OpdToken[]).length>0) setTokens(t.value as OpdToken[]);
      setError(null);
    } catch { setError("Showing demo data."); }
  },[]);

  useEffect(()=>{ fetchData(); },[fetchData]);

  const callNext = (id:number) => {
    setTokens(p=>p.map(t=>t.id===id?{...t,status:"in_consultation",called_at:new Date().toTimeString().slice(0,5)}:t));
    setStats(p=>({...p,waiting:Math.max(0,p.waiting-1),in_consultation:p.in_consultation+1}));
  };
  const markDone = (id:number) => {
    setTokens(p=>p.map(t=>t.id===id?{...t,status:"completed",completed_at:new Date().toTimeString().slice(0,5)}:t));
    setStats(p=>({...p,in_consultation:Math.max(0,p.in_consultation-1),completed:p.completed+1}));
  };

  const displayed = tokens.filter(t=>{
    const mq = !q||t.patient_name.toLowerCase().includes(q.toLowerCase())||t.mrn.toLowerCase().includes(q.toLowerCase())||t.doctor_name.toLowerCase().includes(q.toLowerCase());
    const mt = tab==="all"||t.status===tab;
    return mq&&mt;
  });

  const TABS:[string,string,number][] = [
    ["all","All",tokens.length],
    ["waiting","Waiting",tokens.filter(t=>t.status==="waiting").length],
    ["in_consultation","In Consult",tokens.filter(t=>t.status==="in_consultation").length],
    ["completed","Completed",tokens.filter(t=>t.status==="completed").length],
  ];

  return (
    <div className="space-y-5 pb-8">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div><h2 className="text-2xl font-bold">OPD</h2><p className="text-sm text-muted-foreground">Outpatient queue, token management, and doctor schedule</p></div>
        <div className="flex gap-2">
          <button onClick={fetchData} className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"><RefreshCw className="h-3.5 w-3.5"/>Refresh</button>
          <Button className="gap-2"><UserPlus className="h-4 w-4"/>New Token</Button>
        </div>
      </div>
      {error&&<div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 text-sm text-amber-800"><AlertTriangle className="h-4 w-4 shrink-0"/>{error}</div>}

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          {label:"Total Today",    value:stats.total_today,      color:"border-l-blue-500"},
          {label:"Waiting",        value:stats.waiting,          color:"border-l-amber-500"},
          {label:"In Consult",     value:stats.in_consultation,  color:"border-l-purple-500"},
          {label:"Completed",      value:stats.completed,        color:"border-l-green-500"},
          {label:"Cancelled",      value:stats.cancelled,        color:"border-l-red-500"},
          {label:"Avg Wait (min)", value:stats.avg_wait_min,     color:"border-l-teal-500"},
        ].map(s=>(
          <div key={s.label} className={cn("rounded-xl border bg-background px-4 py-3 border-l-[3px]",s.color)}>
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search + Tabs */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
          <Input value={q} onChange={e=>setQ(e.target.value)} className="pl-9" placeholder="Search patient, MRN, or doctor…"/>
        </div>
      </div>

      {/* Token table */}
      <Card>
        <CardHeader className="pb-0">
          <div className="flex border-b -mx-6 px-6">
            {TABS.map(([key,label,cnt])=>(
              <button key={key} onClick={()=>setTab(key as any)}
                className={cn("flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors",
                  tab===key?"border-primary text-primary":"border-transparent text-muted-foreground hover:text-foreground")}>
                {label}
                <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                  tab===key?"bg-primary text-primary-foreground":"bg-muted text-muted-foreground")}>{cnt}</span>
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {displayed.length===0?(
            <div className="flex flex-col items-center py-16 text-muted-foreground">
              <Stethoscope className="h-10 w-10 mb-2 opacity-20"/><p className="text-sm">No patients in this category</p>
            </div>
          ):(
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b text-[11px] text-muted-foreground">
                  <th className="px-4 py-3 text-left font-medium">Token</th>
                  <th className="px-4 py-3 text-left font-medium">Patient</th>
                  <th className="px-4 py-3 text-left font-medium">Complaint</th>
                  <th className="px-4 py-3 text-left font-medium">Doctor</th>
                  <th className="px-4 py-3 text-left font-medium">Check-in</th>
                  <th className="px-4 py-3 text-left font-medium">Type</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Action</th>
                </tr></thead>
                <tbody>
                  {displayed.map((tk,i)=>{
                    const s=SC[tk.status]; const tc2=TC[tk.type];
                    return (
                      <tr key={tk.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3"><span className="text-base font-bold text-primary">#{tk.token}</span></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <span className={cn("inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",AV[i%AV.length])}>{ini(tk.patient_name)}</span>
                            <div><p className="font-medium leading-tight">{tk.patient_name}</p><p className="text-[11px] text-muted-foreground">{tk.mrn} · {tk.age}y {tk.gender}</p></div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[12px] text-muted-foreground max-w-[140px] truncate">{tk.chief_complaint}</td>
                        <td className="px-4 py-3"><p className="text-[13px] font-medium">{tk.doctor_name}</p><p className="text-[11px] text-muted-foreground">{tk.department}</p></td>
                        <td className="px-4 py-3 text-[12px]">{tk.checked_in}{tk.called_at&&<><br/><span className="text-muted-foreground">Called: {tk.called_at}</span></>}</td>
                        <td className="px-4 py-3"><span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium",tc2.cls)}>{tc2.label}</span></td>
                        <td className="px-4 py-3"><span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium",s.cls)}>{s.label}</span></td>
                        <td className="px-4 py-3">
                          {tk.status==="waiting"&&<button onClick={()=>callNext(tk.id)} className="flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-[11px] font-medium text-primary-foreground hover:bg-primary/90"><ChevronRight className="h-3 w-3"/>Call</button>}
                          {tk.status==="in_consultation"&&<button onClick={()=>markDone(tk.id)} className="flex items-center gap-1 rounded-md bg-green-600 px-2.5 py-1.5 text-[11px] font-medium text-white hover:bg-green-700"><CheckCircle2 className="h-3 w-3"/>Done</button>}
                          {tk.status==="completed"&&<span className="text-[11px] text-green-600 font-medium">✓ Completed</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}