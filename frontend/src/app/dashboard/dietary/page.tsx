"use client";
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Plus, AlertTriangle, UtensilsCrossed, CheckCircle2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";
function hdrs(){ const t=useAuthStore.getState().token; return {"Content-Type":"application/json",...(t?{Authorization:`Bearer ${t}`}:{})}; }
async function get<T>(p:string):Promise<T>{ const r=await fetch(`${BASE}${p}`,{headers:hdrs(),cache:"no-store"}); if(!r.ok)throw new Error(`${r.status}`); const j=await r.json(); return (j?.results??j) as T; }

type MealStatus = "pending"|"prepared"|"delivered"|"returned";
type MealType = "Breakfast"|"Lunch"|"Dinner"|"Snack";
interface DietOrder { id:number; ward:string; bed_no:string; mrn:string; patient_name:string; diet_type:string; allergies:string[]; meal_type:MealType; menu:string; status:MealStatus; ordered_by:string; scheduled_time:string; delivered_at:string|null; notes:string; }
interface DietStats { total_orders:number; delivered:number; pending:number; special_diets:number; wards_covered:number; }

const STATS:DietStats={total_orders:83,delivered:61,pending:22,special_diets:18,wards_covered:6};
const DIET_COLORS:Record<string,string>={
  "Normal":"bg-green-100 text-green-700","Diabetic":"bg-blue-100 text-blue-700","Liquid":"bg-teal-100 text-teal-700",
  "Soft":"bg-amber-100 text-amber-700","IV Fluids":"bg-red-100 text-red-700","NG Tube":"bg-red-100 text-red-700",
  "Low Sodium":"bg-purple-100 text-purple-700","Renal Diet":"bg-orange-100 text-orange-700","Bland":"bg-slate-100 text-slate-600","ANC Diet":"bg-pink-100 text-pink-700",
};
const ORDERS:DietOrder[]=[
  {id:1, ward:"General Ward",  bed_no:"A-12",mrn:"MRN-00801",patient_name:"Bharat Singh",   diet_type:"Liquid",    allergies:[],          meal_type:"Lunch",  menu:"Rice Kanji, Dal Water, Tender Coconut", status:"delivered",ordered_by:"Dr. Sharma",  scheduled_time:"12:30",delivered_at:"12:35",notes:"Typhoid — liquid only"},
  {id:2, ward:"General Ward",  bed_no:"A-18",mrn:"MRN-00734",patient_name:"Kamla Devi",     diet_type:"Normal",    allergies:["Nuts"],    meal_type:"Lunch",  menu:"Rice, Dal, Sabzi, Curd, Salad",        status:"delivered",ordered_by:"Dr. Kumar",   scheduled_time:"12:30",delivered_at:"12:40",notes:"Avoid nuts strictly"},
  {id:3, ward:"Surgical Ward", bed_no:"C-04",mrn:"MRN-00692",patient_name:"Rohit Malhotra", diet_type:"Soft",      allergies:[],          meal_type:"Lunch",  menu:"Khichdi, Curd, Banana",                status:"delivered",ordered_by:"Dr. Arora",   scheduled_time:"12:30",delivered_at:"12:38",notes:"Day 4 post-op"},
  {id:4, ward:"Maternity",     bed_no:"D-07",mrn:"MRN-00621",patient_name:"Savita Rao",     diet_type:"ANC Diet",  allergies:[],          meal_type:"Lunch",  menu:"Rice, Dal, Leafy Veg, Milk, Fruit",   status:"pending",  ordered_by:"Dr. Mehta",   scheduled_time:"12:30",delivered_at:null,      notes:"Post normal delivery"},
  {id:5, ward:"ICU",           bed_no:"ICU-3",mrn:"MRN-00589",patient_name:"Hamid Khan",    diet_type:"IV Fluids", allergies:[],          meal_type:"Lunch",  menu:"RL 500ml + DNS 500ml (IV)",            status:"delivered",ordered_by:"Dr. Gupta",   scheduled_time:"12:00",delivered_at:"12:00",notes:"NPO — IV only"},
  {id:6, ward:"General Ward",  bed_no:"A-22",mrn:"MRN-00541",patient_name:"Geeta Kumari",   diet_type:"Liquid",    allergies:[],          meal_type:"Lunch",  menu:"Nimbu Paani, Rice Water, ORS",         status:"pending",  ordered_by:"Dr. Sharma",  scheduled_time:"12:30",delivered_at:null,      notes:"Dengue — force fluids"},
  {id:7, ward:"ICU",           bed_no:"ICU-5",mrn:"MRN-00503",patient_name:"Rajan Pillai",  diet_type:"NG Tube",   allergies:["Milk"],    meal_type:"Lunch",  menu:"Ryle's Tube Feed 200ml × 4",           status:"pending",  ordered_by:"Dr. Nair",    scheduled_time:"13:00",delivered_at:null,      notes:"CVA — NGT feeding"},
  {id:8, ward:"General Ward",  bed_no:"A-31",mrn:"MRN-00387",patient_name:"Nirmala Verma",  diet_type:"Diabetic",  allergies:[],          meal_type:"Lunch",  menu:"Jowar Roti, Dal, Bitter Gourd, Salad", status:"pending",  ordered_by:"Dr. Patel",   scheduled_time:"12:30",delivered_at:null,      notes:"DM — low GI diet"},
  {id:9, ward:"Surgical Ward", bed_no:"C-09",mrn:"MRN-00412",patient_name:"Vijay Tiwari",   diet_type:"Liquid",    allergies:[],          meal_type:"Lunch",  menu:"Moong Dal Soup, Tender Coconut",       status:"pending",  ordered_by:"Dr. Arora",   scheduled_time:"12:30",delivered_at:null,      notes:"Day 3 post cholecystectomy"},
  {id:10,ward:"Maternity",     bed_no:"D-11",mrn:"MRN-00478",patient_name:"Shalini Mishra", diet_type:"Soft",      allergies:[],          meal_type:"Lunch",  menu:"Idli, Sambar, Curd, Fruit",            status:"delivered",ordered_by:"Dr. Mehta",   scheduled_time:"12:30",delivered_at:"12:42",notes:"Day 1 post C-section"},
];
const SC:Record<MealStatus,{label:string;cls:string}>={
  pending:  {label:"Pending",  cls:"bg-amber-100 text-amber-700"},
  prepared: {label:"Prepared", cls:"bg-blue-100 text-blue-700"},
  delivered:{label:"Delivered",cls:"bg-green-100 text-green-700"},
  returned: {label:"Returned", cls:"bg-red-100 text-red-700"},
};
const WARDS=["All","General Ward","Surgical Ward","Maternity","ICU","Paediatrics"];

export default function DietaryPage(){
  const [orders,setOrders]=useState<DietOrder[]>(ORDERS);
  const [wardFilter,setWardFilter]=useState("All");
  const [statusFilter,setStatusFilter]=useState<"all"|MealStatus>("all");
  const [error,setError]=useState<string|null>(null);

  const fetchData=useCallback(async()=>{
    try{const[o]=await Promise.allSettled([get<DietOrder[]>("/dietary/orders/current/")]);if(o.status==="fulfilled"&&(o.value as DietOrder[]).length>0)setOrders(o.value as DietOrder[]);setError(null);}
    catch{setError("Showing demo data.");}
  },[]);
  useEffect(()=>{fetchData();},[fetchData]);

  const markDelivered=(id:number)=>setOrders(p=>p.map(o=>o.id===id?{...o,status:"delivered",delivered_at:new Date().toTimeString().slice(0,5)}:o));

  const displayed=orders.filter(o=>{
    const mw=wardFilter==="All"||o.ward===wardFilter;
    const ms=statusFilter==="all"||o.status===statusFilter;
    return mw&&ms;
  });

  return(
    <div className="space-y-5 pb-8">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div><h2 className="text-2xl font-bold">Dietary Services</h2><p className="text-sm text-muted-foreground">Patient meal orders, diet planning, and delivery tracking</p></div>
        <div className="flex gap-2">
          <button onClick={fetchData} className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"><RefreshCw className="h-3.5 w-3.5"/>Refresh</button>
          <Button className="gap-2"><Plus className="h-4 w-4"/>Add Order</Button>
        </div>
      </div>
      {error&&<div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 text-sm text-amber-800"><AlertTriangle className="h-4 w-4 shrink-0"/>Showing demo data.</div>}

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {[{label:"Total Orders",value:STATS.total_orders,color:"border-l-blue-500"},{label:"Delivered",value:STATS.delivered,color:"border-l-green-500"},{label:"Pending",value:STATS.pending,color:"border-l-amber-500"},{label:"Special Diets",value:STATS.special_diets,color:"border-l-purple-500"},{label:"Wards Covered",value:STATS.wards_covered,color:"border-l-teal-500"}].map(s=>(
          <div key={s.label} className={cn("rounded-xl border bg-background px-4 py-3 border-l-[3px]",s.color)}><p className="text-2xl font-bold">{s.value}</p><p className="text-xs text-muted-foreground mt-0.5">{s.label}</p></div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <select value={wardFilter} onChange={e=>setWardFilter(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2">
          {WARDS.map(w=><option key={w}>{w}</option>)}
        </select>
        <div className="flex rounded-md border overflow-hidden text-xs">
          {(["all","pending","delivered"] as const).map(v=>(
            <button key={v} onClick={()=>setStatusFilter(v)} className={cn("px-3 py-2 font-medium transition-colors",statusFilter===v?"bg-primary text-primary-foreground":"bg-background text-muted-foreground hover:bg-muted")}>
              {v==="all"?"All":v.charAt(0).toUpperCase()+v.slice(1)} ({v==="all"?orders.length:orders.filter(o=>o.status===v).length})
            </button>
          ))}
        </div>
      </div>

      <Card><CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-[11px] text-muted-foreground">
              <th className="px-4 py-3 text-left font-medium">Patient</th>
              <th className="px-3 py-3 text-left font-medium">Ward / Bed</th>
              <th className="px-3 py-3 text-left font-medium">Diet</th>
              <th className="px-3 py-3 text-left font-medium">Menu</th>
              <th className="px-3 py-3 text-left font-medium">Time</th>
              <th className="px-3 py-3 text-left font-medium">Status</th>
              <th className="px-3 py-3 text-left font-medium">Action</th>
            </tr></thead>
            <tbody>
              {displayed.map(o=>{const sc=SC[o.status];const dc=DIET_COLORS[o.diet_type]??"bg-slate-100 text-slate-600";return(
                <tr key={o.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3"><p className="font-medium">{o.patient_name}</p><p className="text-[11px] text-muted-foreground">{o.mrn}</p></td>
                  <td className="px-3 py-3 text-[12px]"><p>{o.ward}</p><p className="text-muted-foreground">Bed {o.bed_no}</p></td>
                  <td className="px-3 py-3"><span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium",dc)}>{o.diet_type}</span>
                    {o.allergies.length>0&&<p className="text-[10px] text-red-600 mt-0.5">⚠ {o.allergies.join(", ")}</p>}
                  </td>
                  <td className="px-3 py-3 text-[12px] max-w-[180px]"><p className="line-clamp-2">{o.menu}</p>{o.notes&&<p className="text-[10px] text-muted-foreground mt-0.5">{o.notes}</p>}</td>
                  <td className="px-3 py-3 text-[12px]"><p>{o.scheduled_time}</p>{o.delivered_at&&<p className="text-green-600">↓ {o.delivered_at}</p>}</td>
                  <td className="px-3 py-3"><span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium",sc.cls)}>{sc.label}</span></td>
                  <td className="px-3 py-3">
                    {o.status==="pending"&&<button onClick={()=>markDelivered(o.id)} className="flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-[11px] font-medium text-primary-foreground hover:bg-primary/90"><CheckCircle2 className="h-3 w-3"/>Deliver</button>}
                    {o.status==="delivered"&&<span className="text-[11px] text-green-600 font-medium">✓ Done</span>}
                  </td>
                </tr>
              );})}
            </tbody>
          </table>
        </div>
      </CardContent></Card>
    </div>
  );
}