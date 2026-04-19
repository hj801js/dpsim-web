// Reads worker sidechannel at `dpsim:sim:<id>:status`. The Rust dpsim-api
// doesn't expose our status+warnings fields (yet), so the BFF bridges.
// Returns { status, error?, warnings? } or { status: "unknown" } if the
// worker hasn't touched the key yet.
import { NextResponse } from "next/server";
import { getRedis } from "@/lib/server/redis";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  try {
    const r = await getRedis();
    const [raw, mapRaw] = await Promise.all([
      r.get(`dpsim:sim:${id}:status`),
      r.get(`dpsim:sim:${id}:bus_map`),
    ]);
    if (!raw) return NextResponse.json({ status: "unknown" });
    let status: Record<string, unknown>;
    try {
      status = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ status: "unknown", raw });
    }
    // Merge bus_map when the worker has written it. `bus_map[i]` is the
    // display bus name corresponding to the worker CSV column `v_n<i>`.
    if (mapRaw) {
      try {
        status.bus_map = JSON.parse(mapRaw);
      } catch {
        /* ignore — stale / malformed */
      }
    }
    return NextResponse.json(status);
  } catch (e) {
    return NextResponse.json(
      { status: "unknown", error: (e as Error).message },
      { status: 503 },
    );
  }
}
