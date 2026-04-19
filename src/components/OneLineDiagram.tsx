"use client";

// Auto-layout one-line diagram. Any CIM-derived catalog (wscc9, ieee14,
// ieee39, cigre_mv, user uploads via /topology once Phase D lands) gets
// rendered by feeding its ACLineSegment + PowerTransformer edges into a
// dagre layered layout; react-flow then draws the resulting graph.
//
// Voltage overlay is optional: callers pass { busName → magnitude/ref }
// pairs and we color-code each node by ratio. Bus names must match
// catalog.busFrom/busTo exactly — the caller is responsible for mapping
// their worker-CSV columns (v_n<i>) into the display name space.
//
// Click an edge whose cimLine is set → redirect to /?outage_component=…
// so the submit form can stage the outage scenario.

import { ReactFlow, Background, Controls, type Node, type Edge } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import dagre from "dagre";
import type { Wscc9Element } from "@/lib/wscc9";

export interface BusVoltage {
  /** Display bus name, matching catalog.busFrom/busTo. */
  bus: string;
  /** magnitude in volts at the last timestep */
  magnitude: number;
  /** magnitude at t=0 (reference) */
  reference: number;
}

export interface OneLineDiagramProps {
  /** Branch catalog — lines + transformers + switches. */
  catalog: Wscc9Element[];
  /** Model id used for the redirect query when an edge is clicked. */
  modelId: string;
  /** Optional voltage overlay. When empty, the diagram renders
   *  topology-only in grey. */
  voltages?: BusVoltage[];
}

function colorFor(ratio: number): string {
  if (!Number.isFinite(ratio)) return "#94a3b8";
  if (ratio > 0.99) return "#16a34a";
  if (ratio > 0.95) return "#eab308";
  return "#dc2626";
}

const NODE_WIDTH  = 150;
const NODE_HEIGHT = 56;

export function OneLineDiagram({ catalog, modelId, voltages }: OneLineDiagramProps) {
  const router = useRouter();

  // Index voltages by bus name once per render.
  const vByBus = useMemo(
    () => Object.fromEntries((voltages ?? []).map((v) => [v.bus, v])),
    [voltages],
  );

  // Union of bus names appearing in the catalog.
  const buses = useMemo(() => {
    const s = new Set<string>();
    for (const e of catalog) {
      if (e.busFrom) s.add(e.busFrom);
      if (e.busTo)   s.add(e.busTo);
    }
    return Array.from(s);
  }, [catalog]);

  // Layered layout via dagre. For systems with few feeders (WSCC-9, CIGRE MV)
  // this gives a clean left-to-right grid; for meshed systems (IEEE-39)
  // it still produces something navigable, albeit crowded.
  const layout = useMemo(() => {
    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: "LR", nodesep: 40, ranksep: 90, edgesep: 10 });
    g.setDefaultEdgeLabel(() => ({}));
    for (const bus of buses) {
      g.setNode(bus, { width: NODE_WIDTH, height: NODE_HEIGHT });
    }
    for (const e of catalog) {
      if (e.busFrom && e.busTo) {
        g.setEdge(e.busFrom, e.busTo, { name: e.name, kind: e.kind });
      }
    }
    dagre.layout(g);
    const positions: Record<string, { x: number; y: number }> = {};
    for (const bus of buses) {
      const n = g.node(bus);
      if (n) positions[bus] = { x: n.x - NODE_WIDTH / 2, y: n.y - NODE_HEIGHT / 2 };
    }
    return positions;
  }, [buses, catalog]);

  const nodes: Node[] = useMemo(
    () =>
      buses.map((bus) => {
        const pos = layout[bus] ?? { x: 0, y: 0 };
        const v = vByBus[bus];
        const ratio = v ? v.magnitude / v.reference : NaN;
        return {
          id: bus,
          position: pos,
          data: {
            label: (
              <div className="text-center">
                <div className="font-semibold text-xs">{bus}</div>
                <div className="font-mono text-[10px]">
                  {v
                    ? `${(v.magnitude / 1000).toFixed(2)} kV (${(ratio * 100).toFixed(1)}%)`
                    : "—"}
                </div>
              </div>
            ),
          },
          style: {
            background: v ? colorFor(ratio) : "#94a3b8",
            color: "white",
            border: "1px solid #1e293b",
            borderRadius: 8,
            padding: 4,
            width: NODE_WIDTH,
            height: NODE_HEIGHT,
          },
        };
      }),
    [buses, layout, vByBus],
  );

  const edges: Edge[] = useMemo(
    () =>
      catalog.map((e, i) => ({
        id: `e${i}-${e.name}`,
        source: e.busFrom,
        target: e.busTo,
        label: e.name,
        labelStyle: { fontSize: 9, fill: "#475569" },
        labelBgStyle: { fill: "white", fillOpacity: 0.8 },
        style: {
          stroke: e.kind === "transformer" ? "#7c3aed" : "#64748b",
          strokeWidth: e.kind === "transformer" ? 2 : 1.5,
          strokeDasharray: e.kind === "switch" ? "4 2" : undefined,
        },
        data: { cimLine: e.name, kind: e.kind },
      })),
    [catalog],
  );

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500">
        Click any branch to queue an outage of that element — you&apos;ll be
        redirected to the submit form with the outage field pre-filled.
        Lines are grey, transformers purple, switches dashed.
      </p>
      <div className="h-[520px] rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          fitView
          onEdgeClick={(_ev, edge) => {
            const cim = (edge.data as { cimLine?: string } | undefined)?.cimLine;
            if (!cim) return;
            router.push(
              `/?model_id=${encodeURIComponent(modelId)}&outage_component=${encodeURIComponent(cim)}`,
            );
          }}
        >
          <Background />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
}
