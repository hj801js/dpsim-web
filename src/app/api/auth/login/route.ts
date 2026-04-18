// BFF: POST /api/auth/login
//
// Accepts the same credentials shape as dpsim-api's /auth/login and forwards
// them server-to-server. The returned JWT is dropped into an httpOnly cookie
// so browser JS can never read it — XSS-resistant unlike the previous
// localStorage approach (docs/43 #2).

import "server-only";
import { NextResponse } from "next/server";
import { COOKIE_NAME, EMAIL_COOKIE, cookieFlags, upstream } from "@/lib/server/upstream";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "malformed body" }, { status: 400 });
  }

  const up = await fetch(upstream("/auth/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    // No credentials/cookies to upstream — auth upstream uses the
    // Authorization header (injected by the proxy route for /api/dpsim/*).
  });

  if (!up.ok) {
    const text = await up.text().catch(() => "");
    return NextResponse.json(
      { error: `upstream ${up.status}`, detail: text.slice(0, 200) },
      { status: up.status },
    );
  }

  const data = (await up.json()) as { token?: string; email?: string };
  if (!data.token || !data.email) {
    return NextResponse.json({ error: "upstream returned no token" }, { status: 502 });
  }

  const res = NextResponse.json({ email: data.email });
  // Two cookies: the JWT (httpOnly — server use only) and a non-sensitive
  // email marker (httpOnly too — read via /api/auth/me, not directly).
  res.headers.append("Set-Cookie", `${COOKIE_NAME}=${data.token}; ${cookieFlags()}`);
  res.headers.append("Set-Cookie", `${EMAIL_COOKIE}=${data.email}; ${cookieFlags()}`);
  return res;
}
