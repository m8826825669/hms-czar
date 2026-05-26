"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { donorsApi } from "@/lib/api/blood_bank";
import type { BloodDonor, BloodGroup } from "@/types/blood_bank";

const GROUP_LABELS: Record<string, string> = {
  A_POS: "A+", A_NEG: "A-", B_POS: "B+", B_NEG: "B-",
  AB_POS: "AB+", AB_NEG: "AB-", O_POS: "O+", O_NEG: "O-",
};


export default function DonorsPage() {
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState<BloodGroup | "">("");

  const { data: donors = [] } = useQuery({
    queryKey: ["donors", search, groupFilter],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (groupFilter) params.blood_group = groupFilter;
      return await donorsApi.list(params);
    },
  });

  return (
    <div className="p-6 space-y-5 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Blood Donors</h1>
          <p className="text-sm text-slate-500 mt-1">
            {donors.length} donor{donors.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/dashboard/blood-bank"
            className="px-4 py-2 text-sm border border-slate-300 rounded-md hover:bg-slate-50"
          >
            ← Dashboard
          </Link>
          <Link
            href="/dashboard/blood-bank/donors/new"
            className="px-4 py-2 text-sm bg-rose-700 text-white rounded-md hover:bg-rose-800"
          >
            + Register Donor
          </Link>
        </div>
      </div>

      <div className="flex gap-3 flex-wrap">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, donor ID, or phone…"
          className="border border-slate-300 rounded-md px-3 py-2 text-sm w-80"
        />
        <select
          value={groupFilter}
          onChange={(e) => setGroupFilter(e.target.value as BloodGroup | "")}
          className="border border-slate-300 rounded-md px-3 py-2 text-sm"
        >
          <option value="">All blood groups</option>
          {Object.entries(GROUP_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      <div className="border border-slate-200 rounded-md overflow-hidden bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-2 text-xs font-medium text-slate-600 uppercase">Donor ID</th>
              <th className="text-left px-4 py-2 text-xs font-medium text-slate-600 uppercase">Name</th>
              <th className="text-left px-4 py-2 text-xs font-medium text-slate-600 uppercase">Group</th>
              <th className="text-left px-4 py-2 text-xs font-medium text-slate-600 uppercase">Age/Sex</th>
              <th className="text-left px-4 py-2 text-xs font-medium text-slate-600 uppercase">Phone</th>
              <th className="text-center px-4 py-2 text-xs font-medium text-slate-600 uppercase">Donations</th>
              <th className="text-left px-4 py-2 text-xs font-medium text-slate-600 uppercase">Last Donation</th>
              <th className="text-left px-4 py-2 text-xs font-medium text-slate-600 uppercase">Eligibility</th>
            </tr>
          </thead>
          <tbody>
            {donors.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center text-slate-500 italic py-8">
                  No donors found.
                </td>
              </tr>
            )}
            {donors.map((d: BloodDonor) => (
              <tr key={d.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-4 py-2 font-mono text-xs">{d.donor_id}</td>
                <td className="px-4 py-2 font-medium">{d.full_name}</td>
                <td className="px-4 py-2">
                  <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded text-xs font-medium">
                    {GROUP_LABELS[d.blood_group]}
                  </span>
                </td>
                <td className="px-4 py-2 text-slate-600">
                  {d.age ?? "—"}/{d.gender}
                </td>
                <td className="px-4 py-2 text-slate-600">{d.phone}</td>
                <td className="px-4 py-2 text-center font-medium">{d.total_donations}</td>
                <td className="px-4 py-2 text-slate-600">
                  {d.last_donation_date
                    ? new Date(d.last_donation_date).toLocaleDateString("en-IN")
                    : "—"}
                </td>
                <td className="px-4 py-2">
                  {d.eligibility.can_donate ? (
                    <span className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded">
                      Eligible
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-800 rounded"
                          title={d.eligibility.reason}>
                      Deferred
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
