import { NextRequest, NextResponse } from "next/server";

// Content-Security-Policy.
//
// style-src allows 'unsafe-inline' because @xyflow/react (v12) ships
// component styles inline at render time. Hash-based CSP is impractical
// here since the set of inline styles is not known at build time.
//
// script-src uses a per-request nonce in production so we stay off
// 'unsafe-inline'. In dev, Next injects inline HMR helpers that require
// 'unsafe-eval' and 'unsafe-inline'; we relax the policy accordingly.
//
// connect-src is restricted to the app's own origin — the Next route
// handler at /api/dpsim/[...path] already proxies to dpsim-api, so the
// browser never reaches backend services directly.
//
// CSP violations are reported to /api/csp-report where dpsim-web
// increments a Prometheus counter (csp_violations_total).
function buildCsp(nonce: string, isDev: boolean): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": isDev
      ? ["'self'", "'unsafe-inline'", "'unsafe-eval'"]
      : ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:"],
    "font-src": ["'self'", "data:"],
    "connect-src": ["'self'"],
    "frame-ancestors": ["'none'"],
    "form-action": ["'self'"],
    "base-uri": ["'self'"],
    "object-src": ["'none'"],
    "report-uri": ["/api/csp-report"],
    "report-to": ["csp-endpoint"],
  };
  return Object.entries(directives)
    .map(([k, v]) => `${k} ${v.join(" ")}`)
    .join("; ");
}

export function middleware(req: NextRequest) {
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const isDev = process.env.NODE_ENV !== "production";
  const csp = buildCsp(nonce, isDev);

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-csp-nonce", nonce);

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("Content-Security-Policy", csp);
  res.headers.set("x-csp-nonce", nonce);
  res.headers.set(
    "Report-To",
    JSON.stringify({
      group: "csp-endpoint",
      max_age: 10886400,
      endpoints: [{ url: "/api/csp-report" }],
    }),
  );
  return res;
}

export const config = {
  // Skip CSP on static assets and the csp-report endpoint itself — the
  // browser never parses those as HTML and setting CSP on the report
  // endpoint would block its own ingest.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/csp-report).*)",
  ],
};
