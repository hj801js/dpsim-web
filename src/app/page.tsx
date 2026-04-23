"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  DOMAINS,
  SOLVERS,
  SIM_TYPES,
  ENGINES,
  clampPreview,
  MIN_TIMESTEP_MS,
  MAX_FINALTIME_MS,
  MIN_FINALTIME_TO_TIMESTEP_RATIO,
  type DomainType,
  type EngineType,
  type SimulationForm,
  type SimulationType,
  type SolverType,
} from "@/lib/types";
import { MODELS, findModel } from "@/lib/models";

const DEFAULT_FORM: SimulationForm = {
  simulation_type: "Powerflow",
  model_id: "wscc9",
  load_profile_id: "None",
  domain: "DP",
  solver: "MNA",
  timestep: 1,       // ms  (DP typical)
  finaltime: 1000,   // ms  (1 s total)
  outage_component: "",
  engine: "dpsim",   // Phase 4: engine picker — dpsim | pandapower | both
};

export default function DashboardPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">…</p>}>
      <Dashboard />
    </Suspense>
  );
}

function Dashboard() {
  const [form, setForm] = useState<SimulationForm>(DEFAULT_FORM);
  const qc = useQueryClient();
  const searchParams = useSearchParams();

  // Pre-fill from URL params so the one-line diagram's "click to outage this
  // line" link can seed the submit form without any local state.
  useEffect(() => {
    const updates: Partial<SimulationForm> = {};
    const model = searchParams.get("model_id");
    const outage = searchParams.get("outage_component");
    const load = searchParams.get("load_factor");
    if (model) updates.model_id = model;
    if (outage !== null) updates.outage_component = outage;
    if (load) {
      const f = Number(load);
      if (Number.isFinite(f) && f > 0) updates.load_factor = f;
    }
    if (Object.keys(updates).length > 0) {
      setForm((prev) => ({ ...prev, ...updates }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.toString()]);

  // v1.1.1 + v1.2.2 + v1.2.9 — paged listing with filters and sort.
  // State in local component so returning from /simulations/<id> keeps
  // the reader on the same page + same filter.
  const [listOffset, setListOffset] = useState(0);
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterDomain, setFilterDomain] = useState<string>("");
  const [sortKey, setSortKey] = useState<string>("");    // "" = server default
  const [sortOrder, setSortOrder] = useState<string>(""); // "" = server default
  const LIST_LIMIT = 50;
  const list = useQuery({
    queryKey: ["simulations", listOffset, filterStatus, filterDomain, sortKey, sortOrder],
    queryFn: () =>
      api.listSimulationsPaged(LIST_LIMIT, listOffset, {
        status: filterStatus || undefined,
        domain: filterDomain || undefined,
        sort: sortKey || undefined,
        order: sortOrder || undefined,
      }),
    refetchInterval: 5_000,
  });

  // Reset offset to 0 whenever a filter/sort changes so paging stays consistent.
  useEffect(() => {
    setListOffset(0);
  }, [filterStatus, filterDomain, sortKey, sortOrder]);

  // Phase E — runtime topology fetch so uploaded model ids and any custom
  // (non-baked) id still get a filled outage dropdown in the submit form.
  // React Query caches per model_id; stale the baked ones since we already
  // have compile-time catalogs for them.
  const topo = useQuery({
    queryKey: ["topology", form.model_id],
    queryFn: () => api.getTopology(form.model_id),
    enabled: !!form.model_id && !findModel(form.model_id),
    // Topology for a given id is effectively immutable — aggressively cache.
    staleTime: 10 * 60 * 1000,
  });

  const submit = useMutation({
    mutationFn: api.createSimulation,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["simulations"] }),
  });

  return (
    <div className="grid gap-8 md:grid-cols-[380px_1fr]">
      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-base font-semibold">Submit a simulation</h2>

        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            // Don't round-trip empty / default values — the server treats
            // "" outage as "find a line named empty" → warning spam, and
            // load_factor=1 is identical to baseline.
            const payload: SimulationForm = {
              ...form,
              outage_component: form.outage_component?.trim() || undefined,
              load_factor:
                form.load_factor && form.load_factor !== 1
                  ? form.load_factor
                  : undefined,
            };
            submit.mutate(payload);
          }}
        >
          <Field label="Model">
            <div className="flex gap-2">
              <select
                aria-label="Model catalog"
                className="input"
                // "custom" sentinel = free-text ID (uploaded or unknown).
                value={findModel(form.model_id) ? form.model_id : "custom"}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "custom") {
                    // Clear canonical name so the text input becomes editable.
                    setForm({ ...form, model_id: "", outage_component: "" });
                  } else {
                    // Switching model invalidates a previous outage pick.
                    setForm({ ...form, model_id: v, outage_component: "" });
                  }
                }}
              >
                {MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
                <option value="custom">Custom / uploaded</option>
              </select>
              {!findModel(form.model_id) && (
                <input
                  aria-label="Custom model ID"
                  className="input flex-1"
                  value={form.model_id}
                  onChange={(e) =>
                    setForm({ ...form, model_id: e.target.value })
                  }
                  placeholder="<uploaded id>"
                  required
                />
              )}
            </div>
            {findModel(form.model_id)?.hint && (
              <p className="mt-1 text-[11px] text-slate-400">
                {findModel(form.model_id)?.hint}
              </p>
            )}
            {findModel(form.model_id)?.warning && (
              <p
                role="alert"
                className="mt-1 rounded border border-amber-300 bg-amber-50 p-1.5 text-[11px] text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
              >
                ⚠︎ {findModel(form.model_id)?.warning}
              </p>
            )}
          </Field>
          <ModelUploader
            onUploaded={(id) => setForm((f) => ({ ...f, model_id: id }))}
          />

          <div className="grid grid-cols-2 gap-3">
            <Field label="Simulation type">
              <select
                aria-label="Simulation type"
                className="input"
                value={form.simulation_type}
                onChange={(e) =>
                  setForm({
                    ...form,
                    simulation_type: e.target.value as SimulationType,
                  })
                }
              >
                {SIM_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Domain">
              <select
                aria-label="Domain"
                className="input"
                value={form.domain}
                onChange={(e) =>
                  setForm({ ...form, domain: e.target.value as DomainType })
                }
              >
                {DOMAINS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Solver">
              <select
                aria-label="Solver"
                className="input"
                value={form.solver}
                onChange={(e) =>
                  setForm({ ...form, solver: e.target.value as SolverType })
                }
              >
                {SOLVERS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Engine">
              <select
                aria-label="Simulation engine"
                className="input"
                value={form.engine ?? "dpsim"}
                onChange={(e) =>
                  setForm({ ...form, engine: e.target.value as EngineType })
                }
              >
                {ENGINES.map((e) => (
                  <option key={e} value={e}>
                    {e === "both" ? "both (pp + dpsim)" : e}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Load profile ID">
              <input
                aria-label="Load profile ID"
                className="input"
                value={form.load_profile_id}
                onChange={(e) =>
                  setForm({ ...form, load_profile_id: e.target.value })
                }
              />
            </Field>
            <Field label="Timestep (ms)">
              <input
                aria-label="Timestep in milliseconds"
                type="number"
                className="input"
                value={form.timestep}
                min={1}
                onChange={(e) =>
                  setForm({ ...form, timestep: Number(e.target.value) })
                }
              />
            </Field>
            <Field label="Final time (ms)">
              <input
                aria-label="Final time in milliseconds"
                type="number"
                className="input"
                value={form.finaltime}
                min={1}
                onChange={(e) =>
                  setForm({ ...form, finaltime: Number(e.target.value) })
                }
              />
            </Field>
            <Field label="Outage (optional)">
              {(() => {
                const baked = findModel(form.model_id)?.outageCatalog;
                const runtime = topo.data?.branches.map((b) => ({
                  name: b.name,
                  busFrom: b.bus_from,
                  busTo: b.bus_to,
                  kind: b.kind as "line" | "transformer" | "switch",
                }));
                const cat = baked?.length ? baked : (runtime ?? []);
                if (cat.length === 0) {
                  return (
                    <input
                      aria-label="Outage element name"
                      className="input"
                      value={form.outage_component ?? ""}
                      placeholder="— none — (CIM element name)"
                      onChange={(e) =>
                        setForm({ ...form, outage_component: e.target.value })
                      }
                    />
                  );
                }
                const lines = cat.filter((e) => e.kind === "line");
                const xfmrs = cat.filter((e) => e.kind === "transformer");
                return (
                  <select
                    aria-label="Outage element"
                    className="input"
                    value={form.outage_component ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, outage_component: e.target.value })
                    }
                  >
                    <option value="">— none —</option>
                    {lines.length > 0 && (
                      <optgroup label={`Lines (${lines.length})`}>
                        {lines.map((l) => (
                          <option key={l.name} value={l.name}>
                            {l.name} ({l.busFrom}–{l.busTo})
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {xfmrs.length > 0 && (
                      <optgroup label={`Transformers (${xfmrs.length})`}>
                        {xfmrs.map((l) => (
                          <option key={l.name} value={l.name}>
                            {l.name} ({l.busFrom}–{l.busTo})
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                );
              })()}
            </Field>
            <Field label="Load factor (optional)">
              <input
                aria-label="Load factor (1.0 = baseline)"
                type="number"
                step="0.1"
                min="0.1"
                max="5"
                className="input"
                value={form.load_factor ?? 1}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setForm({
                    ...form,
                    load_factor: Number.isFinite(v) && v !== 1 ? v : undefined,
                  });
                }}
              />
            </Field>
          </div>

          <ClampPreview
            timestepMs={form.timestep}
            finaltimeMs={form.finaltime}
          />

          <button
            type="submit"
            disabled={submit.isPending}
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {submit.isPending ? "Submitting..." : "Submit"}
          </button>

          {submit.isError && (
            <p className="text-sm text-red-600">{(submit.error as Error).message}</p>
          )}
          {submit.isSuccess && (
            <p className="text-sm text-emerald-600">
              Submitted — id={submit.data.simulation_id}
            </p>
          )}
        </form>

      </section>

      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Recent simulations</h2>
          <span className="text-xs text-slate-500">auto-refresh 5s</span>
        </div>

        {/* v1.2 filter + sort controls. "" = no filter / server default. */}
        <div className="flex flex-wrap gap-2 text-xs">
          <select
            aria-label="Filter by status"
            className="input !py-1"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">all statuses</option>
            <option value="queued">queued</option>
            <option value="running">running</option>
            <option value="done">done</option>
            <option value="failed">failed</option>
            <option value="canceled">canceled</option>
          </select>
          <select
            aria-label="Filter by domain"
            className="input !py-1"
            value={filterDomain}
            onChange={(e) => setFilterDomain(e.target.value)}
          >
            <option value="">all domains</option>
            <option value="SP">SP</option>
            <option value="DP">DP</option>
            <option value="EMT">EMT</option>
          </select>
          <select
            aria-label="Sort by"
            className="input !py-1"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value)}
          >
            <option value="">newest first</option>
            <option value="simulation_id">sim id</option>
            <option value="created_at">created at</option>
            <option value="status">status</option>
            <option value="domain">domain</option>
          </select>
          {sortKey && (
            <select
              aria-label="Sort order"
              className="input !py-1"
              value={sortOrder || "desc"}
              onChange={(e) => setSortOrder(e.target.value)}
            >
              <option value="desc">desc</option>
              <option value="asc">asc</option>
            </select>
          )}
          {(filterStatus || filterDomain || sortKey) && (
            <button
              type="button"
              className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
              onClick={() => {
                setFilterStatus("");
                setFilterDomain("");
                setSortKey("");
                setSortOrder("");
              }}
            >
              clear
            </button>
          )}
        </div>

        {list.isLoading && <p className="text-sm text-slate-500">Loading…</p>}
        {list.isError && (
          <p className="text-sm text-red-600">
            Failed to list: {(list.error as Error).message}
          </p>
        )}
        {list.data && list.data.simulations.length === 0 && (
          <p className="text-sm text-slate-500">
            {listOffset > 0
              ? "No more simulations on this page."
              : "No simulations yet. Submit one on the left."}
          </p>
        )}
        {list.data && list.data.simulations.length > 0 && (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500">
                  <th className="py-1">ID</th>
                  <th>Type</th>
                  <th>Domain</th>
                  <th>Status</th>
                  <th>Model</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.data.simulations.map((s) => (
                  <tr
                    key={s.simulation_id}
                    className="border-t border-slate-100 dark:border-slate-800"
                  >
                    <td className="py-1 font-mono">{s.simulation_id}</td>
                    <td>{s.simulation_type}</td>
                    <td className="text-xs uppercase">{s.domain ?? "—"}</td>
                    <td>
                      <StatusPill status={s.status ?? undefined} />
                    </td>
                    <td className="font-mono text-xs">{s.model_id}</td>
                    <td className="text-right">
                      <Link
                        href={`/simulations/${s.simulation_id}`}
                        className="text-blue-600 hover:underline"
                      >
                        open →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
              <span>
                {listOffset + 1}–
                {listOffset + list.data.simulations.length}
                {list.data.total > 0 ? ` of ${list.data.total}` : ""}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setListOffset((o) => Math.max(0, o - LIST_LIMIT))
                  }
                  disabled={listOffset === 0}
                  className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  ← prev
                </button>
                <button
                  type="button"
                  onClick={() => setListOffset((o) => o + LIST_LIMIT)}
                  disabled={
                    listOffset + list.data.simulations.length >= list.data.total
                  }
                  className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  next →
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

function ModelUploader({
  onUploaded,
}: {
  onUploaded: (modelId: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [last, setLast] = useState<{ id: string; bytes: number } | null>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null);
    setBusy(true);
    try {
      const { model_id, bytes } = await api.uploadModel(file);
      setLast({ id: model_id, bytes });
      onUploaded(model_id);
    } catch (ex) {
      setErr((ex as Error).message);
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  return (
    <div className="rounded-md border border-dashed border-slate-300 p-3 dark:border-slate-700">
      <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
        <span className="font-medium">Or upload CIM XML:</span>
        <input
          type="file"
          accept=".xml,application/xml,text/xml"
          onChange={onPick}
          disabled={busy}
          className="text-xs"
        />
        {busy && <span className="text-blue-600">uploading…</span>}
      </label>
      {last && (
        <p className="mt-1 text-xs text-slate-500">
          uploaded <span className="font-mono">{last.id}</span> ({last.bytes} bytes)
          — model_id filled in.
        </p>
      )}
      {err && (
        <p className="mt-1 text-xs text-red-600 break-all">{err}</p>
      )}
    </div>
  );
}

function ClampPreview({
  timestepMs,
  finaltimeMs,
}: {
  timestepMs: number;
  finaltimeMs: number;
}) {
  const { effectiveTimestepMs, effectiveFinaltimeMs } = clampPreview(
    timestepMs,
    finaltimeMs,
  );
  const tsClamped = effectiveTimestepMs !== timestepMs;
  const ftClamped = effectiveFinaltimeMs !== finaltimeMs;
  const anyClamped = tsClamped || ftClamped;
  return (
    <p
      className={`text-xs ${
        anyClamped ? "text-amber-600" : "text-slate-500"
      }`}
      data-testid="clamp-preview"
    >
      effective: {effectiveTimestepMs}&nbsp;ms step ×{" "}
      {(effectiveFinaltimeMs / 1000).toFixed(3)}&nbsp;s total
      {anyClamped && (
        <>
          {" "}
          <span className="font-medium">(clamped — server bounds:</span>{" "}
          timestep ≥ {MIN_TIMESTEP_MS}&nbsp;ms, finaltime ≥{" "}
          {MIN_FINALTIME_TO_TIMESTEP_RATIO}× timestep and ≤{" "}
          {MAX_FINALTIME_MS / 1000}&nbsp;s
          <span className="font-medium">)</span>
        </>
      )}
    </p>
  );
}

/** v1.2.6 — colored pill for the list's `status` column. Falls back to
 *  a neutral dash when the summary didn't carry a status (redis-fallback
 *  path or pre-v1.2.6 API). */
function StatusPill({ status }: { status?: string }) {
  if (!status) return <span className="text-slate-400">—</span>;
  const cls =
    status === "done"
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
      : status === "running"
      ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
      : status === "failed"
      ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
      : status === "canceled"
      ? "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
      : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
}
