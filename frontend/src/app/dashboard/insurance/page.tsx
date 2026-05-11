"use client";

import { useEffect, useState } from "react";
import { insuranceApi } from "@/lib/api/phase4c";
import type {
  InsuranceCompany, PolicyCoverage, PreAuth, Claim, InsuranceDashboard,
} from "@/types/phase4c";

export default function InsurancePage() {
  const [tab, setTab] = useState<"dash" | "companies" | "policies" | "preauths" | "claims">("dash");
  const [dash, setDash] = useState<InsuranceDashboard | null>(null);
  const [companies, setCompanies] = useState<InsuranceCompany[]>([]);
  const [policies, setPolicies] = useState<PolicyCoverage[]>([]);
  const [preAuths, setPreAuths] = useState<PreAuth[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    Promise.all([
      insuranceApi.dashboard().catch(() => null),
      insuranceApi.listCompanies().catch(() => []),
      insuranceApi.listPolicies().catch(() => []),
      insuranceApi.listPreAuths().catch(() => []),
      insuranceApi.listClaims().catch(() => []),
    ]).then(([d, c, p, pa, cl]) => {
      setDash(d);
      setCompanies(c);
      setPolicies(p);
      setPreAuths(pa);
      setClaims(cl);
    }).catch(e => setError(String(e))).finally(() => setLoading(false));
  }, []);

  const statusColor = (s: string) => {
    const map: Record<string, string> = {
      DRAFT: "bg-gray-100 text-gray-700",
      SUBMITTED: "bg-blue-100 text-blue-700",
      UNDER_REVIEW: "bg-indigo-100 text-indigo-700",
      APPROVED: "bg-green-100 text-green-700",
      PARTIAL: "bg-yellow-100 text-yellow-700",
      REJECTED: "bg-red-100 text-red-700",
      SETTLED: "bg-emerald-100 text-emerald-700",
      CLOSED: "bg-slate-200 text-slate-700",
      EXPIRED: "bg-orange-100 text-orange-700",
      CANCELLED: "bg-gray-200 text-gray-600",
    };
    return map[s] || "bg-gray-100 text-gray-700";
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Insurance & TPA Management</h1>
      <p className="text-gray-600 mb-4 text-sm">
        Empanelled insurers, policy coverage, pre-authorizations and claim settlement.
      </p>

      {error && <div className="bg-red-50 text-red-700 p-3 rounded mb-4">{error}</div>}

      <div className="flex gap-2 mb-4 border-b">
        {[
          ["dash", "Dashboard"], ["companies", "Insurers"], ["policies", "Policies"],
          ["preauths", "Pre-Auths"], ["claims", "Claims"],
        ].map(([k, label]) => (
          <button key={k}
            className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === k
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-600 hover:text-gray-900"
              }`}
            onClick={() => setTab(k as typeof tab)}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="p-12 text-center text-gray-500">Loading...</div>
      ) : tab === "dash" ? (
        <DashTab dash={dash} preAuths={preAuths} claims={claims} />
      ) : tab === "companies" ? (
        <CompaniesTab companies={companies} />
      ) : tab === "policies" ? (
        <PoliciesTab policies={policies} />
      ) : tab === "preauths" ? (
        <PreAuthsTab preAuths={preAuths} statusColor={statusColor} reload={() => {
          insuranceApi.listPreAuths().then(setPreAuths);
        }} />
      ) : (
        <ClaimsTab claims={claims} statusColor={statusColor} reload={() => {
          insuranceApi.listClaims().then(setClaims);
        }} />
      )}
    </div>
  );
}

function DashTab({ dash, preAuths, claims }: {
  dash: InsuranceDashboard | null; preAuths: PreAuth[]; claims: Claim[];
}) {
  if (!dash) return <div className="text-gray-500 p-6">Dashboard not available</div>;

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Empanelled Insurers" value={dash.total_companies} color="blue" />
        <StatCard label="Active Policies" value={dash.active_policies} color="green" />
        <StatCard label="Pre-auths Pending" value={dash.pre_auths_pending} color="yellow" />
        <StatCard label="Claims Submitted" value={dash.claims_submitted} color="indigo" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-emerald-50 p-4 rounded border border-emerald-200">
          <div className="text-sm text-emerald-700">Approved Amount (Open)</div>
          <div className="text-2xl font-bold text-emerald-900">
            ₹{Number(dash.claims_approved_amount).toLocaleString("en-IN")}
          </div>
        </div>
        <div className="bg-blue-50 p-4 rounded border border-blue-200">
          <div className="text-sm text-blue-700">Settled (Paid)</div>
          <div className="text-2xl font-bold text-blue-900">
            ₹{Number(dash.claims_settled_amount).toLocaleString("en-IN")}
          </div>
        </div>
      </div>

      <div className="bg-white rounded shadow border p-4 mb-4">
        <h2 className="font-semibold mb-2">Recent Pre-Auths</h2>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-2 text-left">Code</th>
                <th className="p-2 text-left">Patient</th>
                <th className="p-2 text-left">Insurer</th>
                <th className="p-2 text-right">Requested</th>
                <th className="p-2 text-right">Approved</th>
                <th className="p-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {preAuths.slice(0, 8).map(p => (
                <tr key={p.id} className="border-t">
                  <td className="p-2 font-mono text-xs">{p.code}</td>
                  <td className="p-2">{p.patient_name}</td>
                  <td className="p-2">{p.insurance_name}</td>
                  <td className="p-2 text-right">₹{Number(p.requested_amount).toLocaleString("en-IN")}</td>
                  <td className="p-2 text-right">₹{Number(p.approved_amount).toLocaleString("en-IN")}</td>
                  <td className="p-2 text-center">
                    <span className="px-2 py-0.5 rounded text-xs bg-gray-100">
                      {p.status_label}
                    </span>
                  </td>
                </tr>
              ))}
              {preAuths.length === 0 && (
                <tr><td colSpan={6} className="p-4 text-center text-gray-400">No pre-auths</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded shadow border p-4">
        <h2 className="font-semibold mb-2">Recent Claims</h2>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-2 text-left">Code</th>
                <th className="p-2 text-left">Patient</th>
                <th className="p-2">Type</th>
                <th className="p-2 text-right">Bill</th>
                <th className="p-2 text-right">Claim</th>
                <th className="p-2 text-right">Approved</th>
                <th className="p-2 text-right">Settled</th>
                <th className="p-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {claims.slice(0, 8).map(c => (
                <tr key={c.id} className="border-t">
                  <td className="p-2 font-mono text-xs">{c.code}</td>
                  <td className="p-2">{c.patient_name}</td>
                  <td className="p-2 text-center text-xs">{c.claim_type_label}</td>
                  <td className="p-2 text-right">₹{Number(c.bill_amount).toLocaleString("en-IN")}</td>
                  <td className="p-2 text-right">₹{Number(c.claim_amount).toLocaleString("en-IN")}</td>
                  <td className="p-2 text-right">₹{Number(c.approved_amount).toLocaleString("en-IN")}</td>
                  <td className="p-2 text-right">₹{Number(c.settled_amount).toLocaleString("en-IN")}</td>
                  <td className="p-2 text-center text-xs">{c.status_label}</td>
                </tr>
              ))}
              {claims.length === 0 && (
                <tr><td colSpan={8} className="p-4 text-center text-gray-400">No claims</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: {
  label: string; value: number | string; color: string;
}) {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 border-blue-200 text-blue-900",
    green: "bg-green-50 border-green-200 text-green-900",
    yellow: "bg-yellow-50 border-yellow-200 text-yellow-900",
    indigo: "bg-indigo-50 border-indigo-200 text-indigo-900",
  };
  return (
    <div className={`${colors[color]} p-4 rounded border`}>
      <div className="text-sm opacity-75">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

function CompaniesTab({ companies }: { companies: InsuranceCompany[] }) {
  return (
    <div className="bg-white rounded shadow border overflow-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="p-2 text-left">Code</th>
            <th className="p-2 text-left">Name</th>
            <th className="p-2 text-left">Phone</th>
            <th className="p-2 text-left">Email</th>
            <th className="p-2">Empanelled</th>
            <th className="p-2">Cashless</th>
            <th className="p-2">Active</th>
          </tr>
        </thead>
        <tbody>
          {companies.map(c => (
            <tr key={c.id} className="border-t hover:bg-gray-50">
              <td className="p-2 font-mono text-xs">{c.code}</td>
              <td className="p-2">{c.name}</td>
              <td className="p-2 text-xs">{c.phone || "—"}</td>
              <td className="p-2 text-xs">{c.email || "—"}</td>
              <td className="p-2 text-center">{c.is_empanelled ? "✓" : "—"}</td>
              <td className="p-2 text-center">{c.is_cashless ? "✓" : "—"}</td>
              <td className="p-2 text-center">{c.is_active ? "✓" : "—"}</td>
            </tr>
          ))}
          {companies.length === 0 && (
            <tr><td colSpan={7} className="p-6 text-center text-gray-400">No insurers</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function PoliciesTab({ policies }: { policies: PolicyCoverage[] }) {
  return (
    <div className="bg-white rounded shadow border overflow-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="p-2 text-left">Policy #</th>
            <th className="p-2 text-left">Patient</th>
            <th className="p-2 text-left">Insurer</th>
            <th className="p-2 text-left">TPA</th>
            <th className="p-2">Type</th>
            <th className="p-2 text-right">Sum Insured</th>
            <th className="p-2">Validity</th>
            <th className="p-2">Active</th>
          </tr>
        </thead>
        <tbody>
          {policies.map(p => (
            <tr key={p.id} className="border-t hover:bg-gray-50">
              <td className="p-2 font-mono text-xs">{p.policy_number}</td>
              <td className="p-2">{p.patient_name}</td>
              <td className="p-2 text-xs">{p.insurance_company_name}</td>
              <td className="p-2 text-xs">{p.tpa_name || "—"}</td>
              <td className="p-2 text-center text-xs">{p.cover_type_label}</td>
              <td className="p-2 text-right">₹{Number(p.sum_insured).toLocaleString("en-IN")}</td>
              <td className="p-2 text-xs text-center">{p.policy_start_date} → {p.policy_end_date}</td>
              <td className="p-2 text-center">{p.is_active ? "✓" : "—"}</td>
            </tr>
          ))}
          {policies.length === 0 && (
            <tr><td colSpan={8} className="p-6 text-center text-gray-400">No policies</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function PreAuthsTab({ preAuths, statusColor, reload }: {
  preAuths: PreAuth[]; statusColor: (s: string) => string; reload: () => void;
}) {
  const [busy, setBusy] = useState<number | null>(null);

  const submit = async (id: number) => {
    setBusy(id);
    try {
      await insuranceApi.submitPreAuth(id);
      reload();
    } catch (e) {
      alert(String(e));
    }
    setBusy(null);
  };

  const approve = async (id: number) => {
    const amt = prompt("Approved amount (₹)?");
    if (!amt) return;
    const ref = prompt("TPA reference number?") || "";
    setBusy(id);
    try {
      await insuranceApi.approvePreAuth(id, {
        approved_amount: parseFloat(amt),
        tpa_reference: ref,
      });
      reload();
    } catch (e) {
      alert(String(e));
    }
    setBusy(null);
  };

  return (
    <div className="bg-white rounded shadow border overflow-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="p-2 text-left">Code</th>
            <th className="p-2 text-left">Patient</th>
            <th className="p-2 text-left">Insurer</th>
            <th className="p-2">Urgency</th>
            <th className="p-2 text-left">Diagnosis</th>
            <th className="p-2 text-right">Requested</th>
            <th className="p-2 text-right">Approved</th>
            <th className="p-2">Status</th>
            <th className="p-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {preAuths.map(p => (
            <tr key={p.id} className="border-t hover:bg-gray-50">
              <td className="p-2 font-mono text-xs">{p.code}</td>
              <td className="p-2">{p.patient_name}</td>
              <td className="p-2 text-xs">{p.insurance_name}</td>
              <td className="p-2 text-center text-xs">{p.urgency_label}</td>
              <td className="p-2 text-xs truncate max-w-xs">{p.primary_diagnosis}</td>
              <td className="p-2 text-right">₹{Number(p.requested_amount).toLocaleString("en-IN")}</td>
              <td className="p-2 text-right">₹{Number(p.approved_amount).toLocaleString("en-IN")}</td>
              <td className="p-2 text-center">
                <span className={`px-2 py-0.5 rounded text-xs ${statusColor(p.status)}`}>
                  {p.status_label}
                </span>
              </td>
              <td className="p-2 text-center text-xs">
                {p.status === "DRAFT" && (
                  <button onClick={() => submit(p.id)} disabled={busy === p.id}
                    className="text-blue-600 hover:underline">Submit</button>
                )}
                {p.status === "SUBMITTED" && (
                  <button onClick={() => approve(p.id)} disabled={busy === p.id}
                    className="text-green-600 hover:underline">Approve</button>
                )}
              </td>
            </tr>
          ))}
          {preAuths.length === 0 && (
            <tr><td colSpan={9} className="p-6 text-center text-gray-400">No pre-auths</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function ClaimsTab({ claims, statusColor, reload }: {
  claims: Claim[]; statusColor: (s: string) => string; reload: () => void;
}) {
  const [busy, setBusy] = useState<number | null>(null);

  const submit = async (id: number) => {
    setBusy(id);
    try {
      await insuranceApi.submitClaim(id);
      reload();
    } catch (e) {
      alert(String(e));
    }
    setBusy(null);
  };

  const approve = async (id: number) => {
    const amt = prompt("Approved amount?");
    if (!amt) return;
    setBusy(id);
    try {
      await insuranceApi.approveClaim(id, { approved_amount: parseFloat(amt) });
      reload();
    } catch (e) {
      alert(String(e));
    }
    setBusy(null);
  };

  const settle = async (id: number) => {
    const amt = prompt("Settled amount?");
    if (!amt) return;
    setBusy(id);
    try {
      await insuranceApi.settleClaim(id, { settled_amount: parseFloat(amt) });
      reload();
    } catch (e) {
      alert(String(e));
    }
    setBusy(null);
  };

  return (
    <div className="bg-white rounded shadow border overflow-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="p-2 text-left">Code</th>
            <th className="p-2 text-left">Patient</th>
            <th className="p-2 text-left">Insurer</th>
            <th className="p-2">Type</th>
            <th className="p-2 text-right">Bill</th>
            <th className="p-2 text-right">Co-pay</th>
            <th className="p-2 text-right">Claim</th>
            <th className="p-2 text-right">Approved</th>
            <th className="p-2 text-right">Settled</th>
            <th className="p-2">Status</th>
            <th className="p-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {claims.map(c => (
            <tr key={c.id} className="border-t hover:bg-gray-50">
              <td className="p-2 font-mono text-xs">{c.code}</td>
              <td className="p-2">{c.patient_name}</td>
              <td className="p-2 text-xs">{c.insurance_name}</td>
              <td className="p-2 text-center text-xs">{c.claim_type_label}</td>
              <td className="p-2 text-right">₹{Number(c.bill_amount).toLocaleString("en-IN")}</td>
              <td className="p-2 text-right">₹{Number(c.co_pay_amount).toLocaleString("en-IN")}</td>
              <td className="p-2 text-right">₹{Number(c.claim_amount).toLocaleString("en-IN")}</td>
              <td className="p-2 text-right">₹{Number(c.approved_amount).toLocaleString("en-IN")}</td>
              <td className="p-2 text-right">₹{Number(c.settled_amount).toLocaleString("en-IN")}</td>
              <td className="p-2 text-center">
                <span className={`px-2 py-0.5 rounded text-xs ${statusColor(c.status)}`}>
                  {c.status_label}
                </span>
              </td>
              <td className="p-2 text-center text-xs space-x-2">
                {c.status === "DRAFT" && (
                  <button onClick={() => submit(c.id)} disabled={busy === c.id}
                    className="text-blue-600 hover:underline">Submit</button>
                )}
                {(c.status === "SUBMITTED" || c.status === "UNDER_REVIEW") && (
                  <button onClick={() => approve(c.id)} disabled={busy === c.id}
                    className="text-green-600 hover:underline">Approve</button>
                )}
                {(c.status === "APPROVED" || c.status === "PARTIAL") && (
                  <button onClick={() => settle(c.id)} disabled={busy === c.id}
                    className="text-emerald-600 hover:underline">Settle</button>
                )}
              </td>
            </tr>
          ))}
          {claims.length === 0 && (
            <tr><td colSpan={11} className="p-6 text-center text-gray-400">No claims</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
