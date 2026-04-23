// BFF: POST /api/auth/refresh
//
// Reads the httpOnly `dpsim.refresh` cookie, forwards it to dpsim-api's
// /auth/refresh, stores the rotated access + refresh tokens in cookies,
// returns 200 {email} or 401 on failure. No body required from the
// browser — the refresh token never leaves the server-side cookie jar.
//
// The client calls this on a 401 from /api/dpsim/* and retries the
// original request once if refresh succeeds.
import "server-only";
import { NextResponse } from "next/server";
import {
  COOKIE_NAME,
  CSRF_COOKIE,
  EMAIL_COOKIE,
  REFRESH_COOKIE,
  cookieFlags,
  csrfCookieFlags,
  newCsrfToken,
  refreshCookieFlags,
  upstream,
} from "@/lib/server/upstream";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const match = cookieHeader.match(
    new RegExp(`(?:^|; )${REFRESH_COOKIE}=([^;]+)`),
  );
  const refresh = match ? decodeURIComponent(match[1]) : "";
  if (!refresh) {
    return NextResponse.json(
      { error: "no refresh cookie" },
      { status: 401 },
    );
  }

  const up = await fetch(upstream("/auth/refresh"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refresh }),
  });

  if (!up.ok) {
    // Upstream 401 = refresh rejected (expired / revoked / rotated).
    // Clear our cookies so the client doesn't retry with the same bad
    // token indefinitely.
    const clear = (name: string) =>
      `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
    const res = NextResponse.json(
      { error: `upstream ${up.status}` },
      { status: up.status },
    );
    res.headers.append("Set-Cookie", clear(COOKIE_NAME));
    res.headers.append("Set-Cookie", clear(REFRESH_COOKIE));
    res.headers.append("Set-Cookie", clear(EMAIL_COOKIE));
    res.headers.append("Set-Cookie", clear(CSRF_COOKIE));
    return res;
  }

  const data = (await up.json()) as {
    token?: string;
    email?: string;
    refresh_token?: string;
  };
  if (!data.token || !data.email) {
    return NextResponse.json(
      { error: "upstream returned no token" },
      { status: 502 },
    );
  }

  const res = NextResponse.json({ email: data.email });
  res.headers.append("Set-Cookie", `${COOKIE_NAME}=${data.token}; ${cookieFlags()}`);
  res.headers.append("Set-Cookie", `${EMAIL_COOKIE}=${data.email}; ${cookieFlags()}`);
  // Rotate the CSRF token too — lines up with a session refresh.
  res.headers.append(
    "Set-Cookie",
    `${CSRF_COOKIE}=${newCsrfToken()}; ${csrfCookieFlags()}`,
  );
  if (data.refresh_token) {
    res.headers.append(
      "Set-Cookie",
      `${REFRESH_COOKIE}=${data.refresh_token}; ${refreshCookieFlags()}`,
    );
  }
  return res;
}
