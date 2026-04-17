// Types mirror the hj801js/dpsim-api Rust structs (routes.rs).
// Once dpsim-api is merged upstream, regenerate from /openapi.json via
//   npx openapi-typescript http://localhost:8000/openapi.json -o src/lib/types.gen.ts

export type SimulationType = "Powerflow" | "Outage";
export type DomainType = "SP" | "DP" | "EMT";
export type SolverType = "MNA" | "DAE" | "NRP";

export interface SimulationForm {
  simulation_type: SimulationType;
  model_id: string;
  load_profile_id: string; // "None" if absent
  domain: DomainType;
  solver: SolverType;
  timestep: number;
  finaltime: number;
}

export interface Simulation extends SimulationForm {
  simulation_id: number;
  results_id: string;
  results_data: string; // CSV text (empty until worker uploads)
  error: string;
}

export interface SimulationSummary {
  simulation_id: number;
  model_id: string;
  simulation_type: SimulationType;
}

/** `GET /simulation` wraps the summary array in an object. */
export interface SimulationArray {
  simulations: SimulationSummary[];
}

/** Worker sidechannel in redis (`dpsim:sim:<id>:status`). */
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
}

export const DOMAINS: DomainType[] = ["SP", "DP", "EMT"];
export const SOLVERS: SolverType[] = ["MNA", "DAE", "NRP"];
export const SIM_TYPES: SimulationType[] = ["Powerflow", "Outage"];
