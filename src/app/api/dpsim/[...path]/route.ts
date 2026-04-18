// Proxy: /api/dpsim/:path* → dpsim-api :path*
//
// Replaces the next.config.ts `rewrites()` entry so we have a server-side
// hook to read the httpOnly JWT cookie and turn it into an Authorization
// header. The browser never sees or sets the header itself — that's the
// whole point of docs/43 #2.
//
// Supports the methods dpsim-api exposes today: GET, POST. PUT/DELETE/PATCH
// would slot in trivially — just add export consts for them.

import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, upstream } from "@/lib/server/upstream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function proxy(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
): Promise<NextResponse> {
  const { path } = await ctx.params;
  const url = new URL(req.url);
  const target = upstream(`/${path.join("/")}${url.search}`);

  // Forward request headers minus hop-by-hop and host-specific ones. Inject
  // Authorization from the cookie when present.
  const headers = new Headers();
  req.headers.forEach((value, key) => {
    const k = key.toLowerCase();
    if (k === "host" || k === "connection" || k === "content-length") return;
    // Never let a browser-supplied Authorization header pass through — the
    // only auth we accept is the cookie-derived one we set ourselves.
    if (k === "authorization") return;
    headers.set(key, value);
  });
  const jwt = req.cookies.get(COOKIE_NAME)?.value;
  if (jwt) headers.set("Authorization", `Bearer ${jwt}`);

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  // Read the whole body — 16 MiB limit lives upstream (Rocket), so at worst
  // we briefly buffer a 16 MiB upload. Streaming via req.body + duplex:'half'
  // works on modern Node but fails at the edge so we keep this simple.
  const body = hasBody ? await req.arrayBuffer() : undefined;

  const up = await fetch(target, {
    method: req.method,
    headers,
    body,
    redirect: "manual",
  });

  // Pass the upstream response straight through. Strip hop-by-hop headers
  // that would confuse the browser (Transfer-Encoding especially).
  const outHeaders = new Headers(up.headers);
  for (const h of ["transfer-encoding", "connection", "keep-alive"]) {
    outHeaders.delete(h);
  }

  return new NextResponse(up.body, {
    status: up.status,
    statusText: up.statusText,
    headers: outHeaders,
  });
}

export const GET  = proxy;
export const POST = proxy;
