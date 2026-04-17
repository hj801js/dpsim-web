"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api";
import {
  DOMAINS,
  SOLVERS,
  SIM_TYPES,
  type DomainType,
  type SimulationForm,
  type SimulationType,
  type SolverType,
} from "@/lib/types";

const DEFAULT_FORM: SimulationForm = {
  simulation_type: "Powerflow",
  model_id: "wscc9",
  load_profile_id: "None",
  domain: "DP",
  solver: "MNA",
  timestep: 1,       // ms  (DP typical)
  finaltime: 1000,   // ms  (1 s total)
};

export default function DashboardPage() {
  const [form, setForm] = useState<SimulationForm>(DEFAULT_FORM);
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ["simulations"],
    queryFn: api.listSimulations,
    refetchInterval: 5_000,
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
            submit.mutate(form);
          }}
        >
          <Field label="Model ID">
            <input
              className="input"
              value={form.model_id}
              onChange={(e) => setForm({ ...form, model_id: e.target.value })}
              placeholder="wscc9 | demo | ..."
              required
            />
          </Field>

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
          </div>

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

        {list.isLoading && <p className="text-sm text-slate-500">Loading…</p>}
        {list.isError && (
          <p className="text-sm text-red-600">
            Failed to list: {(list.error as Error).message}
          </p>
        )}
        {list.data && list.data.length === 0 && (
          <p className="text-sm text-slate-500">
            No simulations yet. Submit one on the left.
          </p>
        )}
        {list.data && list.data.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500">
                <th className="py-1">ID</th>
                <th>Type</th>
                <th>Model</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {list.data
                .slice()
                .reverse()
                .map((s) => (
                  <tr
                    key={s.simulation_id}
                    className="border-t border-slate-100 dark:border-slate-800"
                  >
                    <td className="py-1 font-mono">{s.simulation_id}</td>
                    <td>{s.simulation_type}</td>
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
