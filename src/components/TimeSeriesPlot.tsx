"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const PALETTE = [
  "#2563eb", // blue-600
  "#dc2626", // red-600
  "#059669", // emerald-600
  "#d97706", // amber-600
  "#7c3aed", // violet-600
  "#0891b2", // cyan-600
  "#be185d", // pink-700
  "#65a30d", // lime-600
];

export interface TimeSeriesPlotProps {
  /** Rows keyed by column name. Expects a `time` column plus numeric series. */
  rows: Record<string, number>[];
  /** Columns to plot. If omitted, all numeric columns except `time` are used. */
  columns?: string[];
  /** Optional cap to reduce render load on very long simulations. */
  maxPoints?: number;
}

export function TimeSeriesPlot({ rows, columns, maxPoints = 2_000 }: TimeSeriesPlotProps) {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-500">No data to plot.</p>;
  }

  const allColumns = Object.keys(rows[0]);
  const toPlot = (columns ?? allColumns.filter((c) => c !== "time")).slice(0, 12);

  // Downsample by stride if needed; keep first and last for accurate bounds.
  const data =
    rows.length > maxPoints
      ? rows.filter((_, i) => i % Math.ceil(rows.length / maxPoints) === 0)
      : rows;

  return (
    <div className="h-96 w-full">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 12, right: 24, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
          <XAxis dataKey="time" tickFormatter={(v) => Number(v).toPrecision(3)} />
          <YAxis tickFormatter={(v) => Number(v).toPrecision(3)} />
          <Tooltip
            labelFormatter={(v) => `t=${Number(v).toPrecision(4)}`}
            formatter={(v: number) => Number(v).toPrecision(5)}
          />
          <Legend />
          {toPlot.map((col, i) => (
            <Line
              key={col}
              type="monotone"
              dataKey={col}
              dot={false}
              strokeWidth={1.5}
              stroke={PALETTE[i % PALETTE.length]}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
