// Known-model registry — the union of baked-in CIM bundles the worker
// recognises (see worker.py::CIM_BUNDLES) plus the demo programmatic
// topology and the "custom" sentinel for uploaded model ids.
//
// Consumed by the submit form's model dropdown and the outage dropdown.

import { WSCC9_LINES, type Wscc9Element } from "./wscc9";
import { IEEE39_LINES } from "./ieee39";

export interface ModelEntry {
  id: string;
  label: string;
  /** Outage-able element catalog for this model. Empty for `demo` and
   *  `custom` — the outage dropdown falls back to a free-text input. */
  outageCatalog: Wscc9Element[];
  /** Short description shown next to the dropdown. */
  hint: string;
}

export const MODELS: ModelEntry[] = [
  {
    id: "wscc9",
    label: "WSCC-9 (9-bus)",
    outageCatalog: WSCC9_LINES,
    hint: "Western System Coordinating Council test system — 9 buses, 3 generators.",
  },
  {
    id: "ieee39",
    label: "IEEE-39 (New England, 39-bus)",
    outageCatalog: IEEE39_LINES,
    hint: "New England 39-bus reduced transmission system — 34 lines, 12 transformers, 10 generators.",
  },
  {
    id: "demo",
    label: "Demo topology (programmatic)",
    outageCatalog: [],
    hint: "Small hand-built circuit the worker constructs in Python. EMT-capable.",
  },
];

/** Lookup helper. Returns undefined for custom/uploaded ids. */
export function findModel(id: string): ModelEntry | undefined {
  return MODELS.find((m) => m.id === id);
}
