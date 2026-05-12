"use client";
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, RefreshCw, Plus, AlertTriangle, Shield, CheckCircle2, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";
function hdrs(){ const t=useAuthStore.getState().token; return {"Content-Type":"application/json",...(t?{Authorization:`Bearer ${t}`}:{})}; }
async function get<T>(p:string):Promise<T>{ const r=await fetch(`${BASE}${p}`,{headers:hdrs(),cache:"no-store"}); if(!r.ok)throw new Error(`${r.status}`); const j=await r.json(); return (j?.results??j) as T; }

type VaxStatus = "scheduled"|"administered"|"deferred"|"refused";
interface VaxRecord { id:number; mrn:string; patient_name:string; age:number; gender:string; phone:string; vaccine_name:string; dose:string; batch_no:string; route:string; site:string; nurse_name:string; scheduled_date:string; administered_at:string|null; status:VaxStatus; notes:string; next_due:string|null; }
interface VaxStock { id:number; vaccine_name:string; doses_available:number; doses_administered_today:number; expiry:string; storage_temp:string; manufacturer:string; min_stock:number; }
interface VaxStats { scheduled_today:number; administered_today:number; deferred:number; stock_items:number; expiring_soon:number; }

const STATS:VaxStats={scheduled_today:34,administered_today:28,deferred:3,stock_items:12,expiring_soon:2};
const RECORDS:VaxRecord[]=[
  {id:1, mrn:"MRN-10001",patient_name:"Baby Riya Sharma",  age:0, gender:"F",phone:"9811111111",vaccine_name:"BCG",           dose:"Birth dose",   batch_no:"BCG-2026-041",route:"Intradermal",   site:"Left arm",    nurse_name:"Sr. Kavya",  scheduled_date:"2026-05-12",administered_at:"09:15",status:"administered",notes:"No adverse reaction.",     next_due:"2026-07-12"},
  {id:2, mrn:"MRN-10002",patient_name:"Arjun Singh",       age:0, gender:"M",phone:"9822222222",vaccine_name:"OPV 0",          dose:"Birth dose",   batch_no:"OPV-2026-018",route:"Oral",          site:"Oral",        nurse_name:"Sr. Kavya",  scheduled_date:"2026-05-12",administered_at:"09:20",status:"administered",notes:"Administered without issue.",next_due:"2026-07-12"},
  {id:3, mrn:"MRN-10003",patient_name:"Ravi Kumar",        age:1, gender:"M",phone:"9833333333",vaccine_name:"Pentavalent",    dose:"Dose 2",       batch_no:"PENT-2026-072",route:"Intramuscular", site:"Left thigh",  nurse_name:"Sr. Meena",  scheduled_date:"2026-05-12",administered_at:"09:45",status:"administered",notes:"",                           next_due:"2026-07-12"},
  {id:4, mrn:"MRN-10004",patient_name:"Sita Devi",         age:25,gender:"F",phone:"9844444444",vaccine_name:"TT (Pregnancy)", dose:"TT-2",         batch_no:"TT-2026-031",  route:"Intramuscular", site:"Left arm",    nurse_name:"Sr. Meena",  scheduled_date:"2026-05-12",administered_at:"10:00",status:"administered",notes:"G2P1, 28 weeks.",           next_due:null},
  {id:5, mrn:"MRN-10005",patient_name:"Mohammed Ali",      age:45,gender:"M",phone:"9855555555",vaccine_name:"COVID-19 Booster",dose:"Booster",     batch_no:"COV-2026-099",route:"Intramuscular", site:"Right arm",   nurse_name:"Sr. Kavya",  scheduled_date:"2026-05-12",administered_at:"10:30",status:"administered",notes:"No prior reactions noted.",  next_due:null},
  {id:6, mrn:"MRN-10006",patient_name:"Preeti Gupta",      age:5, gender:"F",phone:"9866666666",vaccine_name:"MMR",            dose:"Dose 1",       batch_no:"MMR-2026-054",route:"Subcutaneous",  site:"Right arm",   nurse_name:"Sr. Meena",  scheduled_date:"2026-05-12",administered_at:null,     status:"scheduled",   notes:"",                           next_due:null},
  {id:7, mrn:"MRN-10007",patient_name:"Shyam Lal",         age:2, gender:"M",phone:"9877777777",vaccine_name:"Hepatitis B",    dose:"Dose 3",       batch_no:"HEPB-2026-022",route:"Intramuscular", site:"Left thigh",  nurse_name:"Sr. Kavya",  scheduled_date:"2026-05-12",administered_at:null,     status:"scheduled",   notes:"",                           next_due:null},
  {id:8, mrn:"MRN-10008",patient_name:"Kamla Verma",       age:60,gender:"F",phone:"9888888888",vaccine_name:"Pneumococcal",   dose:"Dose 1",       batch_no:"PCV-2026-011",route:"Intramuscular", site:"Right arm",   nurse_name:"Sr. Meena",  scheduled_date:"2026-05-12",administered_at:null,     status:"deferred",    notes:"Mild fever today. Deferred by 1 week.", next_due:"2026-05-19"},
  {id:9, mrn:"MRN-10009",patient_name:"Tanveer Khan",      age:12,gender:"M",phone:"9899999999",vaccine_name:"Typhoid",        dose:"Dose 1",       batch_no:"TYP-2026-043",route:"Intramuscular", site:"Left arm",    nurse_name:"Sr. Kavya",  scheduled_date:"2026-05-12",administered_at:null,     status:"scheduled",   notes:"",                           next_due:"2029-05-12"},
];
const STOCKS:VaxStock[]=[
  {id:1, vaccine_name:"BCG",              doses_available:120,doses_administered_today:8, expiry:"2026-08-31",storage_temp:"2-8°C",  manufacturer:"Serum Institute",     min_stock:20},
  {id:2, vaccine_name:"OPV",              doses_available:200,doses_administered_today:10,expiry:"2026-07-31",storage_temp:"-20°C",  manufacturer:"Bharat Biotech",       min_stock:30},
  {id:3, vaccine_name:"Pentavalent",      doses_available:80, doses_administered_today:12,expiry:"2026-09-30",storage_temp:"2-8°C",  manufacturer:"Serum Institute",     min_stock:20},
  {id:4, vaccine_name:"MMR",              doses_available:60, doses_administered_today:5, expiry:"2026-10-31",storage_temp:"2-8°C",  manufacturer:"Merck",               min_stock:15},
  {id:5, vaccine_name:"Hepatitis B",      doses_available:18, doses_administered_today:6, expiry:"2026-06-30",storage_temp:"2-8°C",  manufacturer:"Serum Institute",     min_stock:20},
  {id:6, vaccine_name:"TT",               doses_available:150,doses_administered_today:4, expiry:"2027-03-31",storage_temp:"2-8°C",  manufacturer:"Bharat Biotech",       min_stock:30},
  {id:7, vaccine_name:"COVID-19 Booster", doses_available:45, doses_administered_today:3, expiry:"2026-11-30",storage_temp:"2-8°C",  manufacturer:"Covaxin/Covishield",  min_stock:10},
  {id:8, vaccine_name:"Pneumococcal",     doses_available:12, doses_administered_today:2, expiry:"2026-05-20",storage_temp:"2-8°C",  manufacturer:"Pfizer",              min_stock:10},
  {id:9, vaccine_name:"Typhoid",          doses_available:90, doses_administered_today:3, expiry:"2027-01-31",storage_temp:"2-8°C",  manufacturer:"Bharat Biotech",       min_stock:20},
];

const SC:Record<VaxStatus,{label:string;cls:string}>={
  scheduled:    {label:"Scheduled",    cls:"bg-blue-100 text-blue-700"},
  administered: {label:"Administered", cls:"bg-green-100 text-green-700"},
  deferred:     {label:"Deferred",     cls:"bg-amber-100 text-amber-700"},
  refused:      {label:"Refused",      cls:"bg-red-100 text-red-700"},
};
const AV=["bg-blue-100 text-blue-700","bg-purple-100 text-purple-700","bg-teal-100 text-teal-700","bg-amber-100 text-amber-700","bg-rose-100 text-rose-700"];
function ini(n:string){return n.split(" ").slice(0,2).map(w=>w[0]).join("").toUpperCase();}

export default function VaccinationPage(){
  const [records,setRecords]=useState<VaxRecord[]>(RECORDS);
  const [stocks]=useState<VaxStock[]>(STOCKS);
  const [tab,setTab]=useState<"sessions"|"stock">("sessions");
  const [q,setQ]=useState("");
  const [filter,setFilter]=useState<"all"|VaxStatus>("all");
  const [expanded,setExpanded]=useState<number|null>(null);
  const [error,setError]=useState<string|null>(null);

  const fetchData=useCallback(async()=>{
    try{
      const[r]=await Promise.allSettled([get<VaxRecord[]>("/vaccination/today/")]);
      if(r.status==="fulfilled"&&(r.value as VaxRecord[]).length>0) setRecords(r.value as VaxRecord[]);
      setError(null);
    }catch{setError("Showing demo data.");}
  },[]);
  useEffect(()=>{fetchData();},[fetchData]);

  const administer=(id:number)=>setRecords(p=>p.map(r=>r.id===id?{...r,status:"administered",administered_at:new Date().toTimeString().slice(0,5)}:r));

  const displayed=records.filter(r=>{
    const mq=!q||r.patient_name.toLowerCase().includes(q.toLowerCase())||r.mrn.toLowerCase().includes(q.toLowerCase())||r.vaccine_name.toLowerCase().includes(q.toLowerCase());
    const ms=filter==="all"||r.status===filter;
    return mq&&ms;
  });

  const expiringSoon=stocks.filter(s=>new Date(s.expiry)<new Date(Date.now()+30*86400000));
  const lowStock=stocks.filter(s=>s.doses_available<s.min_stock);

  return(
    <div className="space-y-5 pb-8">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div><h2 className="text-2xl font-bold">Vaccination</h2><p className="text-sm text-muted-foreground">Immunisation sessions, vaccine stock, and records</p></div>
        <div className="flex gap-2">
          <button onClick={fetchData} className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"><RefreshCw className="h-3.5 w-3.5"/>Refresh</button>
          <Button className="gap-2"><Plus className="h-4 w-4"/>Schedule</Button>
        </div>
      </div>
      {error&&<div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 text-sm text-amber-800"><AlertTriangle className="h-4 w-4 shrink-0"/>Showing demo data.</div>}

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {[
          {label:"Scheduled Today",     value:STATS.scheduled_today,     color:"border-l-blue-500"},
          {label:"Administered",        value:STATS.administered_today,   color:"border-l-green-500"},
          {label:"Deferred",            value:STATS.deferred,             color:"border-l-amber-500"},
          {label:"Vaccine Types",       value:STATS.stock_items,          color:"border-l-teal-500"},
          {label:"Expiring Soon",       value:STATS.expiring_soon,        color:"border-l-red-500"},
        ].map(s=>(
          <div key={s.label} className={cn("rounded-xl border bg-background px-4 py-3 border-l-[3px]",s.color)}>
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {(expiringSoon.length>0||lowStock.length>0)&&(
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
          <p className="text-sm font-semibold text-amber-800 mb-2">⚠ Stock Alerts</p>
          <div className="flex flex-wrap gap-2">
            {expiringSoon.map(s=><span key={s.id} className="rounded-full px-2.5 py-1 text-[12px] font-medium bg-red-100 text-red-700">Expiring: {s.vaccine_name} ({s.expiry})</span>)}
            {lowStock.map(s=><span key={s.id} className="rounded-full px-2.5 py-1 text-[12px] font-medium bg-amber-100 text-amber-700">Low: {s.vaccine_name} ({s.doses_available} doses)</span>)}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-4 border-b">
        {([["sessions","Today's Sessions"],["stock","Vaccine Stock"]] as const).map(([v,l])=>(
          <button key={v} onClick={()=>setTab(v)} className={cn("py-2.5 px-1 text-sm font-medium border-b-2 -mb-px transition-colors",tab===v?"border-primary text-primary":"border-transparent text-muted-foreground hover:text-foreground")}>{l}</button>
        ))}
      </div>

      {tab==="sessions"?(
        <>
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/><Input value={q} onChange={e=>setQ(e.target.value)} className="pl-9" placeholder="Search patient, MRN, or vaccine…"/></div>
            <div className="flex rounded-md border overflow-hidden text-xs">
              {(["all","scheduled","administered","deferred"] as const).map(v=>(
                <button key={v} onClick={()=>setFilter(v)} className={cn("px-3 py-2 font-medium transition-colors",filter===v?"bg-primary text-primary-foreground":"bg-background text-muted-foreground hover:bg-muted")}>
                  {v==="all"?"All":v.charAt(0).toUpperCase()+v.slice(1)}
                  {" "}({v==="all"?records.length:records.filter(r=>r.status===v).length})
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            {displayed.map((r,i)=>{const exp=expanded===r.id; const sc=SC[r.status]; return(
              <Card key={r.id} className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex items-center gap-4 p-4 cursor-pointer hover:bg-muted/20" onClick={()=>setExpanded(exp?null:r.id)}>
                    <span className={cn("inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold",AV[i%AV.length])}>{ini(r.patient_name)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-[14px]">{r.patient_name}</p>
                        <span className="text-[11px] text-muted-foreground">{r.mrn}</span>
                        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium",sc.cls)}>{sc.label}</span>
                      </div>
                      <div className="flex flex-wrap gap-3 mt-1 text-[12px] text-muted-foreground">
                        <span className="font-medium text-foreground">{r.vaccine_name}</span>
                        <span>· {r.dose}</span>
                        <span>· {r.age===0?"Newborn":`${r.age}y`} {r.gender==="M"?"Male":"Female"}</span>
                        {r.administered_at&&<span>· Given at {r.administered_at}</span>}
                        {r.next_due&&<span className="text-amber-600">· Next due: {r.next_due}</span>}
                      </div>
                    </div>
                    <div className="shrink-0">
                      {r.status==="scheduled"&&<button onClick={e=>{e.stopPropagation();administer(r.id);}} className="flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-[11px] font-medium text-primary-foreground hover:bg-primary/90"><Shield className="h-3 w-3"/>Administer</button>}
                    </div>
                    {exp?<ChevronUp className="h-4 w-4 text-muted-foreground shrink-0"/>:<ChevronDown className="h-4 w-4 text-muted-foreground shrink-0"/>}
                  </div>
                  {exp&&(
                    <div className="border-t bg-muted/20 p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-[12px]">
                      <div><p className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wide mb-1">Batch No</p><p className="font-mono">{r.batch_no}</p></div>
                      <div><p className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wide mb-1">Route / Site</p><p>{r.route} · {r.site}</p></div>
                      <div><p className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wide mb-1">Nurse</p><p>{r.nurse_name}</p></div>
                      <div><p className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wide mb-1">Phone</p><p>{r.phone}</p></div>
                      {r.notes&&<div className="col-span-2 md:col-span-4"><p className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wide mb-1">Notes</p><p>{r.notes}</p></div>}
                    </div>
                  )}
                </CardContent>
              </Card>
            );})}
          </div>
        </>
      ):(
        <Card><CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-[11px] text-muted-foreground">
                <th className="px-4 py-3 text-left font-medium">Vaccine</th>
                <th className="px-3 py-3 text-right font-medium">Available</th>
                <th className="px-3 py-3 text-right font-medium">Used Today</th>
                <th className="px-3 py-3 text-left font-medium">Expiry</th>
                <th className="px-3 py-3 text-left font-medium">Temp</th>
                <th className="px-3 py-3 text-left font-medium">Manufacturer</th>
              </tr></thead>
              <tbody>{stocks.map(s=>{
                const isLow=s.doses_available<s.min_stock;
                const isExp=new Date(s.expiry)<new Date(Date.now()+30*86400000);
                return(
                  <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{s.vaccine_name}</td>
                    <td className={cn("px-3 py-3 text-right font-semibold",isLow?"text-red-600":"text-green-600")}>{s.doses_available}</td>
                    <td className="px-3 py-3 text-right text-muted-foreground">{s.doses_administered_today}</td>
                    <td className={cn("px-3 py-3",isExp?"text-red-600 font-semibold":"text-muted-foreground")}>{s.expiry}{isExp&&" ⚠"}</td>
                    <td className="px-3 py-3 text-[12px] text-muted-foreground">{s.storage_temp}</td>
                    <td className="px-3 py-3 text-[12px] text-muted-foreground">{s.manufacturer}</td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        </CardContent></Card>
      )}
    </div>
  );
}