"use client";
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, RefreshCw, Plus, AlertTriangle, Users, ChevronDown, ChevronUp, Edit2, Phone, Mail, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";
function hdrs(){ const t=useAuthStore.getState().token; return {"Content-Type":"application/json",...(t?{Authorization:`Bearer ${t}`}:{})}; }
async function get<T>(p:string):Promise<T>{ const r=await fetch(`${BASE}${p}`,{headers:hdrs(),cache:"no-store"}); if(!r.ok)throw new Error(`${r.status}`); const j=await r.json(); return (j?.results??j) as T; }

type EmpStatus = "active"|"on_leave"|"resigned"|"terminated";
type EmpType   = "Permanent"|"Contract"|"Probation"|"Consultant";

interface Employee {
  id:number; emp_code:string; name:string; designation:string;
  department:string; emp_type:EmpType; status:EmpStatus;
  phone:string; email:string; joining_date:string; dob:string;
  qualification:string; experience_years:number; address:string;
  reporting_to:string; leaves_taken:number; leaves_balance:number;
}
interface HrStats { total_staff:number; active:number; on_leave:number; new_joinings:number; resignations:number; open_positions:number; }

const STATS:HrStats={total_staff:184,active:171,on_leave:8,new_joinings:3,resignations:1,open_positions:7};
const EMPLOYEES:Employee[]=[
  {id:1, emp_code:"EMP-001",name:"Dr. Arvind Sharma",     designation:"Senior Physician",        department:"General Medicine",  emp_type:"Permanent",   status:"active",   phone:"9876540001",email:"arvind@hospital.in",   joining_date:"2019-06-01",dob:"1978-03-15",qualification:"MBBS, MD",             experience_years:14,address:"Sector 14, Gurugram",reporting_to:"Dr. HOD",    leaves_taken:5, leaves_balance:25},
  {id:2, emp_code:"EMP-002",name:"Dr. Sneha Mehta",       designation:"Gynaecologist",           department:"Gynaecology",       emp_type:"Permanent",   status:"active",   phone:"9876540002",email:"sneha@hospital.in",    joining_date:"2017-03-15",dob:"1982-07-22",qualification:"MBBS, MS",             experience_years:16,address:"DLF Phase 2, Gurugram",reporting_to:"Dr. HOD",   leaves_taken:8, leaves_balance:22},
  {id:3, emp_code:"EMP-015",name:"Sr. Kavya Reddy",       designation:"Staff Nurse",             department:"ICU",               emp_type:"Permanent",   status:"active",   phone:"9876540015",email:"kavya@hospital.in",    joining_date:"2021-01-10",dob:"1995-05-10",qualification:"B.Sc Nursing",         experience_years:4, address:"Sector 22, Gurugram",reporting_to:"Sr. Nurse Incharge",leaves_taken:3,leaves_balance:27},
  {id:4, emp_code:"EMP-031",name:"Ravi Kumar",             designation:"Pharmacist",              department:"Pharmacy",          emp_type:"Permanent",   status:"active",   phone:"9876540031",email:"ravi@hospital.in",     joining_date:"2020-08-01",dob:"1991-11-20",qualification:"B.Pharm",              experience_years:6, address:"Old Gurugram",reporting_to:"Chief Pharmacist",  leaves_taken:6, leaves_balance:24},
  {id:5, emp_code:"EMP-042",name:"Meena Iyer",             designation:"Lab Technician",          department:"Laboratory",        emp_type:"Permanent",   status:"on_leave", phone:"9876540042",email:"meena@hospital.in",    joining_date:"2018-11-15",dob:"1989-02-14",qualification:"DMLT",                experience_years:8, address:"Sector 56, Gurugram",reporting_to:"Lab Manager",        leaves_taken:14,leaves_balance:16},
  {id:6, emp_code:"EMP-058",name:"Ramesh Yadav",           designation:"Ambulance Driver",        department:"Ambulance",         emp_type:"Permanent",   status:"active",   phone:"9876540058",email:"ramesh@hospital.in",   joining_date:"2016-04-20",dob:"1985-09-08",qualification:"12th + Heavy License",experience_years:10,address:"New Colony, Gurugram",reporting_to:"Fleet Manager", leaves_taken:10,leaves_balance:20},
  {id:7, emp_code:"EMP-073",name:"Priya Sharma",           designation:"Receptionist",            department:"Reception",         emp_type:"Permanent",   status:"active",   phone:"9876540073",email:"priya.r@hospital.in",  joining_date:"2022-06-01",dob:"1998-04-25",qualification:"BBA",                 experience_years:2, address:"Palam Vihar, Gurugram",reporting_to:"Admin Manager",   leaves_taken:2, leaves_balance:28},
  {id:8, emp_code:"EMP-089",name:"Anil Gupta",             designation:"Medical Records Officer", department:"Medical Records",   emp_type:"Contract",    status:"active",   phone:"9876540089",email:"anil@hospital.in",     joining_date:"2023-09-01",dob:"1993-06-30",qualification:"B.Sc, PGDMLT",        experience_years:3, address:"Sector 9, Gurugram",reporting_to:"Admin Manager",    leaves_taken:1, leaves_balance:14},
  {id:9, emp_code:"EMP-102",name:"Sunita Devi",            designation:"Ward Attendant",          department:"Housekeeping",      emp_type:"Permanent",   status:"active",   phone:"9876540102",email:"",                      joining_date:"2015-03-01",dob:"1980-12-01",qualification:"10th",                experience_years:11,address:"Vikas Nagar, Gurugram",reporting_to:"HK Supervisor",  leaves_taken:7, leaves_balance:23},
  {id:10,emp_code:"EMP-115",name:"Dr. Kiran Rao",          designation:"Dermatologist",           department:"Dermatology",       emp_type:"Consultant",  status:"on_leave", phone:"9876540005",email:"kiran@hospital.in",    joining_date:"2018-07-20",dob:"1983-01-17",qualification:"MBBS, MD",             experience_years:10,address:"Sushant Lok, Gurugram",reporting_to:"Dr. HOD",    leaves_taken:5, leaves_balance:25},
];

const ESC:Record<EmpStatus,{label:string;cls:string;dot:string}>={
  active:    {label:"Active",     cls:"bg-green-100 text-green-700",  dot:"bg-green-500"},
  on_leave:  {label:"On Leave",   cls:"bg-amber-100 text-amber-700",  dot:"bg-amber-500"},
  resigned:  {label:"Resigned",   cls:"bg-red-100 text-red-700",      dot:"bg-red-500"},
  terminated:{label:"Terminated", cls:"bg-slate-100 text-slate-600",  dot:"bg-slate-400"},
};
const ETC:Record<EmpType,string>={
  Permanent:"bg-blue-100 text-blue-700",Contract:"bg-amber-100 text-amber-700",
  Probation:"bg-purple-100 text-purple-700",Consultant:"bg-teal-100 text-teal-700",
};
const DEPT_FILTER=["All","General Medicine","Gynaecology","ICU","Pharmacy","Laboratory","Ambulance","Reception","Housekeeping","Dermatology"];
const AV=["bg-blue-100 text-blue-700","bg-purple-100 text-purple-700","bg-teal-100 text-teal-700","bg-amber-100 text-amber-700","bg-rose-100 text-rose-700"];
function ini(n:string){return n.replace("Dr.","").replace("Sr.","").trim().split(" ").filter(Boolean).slice(0,2).map((w:string)=>w[0]).join("").toUpperCase();}

export default function HrPage(){
  const [staff,setStaff]=useState<Employee[]>(EMPLOYEES);
  const [q,setQ]=useState("");
  const [dept,setDept]=useState("All");
  const [statusFilter,setStatus]=useState<EmpStatus|"all">("all");
  const [expanded,setExpanded]=useState<number|null>(null);
  const [error,setError]=useState<string|null>(null);

  const fetchData=useCallback(async()=>{
    try{const[e]=await Promise.allSettled([get<Employee[]>("/hr/employees/")]);
      if(e.status==="fulfilled"&&(e.value as Employee[]).length>0)setStaff(e.value as Employee[]);
      setError(null);}catch{setError("Showing demo data.");}
  },[]);
  useEffect(()=>{fetchData();},[fetchData]);

  const displayed=staff.filter(e=>{
    const mq=!q||e.name.toLowerCase().includes(q.toLowerCase())||e.emp_code.toLowerCase().includes(q.toLowerCase())||e.designation.toLowerCase().includes(q.toLowerCase());
    const md=dept==="All"||e.department===dept;
    const ms=statusFilter==="all"||e.status===statusFilter;
    return mq&&md&&ms;
  });

  return(
    <div className="space-y-5 pb-8">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div><h2 className="text-2xl font-bold">Human Resources</h2><p className="text-sm text-muted-foreground">Staff directory, leaves, and workforce management</p></div>
        <div className="flex gap-2">
          <button onClick={fetchData} className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"><RefreshCw className="h-3.5 w-3.5"/>Refresh</button>
          <Button className="gap-2"><Plus className="h-4 w-4"/>Add Employee</Button>
        </div>
      </div>
      {error&&<div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 text-sm text-amber-800"><AlertTriangle className="h-4 w-4 shrink-0"/>Showing demo data.</div>}

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[{l:"Total Staff",v:STATS.total_staff,c:"border-l-blue-500"},{l:"Active",v:STATS.active,c:"border-l-green-500"},
          {l:"On Leave",v:STATS.on_leave,c:"border-l-amber-500"},{l:"New Joinings",v:STATS.new_joinings,c:"border-l-teal-500"},
          {l:"Resignations",v:STATS.resignations,c:"border-l-red-500"},{l:"Open Positions",v:STATS.open_positions,c:"border-l-purple-500"},
        ].map(s=><div key={s.l} className={cn("rounded-xl border bg-background px-4 py-3 border-l-[3px]",s.c)}><p className="text-2xl font-bold">{s.v}</p><p className="text-xs text-muted-foreground mt-0.5">{s.l}</p></div>)}
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/><Input value={q} onChange={e=>setQ(e.target.value)} className="pl-9" placeholder="Search by name, code, or designation…"/></div>
        <select value={dept} onChange={e=>setDept(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2">
          {DEPT_FILTER.map(d=><option key={d}>{d}</option>)}
        </select>
        <div className="flex rounded-md border overflow-hidden text-xs">
          {(["all","active","on_leave"] as const).map(v=>(
            <button key={v} onClick={()=>setStatus(v)} className={cn("px-3 py-2 font-medium transition-colors",statusFilter===v?"bg-primary text-primary-foreground":"bg-background text-muted-foreground hover:bg-muted")}>
              {v==="all"?"All":v==="on_leave"?"On Leave":"Active"} ({v==="all"?staff.length:staff.filter(e=>e.status===v).length})
            </button>
          ))}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Showing {displayed.length} of {staff.length} staff</p>

      <div className="space-y-2">
        {displayed.map((emp,i)=>{const exp=expanded===emp.id;const sc=ESC[emp.status];return(
          <Card key={emp.id} className="overflow-hidden">
            <CardContent className="p-0">
              <div className="flex items-center gap-4 p-4 cursor-pointer hover:bg-muted/20" onClick={()=>setExpanded(exp?null:emp.id)}>
                <span className={cn("inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold",AV[i%AV.length])}>{ini(emp.name)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-[14px]">{emp.name}</p>
                    <span className="font-mono text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{emp.emp_code}</span>
                    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",sc.cls)}><span className={cn("h-1.5 w-1.5 rounded-full",sc.dot)}/>{sc.label}</span>
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium",ETC[emp.emp_type])}>{emp.emp_type}</span>
                  </div>
                  <div className="flex flex-wrap gap-3 mt-1 text-[12px] text-muted-foreground">
                    <span className="font-medium text-foreground">{emp.designation}</span>
                    <span>· {emp.department}</span>
                    <span>· {emp.experience_years}y exp</span>
                    <span>· Joined {emp.joining_date}</span>
                  </div>
                </div>
                <div className="text-right text-[12px] shrink-0">
                  <p className="font-medium">{emp.leaves_balance} leaves left</p>
                  <p className="text-muted-foreground">{emp.leaves_taken} taken</p>
                </div>
                {exp?<ChevronUp className="h-4 w-4 text-muted-foreground shrink-0"/>:<ChevronDown className="h-4 w-4 text-muted-foreground shrink-0"/>}
              </div>
              {exp&&(
                <div className="border-t bg-muted/20 p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-[12px]">
                  <div><p className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wide mb-1">Phone</p><p className="flex items-center gap-1"><Phone className="h-3 w-3"/>{emp.phone}</p></div>
                  <div><p className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wide mb-1">Email</p><p className="flex items-center gap-1"><Mail className="h-3 w-3"/>{emp.email||"—"}</p></div>
                  <div><p className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wide mb-1">Date of Birth</p><p>{emp.dob}</p></div>
                  <div><p className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wide mb-1">Qualification</p><p>{emp.qualification}</p></div>
                  <div><p className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wide mb-1">Reports To</p><p>{emp.reporting_to}</p></div>
                  <div><p className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wide mb-1">Address</p><p className="flex items-center gap-1"><MapPin className="h-3 w-3"/>{emp.address}</p></div>
                  <div className="flex gap-2 col-span-2">
                    <button className="flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"><Edit2 className="h-3 w-3"/>Edit</button>
                    <button className="flex items-center gap-1 rounded-md border border-amber-200 px-3 py-1.5 text-xs text-amber-600 hover:bg-amber-50">Apply Leave</button>
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