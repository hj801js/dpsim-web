// Server-only helper: resolves the dpsim-api base URL and builds URLs.
// Keeping it in lib/server/ signals (and `import "server-only"` enforces)
// that this file must never land in a client bundle.
import "server-only";

const DPSIM_API = process.env.DPSIM_API_URL ?? "http://localhost:8000";

export function upstream(path: string): string {
  return `${DPSIM_API.replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

// 24h JWT TTL (mirrors dpsim-api auth::issue_token's ttl_hours=24).
export const COOKIE_MAX_AGE = 24 * 60 * 60;
export const COOKIE_NAME = "dpsim.jwt";
export const EMAIL_COOKIE = "dpsim.email";

// CSRF double-submit cookie (session 28 hardening). Readable by browser JS,
// NOT HttpOnly — by design: the client has to read it and echo it back in a
// header on state-changing requests. Comparison happens in the
// /api/dpsim/[...path] proxy route.
export const CSRF_COOKIE = "dpsim.csrf";
export const CSRF_HEADER = "x-csrf-token";

export function cookieFlags(): string {
  const secure = process.env.NODE_ENV === "production" ? "Secure; " : "";
  return `Path=/; HttpOnly; SameSite=Lax; ${secure}Max-Age=${COOKIE_MAX_AGE}`;
}

// Non-HttpOnly variant used for the CSRF marker.
export function csrfCookieFlags(): string {
  const secure = process.env.NODE_ENV === "production" ? "Secure; " : "";
  return `Path=/; SameSite=Lax; ${secure}Max-Age=${COOKIE_MAX_AGE}`;
}

/** Cryptographically random 32-byte hex string for the CSRF token. */
export function newCsrfToken(): string {
  // Node ≥ 20 has the Web Crypto API globally; fall back to
  // require("crypto").randomBytes via node:crypto for earlier setups.
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
