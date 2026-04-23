"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { authApi } from "@/lib/auth";

type Mode = "login" | "signup";

export default function LoginPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">…</p>}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/";

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const fn = mode === "login" ? authApi.login : authApi.signup;
      await fn({ email, password });
      // Cookie is now set by the BFF route; AuthChip picks it up via
      // /api/auth/me. No client-side session persistence needed.
      router.replace(next);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-6 pt-8">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          {mode === "login" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {mode === "login"
            ? "Sign in to continue to the DPsim console."
            : "Get started in about 15 seconds."}
        </p>
      </div>

      <div className="panel p-6">
        <form className="space-y-4" onSubmit={onSubmit}>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input mt-1.5"
              autoComplete="email"
              placeholder="you@example.com"
            />
          </label>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
            Password <span className="text-slate-400 dark:text-slate-500">· ≥ 8 chars</span>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input mt-1.5"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              placeholder="••••••••"
            />
          </label>

          {err && (
            <p
              className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300"
              role="alert"
            >
              {err}
            </p>
          )}

          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? "…" : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>

        <div className="mt-4 border-t border-slate-200 pt-4 text-center dark:border-slate-800">
          <button
            type="button"
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
            className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            {mode === "login"
              ? "New here? Create an account →"
              : "← Already registered? Sign in"}
          </button>
        </div>
      </div>

      <p className="text-center text-[10px] text-slate-400 dark:text-slate-600">
        Auth is opt-in on the server (<code>DPSIM_AUTH_REQUIRED</code>). Signup
        and login still work when the flag is off.
      </p>
    </div>
  );
}
