// Thin wrapper around the dpsim-api REST surface. All calls go through the
// /api/dpsim/* rewrite configured in next.config.ts so neither CORS nor
// backend hostnames leak into the browser.

import type {
  Simulation,
  SimulationArray,
  SimulationForm,
  SimulationSummary,
  SimStatus,
} from "./types";
import { authHeader } from "./auth";

const BASE = "/api/dpsim";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...authHeader(),
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (res.status === 401 && typeof window !== "undefined") {
    // Auth was required and our token is missing/expired. Bounce to /login
    // so the user can authenticate and retry.
    const current = window.location.pathname + window.location.search;
    if (!current.startsWith("/login")) {
      window.location.href = `/login?next=${encodeURIComponent(current)}`;
      // Hold the promise indefinitely so callers don't surface an error
      // toast while the browser is mid-navigation. The Promise resolves
      // when the new page loads and tears this JS context down.
      return new Promise<T>(() => {});
    }
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`dpsim-api ${res.status}: ${text || res.statusText}`);
  }
  return (await res.json()) as T;
}

export const api = {
  listSimulations: async (): Promise<SimulationSummary[]> => {
    // dpsim-api returns { simulations: [...] } — unwrap here.
    const res = await request<SimulationArray>("/simulation");
    return res.simulations ?? [];
  },
  getSimulation: (id: number) => request<Simulation>(`/simulation/${id}`),
  createSimulation: (form: SimulationForm) =>
    request<Simulation>("/simulation", {
      method: "POST",
      body: JSON.stringify(form),
    }),
  // Worker sidechannel via our BFF route. Returns { status, error?, warnings? }.
  getSimStatus: async (id: number): Promise<SimStatus> => {
    const res = await fetch(`/api/sim-status/${id}`, { cache: "no-store" });
    if (!res.ok) return { status: "unknown" };
    return (await res.json()) as SimStatus;
  },
  // P4.2: upload a CIM model. Sends raw bytes (application/xml). dpsim-api
  // stores them in file-service and returns the opaque model_id to use in the
  // subsequent POST /simulation.
  uploadModel: async (file: File): Promise<{ model_id: string; bytes: number }> => {
    const res = await fetch(`${BASE}/models`, {
      method: "POST",
      headers: {
        "Content-Type": file.type || "application/xml",
        ...authHeader(),
      },
      body: file,
      cache: "no-store",
    });
    if (res.status === 413) {
      throw new Error("Model file exceeds the 16 MiB limit");
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`upload failed (${res.status}): ${text}`);
    }
    return (await res.json()) as { model_id: string; bytes: number };
  },
};

// Parse dpsim CSV (fixed-width-ish, leading whitespace, comma-separated).
// Returns { columns, rows } where rows is Record<column, number>.
export function parseDpsimCsv(csv: string) {
  const lines = csv
    .trim()
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return { columns: [] as string[], rows: [] as Record<string, number>[] };

  const columns = lines[0]
    .split(",")
    .map((c) => c.trim());

  const rows = lines.slice(1).map((line) => {
    const parts = line.split(",").map((p) => Number(p.trim()));
    const row: Record<string, number> = {};
    columns.forEach((col, i) => {
      row[col] = parts[i];
    });
    return row;
  });

  return { columns, rows };
}

// Collapse `<base>.re` and `<base>.im` pairs into a single `<base>` magnitude.
// Returns the list of base names (ordered by first appearance) and a new row set.
export function toMagnitudeSeries(
  columns: string[],
  rows: Record<string, number>[],
) {
  const bases: string[] = [];
  for (const c of columns) {
    if (c === "time") continue;
    const m = c.match(/^(.+)\.re$/);
    if (!m) continue;
    const base = m[1];
    if (columns.includes(`${base}.im`)) bases.push(base);
  }
  const outCols = ["time", ...bases];
  const outRows = rows.map((r) => {
    const o: Record<string, number> = { time: r.time };
    for (const b of bases) {
      const re = r[`${b}.re`] ?? 0;
      const im = r[`${b}.im`] ?? 0;
      o[b] = Math.hypot(re, im);
    }
    return o;
  });
  return { columns: outCols, rows: outRows };
}

// Divide every column by its first-row (t=0) magnitude so curves start at 1.0.
// Columns whose t=0 value is zero are left untouched.
export function toPerUnitRelative(
  columns: string[],
  rows: Record<string, number>[],
) {
  if (rows.length === 0) return { columns, rows };
  const bases = Object.fromEntries(
    columns.map((c) => [c, c === "time" ? 1 : rows[0][c] || 0]),
  );
  const outRows = rows.map((r) => {
    const o: Record<string, number> = { time: r.time };
    for (const c of columns) {
      if (c === "time") continue;
      const base = bases[c];
      o[c] = base === 0 ? r[c] : r[c] / base;
    }
    return o;
  });
  return { columns, rows: outRows };
}
