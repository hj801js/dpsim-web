"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { clearSession, getSession, type AuthSession } from "@/lib/auth";

export function AuthChip() {
  const [session, setSession] = useState<AuthSession | null>(null);

  useEffect(() => {
    setSession(getSession());
    function sync() {
      setSession(getSession());
    }
    window.addEventListener("dpsim-auth-changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("dpsim-auth-changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  if (!session) {
    return (
      <Link
        href="/login"
        className="hover:text-slate-900 dark:hover:text-slate-100"
      >
        Sign in
      </Link>
    );
  }

  return (
    <span className="flex items-center gap-2">
      <span
        className="font-mono text-xs text-slate-500"
        title={session.email}
      >
        {session.email}
      </span>
      <button
        type="button"
        onClick={() => clearSession()}
        className="rounded border border-slate-300 px-2 py-0.5 text-xs hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
      >
        Sign out
      </button>
    </span>
  );
}
