// Types generated from dpsim-api's /openapi.json via `npm run gen:types`.
// Re-exported under stable names here so callsites don't need to know
// the generated path layout. Re-run gen:types after any dpsim-api struct
// change (start the backend, then `npm run gen:types`).

import type { components } from "./types.gen";

type Schemas = components["schemas"];

export type SimulationType = Schemas["SimulationType"];
export type DomainType = Schemas["DomainType"];
export type SolverType = Schemas["SolverType"];

export type SimulationForm = Schemas["SimulationForm"];
export type Simulation = Schemas["Simulation"];
export type SimulationSummary = Schemas["SimulationSummary"];
export type SimulationArray = Schemas["SimulationArray"];

// Runtime enum arrays — the OpenAPI codegen only yields types, but the UI
// needs the actual values to render <select> options. Keep these in sync
// with the JsonSchema enums in dpsim-api/src/routes.rs.
export const SIM_TYPES: SimulationType[] = ["Powerflow", "Outage"];
export const DOMAINS: DomainType[] = ["SP", "DP", "EMT"];
export const SOLVERS: SolverType[] = ["MNA", "DAE", "NRP"];

// Input bounds — kept in sync with the worker (clamp_params in
// dpsim/examples/service-stack/worker.py) and with dpsim-api's
// server-side validation (parse_simulation_form). Centralised here so
// the submission form can preview the effective values before posting.
export const MIN_TIMESTEP_MS = 0.01;
export const MAX_FINALTIME_MS = 30_000;
export const MIN_FINALTIME_TO_TIMESTEP_RATIO = 10;

export function clampPreview(timestepMs: number, finaltimeMs: number) {
  const ts = Math.max(timestepMs, MIN_TIMESTEP_MS);
  const floor = ts * MIN_FINALTIME_TO_TIMESTEP_RATIO;
  const ft = Math.min(Math.max(finaltimeMs, floor), MAX_FINALTIME_MS);
  return { effectiveTimestepMs: ts, effectiveFinaltimeMs: ft };
}

// Worker sidechannel in redis (`dpsim:sim:<id>:status`). Not part of the
// Rust OpenAPI — served by our own BFF route /api/sim-status/<id>.
export type SimStatusState =
  | "queued"
  | "running"
  | "done"
  | "failed"
  | "unknown";
export interface SimStatus {
  status: SimStatusState;
  error?: string;
  warnings?: string[];
  /** Approximate 0–100 percent. Worker publishes while sim.run() blocks,
   *  sampling the output CSV's row count vs expected steps. */
  progress?: number;
}
