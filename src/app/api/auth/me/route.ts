// BFF: GET /api/auth/me
//
// Reads the EMAIL cookie and, when the JWT is also present, verifies it by
// calling upstream /auth/me. Returns { email } on success, 401 when not
// logged in or the token has expired. Client components use this to render
// the signed-in state without ever seeing the token itself.

import "server-only";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE_NAME, EMAIL_COOKIE, upstream } from "@/lib/server/upstream";

export const runtime = "nodejs";
// Auth state changes under our feet — don't let Next cache this.
export const dynamic = "force-dynamic";

export async function GET() {
  const c = await cookies();
  const jwt   = c.get(COOKIE_NAME)?.value;
  const email = c.get(EMAIL_COOKIE)?.value;
  if (!jwt) return NextResponse.json({ email: null }, { status: 401 });

  const up = await fetch(upstream("/auth/me"), {
    headers: { Authorization: `Bearer ${jwt}` },
    cache: "no-store",
  });
  if (!up.ok) {
    return NextResponse.json({ email: null }, { status: 401 });
  }
  const data = (await up.json()) as { email?: string };
  return NextResponse.json({ email: data.email ?? email ?? null });
}
