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

export function cookieFlags(): string {
  const secure = process.env.NODE_ENV === "production" ? "Secure; " : "";
  return `Path=/; HttpOnly; SameSite=Lax; ${secure}Max-Age=${COOKIE_MAX_AGE}`;
}
