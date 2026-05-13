"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Download, FileText, Calendar, RefreshCw, Clock, CheckCircle2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

type ReportStatus   = "ready"|"generating"|"scheduled"|"failed";
type ReportCategory = "Clinical"|"Financial"|"Operational"|"HR"|"Quality"|"Statutory";

interface Report {
  id:        number;
  name:      string;
  category:  ReportCategory;
  description: string;
  frequency: string;
  last_generated: string;
  next_due:  string | null;
  status:    ReportStatus;
  format:    string[];
  size_kb:   number;
}

const REPORTS: Report[] = [
  // Clinical
  { id:1,  name:"Daily OPD Summary",              category:"Clinical",     description:"Token-wise OPD summary with doctor-wise count, consultation fees, and wait times.",        frequency:"Daily",   last_generated:"2026-05-12 08:00", next_due:"2026-05-13 08:00", status:"ready",      format:["PDF","Excel"], size_kb:128  },
  { id:2,  name:"IPD Census Report",              category:"Clinical",     description:"Ward-wise admitted patients, diagnoses, LOS, and discharge summary.",                      frequency:"Daily",   last_generated:"2026-05-12 07:00", next_due:"2026-05-13 07:00", status:"ready",      format:["PDF","Excel"], size_kb:210  },
  { id:3,  name:"OT Utilisation Report",          category:"Clinical",     description:"Theatre-wise case list, surgeon performance, utilisation %, and TAT.",                    frequency:"Daily",   last_generated:"2026-05-12 06:00", next_due:"2026-05-13 06:00", status:"ready",      format:["PDF"],         size_kb:98   },
  { id:4,  name:"Morbidity & Mortality Report",   category:"Clinical",     description:"Monthly disease-wise admissions, complication rates, and mortality analysis.",            frequency:"Monthly", last_generated:"2026-05-01 09:00", next_due:"2026-06-01 09:00", status:"ready",      format:["PDF","Word"],  size_kb:340  },
  { id:5,  name:"Infection Control Report",       category:"Clinical",     description:"HAI rates, antibiogram data, isolation cases, and CSSD sterilisation logs.",             frequency:"Monthly", last_generated:"2026-05-01 10:00", next_due:"2026-06-01 10:00", status:"ready",      format:["PDF"],         size_kb:185  },
  { id:6,  name:"Emergency Case Summary",         category:"Clinical",     description:"ER visits, triage categories, LWBS rates, and disposition analysis.",                     frequency:"Daily",   last_generated:"2026-05-12 06:30", next_due:"2026-05-13 06:30", status:"ready",      format:["PDF","Excel"], size_kb:156  },
  // Financial
  { id:7,  name:"Daily Revenue & Collection",     category:"Financial",    description:"Department-wise billing, cash/card/UPI/insurance breakup, and pending dues.",            frequency:"Daily",   last_generated:"2026-05-12 09:00", next_due:"2026-05-13 09:00", status:"ready",      format:["PDF","Excel"], size_kb:142  },
  { id:8,  name:"Monthly P&L Statement",          category:"Financial",    description:"Income, direct costs, overheads, EBITDA, and net profit/loss by department.",            frequency:"Monthly", last_generated:"2026-05-01 11:00", next_due:"2026-06-01 11:00", status:"ready",      format:["PDF","Excel"], size_kb:420  },
  { id:9,  name:"Insurance Claim Status Report",  category:"Financial",    description:"Insurer-wise claim status, pending, approved, rejected, TAT, and disallowance.",         frequency:"Weekly",  last_generated:"2026-05-10 09:00", next_due:"2026-05-17 09:00", status:"ready",      format:["PDF","Excel"], size_kb:198  },
  { id:10, name:"Pharmacy Revenue Report",        category:"Financial",    description:"Drug-wise sales, slow/fast moving, expiry losses, and margins.",                         frequency:"Monthly", last_generated:"2026-05-01 08:00", next_due:"2026-06-01 08:00", status:"ready",      format:["PDF","Excel"], size_kb:312  },
  { id:11, name:"GST & Tax Report",               category:"Financial",    description:"Taxable services, input credit, GST collected, and TDS deductions.",                     frequency:"Monthly", last_generated:"2026-05-01 12:00", next_due:"2026-06-01 12:00", status:"ready",      format:["PDF","Excel"], size_kb:268  },
  // Operational
  { id:12, name:"Bed Occupancy Report",           category:"Operational",  description:"Ward-wise occupancy %, ALOS, BOR, bed turnover, and vacancy analysis.",                 frequency:"Daily",   last_generated:"2026-05-12 07:30", next_due:"2026-05-13 07:30", status:"ready",      format:["PDF","Excel"], size_kb:118  },
  { id:13, name:"Inventory Consumption Report",   category:"Operational",  description:"Item-wise consumption, reorder alerts, dead stock, and GRN summary.",                   frequency:"Weekly",  last_generated:"2026-05-10 08:00", next_due:"2026-05-17 08:00", status:"ready",      format:["PDF","Excel"], size_kb:388  },
  { id:14, name:"Lab TAT & Quality Report",       category:"Operational",  description:"Test-wise TAT, outlier samples, rejection rate, and QC summary.",                       frequency:"Weekly",  last_generated:"2026-05-10 10:00", next_due:"2026-05-17 10:00", status:"ready",      format:["PDF"],         size_kb:224  },
  { id:15, name:"Equipment Downtime Report",      category:"Operational",  description:"Asset-wise downtime, MTBF, MTTR, maintenance costs, and AMC status.",                   frequency:"Monthly", last_generated:"2026-05-01 14:00", next_due:"2026-06-01 14:00", status:"ready",      format:["PDF","Excel"], size_kb:176  },
  { id:16, name:"MIS Report — Weekly",            category:"Operational",  description:"Key operational metrics: OPD, IPD, OT, revenue, complaints, NPS.",                      frequency:"Weekly",  last_generated:"2026-05-10 11:00", next_due:"2026-05-17 11:00", status:"generating", format:["PDF"],         size_kb:0    },
  // HR
  { id:17, name:"Attendance & Leave Report",      category:"HR",           description:"Staff attendance, leave balances, absent analysis, and overtime hours.",                 frequency:"Monthly", last_generated:"2026-05-01 08:00", next_due:"2026-06-01 08:00", status:"ready",      format:["PDF","Excel"], size_kb:302  },
  { id:18, name:"Payroll Summary",                category:"HR",           description:"Department-wise salary cost, headcount, PF, ESIC, and TDS summary.",                    frequency:"Monthly", last_generated:"2026-05-10 09:00", next_due:"2026-06-10 09:00", status:"ready",      format:["PDF","Excel"], size_kb:248  },
  { id:19, name:"Staff Turnover Report",          category:"HR",           description:"Joinings, resignations, turnover rate, exit interview summary, and department analysis.",frequency:"Quarterly",last_generated:"2026-04-01 10:00",next_due:"2026-07-01 10:00", status:"ready",      format:["PDF"],         size_kb:142  },
  // Quality
  { id:20, name:"Patient Satisfaction (NPS)",     category:"Quality",      description:"NPS scores, survey feedback, complaint analysis, and improvement actions.",              frequency:"Monthly", last_generated:"2026-05-01 09:00", next_due:"2026-06-01 09:00", status:"ready",      format:["PDF","Excel"], size_kb:195  },
  { id:21, name:"Complaint Resolution Report",    category:"Quality",      description:"Category-wise complaints, resolution TAT, escalations, and satisfaction ratings.",      frequency:"Monthly", last_generated:"2026-05-01 10:00", next_due:"2026-06-01 10:00", status:"ready",      format:["PDF"],         size_kb:162  },
  // Statutory
  { id:22, name:"NABH Compliance Report",         category:"Statutory",    description:"NABH standards compliance checklist, gap analysis, and corrective actions.",             frequency:"Quarterly",last_generated:"2026-04-01 11:00",next_due:"2026-07-01 11:00", status:"ready",      format:["PDF"],         size_kb:520  },
  { id:23, name:"Biomedical Waste Report",        category:"Statutory",    description:"Category-wise waste generation, disposal, contractor compliance, and CPCB summary.",    frequency:"Monthly", last_generated:"2026-05-01 08:00", next_due:"2026-06-01 08:00", status:"ready",      format:["PDF"],         size_kb:148  },
  { id:24, name:"PCPNDT Compliance Report",       category:"Statutory",    description:"USG case register, Form F records, and regulatory compliance summary.",                  frequency:"Monthly", last_generated:"2026-05-01 08:00", next_due:"2026-06-01 08:00", status:"scheduled",  format:["PDF"],         size_kb:0    },
];

const CAT_CFG: Record<ReportCategory, { cls: string; color: string }> = {
  Clinical:     { cls:"bg-blue-100 text-blue-700",    color:"border-l-blue-500"   },
  Financial:    { cls:"bg-green-100 text-green-700",  color:"border-l-green-500"  },
  Operational:  { cls:"bg-amber-100 text-amber-700",  color:"border-l-amber-500"  },
  HR:           { cls:"bg-purple-100 text-purple-700",color:"border-l-purple-500" },
  Quality:      { cls:"bg-teal-100 text-teal-700",    color:"border-l-teal-500"   },
  Statutory:    { cls:"bg-red-100 text-red-700",      color:"border-l-red-500"    },
};
const STATUS_CFG: Record<ReportStatus, { label: string; cls: string; icon: React.ReactNode }> = {
  ready:      { label:"Ready",      cls:"bg-green-100 text-green-700",  icon:<CheckCircle2 className="h-3 w-3" /> },
  generating: { label:"Generating", cls:"bg-blue-100 text-blue-700",   icon:<RefreshCw    className="h-3 w-3 animate-spin" /> },
  scheduled:  { label:"Scheduled",  cls:"bg-amber-100 text-amber-700", icon:<Clock        className="h-3 w-3" /> },
  failed:     { label:"Failed",     cls:"bg-red-100 text-red-700",     icon:<AlertTriangle className="h-3 w-3" /> },
};
const CATEGORIES: ReportCategory[] = ["Clinical","Financial","Operational","HR","Quality","Statutory"];

export default function ReportsPage() {
  const [q, setQ]             = useState("");
  const [cat, setCat]         = useState<ReportCategory | "All">("All");
  const [generating, setGen]  = useState<number | null>(null);

  const generate = (id: number) => {
    setGen(id);
    setTimeout(() => setGen(null), 2000);
  };

  const displayed = REPORTS.filter(r => {
    const mq = !q || r.name.toLowerCase().includes(q.toLowerCase()) || r.description.toLowerCase().includes(q.toLowerCase());
    const mc = cat === "All" || r.category === cat;
    return mq && mc;
  });

  const grouped = CATEGORIES.reduce<Record<string, Report[]>>((acc, c) => {
    const items = displayed.filter(r => r.category === c);
    if (items.length) acc[c] = items;
    return acc;
  }, {});

  return (
    <div className="space-y-5 pb-8">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div><h2 className="text-2xl font-bold">Reports</h2><p className="text-sm text-muted-foreground">Generate, schedule, and download hospital MIS reports</p></div>
        <Button className="gap-2"><Calendar className="h-4 w-4" />Schedule Report</Button>
      </div>

      {/* Summary */}
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {CATEGORIES.map(c => {
          const cnt = REPORTS.filter(r => r.category === c).length;
          const cc  = CAT_CFG[c];
          return (
            <button key={c} onClick={() => setCat(cat === c ? "All" : c)}
              className={cn("rounded-xl border bg-background px-4 py-3 text-left transition-all border-l-[3px] hover:shadow-sm", cc.color, cat === c && "ring-2 ring-primary")}>
              <p className="text-2xl font-bold">{cnt}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{c}</p>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={e => setQ(e.target.value)} className="pl-9" placeholder="Search reports…" />
        </div>
        <div className="flex rounded-md border overflow-hidden text-xs">
          <button onClick={() => setCat("All")} className={cn("px-3 py-2 font-medium transition-colors", cat === "All" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted")}>All ({REPORTS.length})</button>
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setCat(c)} className={cn("px-3 py-2 font-medium transition-colors", cat === c ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted")}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Reports grouped by category */}
      {Object.entries(grouped).map(([category, reports]) => {
        const cc = CAT_CFG[category as ReportCategory];
        return (
          <div key={category}>
            <div className="flex items-center gap-2 mb-3">
              <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", cc.cls)}>{category}</span>
              <span className="text-xs text-muted-foreground">{reports.length} reports</span>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {reports.map(r => {
                const sc  = STATUS_CFG[r.status];
                const isGen = generating === r.id || r.status === "generating";
                return (
                  <Card key={r.id} className={cn("overflow-hidden transition-shadow hover:shadow-md", cc.color.replace("border-l-","border-l-[3px] border-l-"))}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl mt-0.5", cc.cls.split(" ")[0])}>
                            <FileText className={cn("h-4 w-4", cc.cls.split(" ")[1])} />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-[13px] leading-tight">{r.name}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{r.description}</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-3 pt-3 border-t flex-wrap gap-2">
                        <div className="flex items-center gap-2 flex-wrap text-[11px] text-muted-foreground">
                          <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium", sc.cls)}>{sc.icon}{sc.label}</span>
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{r.frequency}</span>
                          {r.last_generated && <span>Last: {r.last_generated.split(" ")[0]}</span>}
                          {r.size_kb > 0   && <span>{r.size_kb > 1000 ? `${(r.size_kb/1000).toFixed(1)} MB` : `${r.size_kb} KB`}</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          {/* Format badges */}
                          {r.format.map(f => (
                            <span key={f} className="rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{f}</span>
                          ))}
                          {/* Actions */}
                          {r.status === "ready" && (
                            <>
                              <button
                                onClick={() => generate(r.id)}
                                disabled={isGen}
                                className="flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-[11px] text-muted-foreground hover:bg-muted disabled:opacity-50 transition-colors">
                                <RefreshCw className={cn("h-3 w-3", isGen && "animate-spin")} />
                                {isGen ? "..." : "Regenerate"}
                              </button>
                              <button className="flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-[11px] text-primary-foreground font-medium hover:bg-primary/90">
                                <Download className="h-3 w-3" />Download
                              </button>
                            </>
                          )}
                          {r.status === "generating" && (
                            <span className="flex items-center gap-1 text-[11px] text-blue-600 font-medium">
                              <RefreshCw className="h-3 w-3 animate-spin" />Generating…
                            </span>
                          )}
                          {r.status === "scheduled" && (
                            <span className="flex items-center gap-1 text-[11px] text-amber-600 font-medium">
                              <Clock className="h-3 w-3" />Scheduled
                            </span>
                          )}
                        </div>
                      </div>
                      {r.next_due && (
                        <p className="text-[10px] text-muted-foreground mt-1.5">Next: {r.next_due}</p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}