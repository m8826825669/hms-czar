"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { kitchenApi } from "@/lib/api/phase3b";
import type { KitchenSummary } from "@/types/phase3b";

const MEAL_LABELS: Record<string, string> = {
  BREAKFAST: "Breakfast",
  MORNING_SNACK: "Mid-Morning",
  LUNCH: "Lunch",
  EVENING_SNACK: "Evening",
  DINNER: "Dinner",
  BEDTIME: "Bedtime",
};


export default function DietaryDashboardPage() {
  const queryClient = useQueryClient();
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);

  const { data, isLoading } = useQuery<KitchenSummary>({
    queryKey: ["kitchen-today", date],
    queryFn: async () => (await kitchenApi.today(date)).data,
    refetchInterval: 60000,
  });

  const generate = useMutation({
    mutationFn: () => kitchenApi.generateAll(date),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["kitchen-today", date] }),
  });

  if (isLoading || !data) return <div className="p-8 text-slate-500">Loading…</div>;

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Dietary / Kitchen Production
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Total servings today: {data.total_servings}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                 className="border border-slate-300 rounded-md px-3 py-2 text-sm" />
          <button onClick={() => generate.mutate()}
                  disabled={generate.isPending}
                  className="px-4 py-2 text-sm bg-sky-700 text-white rounded-md hover:bg-sky-800">
            {generate.isPending ? "Generating…" : "Auto-generate Meals"}
          </button>
          <Link href="/dashboard/dietary/diet-plans"
                className="px-4 py-2 text-sm border border-slate-300 rounded-md hover:bg-slate-50">
            Diet Plans
          </Link>
        </div>
      </div>

      {Object.keys(data.by_meal_type).length === 0 ? (
        <div className="border border-dashed border-slate-300 rounded-md p-8 text-center text-slate-500">
          <p>No meals scheduled for {date}.</p>
          <p className="text-sm mt-2">
            Click "Auto-generate Meals" to create today's meals for all active diet plans.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(data.by_meal_type).map(([mealType, items]) => (
            <div key={mealType} className="border border-slate-200 rounded-lg bg-white">
              <div className="bg-slate-50 border-b border-slate-200 px-4 py-2">
                <div className="font-medium">{MEAL_LABELS[mealType] || mealType}</div>
                <div className="text-xs text-slate-500">
                  {items.reduce((s, i) => s + i.quantity, 0)} servings
                </div>
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {items.map((i) => (
                    <tr key={i.item_id} className="border-b border-slate-100 last:border-0">
                      <td className="px-3 py-2">
                        <div className="font-medium">{i.item_name}</div>
                        <div className="text-xs font-mono text-slate-500">{i.item_code}</div>
                      </td>
                      <td className="px-3 py-2 text-right font-semibold">
                        ×{i.quantity}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
