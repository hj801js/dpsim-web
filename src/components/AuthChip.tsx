"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { authApi, fetchSession, onAuthChanged, type AuthSession } from "@/lib/auth";

export function AuthChip() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function sync() {
      const s = await fetchSession();
      if (!cancelled) {
        setSession(s);
        setLoading(false);
      }
    }
    sync();
    const off = onAuthChanged(sync);
    return () => {
      cancelled = true;
      off();
    };
  }, []);

  if (loading) {
    return <span className="text-xs text-slate-400">…</span>;
  }

  if (!session) {
    return (
      <Link href="/login" className="btn-primary btn-sm">
        Sign in
      </Link>
    );
  }

  return (
    <span className="ml-2 flex items-center gap-2 border-l border-slate-200 pl-3 dark:border-slate-800">
      {/* Show a clipped email so long domain tails don't blow the header. */}
      <span
        className="hidden max-w-[180px] truncate font-mono text-xs text-slate-500 dark:text-slate-400 sm:inline"
        title={session.email}
      >
        {session.email}
      </span>
      <button
        type="button"
        onClick={() => authApi.logout()}
        className="btn-secondary btn-sm"
      >
        Sign out
      </button>
    </span>
  );
}
