"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { use, useEffect, useMemo, useState } from "react";
import { TimeSeriesPlot } from "@/components/TimeSeriesPlot";
import { OneLineDiagram, type BusVoltage } from "@/components/OneLineDiagram";
import { findModel } from "@/lib/models";
import { ComparePanel } from "@/components/ComparePanel";
import {
  api,
  parseDpsimCsv,
  toMagnitudeSeries,
  toPerUnitRelative,
} from "@/lib/api";

type ViewMode = "raw" | "magnitude" | "pu";

export default function SimulationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const numericId = Number(id);
  const searchParams = useSearchParams();
  const compareIdRaw = searchParams.get("compare");
  const compareId = compareIdRaw ? Number(compareIdRaw) : null;

  const sim = useQuery({
    queryKey: ["simulation", numericId],
    queryFn: () => api.getSimulation(numericId),
    refetchInterval: (q) => {
      // Stop polling once results_data is non-empty OR the Rust `error`
      // field populated. Sidechannel-driven stop is handled by the status
      // query below via a separate stop condition.
      const data = q.state.data;
      if (data?.results_data) return false;
      if (data?.error) return false;
      return 2_000;
    },
  });

  const status = useQuery({
    queryKey: ["sim-status", numericId],
    queryFn: () => api.getSimStatus(numericId),
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      return s === "done" || s === "failed" ? false : 2_000;
    },
  });

  // Phase E — runtime topology for uploaded/unknown model ids. Baked
  // bundles (wscc9/ieee14/…) already have compile-time catalogs so we skip
  // the fetch for them via `enabled`.
  const runtimeTopo = useQuery({
    queryKey: ["topology", sim.data?.model_id],
    queryFn: () => api.getTopology(sim.data!.model_id),
    enabled: !!sim.data?.model_id && !findModel(sim.data.model_id),
    staleTime: 10 * 60 * 1000,
  });

  const parsed = useMemo(() => {
    if (!sim.data?.results_data) return null;
    return parseDpsimCsv(sim.data.results_data);
  }, [sim.data?.results_data]);

  const [viewMode, setViewMode] = useState<ViewMode>("magnitude");
  const [selected, setSelected] = useState<string[] | null>(null);

  // Transform the raw CSV into the chosen view.
  const display = useMemo(() => {
    if (!parsed) return null;
    if (viewMode === "raw") return parsed;
    const mag = toMagnitudeSeries(parsed.columns, parsed.rows);
    if (viewMode === "magnitude") return mag;
    return toPerUnitRelative(mag.columns, mag.rows);
  }, [parsed, viewMode]);

  // Reset column selection when view mode changes (different column names).
  useEffect(() => setSelected(null), [viewMode]);

  const plotColumns =
    selected ??
    (display ? display.columns.filter((c) => c !== "time").slice(0, 9) : []);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/"
          className="text-sm text-blue-600 hover:underline"
        >
          ← all simulations
        </Link>
        <h1 className="mt-2 text-xl font-semibold">
          Simulation #{numericId}
        </h1>
      </div>

      {sim.isLoading && <p className="text-sm text-slate-500">Loading…</p>}
      {sim.isError && (
        <p className="text-sm text-red-600">
          {(sim.error as Error).message}
        </p>
      )}

      {sim.data && (
        <>
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm md:grid-cols-4">
              <Item label="Type" value={sim.data.simulation_type} />
              <Item label="Domain" value={sim.data.domain} />
              <Item label="Solver" value={sim.data.solver} />
              <Item label="Timestep" value={`${sim.data.timestep} ms`} />
              <Item label="Final time" value={`${sim.data.finaltime} ms`} />
              <Item label="Model ID" value={sim.data.model_id} />
              <Item label="Results ID" value={sim.data.results_id} mono />
              <Item
                label="Status"
                value={
                  status.data?.status === "failed"
                    ? "failed"
                    : sim.data.results_data
                    ? "done"
                    : status.data?.status === "running"
                    ? "running…"
                    : sim.data.error
                    ? "error"
                    : "queued…"
                }
              />
              {sim.data.trace_id && (
                <Item
                  label="Trace"
                  value={
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-xs">{sim.data.trace_id}</span>
                      <a
                        href={`http://localhost:16686/search?service=dpsim-worker&tags=${encodeURIComponent(`{"dpsim.trace_id_str":"${sim.data.trace_id}"}`)}&limit=20`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Jaeger ↗
                      </a>
                    </span>
                  }
                />
              )}
            </dl>
            {status.data?.status === "running" &&
              typeof status.data.progress === "number" && (
                <div className="mt-4">
                  <div className="mb-1 flex justify-between text-xs text-slate-600 dark:text-slate-400">
                    <span>Simulation progress</span>
                    <span
                      className="font-mono"
                      data-testid="progress-pct"
                    >
                      {status.data.progress.toFixed(0)}%
                    </span>
                  </div>
                  <div
                    className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
                    role="progressbar"
                    aria-valuenow={Math.round(status.data.progress)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div
                      className="h-full bg-blue-600 transition-[width] duration-300"
                      style={{ width: `${status.data.progress}%` }}
                    />
                  </div>
                </div>
              )}
            {(status.data?.status === "failed" || sim.data.error) && (
              <div className="mt-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
                <p className="font-semibold">Simulation failed</p>
                <p className="mt-1 font-mono text-xs break-all">
                  {status.data?.error ?? sim.data.error}
                </p>
              </div>
            )}
            {status.data?.warnings && status.data.warnings.length > 0 && (
              <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                <p className="font-semibold">
                  Worker adjusted your request ({status.data.warnings.length})
                </p>
                <ul className="mt-1 list-disc pl-5 text-xs">
                  {status.data.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="text-base font-semibold">Time series</h2>
              <div className="flex items-center gap-3">
                <div
                  className="inline-flex overflow-hidden rounded-md border border-slate-300 text-xs dark:border-slate-700"
                  role="radiogroup"
                  aria-label="View mode"
                >
                  {(
                    [
                      ["raw", "re/im"],
                      ["magnitude", "|V| [V]"],
                      ["pu", "p.u. (V/V₀)"],
                    ] as [ViewMode, string][]
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={viewMode === value ? "true" : "false"}
                      onClick={() => setViewMode(value)}
                      className={`px-2.5 py-1 ${
                        viewMode === value
                          ? "bg-blue-600 text-white"
                          : "bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {parsed && (
                  <a
                    href={`data:text/csv;base64,${typeof window !== "undefined" ? btoa(unescape(encodeURIComponent(sim.data.results_data))) : ""}`}
                    download={`sim_${numericId}.csv`}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Download CSV
                  </a>
                )}
              </div>
            </div>

            {!sim.data.results_data && (
              <p className="text-sm text-slate-500">
                Waiting for worker to upload results… (polling every 2s)
              </p>
            )}

            {display && (
              <>
                <div className="mb-4 flex flex-wrap gap-2">
                  {display.columns
                    .filter((c) => c !== "time")
                    .map((col) => {
                      const on = plotColumns.includes(col);
                      return (
                        <button
                          key={col}
                          onClick={() =>
                            setSelected(
                              on
                                ? plotColumns.filter((c) => c !== col)
                                : [...plotColumns, col],
                            )
                          }
                          className={`rounded-full border px-2.5 py-1 text-xs font-mono ${
                            on
                              ? "border-blue-500 bg-blue-500/10 text-blue-700 dark:text-blue-300"
                              : "border-slate-300 text-slate-600 hover:border-slate-400 dark:border-slate-700 dark:text-slate-400"
                          }`}
                        >
                          {col}
                        </button>
                      );
                    })}
                </div>

                <TimeSeriesPlot rows={display.rows} columns={plotColumns} />

                <ComparePanel
                  baselineId={numericId}
                  compareId={compareId}
                  viewMode={viewMode}
                />

                {(() => {
                  const model = findModel(sim.data.model_id);
                  // For baked models, use the compile-time catalog; for
                  // uploaded ids, fall back to the /topology prefetch below.
                  const catalog = model?.outageCatalog.length
                    ? model.outageCatalog
                    : (runtimeTopo.data?.branches.map((b) => ({
                        name: b.name,
                        busFrom: b.bus_from,
                        busTo: b.bus_to,
                        kind: b.kind as "line" | "transformer" | "switch",
                      })) ?? []);
                  if (catalog.length === 0) return null;
                  // Voltage overlay: worker publishes a bus_map sidechannel
                  // with the solver-determined ordering (bus_map[i] is the
                  // display name of column `v_n<i>`). Falls back to the
                  // WSCC-9 convention (v_n<i> → BUS<i+1>) for that one model
                  // so pre-bus_map sims keep working; everything else shows
                  // topology-only grey when the map is absent.
                  const voltages: BusVoltage[] = (() => {
                    if (!parsed) return [];
                    const last  = parsed.rows[parsed.rows.length - 1];
                    const first = parsed.rows[0];
                    if (!last || !first) return [];
                    const map = status.data?.bus_map;
                    const resolveName = (i: number): string | null => {
                      if (map && map[i]) return map[i];
                      if (sim.data.model_id === "wscc9") return `BUS${i + 1}`;
                      return null;
                    };
                    const out: BusVoltage[] = [];
                    // Iterate all v_n<i> columns the CSV actually carries.
                    const idxs = new Set<number>();
                    for (const c of parsed.columns) {
                      const m = c.match(/^v_n(\d+)\.re$/);
                      if (m) idxs.add(Number(m[1]));
                    }
                    for (const i of Array.from(idxs).sort((a, b) => a - b)) {
                      const name = resolveName(i);
                      if (!name) continue;
                      const re = `v_n${i}.re`;
                      const im = `v_n${i}.im`;
                      const magLast = Math.hypot(last[re] ?? 0, last[im] ?? 0);
                      const magRef  = Math.hypot(first[re] ?? 0, first[im] ?? 0);
                      out.push({ bus: name, magnitude: magLast, reference: magRef });
                    }
                    return out;
                  })();
                  return (
                    <div className="mt-6">
                      <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                        One-line diagram ({model?.label ?? sim.data.model_id})
                      </h3>
                      <OneLineDiagram
                        catalog={catalog}
                        modelId={sim.data.model_id}
                        voltages={voltages}
                      />
                    </div>
                  );
                })()}

                <p className="mt-3 text-xs text-slate-500">
                  {display.rows.length} samples · {display.columns.length - 1} signals in{" "}
                  {viewMode === "raw"
                    ? "raw re/im"
                    : viewMode === "magnitude"
                    ? "magnitude (V)"
                    : "per-unit (normalized to t=0)"}
                  {viewMode === "pu" && (
                    <>
                      {" "}·{" "}
                      <span className="italic">
                        base = node magnitude at t=0 (e.g. BUS1 V₀ ≈ 17.16 kV → 1.000 p.u.)
                      </span>
                    </>
                  )}
                </p>
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function Item({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className={mono ? "font-mono text-xs" : ""}>{value}</dd>
    </div>
  );
}
