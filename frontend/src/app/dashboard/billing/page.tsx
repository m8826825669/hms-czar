"use client";
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, RefreshCw, Plus, AlertTriangle, Receipt, ChevronDown, ChevronUp, Printer, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";
function hdrs(){ const t=useAuthStore.getState().token; return {"Content-Type":"application/json",...(t?{Authorization:`Bearer ${t}`}:{})}; }
async function get<T>(p:string):Promise<T>{ const r=await fetch(`${BASE}${p}`,{headers:hdrs(),cache:"no-store"}); if(!r.ok)throw new Error(`${r.status}`); const j=await r.json(); return (j?.results??j) as T; }

type PaymentMode = "cash"|"card"|"upi"|"insurance"|"credit";
type BillStatus  = "draft"|"generated"|"paid"|"partial"|"waived"|"cancelled";
type BillType    = "OPD"|"IPD"|"Emergency"|"Lab"|"Pharmacy"|"OT"|"Radiology";

interface BillItem  { description:string; qty:number; rate:number; amount:number; category:string; }
interface Bill {
  id:number; bill_no:string; mrn:string; patient_name:string; age:number;
  gender:string; phone:string; bill_type:BillType; department:string;
  doctor_name:string; items:BillItem[]; subtotal:number; discount:number;
  discount_reason:string; tax:number; net_amount:number; paid_amount:number;
  due_amount:number; payment_mode:PaymentMode; insurance_claim:string|null;
  status:BillStatus; generated_at:string; paid_at:string|null; cashier:string;
}
interface BillingStats {
  bills_today:number; revenue_today:number; collected_today:number;
  pending_amount:number; insurance_pending:number; discount_given:number;
}

const STATS:BillingStats={bills_today:89,revenue_today:386400,collected_today:310800,pending_amount:75600,insurance_pending:142000,discount_given:18200};

const BILLS:Bill[]=[
  { id:1, bill_no:"BILL/0512/001", mrn:"MRN-00482", patient_name:"Ramesh Kumar", age:45, gender:"M", phone:"9876543210",
    bill_type:"OPD", department:"General OPD", doctor_name:"Dr. Sharma", status:"paid", payment_mode:"cash",
    generated_at:"09:30", paid_at:"09:35", cashier:"Cashier Ravi", insurance_claim:null,
    items:[{description:"OPD Consultation",qty:1,rate:400,amount:400,category:"Consultation"},{description:"ECG",qty:1,rate:200,amount:200,category:"Procedure"},{description:"Medicine (Pharmacy)",qty:1,rate:340,amount:340,category:"Pharmacy"}],
    subtotal:940,discount:0,discount_reason:"",tax:0,net_amount:940,paid_amount:940,due_amount:0 },

  { id:2, bill_no:"BILL/0512/002", mrn:"MRN-00501", patient_name:"Arun Singh", age:58, gender:"M", phone:"9898989898",
    bill_type:"OPD", department:"Cardiology", doctor_name:"Dr. Gupta", status:"paid", payment_mode:"card",
    generated_at:"10:15", paid_at:"10:22", cashier:"Cashier Seema", insurance_claim:null,
    items:[{description:"Cardiology Consultation",qty:1,rate:800,amount:800,category:"Consultation"},{description:"Stress Test (TMT)",qty:1,rate:1800,amount:1800,category:"Procedure"},{description:"Lipid Profile",qty:1,rate:600,amount:600,category:"Lab"}],
    subtotal:3200,discount:200,discount_reason:"Senior citizen",tax:0,net_amount:3000,paid_amount:3000,due_amount:0 },

  { id:3, bill_no:"BILL/0512/005", mrn:"MRN-00692", patient_name:"Rohit Malhotra", age:42, gender:"M", phone:"9833456789",
    bill_type:"IPD", department:"Surgical Ward", doctor_name:"Dr. Arora", status:"partial", payment_mode:"insurance",
    generated_at:"11:00", paid_at:null, cashier:"Cashier Ravi", insurance_claim:"CLAIM/0512/003",
    items:[{description:"Room Charges (Ward) × 4 days",qty:4,rate:2500,amount:10000,category:"Room"},{description:"Surgery — Appendectomy",qty:1,rate:18000,amount:18000,category:"Surgery"},{description:"Anaesthesia Charges",qty:1,rate:5000,amount:5000,category:"Procedure"},{description:"OT Charges",qty:1,rate:3000,amount:3000,category:"OT"},{description:"Medicines & Consumables",qty:1,rate:4200,amount:4200,category:"Pharmacy"},{description:"Lab Tests",qty:1,rate:1800,amount:1800,category:"Lab"}],
    subtotal:42000,discount:2000,discount_reason:"Insurance TPA discount",tax:0,net_amount:40000,paid_amount:25000,due_amount:15000 },

  { id:4, bill_no:"BILL/0512/008", mrn:"MRN-00589", patient_name:"Hamid Khan", age:61, gender:"M", phone:"9855678901",
    bill_type:"Emergency", department:"ICU", doctor_name:"Dr. Gupta", status:"generated", payment_mode:"insurance",
    generated_at:"12:00", paid_at:null, cashier:"Cashier Seema", insurance_claim:"CLAIM/0512/007",
    items:[{description:"Emergency Admission",qty:1,rate:5000,amount:5000,category:"Admission"},{description:"ICU Charges × 1 day",qty:1,rate:8000,amount:8000,category:"Room"},{description:"Cardiac Monitoring",qty:1,rate:3000,amount:3000,category:"Procedure"},{description:"Medicines & IV Fluids",qty:1,rate:6200,amount:6200,category:"Pharmacy"},{description:"ECG × 3",qty:3,rate:200,amount:600,category:"Procedure"},{description:"Lab — Troponin, CBC, BMP",qty:1,rate:2400,amount:2400,category:"Lab"}],
    subtotal:25200,discount:0,discount_reason:"",tax:0,net_amount:25200,paid_amount:0,due_amount:25200 },

  { id:5, bill_no:"BILL/0512/011", mrn:"MRN-00271", patient_name:"Sunita Joshi", age:27, gender:"F", phone:"9871234567",
    bill_type:"OPD", department:"General OPD", doctor_name:"Dr. Sharma", status:"paid", payment_mode:"upi",
    generated_at:"12:30", paid_at:"12:33", cashier:"Cashier Ravi", insurance_claim:null,
    items:[{description:"OPD Consultation",qty:1,rate:400,amount:400,category:"Consultation"},{description:"Medicines",qty:1,rate:185,amount:185,category:"Pharmacy"}],
    subtotal:585,discount:0,discount_reason:"",tax:0,net_amount:585,paid_amount:585,due_amount:0 },

  { id:6, bill_no:"BILL/0512/014", mrn:"MRN-00478", patient_name:"Meena Sharma", age:58, gender:"F", phone:"9844567890",
    bill_type:"OT", department:"Orthopaedics", doctor_name:"Dr. Patel", status:"draft", payment_mode:"insurance",
    generated_at:"13:00", paid_at:null, cashier:"Cashier Seema", insurance_claim:null,
    items:[{description:"Room Charges (Private) × 2 days",qty:2,rate:4500,amount:9000,category:"Room"},{description:"Surgery — TKR",qty:1,rate:65000,amount:65000,category:"Surgery"},{description:"Implant — Knee Prosthesis",qty:1,rate:45000,amount:45000,category:"Implant"},{description:"Anaesthesia",qty:1,rate:8000,amount:8000,category:"Procedure"},{description:"Physiotherapy × 2",qty:2,rate:800,amount:1600,category:"Procedure"},{description:"Medicines & Consumables",qty:1,rate:5400,amount:5400,category:"Pharmacy"}],
    subtotal:134000,discount:4000,discount_reason:"Corporate discount",tax:0,net_amount:130000,paid_amount:0,due_amount:130000 },

  { id:7, bill_no:"BILL/0512/017", mrn:"MRN-00712", patient_name:"Lata Deshpande", age:45, gender:"F", phone:"9878901234",
    bill_type:"OT", department:"Surgical Ward", doctor_name:"Dr. Arora", status:"generated", payment_mode:"credit",
    generated_at:"13:30", paid_at:null, cashier:"Cashier Ravi", insurance_claim:null,
    items:[{description:"Surgery — Thyroidectomy",qty:1,rate:28000,amount:28000,category:"Surgery"},{description:"Room Charges (Semi-private) × 2",qty:2,rate:2800,amount:5600,category:"Room"},{description:"Anaesthesia",qty:1,rate:5000,amount:5000,category:"Procedure"},{description:"Lab Tests",qty:1,rate:3200,amount:3200,category:"Lab"},{description:"Medicines",qty:1,rate:2800,amount:2800,category:"Pharmacy"}],
    subtotal:44600,discount:0,discount_reason:"",tax:0,net_amount:44600,paid_amount:0,due_amount:44600 },
];

const BSC:Record<BillStatus,{label:string;cls:string}>={
  draft:     {label:"Draft",     cls:"bg-slate-100 text-slate-600"},
  generated: {label:"Generated", cls:"bg-blue-100 text-blue-700"},
  paid:      {label:"Paid",      cls:"bg-green-100 text-green-700"},
  partial:   {label:"Partial",   cls:"bg-amber-100 text-amber-700"},
  waived:    {label:"Waived",    cls:"bg-purple-100 text-purple-700"},
  cancelled: {label:"Cancelled", cls:"bg-red-100 text-red-700"},
};
const PMC:Record<PaymentMode,string>={
  cash:"bg-green-100 text-green-700",card:"bg-blue-100 text-blue-700",
  upi:"bg-purple-100 text-purple-700",insurance:"bg-teal-100 text-teal-700",credit:"bg-amber-100 text-amber-700",
};
const BTC:Record<BillType,string>={
  OPD:"bg-blue-100 text-blue-700",IPD:"bg-purple-100 text-purple-700",
  Emergency:"bg-red-100 text-red-700",Lab:"bg-teal-100 text-teal-700",
  Pharmacy:"bg-green-100 text-green-700",OT:"bg-amber-100 text-amber-700",
  Radiology:"bg-cyan-100 text-cyan-700",
};
const CATC:Record<string,string>={
  Consultation:"bg-blue-50 text-blue-700",Room:"bg-purple-50 text-purple-700",
  Surgery:"bg-red-50 text-red-700",Procedure:"bg-amber-50 text-amber-700",
  Lab:"bg-teal-50 text-teal-700",Pharmacy:"bg-green-50 text-green-700",
  Implant:"bg-orange-50 text-orange-700",Admission:"bg-slate-50 text-slate-700",
};
const AV=["bg-blue-100 text-blue-700","bg-purple-100 text-purple-700","bg-teal-100 text-teal-700","bg-amber-100 text-amber-700","bg-rose-100 text-rose-700"];
function ini(n:string){return n.split(" ").slice(0,2).map(w=>w[0]).join("").toUpperCase();}
function fmt(n:number){return `₹${n.toLocaleString("en-IN")}`;}

export default function BillingPage(){
  const [bills,setBills]=useState<Bill[]>(BILLS);
  const [q,setQ]=useState("");
  const [tab,setTab]=useState<"all"|BillStatus>("all");
  const [expanded,setExpanded]=useState<number|null>(null);
  const [error,setError]=useState<string|null>(null);

  const fetchData=useCallback(async()=>{
    try{
      const[b]=await Promise.allSettled([get<Bill[]>("/billing/bills/today/")]);
      if(b.status==="fulfilled"&&(b.value as Bill[]).length>0) setBills(b.value as Bill[]);
      setError(null);
    }catch{setError("Showing demo data.");}
  },[]);
  useEffect(()=>{fetchData();},[fetchData]);

  const markPaid=(id:number,mode:PaymentMode)=>setBills(p=>p.map(b=>b.id===id?{...b,status:"paid",payment_mode:mode,paid_at:new Date().toTimeString().slice(0,5),paid_amount:b.net_amount,due_amount:0}:b));

  const TABS:[string,string][]=[["all","All"],["generated","Generated"],["partial","Partial"],["paid","Paid"],["draft","Draft"]];
  const displayed=bills.filter(b=>{
    const mq=!q||b.patient_name.toLowerCase().includes(q.toLowerCase())||b.bill_no.toLowerCase().includes(q.toLowerCase())||b.mrn.toLowerCase().includes(q.toLowerCase());
    const mt=tab==="all"||b.status===tab;
    return mq&&mt;
  });

  const totalRevenue=bills.reduce((s,b)=>s+b.net_amount,0);
  const totalCollected=bills.filter(b=>b.status==="paid").reduce((s,b)=>s+b.paid_amount,0);
  const totalPending=bills.filter(b=>b.status!=="paid"&&b.status!=="cancelled").reduce((s,b)=>s+b.due_amount,0);

  return(
    <div className="space-y-5 pb-8">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div><h2 className="text-2xl font-bold">Billing</h2><p className="text-sm text-muted-foreground">Patient bills, payments, receipts, and revenue tracking</p></div>
        <div className="flex gap-2">
          <button onClick={fetchData} className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"><RefreshCw className="h-3.5 w-3.5"/>Refresh</button>
          <Button className="gap-2"><Plus className="h-4 w-4"/>New Bill</Button>
        </div>
      </div>
      {error&&<div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 text-sm text-amber-800"><AlertTriangle className="h-4 w-4 shrink-0"/>Showing demo data.</div>}

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          {label:"Bills Today",       value:fmt(STATS.bills_today),       numeric:STATS.bills_today,    color:"border-l-blue-500"},
          {label:"Revenue Today",     value:fmt(totalRevenue),             numeric:null,                 color:"border-l-green-500"},
          {label:"Collected",         value:fmt(totalCollected),           numeric:null,                 color:"border-l-teal-500"},
          {label:"Pending",           value:fmt(totalPending),             numeric:null,                 color:"border-l-amber-500"},
          {label:"Insurance Pending", value:fmt(STATS.insurance_pending),  numeric:null,                 color:"border-l-purple-500"},
          {label:"Discount Given",    value:fmt(STATS.discount_given),     numeric:null,                 color:"border-l-slate-400"},
        ].map(s=>(
          <div key={s.label} className={cn("rounded-xl border bg-background px-4 py-3 border-l-[3px]",s.color)}>
            <p className="text-xl font-bold">{s.numeric??s.value}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{s.label}</p>
            {s.numeric&&<p className="text-[11px] text-muted-foreground">{s.value}</p>}
          </div>
        ))}
      </div>

      {/* Search + Tabs */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
          <Input value={q} onChange={e=>setQ(e.target.value)} className="pl-9" placeholder="Search by patient, MRN, or bill number…"/>
        </div>
      </div>
      <div className="flex border-b">
        {TABS.map(([v,l])=>(
          <button key={v} onClick={()=>setTab(v as any)}
            className={cn("flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors",
              tab===v?"border-primary text-primary":"border-transparent text-muted-foreground hover:text-foreground")}>
            {l}
            <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold",tab===v?"bg-primary text-primary-foreground":"bg-muted text-muted-foreground")}>
              {v==="all"?bills.length:bills.filter(b=>b.status===v).length}
            </span>
          </button>
        ))}
      </div>

      {/* Bill cards */}
      <div className="space-y-2">
        {displayed.map((bill,i)=>{
          const exp=expanded===bill.id;
          const sc=BSC[bill.status];
          return(
            <Card key={bill.id} className={cn("overflow-hidden",bill.status==="partial"&&"border-amber-200",bill.due_amount>10000&&bill.status!=="paid"&&"border-amber-200")}>
              <CardContent className="p-0">
                {/* Header row */}
                <div className="flex items-center gap-4 p-4 cursor-pointer hover:bg-muted/20" onClick={()=>setExpanded(exp?null:bill.id)}>
                  <span className={cn("inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold",AV[i%AV.length])}>{ini(bill.patient_name)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-[14px]">{bill.patient_name}</p>
                      <span className="font-mono text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{bill.bill_no}</span>
                      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium",BTC[bill.bill_type])}>{bill.bill_type}</span>
                      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium",sc.cls)}>{sc.label}</span>
                      {bill.payment_mode&&bill.status==="paid"&&<span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium capitalize",PMC[bill.payment_mode])}>{bill.payment_mode.toUpperCase()}</span>}
                    </div>
                    <div className="flex flex-wrap gap-3 mt-1 text-[12px] text-muted-foreground">
                      <span>{bill.mrn}</span><span>· {bill.doctor_name}</span><span>· {bill.department}</span><span>· {bill.generated_at}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0 min-w-[100px]">
                    <p className="font-bold text-lg">{fmt(bill.net_amount)}</p>
                    {bill.due_amount>0&&<p className="text-[11px] text-amber-600 font-medium">Due: {fmt(bill.due_amount)}</p>}
                    {bill.status==="paid"&&<p className="text-[11px] text-green-600 font-medium">✓ Paid {bill.paid_at}</p>}
                  </div>
                  {exp?<ChevronUp className="h-4 w-4 text-muted-foreground shrink-0"/>:<ChevronDown className="h-4 w-4 text-muted-foreground shrink-0"/>}
                </div>

                {/* Expanded detail */}
                {exp&&(
                  <div className="border-t bg-muted/20 p-4 space-y-4">
                    {/* Bill items */}
                    <div>
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Bill Items</p>
                      <table className="w-full text-[12px]">
                        <thead><tr className="border-b text-[11px] text-muted-foreground"><th className="pb-1.5 text-left font-medium">Description</th><th className="pb-1.5 text-center font-medium">Qty</th><th className="pb-1.5 text-right font-medium">Rate</th><th className="pb-1.5 text-right font-medium">Amount</th></tr></thead>
                        <tbody>
                          {bill.items.map((item,j)=>(
                            <tr key={j} className="border-b last:border-0">
                              <td className="py-1.5">
                                <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium mr-1.5",CATC[item.category]??"bg-slate-100 text-slate-600")}>{item.category}</span>
                                {item.description}
                              </td>
                              <td className="py-1.5 text-center">{item.qty}</td>
                              <td className="py-1.5 text-right">{fmt(item.rate)}</td>
                              <td className="py-1.5 text-right font-medium">{fmt(item.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Totals */}
                    <div className="flex justify-end">
                      <div className="w-64 space-y-1 text-[12px]">
                        <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{fmt(bill.subtotal)}</span></div>
                        {bill.discount>0&&<div className="flex justify-between text-green-600"><span>Discount{bill.discount_reason&&` (${bill.discount_reason})`}</span><span>− {fmt(bill.discount)}</span></div>}
                        {bill.tax>0&&<div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span>{fmt(bill.tax)}</span></div>}
                        <div className="flex justify-between font-bold text-base border-t pt-1"><span>Net Amount</span><span>{fmt(bill.net_amount)}</span></div>
                        {bill.paid_amount>0&&<div className="flex justify-between text-green-600"><span>Paid</span><span>{fmt(bill.paid_amount)}</span></div>}
                        {bill.due_amount>0&&<div className="flex justify-between text-amber-600 font-semibold"><span>Due</span><span>{fmt(bill.due_amount)}</span></div>}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-2 border-t">
                      <button className="flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"><Printer className="h-3 w-3"/>Print</button>
                      {(bill.status==="generated"||bill.status==="draft")&&(
                        <>
                          <button onClick={()=>markPaid(bill.id,"cash")} className="flex items-center gap-1 rounded-md bg-green-600 px-3 py-1.5 text-xs text-white font-medium hover:bg-green-700"><CheckCircle2 className="h-3 w-3"/>Cash</button>
                          <button onClick={()=>markPaid(bill.id,"card")} className="flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs text-white font-medium hover:bg-blue-700"><CheckCircle2 className="h-3 w-3"/>Card</button>
                          <button onClick={()=>markPaid(bill.id,"upi")} className="flex items-center gap-1 rounded-md bg-purple-600 px-3 py-1.5 text-xs text-white font-medium hover:bg-purple-700"><CheckCircle2 className="h-3 w-3"/>UPI</button>
                          {bill.insurance_claim&&<button onClick={()=>markPaid(bill.id,"insurance")} className="flex items-center gap-1 rounded-md bg-teal-600 px-3 py-1.5 text-xs text-white font-medium hover:bg-teal-700"><CheckCircle2 className="h-3 w-3"/>Insurance</button>}
                        </>
                      )}
                      {bill.status==="partial"&&<button onClick={()=>markPaid(bill.id,bill.payment_mode)} className="flex items-center gap-1 rounded-md bg-amber-600 px-3 py-1.5 text-xs text-white font-medium hover:bg-amber-700"><CheckCircle2 className="h-3 w-3"/>Collect Balance {fmt(bill.due_amount)}</button>}
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