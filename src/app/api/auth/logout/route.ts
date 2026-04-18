// BFF: POST /api/auth/logout — expires both cookies. No upstream call; the
// JWT is still valid server-side until exp, but without the cookie the
// browser can't present it. A real deployment would add a revocation list
// upstream if that gap matters.

import "server-only";
import { NextResponse } from "next/server";
import { COOKIE_NAME, EMAIL_COOKIE } from "@/lib/server/upstream";

export const runtime = "nodejs";

const EXPIRE = "Path=/; HttpOnly; SameSite=Lax; Max-Age=0";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.headers.append("Set-Cookie", `${COOKIE_NAME}=; ${EXPIRE}`);
  res.headers.append("Set-Cookie", `${EMAIL_COOKIE}=; ${EXPIRE}`);
  return res;
}
