// Static WSCC-9 outage-able element catalog. `name` matches
// cim:IdentifiedObject.name in the CIM EQ bundle so sending it as
// POST /simulation body.outage_component works directly. P3.4 worker
// outage handles both cim:ACLineSegment and cim:PowerTransformerEnd —
// transformers are listed here with kind="transformer".
// Generated from the CIM EQ+TP files (session 22/23 docs for details).

export type Wscc9ElementKind = "line" | "transformer";

export interface Wscc9Element {
  name: string;
  busFrom: string;
  busTo: string;
  kind: Wscc9ElementKind;
}

export const WSCC9_LINES: Wscc9Element[] = [
  { name: "LINE75", busFrom: "BUS7", busTo: "BUS5", kind: "line" },
  { name: "LINE96", busFrom: "BUS9", busTo: "BUS6", kind: "line" },
  { name: "LINE64", busFrom: "BUS6", busTo: "BUS4", kind: "line" },
  { name: "LINE54", busFrom: "BUS5", busTo: "BUS4", kind: "line" },
  { name: "LINE89", busFrom: "BUS9", busTo: "BUS8", kind: "line" },
  { name: "LINE78", busFrom: "BUS7", busTo: "BUS8", kind: "line" },
  { name: "TR14",   busFrom: "BUS1", busTo: "BUS4", kind: "transformer" },
  { name: "TR27",   busFrom: "BUS2", busTo: "BUS7", kind: "transformer" },
  { name: "TR39",   busFrom: "BUS3", busTo: "BUS9", kind: "transformer" },
];
