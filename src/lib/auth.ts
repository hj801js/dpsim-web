// Client-side auth helpers — localStorage-backed JWT + fetch interceptor.
//
// The dpsim-api is opt-in auth (DPSIM_AUTH_REQUIRED env). When the flag is
// off, every request works without a token, so these helpers are silent
// until the user actually logs in.

const TOKEN_KEY = "dpsim.jwt";
const EMAIL_KEY = "dpsim.email";

export interface AuthSession {
  token: string;
  email: string;
}

export function getSession(): AuthSession | null {
  if (typeof window === "undefined") return null;
  const token = window.localStorage.getItem(TOKEN_KEY);
  const email = window.localStorage.getItem(EMAIL_KEY);
  if (!token || !email) return null;
  return { token, email };
}

export function saveSession(s: AuthSession): void {
  window.localStorage.setItem(TOKEN_KEY, s.token);
  window.localStorage.setItem(EMAIL_KEY, s.email);
  window.dispatchEvent(new CustomEvent("dpsim-auth-changed"));
}

export function clearSession(): void {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(EMAIL_KEY);
  window.dispatchEvent(new CustomEvent("dpsim-auth-changed"));
}

export function authHeader(): Record<string, string> {
  const s = getSession();
  return s ? { Authorization: `Bearer ${s.token}` } : {};
}

export interface Credentials {
  email: string;
  password: string;
}

async function postAuth(path: "/signup" | "/login", creds: Credentials) {
  const res = await fetch(`/api/dpsim/auth${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(creds),
  });
  if (!res.ok) {
    throw new Error(`auth${path} ${res.status}: ${await res.text().catch(() => "")}`);
  }
  return (await res.json()) as AuthSession;
}

export const authApi = {
  login:  (c: Credentials) => postAuth("/login",  c),
  signup: (c: Credentials) => postAuth("/signup", c),
};
