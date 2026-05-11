"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { gstApi } from "@/lib/api/reports";
import type { GSTR1Row, GSTR1HSNRow } from "@/lib/api/reports";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function GSTReportsPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [tab, setTab] = useState<"gstr1" | "gstr3b">("gstr1");

  const gstr1 = useQuery({
    queryKey: ["gstr1", year, month],
    queryFn: () => gstApi.gstr1(year, month),
    enabled: tab === "gstr1",
  });
  const gstr3b = useQuery({
    queryKey: ["gstr3b", year, month],
    queryFn: () => gstApi.gstr3b(year, month),
    enabled: tab === "gstr3b",
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">GST Reports</h1>
          <p className="text-sm text-slate-500 mt-1">
            Monthly GSTR-1 (outward supplies) and GSTR-3B (summary return) for filing
          </p>
        </div>
      </div>

      {/* Period picker + export */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col md:flex-row md:items-end gap-4">
        <div>
          <label className="block text-xs uppercase tracking-wide text-slate-500 mb-1">
            Month
          </label>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 outline-none"
          >
            {MONTH_NAMES.map((name, i) => (
              <option key={i} value={i + 1}>{name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wide text-slate-500 mb-1">
            Year
          </label>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            min={2017}
            max={today.getFullYear() + 1}
            className="border border-slate-300 rounded-md px-3 py-2 text-sm w-28 focus:ring-2 focus:ring-sky-500 outline-none"
          />
        </div>
        <div className="flex-1" />
        <a
          href={gstApi.workbookUrl(year, month)}
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 text-sm font-medium"
        >
          📊 Download Excel Workbook
        </a>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <div className="flex gap-1">
          {[
            { k: "gstr1" as const, label: "GSTR-1 (Outward Supplies)" },
            { k: "gstr3b" as const, label: "GSTR-3B (Summary Return)" },
          ].map(({ k, label }) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
                tab === k
                  ? "border-sky-600 text-sky-700"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* GSTR-1 */}
      {tab === "gstr1" && (
        <>
          {gstr1.isLoading && (
            <div className="p-12 text-center text-slate-400">Loading…</div>
          )}
          {gstr1.data && (
            <div className="space-y-6">
              <PeriodHeader
                title="GSTR-1"
                period={gstr1.data.period_label}
                gstin={gstr1.data.gstin}
                fp={gstr1.data.fp}
              />

              <TotalsCard totals={gstr1.data.totals} />

              <DocsCard docs={gstr1.data.docs} />

              <SectionCard title="B2CS — Business to Consumer (Small)"
                subtitle="Aggregate intra-state sales to unregistered consumers, by state and tax rate">
                {gstr1.data.b2cs.length === 0 ? (
                  <EmptyMessage>No B2CS supplies in this period.</EmptyMessage>
                ) : (
                  <B2CSTable rows={gstr1.data.b2cs} />
                )}
              </SectionCard>

              <SectionCard title="B2CL — Business to Consumer (Large, inter-state)"
                subtitle="Inter-state invoices to unregistered consumers above ₹2.5 lakh">
                {gstr1.data.b2cl.length === 0 ? (
                  <EmptyMessage>No B2CL invoices in this period.</EmptyMessage>
                ) : (
                  <B2CLTable rows={gstr1.data.b2cl} />
                )}
              </SectionCard>

              <SectionCard title="HSN Summary"
                subtitle="Aggregated by HSN/SAC code and tax rate">
                {gstr1.data.hsn_summary.length === 0 ? (
                  <EmptyMessage>No HSN data.</EmptyMessage>
                ) : (
                  <HSNTable rows={gstr1.data.hsn_summary} />
                )}
              </SectionCard>
            </div>
          )}
        </>
      )}

      {/* GSTR-3B */}
      {tab === "gstr3b" && (
        <>
          {gstr3b.isLoading && (
            <div className="p-12 text-center text-slate-400">Loading…</div>
          )}
          {gstr3b.data && (
            <div className="space-y-6">
              <PeriodHeader
                title="GSTR-3B"
                period={gstr3b.data.period_label}
                gstin={gstr3b.data.gstin}
                fp={gstr3b.data.fp}
              />

              <SectionCard title="3.1 — Outward & Reverse Charge Supplies"
                subtitle="Tax liability on outward supplies and inward supplies attracting reverse charge">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Nature of Supplies</th>
                        <th className="px-3 py-2 text-right font-medium">Taxable Value</th>
                        <th className="px-3 py-2 text-right font-medium">CGST</th>
                        <th className="px-3 py-2 text-right font-medium">SGST</th>
                        <th className="px-3 py-2 text-right font-medium">IGST</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      <Sec3Row label="(a) Outward taxable supplies (other than zero rated, nil-rated and exempted)"
                        row={gstr3b.data.sec_3_1.outward_taxable} />
                      <Sec3Row label="(b) Outward taxable supplies (zero rated)"
                        row={gstr3b.data.sec_3_1.zero_rated} />
                      <Sec3Row label="(c) Other outward supplies (nil rated, exempted)"
                        row={gstr3b.data.sec_3_1.other_outward} />
                      <Sec3Row label="(d) Inward supplies (liable to reverse charge)"
                        row={gstr3b.data.sec_3_1.inward_reverse} />
                      <Sec3Row label="(e) Non-GST outward supplies"
                        row={gstr3b.data.sec_3_1.non_gst_outward} />
                    </tbody>
                  </table>
                </div>
              </SectionCard>

              <SectionCard title="4 — Eligible ITC"
                subtitle="Input Tax Credit summary">
                <div className="px-3 py-3 text-sm text-slate-600 italic">
                  {gstr3b.data.sec_4_itc.note}
                </div>
              </SectionCard>

              <SectionCard title="6.1 — Tax Payable"
                subtitle="Final tax liability for the period">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4">
                  <Stat label="CGST" value={gstr3b.data.sec_6_1_tax_payable.cgst} />
                  <Stat label="SGST" value={gstr3b.data.sec_6_1_tax_payable.sgst} />
                  <Stat label="IGST" value={gstr3b.data.sec_6_1_tax_payable.igst} />
                  <Stat label="Total" value={gstr3b.data.sec_6_1_tax_payable.total} accent />
                </div>
              </SectionCard>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Reusable components ───────────────────────────────────────────────────────

function PeriodHeader({
  title, period, gstin, fp,
}: { title: string; period: string; gstin: string; fp: string }) {
  return (
    <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-lg p-5 text-white">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-300">
            {title} · Filing Period
          </div>
          <div className="text-2xl font-semibold mt-1">{period}</div>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-wide text-slate-300">GSTIN</div>
          <div className="text-base font-mono mt-1">{gstin}</div>
          <div className="text-xs text-slate-400 mt-0.5">FP: {fp}</div>
        </div>
      </div>
    </div>
  );
}

function TotalsCard({
  totals,
}: { totals: { taxable_value: string; cgst: string; sgst: string; igst: string; total_tax: string; grand_total: string } }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5">
      <h3 className="text-base font-semibold text-slate-800 mb-3">Period Totals</h3>
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Stat label="Taxable Value" value={totals.taxable_value} />
        <Stat label="CGST" value={totals.cgst} />
        <Stat label="SGST" value={totals.sgst} />
        <Stat label="IGST" value={totals.igst} />
        <Stat label="Total Tax" value={totals.total_tax} />
        <Stat label="Grand Total" value={totals.grand_total} accent />
      </div>
    </div>
  );
}

function DocsCard({
  docs,
}: { docs: { invoices_issued: number; invoices_cancelled: number; refunds_processed: number } }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5">
      <h3 className="text-base font-semibold text-slate-800 mb-3">Document Summary</h3>
      <div className="grid grid-cols-3 gap-4">
        <DocStat label="Invoices Issued" value={docs.invoices_issued} tone="sky" />
        <DocStat label="Invoices Cancelled" value={docs.invoices_cancelled} tone="amber" />
        <DocStat label="Refunds Processed" value={docs.refunds_processed} tone="emerald" />
      </div>
    </div>
  );
}

function SectionCard({
  title, subtitle, children,
}: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100">
        <h3 className="text-base font-semibold text-slate-800">{title}</h3>
        {subtitle && (
          <div className="text-xs text-slate-500 mt-0.5">{subtitle}</div>
        )}
      </div>
      {children}
    </div>
  );
}

function EmptyMessage({ children }: { children: React.ReactNode }) {
  return <div className="p-8 text-center text-slate-400 text-sm">{children}</div>;
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div
        className={`mt-1 font-mono ${
          accent ? "text-xl font-bold text-sky-700" : "text-base font-semibold text-slate-800"
        }`}
      >
        ₹{Number(value).toFixed(2)}
      </div>
    </div>
  );
}

function DocStat({
  label, value, tone,
}: { label: string; value: number; tone: "sky" | "amber" | "emerald" }) {
  const tones = {
    sky: "text-sky-700",
    amber: "text-amber-700",
    emerald: "text-emerald-700",
  };
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${tones[tone]}`}>{value}</div>
    </div>
  );
}

function B2CSTable({ rows }: { rows: GSTR1Row[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
          <tr>
            <th className="px-3 py-2 text-left font-medium">State Code</th>
            <th className="px-3 py-2 text-right font-medium">Rate</th>
            <th className="px-3 py-2 text-right font-medium">Taxable Value</th>
            <th className="px-3 py-2 text-right font-medium">CGST</th>
            <th className="px-3 py-2 text-right font-medium">SGST</th>
            <th className="px-3 py-2 text-right font-medium">IGST</th>
            <th className="px-3 py-2 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 font-mono">
          {rows.map((r, i) => (
            <tr key={i} className="hover:bg-slate-50">
              <td className="px-3 py-2">{r.state_code}</td>
              <td className="px-3 py-2 text-right">{Number(r.rate).toFixed(2)}%</td>
              <td className="px-3 py-2 text-right">₹{Number(r.taxable_value).toFixed(2)}</td>
              <td className="px-3 py-2 text-right">₹{Number(r.cgst).toFixed(2)}</td>
              <td className="px-3 py-2 text-right">₹{Number(r.sgst).toFixed(2)}</td>
              <td className="px-3 py-2 text-right">₹{Number(r.igst).toFixed(2)}</td>
              <td className="px-3 py-2 text-right font-medium">
                ₹{Number(r.total).toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function B2CLTable({ rows }: { rows: Array<{ 
  invoice_no: string; 
  invoice_date: string; 
  invoice_value: string; 
  place_of_supply: string; 
  rate: string; 
  taxable_value: string; 
  igst: string; 
  total: string;
  }> }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Invoice #</th>
            <th className="px-3 py-2 text-left font-medium">Date</th>
            <th className="px-3 py-2 text-left font-medium">POS</th>
            <th className="px-3 py-2 text-right font-medium">Rate</th>
            <th className="px-3 py-2 text-right font-medium">Taxable</th>
            <th className="px-3 py-2 text-right font-medium">IGST</th>
            <th className="px-3 py-2 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 font-mono">
          {rows.map((r) => (
            <tr key={r.invoice_no} className="hover:bg-slate-50">
              <td className="px-3 py-2">{r.invoice_no}</td>
              <td className="px-3 py-2">{r.invoice_date}</td>
              <td className="px-3 py-2">{r.place_of_supply}</td>
              <td className="px-3 py-2 text-right">{Number(r.rate).toFixed(2)}%</td>
              <td className="px-3 py-2 text-right">₹{Number(r.taxable_value).toFixed(2)}</td>
              <td className="px-3 py-2 text-right">₹{Number(r.igst).toFixed(2)}</td>
              <td className="px-3 py-2 text-right font-medium">
                ₹{Number(r.total).toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HSNTable({ rows }: { rows: GSTR1HSNRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
          <tr>
            <th className="px-3 py-2 text-left font-medium">HSN/SAC</th>
            <th className="px-3 py-2 text-right font-medium">Rate</th>
            <th className="px-3 py-2 text-right font-medium">Qty</th>
            <th className="px-3 py-2 text-right font-medium">Taxable Value</th>
            <th className="px-3 py-2 text-right font-medium">CGST</th>
            <th className="px-3 py-2 text-right font-medium">SGST</th>
            <th className="px-3 py-2 text-right font-medium">IGST</th>
            <th className="px-3 py-2 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 font-mono">
          {rows.map((r, i) => (
            <tr key={i} className="hover:bg-slate-50">
              <td className="px-3 py-2">{r.hsn}</td>
              <td className="px-3 py-2 text-right">{Number(r.rate).toFixed(2)}%</td>
              <td className="px-3 py-2 text-right">{r.quantity}</td>
              <td className="px-3 py-2 text-right">₹{Number(r.taxable_value).toFixed(2)}</td>
              <td className="px-3 py-2 text-right">₹{Number(r.cgst).toFixed(2)}</td>
              <td className="px-3 py-2 text-right">₹{Number(r.sgst).toFixed(2)}</td>
              <td className="px-3 py-2 text-right">₹{Number(r.igst).toFixed(2)}</td>
              <td className="px-3 py-2 text-right font-medium">
                ₹{Number(r.total).toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Sec3Row({
  label, row,
}: { label: string; row: { taxable_value: string; cgst: string; sgst: string; igst: string } }) {
  return (
    <tr className="hover:bg-slate-50">
      <td className="px-3 py-2 font-sans text-xs text-slate-700">{label}</td>
      <td className="px-3 py-2 text-right">₹{Number(row.taxable_value).toFixed(2)}</td>
      <td className="px-3 py-2 text-right">₹{Number(row.cgst).toFixed(2)}</td>
      <td className="px-3 py-2 text-right">₹{Number(row.sgst).toFixed(2)}</td>
      <td className="px-3 py-2 text-right">₹{Number(row.igst).toFixed(2)}</td>
    </tr>
  );
}
