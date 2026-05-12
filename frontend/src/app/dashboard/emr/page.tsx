"use client";
import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, FileText, AlertTriangle, ChevronDown, ChevronUp, Pill, Activity, User, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";
function hdrs(){ const t=useAuthStore.getState().token; return {"Content-Type":"application/json",...(t?{Authorization:`Bearer ${t}`}:{})}; }
async function get<T>(p:string):Promise<T>{ const r=await fetch(`${BASE}${p}`,{headers:hdrs(),cache:"no-store"}); if(!r.ok)throw new Error(`${r.status}`); const j=await r.json(); return (j?.results??j) as T; }

interface EmrRecord { id:number; mrn:string; patient_name:string; age:number; gender:string; blood_group:string; phone:string; allergies:string[]; chronic_conditions:string[]; last_visit:string; total_visits:number;
  records:{ id:number; date:string; type:string; doctor:string; department:string; chief_complaint:string; diagnosis:string; prescription:string[]; notes:string; }[]; }

const RECORDS:EmrRecord[]=[
  { id:1,mrn:"MRN-00482",patient_name:"Ramesh Kumar",age:45,gender:"M",blood_group:"B+",phone:"9876543210",
    allergies:["Penicillin"],chronic_conditions:["Hypertension","Type 2 Diabetes"],last_visit:"2026-05-12",total_visits:18,
    records:[
      {id:1,date:"2026-05-12",type:"OPD",doctor:"Dr. Sharma",department:"General OPD",chief_complaint:"Fever and body ache",diagnosis:"Viral Fever",prescription:["Paracetamol 500mg TDS × 5 days","ORS sachets","Rest advised"],notes:"BP: 140/90. RBS: 180. Follow-up after 5 days."},
      {id:2,date:"2026-04-10",type:"OPD",doctor:"Dr. Gupta",department:"Cardiology",chief_complaint:"BP review",diagnosis:"Hypertension — controlled",prescription:["Amlodipine 5mg OD (continue)","Losartan 50mg OD (continue)"],notes:"BP: 132/86. ECG normal. Continue current medications."},
    ]},
  { id:2,mrn:"MRN-00389",patient_name:"Priya Devi",age:32,gender:"F",blood_group:"O+",phone:"9812345678",
    allergies:[],chronic_conditions:["G3P2 — ANC care"],last_visit:"2026-05-12",total_visits:9,
    records:[
      {id:3,date:"2026-05-12",type:"OPD",doctor:"Dr. Mehta",department:"Gynaecology",chief_complaint:"ANC follow-up 32 weeks",diagnosis:"Uncomplicated ANC 32 weeks",prescription:["Iron + Folic Acid continue","Calcium 500mg BD","USG scheduled"],notes:"BP: 118/74. FHS: 148 bpm. Growth appropriate."},
    ]},
  { id:3,mrn:"MRN-00501",patient_name:"Arun Singh",age:58,gender:"M",blood_group:"A+",phone:"9898989898",
    allergies:["Sulfa drugs"],chronic_conditions:["CAD — post PTCA 2023","Dyslipidaemia"],last_visit:"2026-05-12",total_visits:24,
    records:[
      {id:4,date:"2026-05-12",type:"OPD",doctor:"Dr. Gupta",department:"Cardiology",chief_complaint:"Routine cardiac review",diagnosis:"CAD — stable, post PTCA",prescription:["Aspirin 75mg OD","Atorvastatin 40mg HS","Metoprolol 25mg BD"],notes:"BP: 126/80. Echo: EF 55%. Stress test scheduled."},
    ]},
  { id:4,mrn:"MRN-00156",patient_name:"Dinesh Pandey",age:67,gender:"M",blood_group:"AB+",phone:"9890123456",
    allergies:["Aspirin"],chronic_conditions:["Hypertension","CVA 2024 (resolved)"],last_visit:"2026-05-12",total_visits:31,
    records:[
      {id:5,date:"2026-05-12",type:"Emergency OPD",doctor:"Dr. Kumar",department:"Neurology",chief_complaint:"Sudden giddiness and unsteadiness",diagnosis:"Acute Vestibular Neuritis — r/o TIA",prescription:["Betahistine 16mg TDS","Ondansetron 4mg SOS","Admit for observation"],notes:"CT head: no acute bleed. MRI ordered. BP: 158/96. Admitted to ward B-14."},
    ]},
];

const AV=["bg-blue-100 text-blue-700","bg-purple-100 text-purple-700","bg-teal-100 text-teal-700","bg-amber-100 text-amber-700","bg-rose-100 text-rose-700"];
function ini(n:string){return n.split(" ").slice(0,2).map(w=>w[0]).join("").toUpperCase();}

export default function EmrPage(){
  const [records,setRecords]=useState<EmrRecord[]>(RECORDS);
  const [q,setQ]=useState("");
  const [results,setResults]=useState<EmrRecord[]>([]);
  const [selected,setSelected]=useState<EmrRecord|null>(null);
  const [expanded,setExpanded]=useState<number|null>(null);
  const [error,setError]=useState<string|null>(null);
  const timer=useRef<NodeJS.Timeout>();

  useEffect(()=>{
    if(q.length<2){setResults([]);return;}
    clearTimeout(timer.current);
    timer.current=setTimeout(async()=>{
      try{
        const data=await get<EmrRecord[]>(`/emr/patients/search/?q=${encodeURIComponent(q)}`);
        setResults(data.length>0?data:records.filter(r=>r.patient_name.toLowerCase().includes(q.toLowerCase())||r.mrn.toLowerCase().includes(q.toLowerCase())));
      }catch{
        setResults(records.filter(r=>r.patient_name.toLowerCase().includes(q.toLowerCase())||r.mrn.toLowerCase().includes(q.toLowerCase())));
      }
    },350);
    return ()=>clearTimeout(timer.current);
  },[q,records]);

  return(
    <div className="space-y-5 pb-8">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div><h2 className="text-2xl font-bold">EMR</h2><p className="text-sm text-muted-foreground">Electronic Medical Records — patient history, diagnoses, and prescriptions</p></div>
      </div>
      {error&&<div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 text-sm text-amber-800"><AlertTriangle className="h-4 w-4 shrink-0"/>Showing demo data.</div>}

      <div className="grid gap-5 lg:grid-cols-5">
        {/* Search panel */}
        <div className="lg:col-span-2 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
            <Input autoFocus value={q} onChange={e=>setQ(e.target.value)} className="pl-9" placeholder="Search by name or MRN…"/>
          </div>
          {q.length<2?(
            <div className="rounded-xl border bg-background p-6 text-center text-muted-foreground">
              <Search className="h-10 w-10 mx-auto mb-2 opacity-20"/>
              <p className="text-sm">Type at least 2 characters</p>
              <p className="text-xs mt-1">Search by patient name or MRN</p>
            </div>
          ):results.length===0?(
            <div className="rounded-xl border bg-background p-6 text-center text-muted-foreground"><p className="text-sm">No records found for "{q}"</p></div>
          ):(
            <div className="divide-y border rounded-xl overflow-hidden">
              {results.map((r,i)=>(
                <div key={r.id} onClick={()=>{setSelected(r);setExpanded(null);}} className={cn("flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-muted/40",selected?.id===r.id&&"bg-primary/5 border-l-2 border-l-primary")}>
                  <span className={cn("inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold",AV[i%AV.length])}>{ini(r.patient_name)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{r.patient_name}</p>
                    <p className="text-[11px] text-muted-foreground">{r.mrn} · {r.age}y · {r.total_visits} visits</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Record detail */}
        <div className="lg:col-span-3">
          {!selected?(
            <div className="flex flex-col items-center justify-center rounded-xl border bg-background py-20 text-muted-foreground">
              <FileText className="h-12 w-12 mb-3 opacity-20"/>
              <p className="text-sm font-medium">Select a patient to view records</p>
            </div>
          ):(
            <div className="space-y-4">
              {/* Patient summary */}
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <span className={cn("inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-bold",AV[selected.id%AV.length])}>{ini(selected.patient_name)}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-base">{selected.patient_name}</h3>
                        <span className="font-mono text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{selected.mrn}</span>
                        <span className="text-[11px] rounded-full px-2 py-0.5 bg-red-100 text-red-700 font-medium">{selected.blood_group}</span>
                      </div>
                      <div className="flex flex-wrap gap-3 mt-1.5 text-[12px] text-muted-foreground">
                        <span className="flex items-center gap-1"><User className="h-3 w-3"/>{selected.age}y · {selected.gender==="M"?"Male":"Female"}</span>
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3"/>Last visit: {selected.last_visit}</span>
                        <span className="flex items-center gap-1"><FileText className="h-3 w-3"/>{selected.total_visits} total visits</span>
                      </div>
                      {selected.allergies.length>0&&(
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-[11px] font-semibold text-red-600">⚠ ALLERGIES:</span>
                          {selected.allergies.map(a=><span key={a} className="text-[11px] rounded-full px-2 py-0.5 bg-red-100 text-red-700">{a}</span>)}
                        </div>
                      )}
                      {selected.chronic_conditions.length>0&&(
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          <span className="text-[11px] font-semibold text-amber-700">Chronic:</span>
                          {selected.chronic_conditions.map(c=><span key={c} className="text-[11px] rounded-full px-2 py-0.5 bg-amber-100 text-amber-700">{c}</span>)}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Visit records */}
              <div>
                <p className="text-sm font-semibold mb-3">Visit History ({selected.records.length})</p>
                <div className="space-y-2">
                  {selected.records.map(rec=>{
                    const exp2=expanded===rec.id;
                    return(
                      <Card key={rec.id} className="overflow-hidden">
                        <CardContent className="p-0">
                          <div className="flex items-center gap-4 p-4 cursor-pointer hover:bg-muted/20" onClick={()=>setExpanded(exp2?null:rec.id)}>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-semibold text-sm">{rec.diagnosis}</p>
                                <span className="text-[11px] rounded-full px-2 py-0.5 bg-blue-100 text-blue-700">{rec.type}</span>
                              </div>
                              <div className="flex flex-wrap gap-3 mt-1 text-[12px] text-muted-foreground">
                                <span>{rec.date}</span><span>· {rec.doctor}</span><span>· {rec.department}</span>
                              </div>
                            </div>
                            {exp2?<ChevronUp className="h-4 w-4 text-muted-foreground shrink-0"/>:<ChevronDown className="h-4 w-4 text-muted-foreground shrink-0"/>}
                          </div>
                          {exp2&&(
                            <div className="border-t bg-muted/20 p-4 space-y-3">
                              <div><p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Chief Complaint</p><p className="text-sm">{rec.chief_complaint}</p></div>
                              <div><p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Diagnosis</p><p className="text-sm font-medium">{rec.diagnosis}</p></div>
                              <div>
                                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1"><Pill className="h-3 w-3"/>Prescription</p>
                                <ul className="space-y-1">{rec.prescription.map((rx,i)=><li key={i} className="text-sm flex items-start gap-2"><span className="text-muted-foreground">•</span>{rx}</li>)}</ul>
                              </div>
                              {rec.notes&&<div><p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Clinical Notes</p><p className="text-sm text-muted-foreground">{rec.notes}</p></div>}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}