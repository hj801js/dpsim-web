// Client-side auth helpers — httpOnly-cookie backed.
//
// The JWT lives in an httpOnly cookie set by /api/auth/login; no browser
// JavaScript ever sees it. The client only remembers the user's email
// label for UI purposes, and learns it by calling /api/auth/me. That makes
// XSS token theft a non-issue (docs/43 #2 fix).

export interface AuthSession {
  email: string;
}

// Browser-side "auth changed" notification so the AuthChip in the layout
// header re-renders after login/logout without a full page navigation.
const EVENT = "dpsim-auth-changed";
export function emitAuthChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(EVENT));
  }
}
export function onAuthChanged(fn: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT, fn);
  return () => window.removeEventListener(EVENT, fn);
}

/** Fetch the current session from /api/auth/me. Returns null when the
 *  cookie is missing or the token has expired upstream. */
export async function fetchSession(): Promise<AuthSession | null> {
  try {
    const res = await fetch("/api/auth/me", { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { email: string | null };
    return data.email ? { email: data.email } : null;
  } catch {
    return null;
  }
}

export interface Credentials {
  email: string;
  password: string;
}

async function postAuth(path: "/login" | "/signup", creds: Credentials): Promise<AuthSession> {
  const res = await fetch(`/api/auth${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(creds),
  });
  if (!res.ok) {
    throw new Error(`auth${path} ${res.status}: ${await res.text().catch(() => "")}`);
  }
  const data = (await res.json()) as { email: string };
  emitAuthChanged();
  return { email: data.email };
}

export const authApi = {
  login:  (c: Credentials) => postAuth("/login",  c),
  signup: (c: Credentials) => postAuth("/signup", c),
  async logout(): Promise<void> {
    await fetch("/api/auth/logout", { method: "POST" });
    emitAuthChanged();
  },
};
