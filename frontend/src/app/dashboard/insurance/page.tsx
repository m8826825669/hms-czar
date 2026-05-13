"use client";
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, RefreshCw, Plus, AlertTriangle, Shield, ChevronDown, ChevronUp, FileText, CheckCircle2, XCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";
function hdrs(){ const t=useAuthStore.getState().token; return {"Content-Type":"application/json",...(t?{Authorization:`Bearer ${t}`}:{})}; }
async function get<T>(p:string):Promise<T>{ const r=await fetch(`${BASE}${p}`,{headers:hdrs(),cache:"no-store"}); if(!r.ok)throw new Error(`${r.status}`); const j=await r.json(); return (j?.results??j) as T; }

type ClaimStatus = "pre_auth_pending"|"pre_auth_approved"|"pre_auth_rejected"|"submitted"|"under_review"|"approved"|"partially_approved"|"rejected"|"settled"|"closed";
type InsuranceType = "Cashless"|"Reimbursement";

interface InsuranceClaim {
  id:number; claim_no:string; mrn:string; patient_name:string; age:number;
  gender:string; phone:string; policy_no:string; insurer:string; tpa:string;
  plan_name:string; sum_insured:number; claim_type:InsuranceType;
  admission_date:string; discharge_date:string|null; diagnosis:string;
  treating_doctor:string; claimed_amount:number; approved_amount:number|null;
  settled_amount:number|null; disallowance:number|null;
  disallowance_reason:string; status:ClaimStatus;
  pre_auth_no:string|null; submitted_at:string|null; settled_at:string|null;
  documents_pending:string[]; remarks:string;
}
interface InsuranceStats {
  active_claims:number; pre_auth_pending:number; submitted:number;
  approved:number; settled_today:number; pending_amount:number;
  settled_amount_month:number; rejection_rate:number;
}

const STATS:InsuranceStats={active_claims:28,pre_auth_pending:5,submitted:12,approved:8,settled_today:3,pending_amount:842000,settled_amount_month:2840000,rejection_rate:8};

const CLAIMS:InsuranceClaim[]=[
  { id:1,claim_no:"CLAIM/0512/001",mrn:"MRN-00692",patient_name:"Rohit Malhotra",age:42,gender:"M",phone:"9833456789",
    policy_no:"STAR/GRP/2024/00412",insurer:"Star Health Insurance",tpa:"Medi Assist",plan_name:"Star Comprehensive",sum_insured:500000,
    claim_type:"Cashless",admission_date:"2026-05-08",discharge_date:null,diagnosis:"Acute Appendicitis",
    treating_doctor:"Dr. S. Arora",claimed_amount:42000,approved_amount:40000,settled_amount:null,disallowance:2000,
    disallowance_reason:"Personal items — toiletries",status:"approved",
    pre_auth_no:"PRE/STAR/2026/00089",submitted_at:"2026-05-08",settled_at:null,
    documents_pending:[],remarks:"Approved. Settlement pending discharge." },

  { id:2,claim_no:"CLAIM/0512/003",mrn:"MRN-00621",patient_name:"Savita Rao",age:34,gender:"F",phone:"9844567890",
    policy_no:"HDFC/FAM/2025/00891",insurer:"HDFC Ergo Health",tpa:"Family Health Plan (TPA)",plan_name:"Optima Secure",sum_insured:1000000,
    claim_type:"Cashless",admission_date:"2026-05-12",discharge_date:null,diagnosis:"Normal Delivery (G2P2)",
    treating_doctor:"Dr. S. Mehta",claimed_amount:28000,approved_amount:null,settled_amount:null,disallowance:null,
    disallowance_reason:"",status:"pre_auth_pending",
    pre_auth_no:null,submitted_at:"2026-05-12",settled_at:null,
    documents_pending:["Admission note","Clinical summary"],remarks:"Pre-auth sent at 13:00. Awaiting TPA response." },

  { id:3,claim_no:"CLAIM/0512/005",mrn:"MRN-00478",patient_name:"Meena Sharma",age:58,gender:"F",phone:"9844567890",
    policy_no:"NIAC/IND/2024/01203",insurer:"National Insurance Co.",tpa:"Paramount Health Services",plan_name:"Mediclaim 2012",sum_insured:300000,
    claim_type:"Cashless",admission_date:"2026-05-12",discharge_date:null,diagnosis:"Bilateral Knee Osteoarthritis",
    treating_doctor:"Dr. P. Patel",claimed_amount:130000,approved_amount:null,settled_amount:null,disallowance:null,
    disallowance_reason:"",status:"pre_auth_pending",
    pre_auth_no:null,submitted_at:"2026-05-12",settled_at:null,
    documents_pending:["MRI report","Ortho surgeon note","Pre-op labs"],remarks:"Sum insured may be insufficient. Patient informed." },

  { id:4,claim_no:"CLAIM/0512/007",mrn:"MRN-00589",patient_name:"Hamid Khan",age:61,gender:"M",phone:"9855678901",
    policy_no:"BAJAJ/CORP/2025/00234",insurer:"Bajaj Allianz",tpa:"Vidal Health",plan_name:"Health Guard",sum_insured:1000000,
    claim_type:"Cashless",admission_date:"2026-05-11",discharge_date:null,diagnosis:"Acute STEMI",
    treating_doctor:"Dr. R. Gupta",claimed_amount:120000,approved_amount:null,settled_amount:null,disallowance:null,
    disallowance_reason:"",status:"pre_auth_approved",
    pre_auth_no:"PRE/BAJAJ/2026/00214",submitted_at:"2026-05-11",settled_at:null,
    documents_pending:["Cath lab report"],remarks:"Pre-auth approved ₹1,20,000. CABG pre-auth extension may be needed." },

  { id:5,claim_no:"CLAIM/0412/018",mrn:"MRN-00312",patient_name:"Suresh Nair",age:35,gender:"M",phone:"9867890123",
    policy_no:"STAR/IND/2023/00567",insurer:"Star Health Insurance",tpa:"Medi Assist",plan_name:"Star Comprehensive",sum_insured:500000,
    claim_type:"Cashless",admission_date:"2026-04-20",discharge_date:"2026-04-25",diagnosis:"Road Traffic Accident — Polytrauma",
    treating_doctor:"Dr. P. Patel",claimed_amount:85000,approved_amount:78000,settled_amount:78000,disallowance:7000,
    disallowance_reason:"Non-medical expenses, attendant charges",status:"settled",
    pre_auth_no:"PRE/STAR/2026/00045",submitted_at:"2026-04-20",settled_at:"2026-05-05",
    documents_pending:[],remarks:"Settled. Disallowance of ₹7,000 collected from patient." },

  { id:6,claim_no:"CLAIM/0312/009",mrn:"MRN-00198",patient_name:"Mohan Kaul",age:62,gender:"M",phone:"9823456789",
    policy_no:"UIIC/SEN/2024/00891",insurer:"United India Insurance",tpa:"Heritage Health",plan_name:"Senior Citizen",sum_insured:200000,
    claim_type:"Reimbursement",admission_date:"2026-03-10",discharge_date:"2026-03-18",diagnosis:"COPD — Exacerbation",
    treating_doctor:"Dr. V. Kumar",claimed_amount:64000,approved_amount:52000,settled_amount:52000,disallowance:12000,
    disallowance_reason:"Certain medicines not covered; attendant charges",status:"settled",
    pre_auth_no:null,submitted_at:"2026-03-22",settled_at:"2026-04-15",
    documents_pending:[],remarks:"Reimbursement credited to patient's account." },

  { id:7,claim_no:"CLAIM/0412/024",mrn:"MRN-00156",patient_name:"Dinesh Pandey",age:67,gender:"M",phone:"9890123456",
    policy_no:"NIAC/SEN/2023/00412",insurer:"National Insurance Co.",tpa:"Paramount Health",plan_name:"Mediclaim",sum_insured:100000,
    claim_type:"Cashless",admission_date:"2026-05-12",discharge_date:null,diagnosis:"CVA — TIA query",
    treating_doctor:"Dr. V. Kumar",claimed_amount:45000,approved_amount:null,settled_amount:null,disallowance:null,
    disallowance_reason:"",status:"submitted",
    pre_auth_no:"PRE/NIAC/2026/00312",submitted_at:"2026-05-12",settled_at:null,
    documents_pending:["MRI report (pending)"],remarks:"Pre-auth submitted. MRI report awaited." },
];

const CSC:Record<ClaimStatus,{label:string;cls:string;dot:string}>={
  pre_auth_pending:    {label:"Pre-Auth Pending",   cls:"bg-slate-100 text-slate-600",    dot:"bg-slate-400"},
  pre_auth_approved:   {label:"Pre-Auth Approved",  cls:"bg-teal-100 text-teal-700",      dot:"bg-teal-500"},
  pre_auth_rejected:   {label:"Pre-Auth Rejected",  cls:"bg-red-100 text-red-700",        dot:"bg-red-500"},
  submitted:           {label:"Submitted",          cls:"bg-blue-100 text-blue-700",      dot:"bg-blue-500"},
  under_review:        {label:"Under Review",       cls:"bg-purple-100 text-purple-700",  dot:"bg-purple-500"},
  approved:            {label:"Approved",           cls:"bg-green-100 text-green-700",    dot:"bg-green-500"},
  partially_approved:  {label:"Partial Approval",   cls:"bg-amber-100 text-amber-700",    dot:"bg-amber-500"},
  rejected:            {label:"Rejected",           cls:"bg-red-100 text-red-700",        dot:"bg-red-500"},
  settled:             {label:"Settled",            cls:"bg-green-200 text-green-800",    dot:"bg-green-600"},
  closed:              {label:"Closed",             cls:"bg-slate-100 text-slate-500",    dot:"bg-slate-400"},
};
const INSURER_COLORS:Record<string,string>={
  "Star Health Insurance":"bg-red-100 text-red-700",
  "HDFC Ergo Health":"bg-blue-100 text-blue-700",
  "National Insurance Co.":"bg-green-100 text-green-700",
  "Bajaj Allianz":"bg-amber-100 text-amber-700",
  "United India Insurance":"bg-purple-100 text-purple-700",
  "New India Assurance":"bg-teal-100 text-teal-700",
};
const AV=["bg-blue-100 text-blue-700","bg-purple-100 text-purple-700","bg-teal-100 text-teal-700","bg-amber-100 text-amber-700","bg-rose-100 text-rose-700"];
function ini(n:string){return n.split(" ").slice(0,2).map(w=>w[0]).join("").toUpperCase();}
function fmt(n:number){return `₹${n.toLocaleString("en-IN")}`;}
const STATUS_GROUPS:{label:string;statuses:ClaimStatus[]}[]=[
  {label:"All",              statuses:[]},
  {label:"Pre-Auth",         statuses:["pre_auth_pending","pre_auth_approved","pre_auth_rejected"]},
  {label:"Active",           statuses:["submitted","under_review","approved","partially_approved"]},
  {label:"Settled / Closed", statuses:["settled","closed"]},
  {label:"Rejected",         statuses:["rejected","pre_auth_rejected"]},
];

export default function InsurancePage(){
  const [claims,setClaims]=useState<InsuranceClaim[]>(CLAIMS);
  const [q,setQ]=useState("");
  const [tab,setTab]=useState("All");
  const [expanded,setExpanded]=useState<number|null>(null);
  const [error,setError]=useState<string|null>(null);

  const fetchData=useCallback(async()=>{
    try{
      const[c]=await Promise.allSettled([get<InsuranceClaim[]>("/insurance/claims/")]);
      if(c.status==="fulfilled"&&(c.value as InsuranceClaim[]).length>0) setClaims(c.value as InsuranceClaim[]);
      setError(null);
    }catch{setError("Showing demo data.");}
  },[]);
  useEffect(()=>{fetchData();},[fetchData]);

  const updateStatus=(id:number,status:ClaimStatus)=>setClaims(p=>p.map(c=>c.id===id?{...c,status}:c));

  const pending=claims.filter(c=>["pre_auth_pending","submitted","under_review"].includes(c.status));
  const activeAmount=claims.filter(c=>!["settled","closed","rejected"].includes(c.status)).reduce((s,c)=>s+c.claimed_amount,0);

  const displayed=claims.filter(c=>{
    const mq=!q||c.patient_name.toLowerCase().includes(q.toLowerCase())||c.claim_no.toLowerCase().includes(q.toLowerCase())||c.mrn.toLowerCase().includes(q.toLowerCase())||c.insurer.toLowerCase().includes(q.toLowerCase());
    const group=STATUS_GROUPS.find(g=>g.label===tab);
    const mt=tab==="All"||!group||group.statuses.length===0||group.statuses.includes(c.status);
    return mq&&mt;
  });

  return(
    <div className="space-y-5 pb-8">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div><h2 className="text-2xl font-bold">Insurance</h2><p className="text-sm text-muted-foreground">Claims management, pre-authorisation, TPA coordination, and settlement tracking</p></div>
        <div className="flex gap-2">
          <button onClick={fetchData} className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"><RefreshCw className="h-3.5 w-3.5"/>Refresh</button>
          <Button className="gap-2"><Plus className="h-4 w-4"/>New Claim</Button>
        </div>
      </div>
      {error&&<div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 text-sm text-amber-800"><AlertTriangle className="h-4 w-4 shrink-0"/>Showing demo data.</div>}

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {label:"Active Claims",        value:STATS.active_claims,                       sub:"Currently open",         color:"border-l-blue-500"},
          {label:"Pending Amount",       value:fmt(activeAmount),                          sub:`${pending.length} awaiting decision`, color:"border-l-amber-500"},
          {label:"Settled This Month",   value:fmt(STATS.settled_amount_month),            sub:"All insurers combined",  color:"border-l-green-500"},
          {label:"Rejection Rate",       value:`${STATS.rejection_rate}%`,                 sub:"Last 30 days",           color:"border-l-red-500"},
        ].map(s=>(
          <div key={s.label} className={cn("rounded-xl border bg-background px-5 py-4 border-l-[3px]",s.color)}>
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-sm font-medium mt-0.5">{s.label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Pending action alert */}
      {pending.length>0&&(
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
          <p className="text-sm font-semibold text-amber-800 flex items-center gap-2 mb-2"><Clock className="h-4 w-4"/>{pending.length} claims awaiting action</p>
          <div className="flex flex-wrap gap-2">
            {pending.map(c=>(
              <span key={c.id} className={cn("rounded-full px-2.5 py-1 text-[11px] font-medium",CSC[c.status].cls)}>
                {c.patient_name} — {CSC[c.status].label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Search + Tabs */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
          <Input value={q} onChange={e=>setQ(e.target.value)} className="pl-9" placeholder="Search by patient, claim no, MRN, or insurer…"/>
        </div>
      </div>
      <div className="flex border-b overflow-x-auto">
        {STATUS_GROUPS.map(g=>(
          <button key={g.label} onClick={()=>setTab(g.label)}
            className={cn("flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors whitespace-nowrap",
              tab===g.label?"border-primary text-primary":"border-transparent text-muted-foreground hover:text-foreground")}>
            {g.label}
            <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold",tab===g.label?"bg-primary text-primary-foreground":"bg-muted text-muted-foreground")}>
              {g.label==="All"?claims.length:claims.filter(c=>g.statuses.includes(c.status)).length}
            </span>
          </button>
        ))}
      </div>

      {/* Claims */}
      <div className="space-y-2">
        {displayed.map((claim,i)=>{
          const exp=expanded===claim.id;
          const sc=CSC[claim.status];
          const ic=INSURER_COLORS[claim.insurer]??"bg-slate-100 text-slate-600";
          return(
            <Card key={claim.id} className={cn("overflow-hidden",
              claim.status==="pre_auth_pending"&&"border-amber-200",
              claim.status==="approved"&&"border-green-200",
              claim.status==="rejected"&&"border-red-200")}>
              <CardContent className="p-0">
                <div className="flex items-center gap-4 p-4 cursor-pointer hover:bg-muted/20" onClick={()=>setExpanded(exp?null:claim.id)}>
                  <span className={cn("inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold",AV[i%AV.length])}>{ini(claim.patient_name)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-[14px]">{claim.patient_name}</p>
                      <span className="font-mono text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{claim.claim_no}</span>
                      <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",sc.cls)}>
                        <span className={cn("h-1.5 w-1.5 rounded-full",sc.dot)}/>{sc.label}
                      </span>
                      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium",claim.claim_type==="Cashless"?"bg-teal-100 text-teal-700":"bg-blue-100 text-blue-700")}>{claim.claim_type}</span>
                    </div>
                    <div className="flex flex-wrap gap-3 mt-1 text-[12px] text-muted-foreground">
                      <span className={cn("rounded px-1.5 py-0.5 text-[11px]",ic)}>{claim.insurer}</span>
                      <span>· {claim.tpa}</span>
                      <span>· {claim.mrn}</span>
                      <span>· {claim.diagnosis}</span>
                    </div>
                    {claim.documents_pending.length>0&&(
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span className="text-[11px] text-amber-600 font-medium">⚠ Docs pending:</span>
                        {claim.documents_pending.map((d,j)=><span key={j} className="rounded px-1.5 py-0.5 text-[10px] bg-amber-100 text-amber-700">{d}</span>)}
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0 min-w-[120px]">
                    <p className="font-bold text-base">{fmt(claim.claimed_amount)}</p>
                    {claim.approved_amount!=null&&<p className="text-[11px] text-green-600 font-medium">Approved: {fmt(claim.approved_amount)}</p>}
                    {claim.settled_amount!=null&&<p className="text-[11px] text-teal-600 font-medium">Settled: {fmt(claim.settled_amount)}</p>}
                    {claim.disallowance!=null&&claim.disallowance>0&&<p className="text-[11px] text-red-500">Disallowed: {fmt(claim.disallowance)}</p>}
                  </div>
                  {exp?<ChevronUp className="h-4 w-4 text-muted-foreground shrink-0"/>:<ChevronDown className="h-4 w-4 text-muted-foreground shrink-0"/>}
                </div>

                {exp&&(
                  <div className="border-t bg-muted/20 p-4 space-y-4">
                    {/* Policy details */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-[12px]">
                      <div><p className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wide mb-1">Policy No</p><p className="font-mono">{claim.policy_no}</p></div>
                      <div><p className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wide mb-1">Plan</p><p>{claim.plan_name}</p></div>
                      <div><p className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wide mb-1">Sum Insured</p><p className="font-semibold">{fmt(claim.sum_insured)}</p></div>
                      <div><p className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wide mb-1">Pre-Auth No</p><p className="font-mono">{claim.pre_auth_no??"Not issued"}</p></div>
                      <div><p className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wide mb-1">Admission</p><p>{claim.admission_date}</p></div>
                      <div><p className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wide mb-1">Discharge</p><p>{claim.discharge_date??"Ongoing"}</p></div>
                      <div><p className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wide mb-1">Submitted</p><p>{claim.submitted_at??"—"}</p></div>
                      <div><p className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wide mb-1">Settled</p><p>{claim.settled_at??"—"}</p></div>
                    </div>

                    {/* Financial summary */}
                    <div className="rounded-lg border bg-background p-3">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Financial Summary</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[12px]">
                        <div><p className="text-muted-foreground">Claimed</p><p className="font-bold text-base">{fmt(claim.claimed_amount)}</p></div>
                        <div><p className="text-muted-foreground">Approved</p><p className={cn("font-bold text-base",claim.approved_amount!=null?"text-green-600":"text-muted-foreground")}>{claim.approved_amount!=null?fmt(claim.approved_amount):"Pending"}</p></div>
                        <div><p className="text-muted-foreground">Disallowed</p><p className={cn("font-bold text-base",claim.disallowance&&claim.disallowance>0?"text-red-600":"text-muted-foreground")}>{claim.disallowance&&claim.disallowance>0?fmt(claim.disallowance):"—"}</p></div>
                        <div><p className="text-muted-foreground">Settled</p><p className={cn("font-bold text-base",claim.settled_amount!=null?"text-teal-600":"text-muted-foreground")}>{claim.settled_amount!=null?fmt(claim.settled_amount):"Pending"}</p></div>
                      </div>
                      {claim.disallowance_reason&&<p className="text-[11px] text-red-600 mt-2">Disallowance reason: {claim.disallowance_reason}</p>}
                    </div>

                    {claim.remarks&&<div className="rounded-lg bg-blue-50 border border-blue-100 p-3 text-[12px] text-blue-800"><span className="font-semibold">Remarks:</span> {claim.remarks}</div>}

                    {/* Actions */}
                    <div className="flex gap-2 flex-wrap pt-2 border-t">
                      <button className="flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"><FileText className="h-3 w-3"/>Documents</button>
                      {claim.status==="pre_auth_pending"&&<button onClick={()=>updateStatus(claim.id,"pre_auth_approved")} className="flex items-center gap-1 rounded-md bg-teal-600 px-3 py-1.5 text-xs text-white font-medium hover:bg-teal-700"><CheckCircle2 className="h-3 w-3"/>Mark Pre-Auth Approved</button>}
                      {claim.status==="pre_auth_approved"&&<button onClick={()=>updateStatus(claim.id,"submitted")} className="flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs text-white font-medium hover:bg-blue-700"><FileText className="h-3 w-3"/>Submit Claim</button>}
                      {claim.status==="submitted"&&<button onClick={()=>updateStatus(claim.id,"approved")} className="flex items-center gap-1 rounded-md bg-green-600 px-3 py-1.5 text-xs text-white font-medium hover:bg-green-700"><CheckCircle2 className="h-3 w-3"/>Mark Approved</button>}
                      {claim.status==="approved"&&<button onClick={()=>updateStatus(claim.id,"settled")} className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs text-white font-medium hover:bg-primary/90"><CheckCircle2 className="h-3 w-3"/>Mark Settled</button>}
                      {["pre_auth_pending","submitted","under_review"].includes(claim.status)&&<button onClick={()=>updateStatus(claim.id,"rejected")} className="flex items-center gap-1 rounded-md border border-red-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"><XCircle className="h-3 w-3"/>Reject</button>}
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