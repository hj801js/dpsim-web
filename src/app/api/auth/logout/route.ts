// BFF: POST /api/auth/logout — hits upstream /auth/logout (server-side
// revocation, session 28) THEN clears the cookies. If the upstream call
// fails we still clear cookies — the browser will have no token to replay
// even if the server hasn't recorded the revocation.

import "server-only";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE_NAME, CSRF_COOKIE, EMAIL_COOKIE, REFRESH_COOKIE, upstream } from "@/lib/server/upstream";

export const runtime = "nodejs";

const EXPIRE = "Path=/; HttpOnly; SameSite=Lax; Max-Age=0";

export async function POST() {
  const c = await cookies();
  const jwt = c.get(COOKIE_NAME)?.value;
  const refresh = c.get(REFRESH_COOKIE)?.value;
  if (jwt) {
    try {
      // v1.2.4 — forward the refresh token so the server revokes it too.
      // Body is optional upstream; empty object works for pre-v1.2.4 clients.
      await fetch(upstream("/auth/logout"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${jwt}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(refresh ? { refresh_token: refresh } : {}),
      });
    } catch {
      // Upstream unreachable — continue to cookie clear. The browser
      // forgets the token; the server-side revocation gap is accepted.
    }
  }
  const res = NextResponse.json({ ok: true });
  res.headers.append("Set-Cookie", `${COOKIE_NAME}=; ${EXPIRE}`);
  res.headers.append("Set-Cookie", `${EMAIL_COOKIE}=; ${EXPIRE}`);
  res.headers.append("Set-Cookie", `${REFRESH_COOKIE}=; ${EXPIRE}`);
  // CSRF cookie is not HttpOnly — the expire variant mirrors csrfCookieFlags.
  res.headers.append("Set-Cookie", `${CSRF_COOKIE}=; Path=/; SameSite=Lax; Max-Age=0`);
  return res;
}
