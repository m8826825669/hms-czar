"use client";
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Plus, AlertTriangle, Droplets, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";
function hdrs(){ const t=useAuthStore.getState().token; return {"Content-Type":"application/json",...(t?{Authorization:`Bearer ${t}`}:{})}; }
async function get<T>(p:string):Promise<T>{ const r=await fetch(`${BASE}${p}`,{headers:hdrs(),cache:"no-store"}); if(!r.ok)throw new Error(`${r.status}`); const j=await r.json(); return (j?.results??j) as T; }

type BloodGroup = "A+"|"A-"|"B+"|"B-"|"O+"|"O-"|"AB+"|"AB-";
interface BloodUnit { group:BloodGroup; whole_blood:number; packed_rbc:number; ffp:number; platelets:number; min_level:number; }
interface BloodRequest { id:number; req_no:string; mrn:string; patient_name:string; ward:string; blood_group:BloodGroup; component:"Whole Blood"|"Packed RBC"|"FFP"|"Platelets"; units_requested:number; units_issued:number; purpose:string; doctor_name:string; requested_at:string; status:"pending"|"cross_match"|"issued"|"returned"|"cancelled"; priority:"routine"|"urgent"|"emergency"; }
interface BloodStats { total_donations_month:number; units_available:number; requests_today:number; units_issued_today:number; critical_stock:number; expiring_soon:number; }

const STATS:BloodStats={total_donations_month:48,units_available:186,requests_today:12,units_issued_today:18,critical_stock:3,expiring_soon:8};
const INVENTORY:BloodUnit[]=[
  {group:"A+", whole_blood:12,packed_rbc:24,ffp:18,platelets:8, min_level:10},
  {group:"A-", whole_blood:4, packed_rbc:6, ffp:4, platelets:2, min_level:5},
  {group:"B+", whole_blood:14,packed_rbc:20,ffp:12,platelets:6, min_level:10},
  {group:"B-", whole_blood:2, packed_rbc:3, ffp:2, platelets:1, min_level:5},
  {group:"O+", whole_blood:18,packed_rbc:28,ffp:20,platelets:10,min_level:15},
  {group:"O-", whole_blood:2, packed_rbc:4, ffp:3, platelets:1, min_level:8},
  {group:"AB+",whole_blood:8, packed_rbc:12,ffp:8, platelets:4, min_level:5},
  {group:"AB-",whole_blood:1, packed_rbc:2, ffp:2, platelets:0, min_level:3},
];
const REQUESTS:BloodRequest[]=[
  {id:1,req_no:"BB/0512/001",mrn:"MRN-00589",patient_name:"Hamid Khan",    ward:"ICU",        blood_group:"B+",component:"Packed RBC",units_requested:2,units_issued:2,purpose:"Pre-op CABG",        doctor_name:"Dr. Kapoor",requested_at:"07:30",status:"issued",    priority:"emergency"},
  {id:2,req_no:"BB/0512/002",mrn:"MRN-00341",patient_name:"Suresh Kumar",  ward:"Surgical",   blood_group:"O+",component:"Packed RBC",units_requested:2,units_issued:2,purpose:"Post-op Appendix",   doctor_name:"Dr. Arora",  requested_at:"10:15",status:"issued",    priority:"urgent"},
  {id:3,req_no:"BB/0512/003",mrn:"MRN-00621",patient_name:"Savita Rao",    ward:"Maternity",  blood_group:"A+",component:"Whole Blood", units_requested:2,units_issued:0,purpose:"Emergency C-Section",doctor_name:"Dr. Mehta",  requested_at:"13:45",status:"cross_match",priority:"emergency"},
  {id:4,req_no:"BB/0512/004",mrn:"MRN-00478",patient_name:"Meena Sharma",  ward:"Ortho",      blood_group:"B+",component:"Packed RBC",units_requested:3,units_issued:0,purpose:"TKR Surgery",        doctor_name:"Dr. Patel",  requested_at:"09:00",status:"cross_match",priority:"urgent"},
  {id:5,req_no:"BB/0512/005",mrn:"MRN-00712",patient_name:"Lata Deshpande",ward:"Surgical",   blood_group:"A-",component:"Packed RBC",units_requested:2,units_issued:0,purpose:"Thyroidectomy",      doctor_name:"Dr. Arora",  requested_at:"14:00",status:"pending",    priority:"routine"},
  {id:6,req_no:"BB/0512/006",mrn:"MRN-00387",patient_name:"Nirmala Verma", ward:"General",    blood_group:"O+",component:"FFP",        units_requested:2,units_issued:2,purpose:"Coagulation support", doctor_name:"Dr. Sharma", requested_at:"08:00",status:"issued",    priority:"urgent"},
];

const RSC:{pending:{label:string;cls:string};cross_match:{label:string;cls:string};issued:{label:string;cls:string};returned:{label:string;cls:string};cancelled:{label:string;cls:string}}={
  pending:    {label:"Pending",     cls:"bg-amber-100 text-amber-700"},
  cross_match:{label:"Cross Match", cls:"bg-blue-100 text-blue-700"},
  issued:     {label:"Issued",      cls:"bg-green-100 text-green-700"},
  returned:   {label:"Returned",    cls:"bg-slate-100 text-slate-600"},
  cancelled:  {label:"Cancelled",   cls:"bg-red-100 text-red-700"},
};
const PRI={routine:{cls:"bg-slate-100 text-slate-600"},urgent:{cls:"bg-amber-100 text-amber-700"},emergency:{cls:"bg-red-100 text-red-700 font-bold"}};
const BG_COLORS:Record<BloodGroup,string>={
  "A+":"bg-red-100 text-red-700","A-":"bg-red-200 text-red-800","B+":"bg-blue-100 text-blue-700","B-":"bg-blue-200 text-blue-800",
  "O+":"bg-green-100 text-green-700","O-":"bg-green-200 text-green-800","AB+":"bg-purple-100 text-purple-700","AB-":"bg-purple-200 text-purple-800",
};
function stockStatus(units:number,min:number):"ok"|"low"|"critical"|"out"{
  if(units===0)return "out";
  if(units<min*0.4)return "critical";
  if(units<min)return "low";
  return "ok";
}
const SS_CLS={ok:"text-green-600",low:"text-amber-600",critical:"text-red-600 font-bold",out:"text-red-700 font-bold"};

export default function BloodBankPage(){
  const [requests,setRequests]=useState<BloodRequest[]>(REQUESTS);
  const [inventory]=useState<BloodUnit[]>(INVENTORY);
  const [tab,setTab]=useState<"requests"|"inventory">("inventory");
  const [error,setError]=useState<string|null>(null);

  const fetchData=useCallback(async()=>{
    try{
      const[r]=await Promise.allSettled([get<BloodRequest[]>("/blood-bank/requests/today/")]);
      if(r.status==="fulfilled"&&(r.value as BloodRequest[]).length>0) setRequests(r.value as BloodRequest[]);
      setError(null);
    }catch{setError("Showing demo data.");}
  },[]);
  useEffect(()=>{fetchData();},[fetchData]);

  const issue=(id:number)=>setRequests(p=>p.map(r=>r.id===id?{...r,status:"issued",units_issued:r.units_requested}:r));
  const crossMatch=(id:number)=>setRequests(p=>p.map(r=>r.id===id?{...r,status:"cross_match"}:r));

  const criticalGroups=inventory.filter(u=>Object.entries({whole_blood:u.whole_blood,packed_rbc:u.packed_rbc,ffp:u.ffp}).some(([,v])=>stockStatus(v,u.min_level)==="critical"||stockStatus(v,u.min_level)==="out"));

  return(
    <div className="space-y-5 pb-8">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div><h2 className="text-2xl font-bold">Blood Bank</h2><p className="text-sm text-muted-foreground">Blood inventory, requests, cross-matching, and issue management</p></div>
        <div className="flex gap-2">
          <button onClick={fetchData} className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"><RefreshCw className="h-3.5 w-3.5"/>Refresh</button>
          <Button className="gap-2"><Plus className="h-4 w-4"/>New Request</Button>
        </div>
      </div>
      {error&&<div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 text-sm text-amber-800"><AlertTriangle className="h-4 w-4 shrink-0"/>Showing demo data.</div>}

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          {label:"Donations (Month)",value:STATS.total_donations_month,color:"border-l-teal-500"},
          {label:"Units Available",  value:STATS.units_available,      color:"border-l-blue-500"},
          {label:"Requests Today",   value:STATS.requests_today,       color:"border-l-purple-500"},
          {label:"Units Issued",     value:STATS.units_issued_today,   color:"border-l-green-500"},
          {label:"Critical Stock",   value:STATS.critical_stock,       color:"border-l-red-500"},
          {label:"Expiring Soon",    value:STATS.expiring_soon,        color:"border-l-amber-500"},
        ].map(s=>(
          <div key={s.label} className={cn("rounded-xl border bg-background px-4 py-3 border-l-[3px]",s.color)}>
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Critical alert */}
      {criticalGroups.length>0&&(
        <div className="rounded-lg bg-red-50 border border-red-200 p-4">
          <p className="text-sm font-semibold text-red-700 flex items-center gap-2 mb-2"><TrendingDown className="h-4 w-4"/>Critical blood stock alert</p>
          <div className="flex flex-wrap gap-2">{criticalGroups.map(g=>(
            <span key={g.group} className={cn("rounded-full px-2.5 py-1 text-[12px] font-semibold",BG_COLORS[g.group])}>{g.group} — Low</span>
          ))}</div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-4 border-b">
        {([["inventory","Inventory"],["requests","Requests Today"]] as const).map(([v,l])=>(
          <button key={v} onClick={()=>setTab(v)} className={cn("py-2.5 px-1 text-sm font-medium border-b-2 -mb-px transition-colors",tab===v?"border-primary text-primary":"border-transparent text-muted-foreground hover:text-foreground")}>{l}</button>
        ))}
      </div>

      {tab==="inventory"?(
        <div>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 mb-4">
            {inventory.map(u=>(
              <div key={u.group} className={cn("rounded-xl border p-3 text-center",BG_COLORS[u.group].replace("text-","border-").replace(/\w+-\d+$/,"border"))}>
                <p className={cn("text-2xl font-black",BG_COLORS[u.group].split(" ")[1])}>{u.group}</p>
                <p className="text-xs text-muted-foreground mt-1">Whole: <span className={cn(SS_CLS[stockStatus(u.whole_blood,u.min_level)])}>{u.whole_blood}U</span></p>
                <p className="text-xs text-muted-foreground">RBC: <span className={cn(SS_CLS[stockStatus(u.packed_rbc,u.min_level)])}>{u.packed_rbc}U</span></p>
                <p className="text-xs text-muted-foreground">FFP: <span className={cn(SS_CLS[stockStatus(u.ffp,u.min_level)])}>{u.ffp}U</span></p>
                <p className="text-xs text-muted-foreground">Plt: <span className={cn(SS_CLS[stockStatus(u.platelets,u.min_level)])}>{u.platelets}U</span></p>
              </div>
            ))}
          </div>
          <Card><CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b text-[11px] text-muted-foreground">
                  <th className="px-4 py-3 text-left font-medium">Group</th>
                  <th className="px-3 py-3 text-right font-medium">Whole Blood</th>
                  <th className="px-3 py-3 text-right font-medium">Packed RBC</th>
                  <th className="px-3 py-3 text-right font-medium">FFP</th>
                  <th className="px-3 py-3 text-right font-medium">Platelets</th>
                  <th className="px-3 py-3 text-right font-medium">Min Level</th>
                </tr></thead>
                <tbody>{inventory.map(u=>(
                  <tr key={u.group} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3"><span className={cn("rounded-full px-2.5 py-1 text-sm font-black",BG_COLORS[u.group])}>{u.group}</span></td>
                    <td className={cn("px-3 py-3 text-right font-semibold",SS_CLS[stockStatus(u.whole_blood,u.min_level)])}>{u.whole_blood} U</td>
                    <td className={cn("px-3 py-3 text-right font-semibold",SS_CLS[stockStatus(u.packed_rbc,u.min_level)])}>{u.packed_rbc} U</td>
                    <td className={cn("px-3 py-3 text-right font-semibold",SS_CLS[stockStatus(u.ffp,u.min_level)])}>{u.ffp} U</td>
                    <td className={cn("px-3 py-3 text-right font-semibold",SS_CLS[stockStatus(u.platelets,u.min_level)])}>{u.platelets} U</td>
                    <td className="px-3 py-3 text-right text-muted-foreground">{u.min_level} U</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </CardContent></Card>
        </div>
      ):(
        <div className="space-y-2">
          {requests.map((r,i)=>{const sc=RSC[r.status]; const pc=PRI[r.priority]; return(
            <Card key={r.id} className="overflow-hidden">
              <CardContent className="p-4 flex items-center gap-4">
                <span className={cn("inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-black",BG_COLORS[r.blood_group])}>{r.blood_group}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-[14px]">{r.patient_name}</p>
                    <span className="font-mono text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{r.req_no}</span>
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px]",sc.cls)}>{sc.label}</span>
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] uppercase tracking-wide",pc.cls)}>{r.priority}</span>
                  </div>
                  <div className="flex flex-wrap gap-3 mt-1 text-[12px] text-muted-foreground">
                    <span>{r.mrn}</span><span>· {r.ward}</span><span>· {r.component}</span>
                    <span className="font-medium text-foreground">· {r.units_requested}U requested</span>
                    {r.units_issued>0&&<span className="text-green-600 font-medium">· {r.units_issued}U issued</span>}
                    <span>· {r.purpose}</span><span>· {r.doctor_name}</span><span>· {r.requested_at}</span>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  {r.status==="pending"&&<button onClick={()=>crossMatch(r.id)} className="rounded-md bg-blue-600 px-3 py-1.5 text-xs text-white font-medium hover:bg-blue-700">Cross Match</button>}
                  {r.status==="cross_match"&&<button onClick={()=>issue(r.id)} className="rounded-md bg-green-600 px-3 py-1.5 text-xs text-white font-medium hover:bg-green-700">Issue Blood</button>}
                </div>
              </CardContent>
            </Card>
          );})}
        </div>
      )}
    </div>
  );
}