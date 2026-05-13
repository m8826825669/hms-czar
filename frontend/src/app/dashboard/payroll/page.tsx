"use client";
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, RefreshCw, Plus, AlertTriangle, IndianRupee, ChevronDown, ChevronUp, CheckCircle2, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";
function hdrs(){ const t=useAuthStore.getState().token; return {"Content-Type":"application/json",...(t?{Authorization:`Bearer ${t}`}:{})}; }
async function get<T>(p:string):Promise<T>{ const r=await fetch(`${BASE}${p}`,{headers:hdrs(),cache:"no-store"}); if(!r.ok)throw new Error(`${r.status}`); const j=await r.json(); return (j?.results??j) as T; }

type PayStatus = "pending"|"processed"|"paid"|"on_hold";
interface PayslipEntry {
  id:number; emp_code:string; name:string; designation:string; department:string;
  basic:number; hra:number; da:number; ta:number; other_allowance:number;
  gross:number; pf:number; esic:number; tds:number; other_deduction:number;
  total_deduction:number; net_pay:number; days_worked:number; days_absent:number;
  leaves_taken:number; overtime_hrs:number; overtime_pay:number;
  status:PayStatus; payment_mode:string; bank_account:string; month:string;
}
interface PayrollStats { total_employees:number; processed:number; paid:number; pending:number; total_gross:number; total_net:number; total_deductions:number; }

const MONTH="May 2026";
const STATS:PayrollStats={total_employees:184,processed:160,paid:140,pending:24,total_gross:9840000,total_net:8420000,total_deductions:1420000};
const PAYSLIPS:PayslipEntry[]=[
  {id:1, emp_code:"EMP-001",name:"Dr. Arvind Sharma",    designation:"Senior Physician",  department:"General Medicine", basic:80000,hra:32000,da:8000,ta:3000,other_allowance:5000,gross:128000,pf:9600,esic:0,tds:12000,other_deduction:0,total_deduction:21600,net_pay:106400,days_worked:26,days_absent:0,leaves_taken:0,overtime_hrs:0,overtime_pay:0,status:"paid",payment_mode:"Bank Transfer",bank_account:"XXXX-1234",month:MONTH},
  {id:2, emp_code:"EMP-002",name:"Dr. Sneha Mehta",      designation:"Gynaecologist",     department:"Gynaecology",      basic:90000,hra:36000,da:9000,ta:3000,other_allowance:5000,gross:143000,pf:10800,esic:0,tds:15000,other_deduction:0,total_deduction:25800,net_pay:117200,days_worked:24,days_absent:2,leaves_taken:2,overtime_hrs:0,overtime_pay:0,status:"paid",payment_mode:"Bank Transfer",bank_account:"XXXX-5678",month:MONTH},
  {id:3, emp_code:"EMP-015",name:"Sr. Kavya Reddy",      designation:"Staff Nurse",       department:"ICU",              basic:32000,hra:12800,da:3200,ta:1600,other_allowance:2000,gross:51600,pf:3840,esic:0,tds:0,other_deduction:0,total_deduction:3840,net_pay:47760,days_worked:26,days_absent:0,leaves_taken:0,overtime_hrs:8,overtime_pay:3200,status:"paid",payment_mode:"Bank Transfer",bank_account:"XXXX-9012",month:MONTH},
  {id:4, emp_code:"EMP-031",name:"Ravi Kumar",            designation:"Pharmacist",        department:"Pharmacy",         basic:28000,hra:11200,da:2800,ta:1400,other_allowance:1500,gross:44900,pf:3360,esic:280,tds:0,other_deduction:0,total_deduction:3640,net_pay:41260,days_worked:26,days_absent:0,leaves_taken:0,overtime_hrs:4,overtime_pay:1400,status:"processed",payment_mode:"Bank Transfer",bank_account:"XXXX-3456",month:MONTH},
  {id:5, emp_code:"EMP-042",name:"Meena Iyer",            designation:"Lab Technician",    department:"Laboratory",       basic:24000,hra:9600,da:2400,ta:1200,other_allowance:1200,gross:38400,pf:2880,esic:240,tds:0,other_deduction:2000,total_deduction:5120,net_pay:33280,days_worked:12,days_absent:14,leaves_taken:14,overtime_hrs:0,overtime_pay:0,status:"processed",payment_mode:"Bank Transfer",bank_account:"XXXX-7890",month:MONTH},
  {id:6, emp_code:"EMP-058",name:"Ramesh Yadav",          designation:"Ambulance Driver",  department:"Ambulance",        basic:20000,hra:8000,da:2000,ta:1000,other_allowance:1000,gross:32000,pf:2400,esic:200,tds:0,other_deduction:0,total_deduction:2600,net_pay:29400,days_worked:26,days_absent:0,leaves_taken:0,overtime_hrs:12,overtime_pay:2400,status:"processed",payment_mode:"Bank Transfer",bank_account:"XXXX-1122",month:MONTH},
  {id:7, emp_code:"EMP-073",name:"Priya Sharma",          designation:"Receptionist",      department:"Reception",        basic:22000,hra:8800,da:2200,ta:1100,other_allowance:1000,gross:35100,pf:2640,esic:220,tds:0,other_deduction:0,total_deduction:2860,net_pay:32240,days_worked:26,days_absent:0,leaves_taken:0,overtime_hrs:0,overtime_pay:0,status:"pending",payment_mode:"Bank Transfer",bank_account:"XXXX-3344",month:MONTH},
  {id:8, emp_code:"EMP-089",name:"Anil Gupta",            designation:"Records Officer",   department:"Medical Records",  basic:18000,hra:7200,da:1800,ta:900,other_allowance:800,gross:28700,pf:2160,esic:180,tds:0,other_deduction:0,total_deduction:2340,net_pay:26360,days_worked:26,days_absent:0,leaves_taken:0,overtime_hrs:0,overtime_pay:0,status:"on_hold",payment_mode:"Bank Transfer",bank_account:"XXXX-5566",month:MONTH},
];

const PSC:Record<PayStatus,{label:string;cls:string}>={
  pending:  {label:"Pending",   cls:"bg-amber-100 text-amber-700"},
  processed:{label:"Processed", cls:"bg-blue-100 text-blue-700"},
  paid:     {label:"Paid",      cls:"bg-green-100 text-green-700"},
  on_hold:  {label:"On Hold",   cls:"bg-red-100 text-red-700"},
};
const AV=["bg-blue-100 text-blue-700","bg-purple-100 text-purple-700","bg-teal-100 text-teal-700","bg-amber-100 text-amber-700","bg-rose-100 text-rose-700"];
function ini(n:string){return n.split(" ").filter(w=>!["Dr.","Sr."].includes(w)).slice(0,2).map(w=>w[0]).join("").toUpperCase();}
function fmt(n:number){return `₹${n.toLocaleString("en-IN")}`;}

export default function PayrollPage(){
  const [payslips,setPayslips]=useState<PayslipEntry[]>(PAYSLIPS);
  const [q,setQ]=useState("");
  const [tab,setTab]=useState<PayStatus|"all">("all");
  const [expanded,setExpanded]=useState<number|null>(null);
  const [error,setError]=useState<string|null>(null);

  const fetchData=useCallback(async()=>{
    try{const[p]=await Promise.allSettled([get<PayslipEntry[]>(`/payroll/payslips/?month=${MONTH}`)]);
      if(p.status==="fulfilled"&&(p.value as PayslipEntry[]).length>0)setPayslips(p.value as PayslipEntry[]);
      setError(null);}catch{setError("Showing demo data.");}
  },[]);
  useEffect(()=>{fetchData();},[fetchData]);

  const markPaid=(id:number)=>setPayslips(p=>p.map(s=>s.id===id?{...s,status:"paid"}:s));

  const displayed=payslips.filter(p=>{
    const mq=!q||p.name.toLowerCase().includes(q.toLowerCase())||p.emp_code.toLowerCase().includes(q.toLowerCase())||p.department.toLowerCase().includes(q.toLowerCase());
    const mt=tab==="all"||p.status===tab;
    return mq&&mt;
  });

  const totalNet=payslips.filter(p=>p.status!=="on_hold").reduce((s,p)=>s+p.net_pay,0);
  const totalPaid=payslips.filter(p=>p.status==="paid").reduce((s,p)=>s+p.net_pay,0);

  return(
    <div className="space-y-5 pb-8">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div><h2 className="text-2xl font-bold">Payroll</h2><p className="text-sm text-muted-foreground">Salary processing, payslips, and disbursement — {MONTH}</p></div>
        <div className="flex gap-2">
          <button onClick={fetchData} className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"><RefreshCw className="h-3.5 w-3.5"/>Refresh</button>
          <Button variant="outline" className="gap-2"><Download className="h-4 w-4"/>Export</Button>
          <Button className="gap-2"><CheckCircle2 className="h-4 w-4"/>Process All</Button>
        </div>
      </div>
      {error&&<div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 text-sm text-amber-800"><AlertTriangle className="h-4 w-4 shrink-0"/>Showing demo data.</div>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[{l:"Total Payroll",  v:fmt(totalNet),    c:"border-l-blue-500"},{l:"Disbursed",       v:fmt(totalPaid),   c:"border-l-green-500"},
          {l:"Pending",       v:fmt(totalNet-totalPaid), c:"border-l-amber-500"},{l:"On Hold",  v:payslips.filter(p=>p.status==="on_hold").length+" employees",c:"border-l-red-500"},
        ].map(s=><div key={s.l} className={cn("rounded-xl border bg-background px-4 py-4 border-l-[3px]",s.c)}><p className="text-2xl font-bold">{s.v}</p><p className="text-xs text-muted-foreground mt-0.5">{s.l}</p></div>)}
      </div>

      {/* Progress bar */}
      <div className="rounded-xl border bg-background p-4">
        <div className="flex justify-between text-[12px] mb-2">
          <span className="font-medium">Disbursement progress — {MONTH}</span>
          <span className="text-muted-foreground">{payslips.filter(p=>p.status==="paid").length}/{payslips.length} employees paid</span>
        </div>
        <div className="h-2.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full bg-green-500 transition-all" style={{width:`${Math.round(payslips.filter(p=>p.status==="paid").length/payslips.length*100)}%`}}/>
        </div>
        <div className="flex gap-4 mt-2 text-[11px]">
          {[{l:"Paid",c:"bg-green-500"},{l:"Processed",c:"bg-blue-500"},{l:"Pending",c:"bg-amber-500"},{l:"On Hold",c:"bg-red-500"}].map(s=>(
            <span key={s.l} className="flex items-center gap-1 text-muted-foreground"><span className={cn("h-2 w-2 rounded-full",s.c)}/>{s.l}: {payslips.filter(p=>p.status===s.l.toLowerCase().replace(" ","_")).length}</span>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/><Input value={q} onChange={e=>setQ(e.target.value)} className="pl-9" placeholder="Search by name, code, or department…"/></div>
        <div className="flex rounded-md border overflow-hidden text-xs">
          {(["all","pending","processed","paid","on_hold"] as const).map(v=>(
            <button key={v} onClick={()=>setTab(v)} className={cn("px-3 py-2 font-medium transition-colors",tab===v?"bg-primary text-primary-foreground":"bg-background text-muted-foreground hover:bg-muted")}>
              {v==="all"?"All":v==="on_hold"?"On Hold":v.charAt(0).toUpperCase()+v.slice(1)} ({v==="all"?payslips.length:payslips.filter(p=>p.status===v).length})
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {displayed.map((ps,i)=>{const exp=expanded===ps.id;const sc=PSC[ps.status];return(
          <Card key={ps.id} className="overflow-hidden">
            <CardContent className="p-0">
              <div className="flex items-center gap-4 p-4 cursor-pointer hover:bg-muted/20" onClick={()=>setExpanded(exp?null:ps.id)}>
                <span className={cn("inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold",AV[i%AV.length])}>{ini(ps.name)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-[14px]">{ps.name}</p>
                    <span className="font-mono text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{ps.emp_code}</span>
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium",sc.cls)}>{sc.label}</span>
                  </div>
                  <div className="flex flex-wrap gap-3 mt-1 text-[12px] text-muted-foreground">
                    <span>{ps.designation}</span><span>· {ps.department}</span>
                    <span>· {ps.days_worked}d worked</span>
                    {ps.days_absent>0&&<span className="text-amber-600">· {ps.days_absent}d absent</span>}
                    {ps.overtime_hrs>0&&<span className="text-green-600">· {ps.overtime_hrs}h OT</span>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-base">{fmt(ps.net_pay)}</p>
                  <p className="text-[11px] text-muted-foreground">Gross: {fmt(ps.gross)}</p>
                </div>
                {exp?<ChevronUp className="h-4 w-4 text-muted-foreground shrink-0"/>:<ChevronDown className="h-4 w-4 text-muted-foreground shrink-0"/>}
              </div>
              {exp&&(
                <div className="border-t bg-muted/20 p-4 grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Earnings</p>
                    <div className="space-y-1 text-[12px]">
                      {[["Basic",ps.basic],["HRA",ps.hra],["DA",ps.da],["TA",ps.ta],["Other Allowance",ps.other_allowance],ps.overtime_pay>0?["Overtime",ps.overtime_pay]:null].filter(Boolean).map(([k,v])=>(
                        <div key={k as string} className="flex justify-between"><span className="text-muted-foreground">{k}</span><span>{fmt(v as number)}</span></div>
                      ))}
                      <div className="flex justify-between font-bold border-t pt-1"><span>Gross</span><span className="text-green-600">{fmt(ps.gross)}</span></div>
                    </div>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Deductions</p>
                    <div className="space-y-1 text-[12px]">
                      {[["PF",ps.pf],["ESIC",ps.esic],["TDS",ps.tds],ps.other_deduction>0?["Other",ps.other_deduction]:null].filter(Boolean).map(([k,v])=>(
                        <div key={k as string} className="flex justify-between"><span className="text-muted-foreground">{k}</span><span className="text-red-600">− {fmt(v as number)}</span></div>
                      ))}
                      <div className="flex justify-between font-bold border-t pt-1"><span>Net Pay</span><span className="text-primary">{fmt(ps.net_pay)}</span></div>
                    </div>
                    <div className="mt-3 text-[11px] text-muted-foreground">
                      <p>Bank: {ps.bank_account} · {ps.payment_mode}</p>
                    </div>
                    {(ps.status==="processed"||ps.status==="pending")&&(
                      <button onClick={()=>markPaid(ps.id)} className="mt-3 flex items-center gap-1 rounded-md bg-green-600 px-3 py-1.5 text-xs text-white font-medium hover:bg-green-700"><CheckCircle2 className="h-3 w-3"/>Mark Paid</button>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );})}
      </div>
    </div>
  );
}