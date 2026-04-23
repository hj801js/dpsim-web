"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
import { useSimStatusStream } from "@/lib/useSimStatusStream";

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

  const qc = useQueryClient();
  const router = useRouter();

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

  // v1.1.3 cancel. Optimistic: flip the sidechannel status to "canceled"
  // immediately so the UI doesn't flicker back to "running…" during the
  // next refetch window.
  const cancelMut = useMutation({
    mutationFn: () => api.cancelSimulation(numericId),
    onSuccess: () => {
      qc.setQueryData(["sim-status", numericId], {
        status: "canceled",
      });
      qc.invalidateQueries({ queryKey: ["sim-status", numericId] });
      qc.invalidateQueries({ queryKey: ["simulation", numericId] });
    },
  });

  // v1.2.7 retry. On success, invalidate the list (so the fresh sim shows
  // up in the sidebar) and route the user to the new detail page.
  const retryMut = useMutation({
    mutationFn: () => api.retrySimulation(numericId),
    onSuccess: (newSim) => {
      qc.invalidateQueries({ queryKey: ["simulations"] });
      router.push(`/simulations/${newSim.simulation_id}`);
    },
  });

  // v1.1.4 — prefer SSE for live status. The polling useQuery below stays
  // as fallback for when the stream is unavailable (IE, CSR tests, upstream
  // restart); it also serves as the initial data fetch before the stream
  // emits its first event.
  useSimStatusStream(numericId);

  const status = useQuery({
    queryKey: ["sim-status", numericId],
    queryFn: () => api.getSimStatus(numericId),
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      if (s === "done" || s === "failed" || s === "canceled") return false;
      // SSE is authoritative; polling only needs to catch stream gaps.
      return 10_000;
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

  // Normalize the effective status once — used by the pill, action
  // visibility, and conditional alerts below.
  const effectiveStatus = (() => {
    if (status.data?.status === "canceled") return "canceled";
    if (status.data?.status === "failed" || sim.data?.error) return "failed";
    if (sim.data?.results_data) return "done";
    if (status.data?.status === "running") return "running";
    return "queued";
  })();
  const isRunningOrQueued =
    effectiveStatus === "running" || effectiveStatus === "queued";

  return (
    <div className="space-y-6">
      {/* Breadcrumb row */}
      <div className="flex items-center gap-3 text-xs">
        <Link
          href="/"
          className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
        >
          ← all simulations
        </Link>
      </div>

      {/* Header — title + status + actions */}
      {sim.data ? (
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              <span>Simulation</span>
              <span className="font-mono text-xl text-slate-500 tabular-nums dark:text-slate-400">
                #{numericId}
              </span>
              <DetailStatusPill status={effectiveStatus} />
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {sim.data.simulation_type}
              </span>
              <span aria-hidden>·</span>
              <span className="uppercase tracking-wider">{sim.data.domain}</span>
              <span aria-hidden>·</span>
              <span>{sim.data.solver}</span>
              <span aria-hidden>·</span>
              <code className="text-xs text-slate-600 dark:text-slate-400">
                {sim.data.model_id}
              </code>
            </p>
          </div>

          {/* Actions — cancel while queued/running; retry on failure */}
          <div className="flex items-center gap-2">
            {isRunningOrQueued && (
              <button
                type="button"
                onClick={() => cancelMut.mutate()}
                disabled={cancelMut.isPending}
                className="btn-danger btn-sm"
              >
                {cancelMut.isPending ? "Canceling…" : "Cancel"}
              </button>
            )}
            {effectiveStatus === "failed" && (
              <button
                type="button"
                onClick={() => retryMut.mutate()}
                disabled={retryMut.isPending}
                className="btn-primary btn-sm"
              >
                {retryMut.isPending ? "Resubmitting…" : "Retry"}
              </button>
            )}
          </div>
        </div>
      ) : (
        sim.isLoading && (
          <div className="flex items-center gap-2 py-6 text-sm text-slate-500">
            <span className="h-2 w-2 animate-pulse rounded-full bg-slate-400"></span>
            Loading simulation…
          </div>
        )
      )}

      {sim.isError && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {(sim.error as Error).message}
        </p>
      )}

      {sim.data && (
        <>
          {/* Metadata panel */}
          <section className="panel p-6">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm md:grid-cols-4">
              <DetailItem label="Timestep" value={`${sim.data.timestep} ms`} mono />
              <DetailItem label="Final time" value={`${sim.data.finaltime} ms`} mono />
              <DetailItem label="Results ID" value={sim.data.results_id} mono />
              {sim.data.trace_id ? (
                <DetailItem
                  label="Trace"
                  value={
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-slate-700 dark:text-slate-300">
                        {sim.data.trace_id}
                      </span>
                      <a
                        href={`http://localhost:16686/search?service=dpsim-worker&tags=${encodeURIComponent(`{"dpsim.trace_id_str":"${sim.data.trace_id}"}`)}&limit=20`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        Jaeger ↗
                      </a>
                    </span>
                  }
                />
              ) : (
                <DetailItem label="Trace" value={<span className="text-slate-400">—</span>} />
              )}
            </dl>

            {status.data?.status === "running" &&
              typeof status.data.progress === "number" && (
                <div className="mt-5">
                  <div className="mb-1.5 flex justify-between text-xs text-slate-600 dark:text-slate-400">
                    <span>Running…</span>
                    <span className="font-mono tabular-nums" data-testid="progress-pct">
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
                      className="h-full bg-blue-600 transition-[width] duration-300 dark:bg-blue-500"
                      style={{ width: `${status.data.progress}%` }}
                    />
                  </div>
                </div>
              )}

            {(status.data?.status === "failed" || sim.data.error) && (
              <Alert tone="danger" title="Simulation failed">
                <p className="mt-1 font-mono text-xs break-all">
                  {status.data?.error ?? sim.data.error}
                </p>
                {retryMut.isError && (
                  <p className="mt-2 text-xs text-red-700 dark:text-red-400">
                    Retry failed: {(retryMut.error as Error).message}
                  </p>
                )}
              </Alert>
            )}
            {cancelMut.isError && (
              <Alert tone="danger" title="Cancel failed">
                <p className="mt-1 text-xs break-all">
                  {(cancelMut.error as Error).message}
                </p>
              </Alert>
            )}
            {status.data?.status === "canceled" && (
              <Alert tone="neutral" title="Simulation canceled">
                <p className="mt-1 text-xs">
                  The worker stopped this simulation and no results will be uploaded.
                </p>
              </Alert>
            )}
            {status.data?.warnings && status.data.warnings.length > 0 && (
              <Alert
                tone="warning"
                title={`Worker adjusted your request (${status.data.warnings.length})`}
              >
                <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs">
                  {status.data.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </Alert>
            )}
          </section>

          <section className="panel p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Time series
              </h2>
              <div className="flex items-center gap-3">
                <div
                  className="inline-flex overflow-hidden rounded-md border border-slate-300 text-xs shadow-sm dark:border-slate-700"
                  role="radiogroup"
                  aria-label="View mode"
                >
                  {(
                    [
                      ["raw", "re/im"],
                      ["magnitude", "|V| [V]"],
                      ["pu", "p.u. (V/V₀)"],
                    ] as [ViewMode, string][]
                  ).map(([value, label], idx) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={viewMode === value ? "true" : "false"}
                      onClick={() => setViewMode(value)}
                      className={`px-3 py-1.5 font-medium transition-colors ${idx > 0 ? "border-l border-slate-300 dark:border-slate-700" : ""} ${
                        viewMode === value
                          ? "bg-blue-600 text-white"
                          : "bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
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

function DetailItem({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {label}
      </dt>
      <dd
        className={`text-sm text-slate-900 dark:text-slate-100 ${
          mono ? "font-mono text-xs" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

/** Lifecycle status pill for the detail-page header. Maps an effective
 *  status string to a `.pill` with a semantic color. */
function DetailStatusPill({ status }: { status: string }) {
  const cls =
    status === "done"
      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
      : status === "running"
      ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
      : status === "failed"
      ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
      : status === "canceled"
      ? "bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-400"
      : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300";
  return <span className={`pill ${cls} text-[11px] font-semibold`}>{status}</span>;
}

/** Shared alert card used inside section panels. `tone` controls the color
 *  family; `title` is the first-line emphasis; children are the body. */
function Alert({
  tone,
  title,
  children,
}: {
  tone: "danger" | "warning" | "neutral";
  title: string;
  children?: React.ReactNode;
}) {
  const cls = {
    danger:
      "border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300",
    warning:
      "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
    neutral:
      "border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300",
  }[tone];
  return (
    <div className={`mt-4 rounded-md border p-3 text-sm ${cls}`}>
      <p className="font-semibold">{title}</p>
      {children}
    </div>
  );
}
