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

  return (
    <section className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/40">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          Compare
        </h3>
        <select
          aria-label="Simulation to compare with"
          className="input text-xs"
          value={selectedId}
          onChange={(e) => {
            setSelectedId(e.target.value);
            applyCompare(e.target.value);
          }}
        >
          <option value="">— pick a second simulation —</option>
          {others.map((s) => (
            <option key={s.simulation_id} value={s.simulation_id}>
              #{s.simulation_id} · {s.simulation_type} · {s.model_id}
            </option>
          ))}
        </select>
        {compareId !== null && (
          <Link
            href={`/simulations/${compareId}?compare=${baselineId}`}
            className="text-xs text-blue-600 hover:underline"
          >
            flip →
          </Link>
        )}
      </div>

      {compareId === null && (
        <p className="mt-3 text-xs text-slate-500">
          Pick another simulation (e.g. a baseline vs outage run) to see
          per-bus t=last deltas.
        </p>
      )}

      {alternate.isLoading && (
        <p className="mt-3 text-xs text-slate-500">Loading comparison…</p>
      )}

      {alternate.isError && (
        <p className="mt-3 text-xs text-red-600">
          {(alternate.error as Error).message}
        </p>
      )}

      {diff && diff.length > 0 && (
        <table className="mt-3 w-full text-xs" data-testid="compare-diff">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="py-1">Bus</th>
              <th>#{baselineId}</th>
              <th>#{compareId}</th>
              <th>Δ</th>
              <th>% change</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {diff.map((row) => (
              <tr
                key={row.bus}
                className="border-t border-slate-200 dark:border-slate-800"
              >
                <td className="py-1">{row.bus}</td>
                <td>{row.baseline?.toFixed(2) ?? "—"}</td>
                <td>{row.alternate?.toFixed(2) ?? "—"}</td>
                <td
                  className={
                    row.delta === null
                      ? "text-slate-400"
                      : Math.abs(row.pct ?? 0) > 5
                        ? "text-red-600 font-semibold"
                        : Math.abs(row.pct ?? 0) > 1
                          ? "text-amber-600"
                          : "text-slate-600"
                  }
                >
                  {row.delta === null ? "—" : row.delta.toFixed(2)}
                </td>
                <td>
                  {row.pct === null ? "—" : `${row.pct.toFixed(2)}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
