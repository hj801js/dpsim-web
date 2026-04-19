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
import { useEffect, useMemo, useState } from "react";
import dagre from "dagre";
import type { Wscc9Element } from "@/lib/wscc9";

/** When a catalog is larger than this, the diagram renders a Summary card
 *  first and offers an explicit opt-in to pay the dagre+react-flow cost.
 *  Dagre layout for ~300 nodes + ~400 edges takes ~200 ms and the result
 *  is visually cluttered — not useful to force-paint by default. */
const LARGE_MODEL_THRESHOLD = 100;

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

/** Track dark-mode preference via the OS media query + the `dark` class on
 *  <html> Tailwind sets when the user forces a theme. React-flow styles
 *  use inline JS objects, so we can't rely on dark: Tailwind variants. */
function useIsDark(): boolean {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const compute = () =>
      document.documentElement.classList.contains("dark") || mq.matches;
    setDark(compute());
    const onChange = () => setDark(compute());
    mq.addEventListener("change", onChange);
    const obs = new MutationObserver(onChange);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => {
      mq.removeEventListener("change", onChange);
      obs.disconnect();
    };
  }, []);
  return dark;
}

function colorFor(ratio: number): string {
  if (!Number.isFinite(ratio)) return "#94a3b8";
  if (ratio > 0.99) return "#16a34a";
  if (ratio > 0.95) return "#eab308";
  return "#dc2626";
}

const NODE_WIDTH  = 150;
const NODE_HEIGHT = 56;

/** Compact "summary card" for large models — shows the counts + top-degree
 *  buses instead of a 400-edge dagre tangle. Users can opt in to the full
 *  diagram via the button. */
function LargeModelSummary({
  catalog,
  onShowFull,
}: {
  catalog: Wscc9Element[];
  onShowFull: () => void;
}) {
  const stats = useMemo(() => {
    const lines = catalog.filter((e) => e.kind === "line").length;
    const xfmrs = catalog.filter((e) => e.kind === "transformer").length;
    const sw    = catalog.filter((e) => e.kind === "switch").length;
    const degree = new Map<string, number>();
    for (const e of catalog) {
      if (e.busFrom) degree.set(e.busFrom, (degree.get(e.busFrom) ?? 0) + 1);
      if (e.busTo)   degree.set(e.busTo,   (degree.get(e.busTo) ?? 0) + 1);
    }
    const buses = degree.size;
    const top = [...degree.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    return { lines, xfmrs, sw, buses, top };
  }, [catalog]);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm dark:border-slate-800 dark:bg-slate-900">
      <h4 className="font-semibold">Large model — summary</h4>
      <p className="mt-1 text-xs text-slate-500">
        {stats.buses} buses · {stats.lines} lines · {stats.xfmrs} transformers
        {stats.sw > 0 ? ` · ${stats.sw} switches` : ""}. Rendering a full
        one-line diagram for {catalog.length}+ branches is slow and hard to
        read; summary shown by default.
      </p>
      <div className="mt-3">
        <div className="text-xs font-medium text-slate-600 dark:text-slate-400">
          Top-degree buses
        </div>
        <ul className="mt-1 space-y-0.5 text-xs font-mono">
          {stats.top.map(([bus, deg]) => (
            <li key={bus}>
              {bus} — {deg} connections
            </li>
          ))}
        </ul>
      </div>
      <button
        type="button"
        onClick={onShowFull}
        className="mt-3 rounded border border-slate-300 px-3 py-1 text-xs hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
      >
        Render full diagram anyway
      </button>
    </div>
  );
}

export function OneLineDiagram({ catalog, modelId, voltages }: OneLineDiagramProps) {
  const router = useRouter();
  const isDark = useIsDark();
  const [forceFullRender, setForceFullRender] = useState(false);
  const isLarge = catalog.length > LARGE_MODEL_THRESHOLD;
  const skipHeavyLayout = isLarge && !forceFullRender;

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
    // Skip the expensive graph construction when we're going to render
    // the summary instead — positions go unused in that case.
    if (skipHeavyLayout) return {} as Record<string, { x: number; y: number }>;
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
  }, [buses, catalog, skipHeavyLayout]);

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
            // Voltage nodes keep their semantic red/amber/green; untouched
            // nodes use a neutral grey that contrasts against both themes.
            background: v ? colorFor(ratio) : (isDark ? "#475569" : "#94a3b8"),
            color: "white",
            border: isDark ? "1px solid #0f172a" : "1px solid #1e293b",
            borderRadius: 8,
            padding: 4,
            width: NODE_WIDTH,
            height: NODE_HEIGHT,
          },
        };
      }),
    [buses, layout, vByBus, isDark],
  );

  const edges: Edge[] = useMemo(
    () =>
      catalog.map((e, i) => ({
        id: `e${i}-${e.name}`,
        source: e.busFrom,
        target: e.busTo,
        label: e.name,
        labelStyle: { fontSize: 9, fill: isDark ? "#e2e8f0" : "#475569" },
        labelBgStyle: {
          fill: isDark ? "#1e293b" : "white",
          fillOpacity: 0.85,
        },
        style: {
          // Transformer purple is readable on both; line colour flips so
          // grey-on-grey doesn't blend into the dark canvas.
          stroke: e.kind === "transformer"
            ? "#a78bfa"   // violet-400 (readable dark + light)
            : (isDark ? "#94a3b8" : "#64748b"),
          strokeWidth: e.kind === "transformer" ? 2 : 1.5,
          strokeDasharray: e.kind === "switch" ? "4 2" : undefined,
        },
        data: { cimLine: e.name, kind: e.kind },
      })),
    [catalog, isDark],
  );

  if (skipHeavyLayout) {
    return <LargeModelSummary catalog={catalog} onShowFull={() => setForceFullRender(true)} />;
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500">
        Click any branch to queue an outage of that element — you&apos;ll be
        redirected to the submit form with the outage field pre-filled.
        Lines are grey, transformers purple, switches dashed.
      </p>
      <div className="h-[60vh] min-h-[360px] max-h-[780px] rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
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
