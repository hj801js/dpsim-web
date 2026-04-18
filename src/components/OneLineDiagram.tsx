"use client";

// Phase 4.3 scaffold — WSCC-9 one-line diagram. Fixed topology (9 buses +
// slack) rendered via react-flow; node color = last-row voltage magnitude
// relative to the t=0 reference ("puzzle-out the red nodes" use case).
//
// Limitations (next-session work):
//   - Topology is hard-coded for wscc9. IEEE-39 or user-uploaded CIM requires
//     parsing the CIM XML to build nodes/edges dynamically.
//   - Edge flows are not yet displayed (worker doesn't log i_line for CIM yet).
//   - Click interactions (outage scenarios) route back to M4.

import { ReactFlow, Background, Controls, type Node, type Edge } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { WSCC9_LINES } from "@/lib/wscc9";

export interface BusVoltage {
  /** e.g. "v_n0" */
  bus: string;
  /** magnitude in volts at the last timestep */
  magnitude: number;
  /** magnitude at t=0 (reference) */
  reference: number;
}

const WSCC9_LAYOUT: Record<string, { x: number; y: number; label: string }> = {
  v_n0: { x:   0, y:   0, label: "BUS1 (slack 16.5 kV)" },
  v_n4: { x: 200, y:   0, label: "BUS5 (18.0 kV gen)" },
  v_n5: { x: 400, y:   0, label: "BUS6 (13.8 kV gen)" },
  v_n1: { x:   0, y: 120, label: "BUS2 (230 kV)" },
  v_n3: { x: 200, y: 120, label: "BUS4 (230 kV)" },
  v_n6: { x: 400, y: 120, label: "BUS7 (230 kV)" },
  v_n8: { x: 200, y: 240, label: "BUS9 (230 kV)" },
  v_n2: { x:   0, y: 360, label: "BUS3 (230 kV)" },
  v_n7: { x: 400, y: 360, label: "BUS8 (230 kV)" },
};

// Edges annotated with the CIM line name when the element is an
// ACLineSegment (outage-able). Transformers are shown but have no CIM
// line name — clicking them does nothing. See src/lib/wscc9.ts for the
// source CIM mapping.
interface Wscc9Edge {
  from: string;
  to: string;
  /** Present only for ACLineSegments; used as outage_component. */
  cimLine?: string;
  label?: string;
}

const WSCC9_EDGES: Wscc9Edge[] = [
  // Transformers (clickable after session 23 P3.4b)
  { from: "v_n0", to: "v_n1", cimLine: "TR14", label: "TR14" },
  { from: "v_n4", to: "v_n3", cimLine: "TR27", label: "TR27" },
  { from: "v_n5", to: "v_n6", cimLine: "TR39", label: "TR39" },
  // Transmission lines (ACLineSegment) — label + cimLine from WSCC9_LINES.
  { from: "v_n1", to: "v_n3", cimLine: "LINE54",  label: "LINE54"  },
  { from: "v_n1", to: "v_n2", cimLine: "LINE64",  label: "LINE64"  },
  { from: "v_n3", to: "v_n8", cimLine: "LINE96",  label: "LINE96"  },
  { from: "v_n6", to: "v_n8", cimLine: "LINE78",  label: "LINE78"  },
  { from: "v_n2", to: "v_n7", cimLine: "LINE89",  label: "LINE89"  },
  { from: "v_n7", to: "v_n6", cimLine: "LINE75",  label: "LINE75"  },
];

// Suppress unused-import complaint — the catalog might be used for
// tooltips in a future iteration.
void WSCC9_LINES;

function colorFor(ratio: number): string {
  // 1.0 green, 0.95 amber, <0.9 red. Same thresholds the warnings banner uses.
  if (!Number.isFinite(ratio)) return "#94a3b8";
  if (ratio > 0.99) return "#16a34a";
  if (ratio > 0.95) return "#eab308";
  return "#dc2626";
}

export function OneLineDiagram({ voltages }: { voltages: BusVoltage[] }) {
  const byBus = useMemo(
    () => Object.fromEntries(voltages.map((v) => [v.bus, v])),
    [voltages],
  );

  const nodes: Node[] = useMemo(
    () =>
      Object.entries(WSCC9_LAYOUT).map(([bus, pos]) => {
        const v = byBus[bus];
        const ratio = v ? v.magnitude / v.reference : NaN;
        return {
          id: bus,
          position: { x: pos.x, y: pos.y },
          data: {
            label: (
              <div className="text-center">
                <div className="font-semibold">{pos.label}</div>
                <div className="font-mono text-xs">
                  {v
                    ? `${(v.magnitude / 1000).toFixed(2)} kV (${(ratio * 100).toFixed(
                        1,
                      )}%)`
                    : "—"}
                </div>
              </div>
            ),
          },
          style: {
            background: colorFor(ratio),
            color: "white",
            border: "1px solid #1e293b",
            borderRadius: 8,
            padding: 8,
            width: 170,
            fontSize: 11,
          },
        };
      }),
    [byBus],
  );

  const edges: Edge[] = useMemo(
    () =>
      WSCC9_EDGES.map((e, i) => ({
        id: `e${i}`,
        source: e.from,
        target: e.to,
        label: e.label,
        labelStyle: { fontSize: 10, fill: "#475569" },
        labelBgStyle: { fill: "white", fillOpacity: 0.8 },
        style: { stroke: e.cimLine ? "#64748b" : "#cbd5e1", strokeWidth: e.cimLine ? 1.5 : 1 },
        data: { cimLine: e.cimLine },
      })),
    [],
  );

  const router = useRouter();

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500">
        Click any labeled branch (LINE* or TR*) to queue an outage of that
        element — you&apos;ll be redirected to the submit form with the
        outage field pre-filled.
      </p>
      <div className="h-[520px] rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          fitView
          onEdgeClick={(_e, edge) => {
            const cim = (edge.data as { cimLine?: string } | undefined)?.cimLine;
            if (!cim) return;
            router.push(`/?model_id=wscc9&outage_component=${encodeURIComponent(cim)}`);
          }}
        >
          <Background />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
}
