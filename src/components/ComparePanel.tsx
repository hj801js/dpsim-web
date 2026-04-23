"use client";

// Compare the current simulation against another by simulation_id.
// Reads `?compare=<id>` from the URL, fetches that sim, parses its CSV,
// and renders a diff table (per-bus t=last magnitude) + quick jump links.
//
// Design choice: we don't overlay on the main TimeSeriesPlot. Overlaying two
// ~9-bus simulations renders 18 lines in the same legend and gets unreadable.
// A small table of t=last deltas + one "open the other one" link gives the
// same "what did this change?" answer without the visual noise.

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import {
  api,
  parseDpsimCsv,
  toMagnitudeSeries,
  toPerUnitRelative,
} from "@/lib/api";

type ViewMode = "raw" | "magnitude" | "pu";

export function ComparePanel({
  baselineId,
  compareId,
  viewMode,
}: {
  baselineId: number;
  compareId: number | null;
  viewMode: ViewMode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const baseline = useQuery({
    queryKey: ["simulation", baselineId],
    queryFn: () => api.getSimulation(baselineId),
    // Served from react-query cache populated by the parent page.
    staleTime: 60_000,
  });

  const alternate = useQuery({
    enabled: compareId !== null && compareId !== baselineId,
    queryKey: ["simulation", compareId],
    queryFn: () => api.getSimulation(compareId ?? 0),
  });

  const list = useQuery({
    queryKey: ["simulations"],
    queryFn: api.listSimulations,
    staleTime: 30_000,
  });

  const [selectedId, setSelectedId] = useState<string>(
    compareId?.toString() ?? "",
  );

  function applyCompare(idStr: string) {
    const next = new URLSearchParams(params.toString());
    if (idStr) next.set("compare", idStr);
    else next.delete("compare");
    router.replace(`${pathname}?${next.toString()}`);
  }

  const diff = useMemo(() => {
    if (!baseline.data?.results_data || !alternate.data?.results_data) return null;
    const a = toBusTails(baseline.data.results_data, viewMode);
    const b = toBusTails(alternate.data.results_data, viewMode);
    const buses = Array.from(new Set([...Object.keys(a), ...Object.keys(b)])).sort();
    return buses.map((bus) => {
      const av = a[bus];
      const bv = b[bus];
      const delta = av !== undefined && bv !== undefined ? bv - av : null;
      const pct = av && delta !== null ? (delta / av) * 100 : null;
      return { bus, baseline: av, alternate: bv, delta, pct };
    });
  }, [baseline.data?.results_data, alternate.data?.results_data, viewMode]);

  const others = useMemo(
    () => (list.data ?? []).filter((s) => s.simulation_id !== baselineId),
    [list.data, baselineId],
  );

  // Rough threshold classes so the eye lands on large deltas first.
  // Kept separate from the JSX so the table stays readable.
  function deltaCls(pct: number | null): string {
    if (pct === null) return "text-slate-400";
    const a = Math.abs(pct);
    if (a > 5) return "font-semibold text-red-600 dark:text-red-400";
    if (a > 1) return "text-amber-600 dark:text-amber-400";
    return "text-slate-600 dark:text-slate-400";
  }

  return (
    <section className="mt-6 panel p-5 bg-slate-50/80 dark:bg-slate-900/40">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Compare against
        </h3>
        <select
          aria-label="Simulation to compare with"
          className="input-sm"
          value={selectedId}
          onChange={(e) => {
            setSelectedId(e.target.value);
            applyCompare(e.target.value);
          }}
        >
          <option value="">— pick a simulation —</option>
          {others.map((s) => (
            <option key={s.simulation_id} value={s.simulation_id}>
              #{s.simulation_id} · {s.simulation_type} · {s.model_id}
            </option>
          ))}
        </select>
        {compareId !== null && (
          <Link
            href={`/simulations/${compareId}?compare=${baselineId}`}
            className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            flip sides →
          </Link>
        )}
      </div>

      {compareId === null && (
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          Pick another simulation (e.g. a baseline vs outage run) to see
          per-bus t=last deltas side-by-side.
        </p>
      )}

      {alternate.isLoading && (
        <div className="mt-3 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400"></span>
          Loading comparison…
        </div>
      )}

      {alternate.isError && (
        <p className="mt-3 rounded-md bg-red-50 px-2.5 py-1.5 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {(alternate.error as Error).message}
        </p>
      )}

      {diff && diff.length > 0 && (
        <div className="mt-4 -mx-2 overflow-x-auto sm:mx-0">
          <table className="w-full text-xs" data-testid="compare-diff">
            <thead>
              <tr className="text-left font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <th className="py-2 pr-3">Bus</th>
                <th className="py-2 pr-3 tabular-nums">#{baselineId}</th>
                <th className="py-2 pr-3 tabular-nums">#{compareId}</th>
                <th className="py-2 pr-3">Δ</th>
                <th className="py-2">% change</th>
              </tr>
            </thead>
            <tbody className="font-mono tabular-nums">
              {diff.map((row) => (
                <tr
                  key={row.bus}
                  className="border-t border-slate-200 transition-colors hover:bg-white/50 dark:border-slate-800 dark:hover:bg-slate-800/30"
                >
                  <td className="py-1.5 pr-3 text-slate-700 dark:text-slate-300">
                    {row.bus}
                  </td>
                  <td className="py-1.5 pr-3 text-slate-700 dark:text-slate-300">
                    {row.baseline?.toFixed(2) ?? "—"}
                  </td>
                  <td className="py-1.5 pr-3 text-slate-700 dark:text-slate-300">
                    {row.alternate?.toFixed(2) ?? "—"}
                  </td>
                  <td className={`py-1.5 pr-3 ${deltaCls(row.pct)}`}>
                    {row.delta === null ? "—" : row.delta.toFixed(2)}
                  </td>
                  <td className={`py-1.5 ${deltaCls(row.pct)}`}>
                    {row.pct === null ? "—" : `${row.pct.toFixed(2)}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function toBusTails(
  csv: string,
  viewMode: ViewMode,
): Record<string, number> {
  const parsed = parseDpsimCsv(csv);
  if (viewMode === "raw" || parsed.rows.length === 0) return {};
  const mag = toMagnitudeSeries(parsed.columns, parsed.rows);
  const shaped = viewMode === "pu"
    ? toPerUnitRelative(mag.columns, mag.rows)
    : mag;
  const last = shaped.rows[shaped.rows.length - 1];
  const out: Record<string, number> = {};
  for (const col of shaped.columns) {
    if (col === "time") continue;
    out[col] = Number(last[col]);
  }
  return out;
}
