"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { requisitionsApi, issuesApi } from "@/lib/api/blood_bank";
import type { BloodRequisition, BloodBag } from "@/types/blood_bank";

const STATUS_CHIPS: Record<string, string> = {
  PENDING:    "bg-slate-100 text-slate-700 border-slate-300",
  CROSSMATCH: "bg-indigo-100 text-indigo-800 border-indigo-300",
  RESERVED:   "bg-amber-100 text-amber-800 border-amber-300",
  ISSUED:     "bg-emerald-100 text-emerald-800 border-emerald-300",
  CANCELLED:  "bg-rose-100 text-rose-800 border-rose-300",
  REJECTED:   "bg-rose-100 text-rose-800 border-rose-300",
};


export default function RequisitionDetailPage() {
  const params = useParams();
  const id = Number(params?.id);
  const queryClient = useQueryClient();

  const { data: req, isLoading } = useQuery<BloodRequisition>({
    queryKey: ["bb-req", id],
    queryFn: async () => await requisitionsApi.get(id),
    enabled: !!id,
    refetchInterval: 15000,
  });
  const { data: compatibleBags = [] } = useQuery<BloodBag[]>({
    queryKey: ["bb-compatible", id],
    queryFn: async () => await requisitionsApi.compatibleBags(id),
    enabled: !!id && !!req && ["PENDING", "CROSSMATCH", "RESERVED"].includes(req.status),
  });

  if (isLoading || !req) {
    return <div className="p-8 text-slate-500">Loading…</div>;
  }
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["bb-req", id] });
    queryClient.invalidateQueries({ queryKey: ["bb-compatible", id] });
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-slate-900">{req.code}</h1>
            <span className={`text-xs px-2 py-1 rounded border ${STATUS_CHIPS[req.status]}`}>
              {req.status_label}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            For <strong>{req.patient_name}</strong> (MRN {req.patient_mrn}) ·{" "}
            <strong>{req.units_required} units</strong> of {req.component_label}{" "}
            {req.blood_group_label} · {req.urgency_label}
          </p>
        </div>
      </div>

      {/* Summary panel */}
      <section className="border border-slate-200 rounded-lg p-4 bg-white">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <Cell label="Requested By" value={req.requested_by_name} />
          <Cell label="Requested At"
                value={new Date(req.requested_at).toLocaleString("en-IN")} />
          <Cell label="Units Issued" value={`${req.units_issued} / ${req.units_required}`} />
          <Cell label="Admission" value={req.admission_code || "—"} />
        </div>
        {req.purpose && (
          <div className="mt-3 text-sm">
            <span className="font-medium">Indication: </span>
            {req.purpose}
          </div>
        )}
      </section>

      {/* Compatible bags + crossmatch */}
      {["PENDING", "CROSSMATCH", "RESERVED"].includes(req.status) && (
        <section className="border border-slate-200 rounded-lg p-4 bg-white">
          <h2 className="font-medium mb-3">
            Compatible Bags ({compatibleBags.length})
          </h2>
          {compatibleBags.length === 0 ? (
            <p className="text-sm text-slate-500 italic py-4 text-center">
              No compatible bags currently available in inventory.
            </p>
          ) : (
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="text-xs text-slate-500 uppercase border-b border-slate-200">
                  <tr>
                    <th className="text-left py-2">Bag ID</th>
                    <th className="text-left py-2">Group</th>
                    <th className="text-left py-2">Component</th>
                    <th className="text-right py-2">Volume</th>
                    <th className="text-left py-2">Expires</th>
                    <th className="text-left py-2">Days</th>
                    <th className="text-left py-2">Cross-match</th>
                  </tr>
                </thead>
                <tbody>
                  {compatibleBags.map((bag) => {
                    const cm = req.crossmatches.find((c) => c.bag === bag.id);
                    return (
                      <BagRow key={bag.id} bag={bag} crossmatch={cm} req={req}
                              onChange={refresh} />
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Cross-matches recorded */}
      {req.crossmatches.length > 0 && (
        <section className="border border-slate-200 rounded-lg p-4 bg-white">
          <h2 className="font-medium mb-3">
            Cross-match Log ({req.crossmatches.length})
          </h2>
          <table className="min-w-full text-sm">
            <thead className="text-xs text-slate-500 uppercase border-b border-slate-200">
              <tr>
                <th className="text-left py-2">Bag</th>
                <th className="text-left py-2">Group/Component</th>
                <th className="text-left py-2">Result</th>
                <th className="text-left py-2">When</th>
                <th className="text-left py-2">Notes</th>
              </tr>
            </thead>
            <tbody>
              {req.crossmatches.map((cm) => (
                <tr key={cm.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-2 font-mono text-xs">{cm.bag_id_str}</td>
                  <td className="py-2">{cm.bag_blood_group} · {cm.bag_component}</td>
                  <td className="py-2">
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      cm.result === "COMPATIBLE"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-rose-100 text-rose-800"
                    }`}>
                      {cm.result_label}
                    </span>
                  </td>
                  <td className="py-2 text-slate-500">
                    {new Date(cm.performed_at).toLocaleString("en-IN")}
                  </td>
                  <td className="py-2 text-slate-600">{cm.notes || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Issues / Transfusion */}
      {req.issues.length > 0 && (
        <section className="border border-slate-200 rounded-lg p-4 bg-white">
          <h2 className="font-medium mb-3">
            Issued Bags ({req.issues.length})
          </h2>
          <div className="space-y-3">
            {req.issues.map((issue) => (
              <IssueRow key={issue.id} issue={issue} onChange={refresh} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}


function BagRow({
  bag, crossmatch, req, onChange,
}: {
  bag: BloodBag;
  crossmatch?: any;
  req: BloodRequisition;
  onChange: () => void;
}) {
  const cmAction = useMutation({
    mutationFn: (result: "COMPATIBLE" | "INCOMPATIBLE") =>
      requisitionsApi.crossmatch(req.id, { bag_id: bag.id, result }),
    onSuccess: onChange,
  });
  const reserveAction = useMutation({
    mutationFn: () => requisitionsApi.reserve(req.id, bag.id),
    onSuccess: onChange,
  });
  const issueAction = useMutation({
    mutationFn: (data: any) => requisitionsApi.issueBag(req.id, { bag_id: bag.id, ...data }),
    onSuccess: onChange,
  });

  const [showIssueForm, setShowIssueForm] = useState(false);
  const [issuedTo, setIssuedTo] = useState("");
  const [receivedBy, setReceivedBy] = useState("");
  const [unitPrice, setUnitPrice] = useState("1500");
  const [createInvoice, setCreateInvoice] = useState(true);

  const isReserved = bag.status === "RESERVED" && bag.issued_to_requisition === req.id;
  const isAvailableElsewhere = bag.status === "AVAILABLE" || isReserved;

  return (
    <>
      <tr className="border-b border-slate-100">
        <td className="py-2 font-mono text-xs">{bag.bag_id}</td>
        <td className="py-2">{bag.blood_group_label}</td>
        <td className="py-2">{bag.component_label}</td>
        <td className="py-2 text-right">{bag.volume_ml} ml</td>
        <td className="py-2 text-slate-600">
          {new Date(bag.expiry_date).toLocaleDateString("en-IN")}
        </td>
        <td className="py-2">
          <span className={`text-xs ${
            (bag.days_to_expiry ?? 999) < 7
              ? "text-amber-700 font-medium"
              : "text-slate-600"
          }`}>
            {bag.days_to_expiry} d
          </span>
        </td>
        <td className="py-2">
          {!crossmatch && isAvailableElsewhere && (
            <div className="flex gap-1">
              <button
                onClick={() => cmAction.mutate("COMPATIBLE")}
                disabled={cmAction.isPending}
                className="text-xs px-2 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700"
              >
                ✓ Compatible
              </button>
              <button
                onClick={() => cmAction.mutate("INCOMPATIBLE")}
                disabled={cmAction.isPending}
                className="text-xs px-2 py-1 bg-rose-600 text-white rounded hover:bg-rose-700"
              >
                ✗ Incompatible
              </button>
            </div>
          )}
          {crossmatch && crossmatch.result === "COMPATIBLE" && bag.status === "AVAILABLE" && (
            <button
              onClick={() => reserveAction.mutate()}
              disabled={reserveAction.isPending}
              className="text-xs px-2 py-1 bg-amber-600 text-white rounded hover:bg-amber-700"
            >
              Reserve
            </button>
          )}
          {isReserved && (
            <button
              onClick={() => setShowIssueForm(!showIssueForm)}
              className="text-xs px-2 py-1 bg-emerald-700 text-white rounded hover:bg-emerald-800"
            >
              Issue Bag
            </button>
          )}
          {crossmatch && crossmatch.result === "INCOMPATIBLE" && (
            <span className="text-xs text-rose-600">Incompatible</span>
          )}
        </td>
      </tr>
      {showIssueForm && (
        <tr>
          <td colSpan={7} className="bg-slate-50 p-3">
            <div className="grid grid-cols-4 gap-3 items-end">
              <div>
                <label className="text-xs text-slate-600 block mb-1">Issued To</label>
                <input value={issuedTo} onChange={(e) => setIssuedTo(e.target.value)}
                       placeholder="e.g. ICU, OT-1, Ward 3"
                       className="w-full border border-slate-300 rounded px-2 py-1 text-sm" />
              </div>
              <div>
                <label className="text-xs text-slate-600 block mb-1">Received By</label>
                <input value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)}
                       placeholder="Nurse name"
                       className="w-full border border-slate-300 rounded px-2 py-1 text-sm" />
              </div>
              <div>
                <label className="text-xs text-slate-600 block mb-1">Unit Price (₹)</label>
                <input type="number" value={unitPrice}
                       onChange={(e) => setUnitPrice(e.target.value)}
                       className="w-full border border-slate-300 rounded px-2 py-1 text-sm" />
              </div>
              <div className="flex items-end gap-2">
                <label className="flex items-center gap-1 text-xs">
                  <input type="checkbox" checked={createInvoice}
                         onChange={(e) => setCreateInvoice(e.target.checked)} />
                  Bill
                </label>
                <button
                  onClick={() => issueAction.mutate({
                    issued_to_dept: issuedTo, received_by_name: receivedBy,
                    create_invoice: createInvoice, unit_price: unitPrice,
                  })}
                  disabled={issueAction.isPending}
                  className="px-3 py-1 bg-emerald-700 text-white rounded text-sm hover:bg-emerald-800"
                >
                  Issue
                </button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}


function IssueRow({ issue, onChange }: { issue: any; onChange: () => void }) {
  const [show, setShow] = useState(false);
  const [reactions, setReactions] = useState("");
  const [bagReturned, setBagReturned] = useState(false);
  const now = () => new Date().toISOString().slice(0, 16);
  const [start, setStart] = useState(now());
  const [end, setEnd] = useState(now());

  const submit = useMutation({
    mutationFn: () => issuesApi.completeTransfusion(issue.id, {
      started_at: new Date(start).toISOString(),
      completed_at: new Date(end).toISOString(),
      reactions, bag_returned: bagReturned,
    }),
    onSuccess: () => { setShow(false); onChange(); },
  });

  return (
    <div className="border border-slate-200 rounded-md p-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="font-medium font-mono text-sm">{issue.bag_id_str}</div>
          <div className="text-xs text-slate-500">
            {issue.bag_component} {issue.bag_blood_group} · Issued{" "}
            {new Date(issue.issued_at).toLocaleString("en-IN")} · To{" "}
            {issue.issued_to_dept || "—"} · Received by {issue.received_by_name || "—"}
            {issue.invoice_code && (
              <span className="ml-2 text-sky-700">Invoice: {issue.invoice_code}</span>
            )}
          </div>
        </div>
        <div>
          {!issue.transfusion_completed_at ? (
            <button onClick={() => setShow(!show)}
                    className="text-xs px-2 py-1 border border-slate-300 rounded hover:bg-slate-50">
              {show ? "Cancel" : "Complete Transfusion"}
            </button>
          ) : (
            <span className="text-xs text-emerald-700">
              ✓ Completed {new Date(issue.transfusion_completed_at).toLocaleString("en-IN")}
            </span>
          )}
        </div>
      </div>
      {show && (
        <div className="mt-3 p-3 bg-slate-50 rounded grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-600 block mb-1">Started At</label>
            <input type="datetime-local" value={start}
                   onChange={(e) => setStart(e.target.value)}
                   className="w-full border border-slate-300 rounded px-2 py-1 text-sm" />
          </div>
          <div>
            <label className="text-xs text-slate-600 block mb-1">Completed At</label>
            <input type="datetime-local" value={end}
                   onChange={(e) => setEnd(e.target.value)}
                   className="w-full border border-slate-300 rounded px-2 py-1 text-sm" />
          </div>
          <div className="col-span-2">
            <label className="text-xs text-slate-600 block mb-1">Reactions Observed</label>
            <textarea value={reactions} onChange={(e) => setReactions(e.target.value)}
                      rows={2}
                      placeholder="e.g. None / Mild fever / Allergic reaction"
                      className="w-full border border-slate-300 rounded px-2 py-1 text-sm" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={bagReturned}
                   onChange={(e) => setBagReturned(e.target.checked)} />
            Bag returned (unused / partial)
          </label>
          <div className="text-right">
            <button onClick={() => submit.mutate()}
                    disabled={submit.isPending}
                    className="px-4 py-1 bg-emerald-700 text-white rounded text-sm hover:bg-emerald-800 disabled:bg-slate-300">
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


function Cell({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="text-xs text-slate-500 uppercase">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
