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
    const raw = await r.get(`dpsim:sim:${id}:status`);
    if (!raw) return NextResponse.json({ status: "unknown" });
    try {
      return NextResponse.json(JSON.parse(raw));
    } catch {
      return NextResponse.json({ status: "unknown", raw });
    }
  } catch (e) {
    return NextResponse.json(
      { status: "unknown", error: (e as Error).message },
      { status: 503 },
    );
  }
}
