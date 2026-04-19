// Static IEEE-39 (New England) outage-able element catalog. Names match
// cim:IdentifiedObject.name in `_deps/cim-data-src/IEEE-39/*EQ.xml` so the
// value flows straight into POST /simulation body.outage_component. 34
// lines + 12 transformers = 46 elements.
//
// Derived from the EQ bundle by inspecting ACLineSegment / PowerTransformer
// names; bus names follow the convention "BUS<n>" where <n> is the integer
// suffix of the element name (e.g. L-16-24 → BUS16 ↔ BUS24).
//
// Shares the type surface with wscc9.ts so `OutageCatalog` in the submit
// form can render either list from one union.

import type { Wscc9ElementKind, Wscc9Element } from "./wscc9";

export type Ieee39ElementKind = Wscc9ElementKind;
export type Ieee39Element = Wscc9Element;

export const IEEE39_LINES: Ieee39Element[] = [
  { name: "L-01-02", busFrom: "BUS1", busTo: "BUS2", kind: "line" },
  { name: "L-01-39", busFrom: "BUS1", busTo: "BUS39", kind: "line" },
  { name: "L-02-03", busFrom: "BUS2", busTo: "BUS3", kind: "line" },
  { name: "L-02-25", busFrom: "BUS2", busTo: "BUS25", kind: "line" },
  { name: "L-03-04", busFrom: "BUS3", busTo: "BUS4", kind: "line" },
  { name: "L-03-18", busFrom: "BUS3", busTo: "BUS18", kind: "line" },
  { name: "L-04-05", busFrom: "BUS4", busTo: "BUS5", kind: "line" },
  { name: "L-04-14", busFrom: "BUS4", busTo: "BUS14", kind: "line" },
  { name: "L-05-06", busFrom: "BUS5", busTo: "BUS6", kind: "line" },
  { name: "L-05-08", busFrom: "BUS5", busTo: "BUS8", kind: "line" },
  { name: "L-06-07", busFrom: "BUS6", busTo: "BUS7", kind: "line" },
  { name: "L-06-11", busFrom: "BUS6", busTo: "BUS11", kind: "line" },
  { name: "L-07-08", busFrom: "BUS7", busTo: "BUS8", kind: "line" },
  { name: "L-08-09", busFrom: "BUS8", busTo: "BUS9", kind: "line" },
  { name: "L-09-39", busFrom: "BUS9", busTo: "BUS39", kind: "line" },
  { name: "L-10-11", busFrom: "BUS10", busTo: "BUS11", kind: "line" },
  { name: "L-10-13", busFrom: "BUS10", busTo: "BUS13", kind: "line" },
  { name: "L-13-14", busFrom: "BUS13", busTo: "BUS14", kind: "line" },
  { name: "L-14-15", busFrom: "BUS14", busTo: "BUS15", kind: "line" },
  { name: "L-15-16", busFrom: "BUS15", busTo: "BUS16", kind: "line" },
  { name: "L-16-17", busFrom: "BUS16", busTo: "BUS17", kind: "line" },
  { name: "L-16-19", busFrom: "BUS16", busTo: "BUS19", kind: "line" },
  { name: "L-16-21", busFrom: "BUS16", busTo: "BUS21", kind: "line" },
  { name: "L-16-24", busFrom: "BUS16", busTo: "BUS24", kind: "line" },
  { name: "L-17-18", busFrom: "BUS17", busTo: "BUS18", kind: "line" },
  { name: "L-17-27", busFrom: "BUS17", busTo: "BUS27", kind: "line" },
  { name: "L-21-22", busFrom: "BUS21", busTo: "BUS22", kind: "line" },
  { name: "L-22-23", busFrom: "BUS22", busTo: "BUS23", kind: "line" },
  { name: "L-23-24", busFrom: "BUS23", busTo: "BUS24", kind: "line" },
  { name: "L-25-26", busFrom: "BUS25", busTo: "BUS26", kind: "line" },
  { name: "L-26-27", busFrom: "BUS26", busTo: "BUS27", kind: "line" },
  { name: "L-26-28", busFrom: "BUS26", busTo: "BUS28", kind: "line" },
  { name: "L-26-29", busFrom: "BUS26", busTo: "BUS29", kind: "line" },
  { name: "L-28-29", busFrom: "BUS28", busTo: "BUS29", kind: "line" },
  { name: "TR-02-30", busFrom: "BUS2",  busTo: "BUS30", kind: "transformer" },
  { name: "TR-06-31", busFrom: "BUS6",  busTo: "BUS31", kind: "transformer" },
  { name: "TR-10-32", busFrom: "BUS10", busTo: "BUS32", kind: "transformer" },
  { name: "TR-12-11", busFrom: "BUS12", busTo: "BUS11", kind: "transformer" },
  { name: "TR-12-13", busFrom: "BUS12", busTo: "BUS13", kind: "transformer" },
  { name: "TR-19-20", busFrom: "BUS19", busTo: "BUS20", kind: "transformer" },
  { name: "TR-19-33", busFrom: "BUS19", busTo: "BUS33", kind: "transformer" },
  { name: "TR-20-34", busFrom: "BUS20", busTo: "BUS34", kind: "transformer" },
  { name: "TR-22-35", busFrom: "BUS22", busTo: "BUS35", kind: "transformer" },
  { name: "TR-23-36", busFrom: "BUS23", busTo: "BUS36", kind: "transformer" },
  { name: "TR-25-37", busFrom: "BUS25", busTo: "BUS37", kind: "transformer" },
  { name: "TR-29-38", busFrom: "BUS29", busTo: "BUS38", kind: "transformer" },
];
