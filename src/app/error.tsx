"use client";

// App-level error boundary. Next 15 renders this when a route segment
// throws or rejects; without it the user sees Next's default blank page.
// Most failures we've seen in the wild come from dpsim-api being down
// (fetch rejects) or a schema mismatch after a codegen — both are
// recoverable by retrying.

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the error to the console so we can grep it out of browser logs;
    // Next scrubs the message client-side in production unless we do this.
    console.error("dpsim-web error boundary:", error);
  }, [error]);

  return (
    <div className="mx-auto mt-16 max-w-lg space-y-4 rounded-lg border border-red-200 bg-red-50 p-6 text-sm dark:border-red-900 dark:bg-red-950/40">
      <h2 className="text-base font-semibold text-red-700 dark:text-red-300">
        Something went wrong
      </h2>
      <p className="text-slate-700 dark:text-slate-300">
        Most frequent cause: dpsim-api isn&apos;t running. Try{" "}
        <code className="rounded bg-white px-1 py-0.5 text-xs dark:bg-slate-900">
          make up
        </code>{" "}
        from the repo root, then retry.
      </p>
      <pre
        className="max-h-32 overflow-auto rounded bg-white/60 p-2 font-mono text-xs text-slate-800 dark:bg-slate-900/60 dark:text-slate-300"
        data-testid="error-message"
      >
        {error.message}
        {error.digest ? `\n(digest: ${error.digest})` : ""}
      </pre>
      <button
        type="button"
        onClick={reset}
        className="rounded-md bg-red-600 px-4 py-2 text-xs font-medium text-white hover:bg-red-700"
      >
        Retry
      </button>
    </div>
  );
}
