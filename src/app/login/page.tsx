"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { authApi, saveSession } from "@/lib/auth";

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
      const session = await fn({ email, password });
      saveSession(session);
      router.replace(next);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h1 className="text-lg font-semibold">
        {mode === "login" ? "Sign in" : "Create account"}
      </h1>

      <form className="space-y-3" onSubmit={onSubmit}>
        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input mt-1"
            autoComplete="email"
          />
        </label>
        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
          Password <span className="text-slate-400">(≥ 8 chars)</span>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input mt-1"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />
        </label>

        {err && (
          <p className="text-xs text-red-600 break-all" role="alert">
            {err}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {busy ? "…" : mode === "login" ? "Sign in" : "Sign up"}
        </button>
      </form>

      <button
        type="button"
        onClick={() => setMode(mode === "login" ? "signup" : "login")}
        className="w-full text-center text-xs text-blue-600 hover:underline"
      >
        {mode === "login"
          ? "Don't have an account? Sign up"
          : "Already have an account? Sign in"}
      </button>

      <p className="text-[10px] text-slate-400">
        Auth is opt-in on the server (DPSIM_AUTH_REQUIRED env). Signup /
        login still works when the flag is off so you can try it end-to-end.
      </p>
    </div>
  );
}
