"use client";

import { useEffect, useState } from "react";

import { analyticsApi } from "@/lib/api/phase4d";
import type {
  ReportType, SavedReport, ReportRunResult, GoLiveReport, GoLiveStatus,
} from "@/types/phase4d";

function formatINR(n: number): string {
  if (typeof n !== "number") return String(n);
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)} L`;
  if (n >= 1e3) return `₹${(n / 1e3).toFixed(1)} K`;
  return `₹${n.toFixed(0)}`;
}

function StatusPill({ status }: { status: GoLiveStatus }) {
  const colors: Record<GoLiveStatus, string> = {
    PASS: "bg-green-100 text-green-800 border-green-200",
    WARN: "bg-yellow-100 text-yellow-800 border-yellow-200",
    FAIL: "bg-red-100 text-red-800 border-red-200",
  };
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${colors[status]}`}>
      {status}
    </span>
  );
}

function renderReportData(data: unknown): React.ReactNode {
  if (Array.isArray(data)) {
    if (data.length === 0) return <p className="text-sm text-gray-400">No rows.</p>;
    const cols = Object.keys(data[0] as Record<string, unknown>);
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase text-gray-600">
            <tr>
              {cols.map((c) => (
                <th key={c} className="px-3 py-2 font-medium">{c.replace(/_/g, " ")}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i} className="border-b border-gray-100">
                {cols.map((c) => {
                  const v = (row as Record<string, unknown>)[c];
                  const cellText =
                    typeof v === "number" && /amount|revenue|value|outstanding/i.test(c)
                      ? formatINR(v)
                      : v === null || v === undefined
                      ? "—"
                      : String(v);
                  return (
                    <td key={c} className="px-3 py-1.5">{cellText}</td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (typeof data === "object" && data !== null) {
    if ("buckets" in (data as Record<string, unknown>)) {
      const buckets = (data as { buckets: Array<{ bucket: string; amount: number; count: number }> }).buckets;
      return renderReportData(buckets);
    }
    return (
      <pre className="overflow-x-auto rounded-md bg-gray-50 p-3 text-xs text-gray-800">
        {JSON.stringify(data, null, 2)}
      </pre>
    );
  }
  return <p className="text-sm text-gray-500">{String(data)}</p>;
}

export default function ReportsPage() {
  const [tab, setTab] = useState<"reports" | "go-live">("reports");
  const [reportTypes, setReportTypes] = useState<ReportType[]>([]);
  const [saved, setSaved] = useState<SavedReport[]>([]);
  const [selectedType, setSelectedType] = useState<string>("");
  const [parametersJson, setParametersJson] = useState<string>("{}");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ReportRunResult | null>(null);
  const [goLive, setGoLive] = useState<GoLiveReport | null>(null);
  const [goLiveLoading, setGoLiveLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initial loads
  useEffect(() => {
    analyticsApi.reportTypes().then(setReportTypes).catch((e) => setError(String(e?.message || e)));
    analyticsApi.savedReports().then(setSaved).catch((e) => setError(String(e?.message || e)));
  }, []);

  // Detect hash for go-live deep link
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash === "#go-live") {
      setTab("go-live");
    }
  }, []);

  useEffect(() => {
    if (tab !== "go-live" || goLive) return;
    setGoLiveLoading(true);
    analyticsApi
      .goLiveChecklist()
      .then(setGoLive)
      .catch((e) => setError(String(e?.message || e)))
      .finally(() => setGoLiveLoading(false));
  }, [tab, goLive]);

  async function runAdhoc() {
    if (!selectedType) {
      setError("Pick a report type first.");
      return;
    }
    let params: Record<string, unknown> = {};
    try {
      params = JSON.parse(parametersJson || "{}");
    } catch {
      setError("Parameters must be valid JSON.");
      return;
    }
    setError(null);
    setRunning(true);
    try {
      const r = await analyticsApi.runReport(selectedType, params);
      setResult(r);
    } catch (e) {
      setError(String((e as { message?: string })?.message || e));
    } finally {
      setRunning(false);
    }
  }

  async function runSaved(rep: SavedReport) {
    setError(null);
    setRunning(true);
    setSelectedType(rep.report_type);
    setParametersJson(JSON.stringify(rep.parameters, null, 2));
    try {
      const r = await analyticsApi.runSavedReport(rep.id);
      setResult(r);
    } catch (e) {
      setError(String((e as { message?: string })?.message || e));
    } finally {
      setRunning(false);
    }
  }

  async function saveAsNew() {
    if (!selectedType) {
      setError("Pick a report type first.");
      return;
    }
    let params: Record<string, unknown> = {};
    try {
      params = JSON.parse(parametersJson || "{}");
    } catch {
      setError("Parameters must be valid JSON.");
      return;
    }
    const name = prompt("Save as (report name):");
    if (!name) return;
    try {
      const created = await analyticsApi.createSavedReport({
        name,
        report_type: selectedType,
        parameters: params,
        description: "",
      });
      setSaved((s) => [created, ...s]);
    } catch (e) {
      setError(String((e as { message?: string })?.message || e));
    }
  }

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900">Reports &amp; Readiness</h1>
        <p className="text-sm text-gray-500">Custom reports across all 26 HMS modules and go-live readiness.</p>
      </header>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setTab("reports")}
          className={`px-4 py-2 text-sm font-medium ${
            tab === "reports"
              ? "border-b-2 border-blue-600 text-blue-700"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Custom Reports
        </button>
        <button
          onClick={() => setTab("go-live")}
          className={`px-4 py-2 text-sm font-medium ${
            tab === "go-live"
              ? "border-b-2 border-blue-600 text-blue-700"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Go-Live Checklist
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
      )}

      {tab === "reports" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Saved reports */}
          <aside className="lg:col-span-1">
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h3 className="mb-3 text-sm font-semibold text-gray-700">Saved Reports</h3>
              {saved.length === 0 ? (
                <p className="text-xs text-gray-400">
                  No saved reports yet. Run `python manage.py seed_phase4d_analytics` to load examples.
                </p>
              ) : (
                <ul className="space-y-2">
                  {saved.map((r) => (
                    <li key={r.id} className="rounded-md border border-gray-100 p-2 hover:bg-gray-50">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-medium text-gray-800">{r.name}</div>
                          {r.description && (
                            <p className="mt-0.5 text-xs text-gray-500">{r.description}</p>
                          )}
                          <div className="mt-1 text-xs text-gray-400">
                            {r.report_type}
                            {r.is_pinned && <span className="ml-2 text-amber-600">★ pinned</span>}
                          </div>
                        </div>
                        <button
                          onClick={() => runSaved(r)}
                          className="rounded-md bg-blue-600 px-2.5 py-1 text-xs text-white hover:bg-blue-700"
                        >
                          Run
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>

          {/* Builder + results */}
          <main className="space-y-4 lg:col-span-2">
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h3 className="mb-3 text-sm font-semibold text-gray-700">Run Ad-hoc Report</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-gray-600">Report type</label>
                  <select
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value)}
                    className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">— Select —</option>
                    {reportTypes.map((t) => (
                      <option key={t.code} value={t.code}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600">
                    Parameters (JSON)
                  </label>
                  <textarea
                    rows={3}
                    value={parametersJson}
                    onChange={(e) => setParametersJson(e.target.value)}
                    placeholder='{"months": 6}'
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-1.5 font-mono text-xs focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={runAdhoc}
                  disabled={running || !selectedType}
                  className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {running ? "Running…" : "Run"}
                </button>
                <button
                  onClick={saveAsNew}
                  disabled={running || !selectedType}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Save as new…
                </button>
              </div>
            </div>

            {result && (
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="mb-3 flex items-center justify-between border-b border-gray-100 pb-2">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700">{result.report_type}</h3>
                    <p className="text-xs text-gray-500">
                      {result.row_count} row(s) · {result.runtime_ms} ms
                    </p>
                  </div>
                </div>
                {renderReportData(result.data)}
              </div>
            )}
          </main>
        </div>
      )}

      {tab === "go-live" && (
        <div className="space-y-4" id="go-live">
          {goLiveLoading && <p className="text-gray-500">Running checks…</p>}
          {goLive && (
            <>
              <div
                className={`rounded-lg border-2 p-5 ${
                  goLive.summary.ready_for_golive
                    ? "border-green-300 bg-green-50"
                    : "border-amber-300 bg-amber-50"
                }`}
              >
                <div className="flex items-end justify-between">
                  <div>
                    <h2 className={`text-xl font-semibold ${
                      goLive.summary.ready_for_golive ? "text-green-900" : "text-amber-900"
                    }`}>
                      {goLive.summary.ready_for_golive
                        ? "✓ Ready for production go-live"
                        : "⚠ Action needed before go-live"}
                    </h2>
                    <p className="mt-1 text-sm text-gray-700">
                      {goLive.summary.pass} passed · {goLive.summary.warn} warnings · {goLive.summary.fail} blocking · {goLive.summary.readiness_pct}% complete
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setGoLive(null);
                    }}
                    className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Re-run checks
                  </button>
                </div>

                {/* Progress bar */}
                <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-gray-200">
                  <div
                    className={`h-full ${
                      goLive.summary.ready_for_golive ? "bg-green-500" : "bg-amber-500"
                    }`}
                    style={{ width: `${goLive.summary.readiness_pct}%` }}
                  />
                </div>
              </div>

              {/* Group by category */}
              {Array.from(new Set(goLive.rows.map((r) => r.category))).map((cat) => (
                <div key={cat} className="rounded-lg border border-gray-200 bg-white">
                  <div className="border-b border-gray-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-600">
                    {cat}
                  </div>
                  <ul className="divide-y divide-gray-100">
                    {goLive.rows
                      .filter((r) => r.category === cat)
                      .map((r, i) => (
                        <li key={i} className="px-4 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <StatusPill status={r.status} />
                                <span className="text-sm font-medium text-gray-900">{r.check}</span>
                              </div>
                              <p className="mt-1 text-sm text-gray-600">{r.message}</p>
                              {r.action && (
                                <p className="mt-1 text-xs italic text-blue-700">→ {r.action}</p>
                              )}
                            </div>
                          </div>
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
