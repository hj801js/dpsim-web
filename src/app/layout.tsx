import type { Metadata } from "next";
import Link from "next/link";
import { QueryProvider } from "@/components/QueryProvider";
import { AuthChip } from "@/components/AuthChip";
import "./globals.css";

export const metadata: Metadata = {
  title: "DPsim Web",
  description: "DPsim simulation console",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <QueryProvider>
          <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4">
            <header className="flex items-center justify-between border-b border-slate-200 py-4 dark:border-slate-800">
              <Link
                href="/"
                className="text-lg font-semibold tracking-tight hover:opacity-80"
              >
                DPsim Web
              </Link>
              <nav className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
                <Link href="/" className="hover:text-slate-900 dark:hover:text-slate-100">
                  Submit
                </Link>
                <a
                  href="http://localhost:8000/swagger/"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-slate-900 dark:hover:text-slate-100"
                >
                  API docs ↗
                </a>
                <AuthChip />
              </nav>
            </header>
            <main className="flex-1 py-8">{children}</main>
            <footer className="border-t border-slate-200 py-4 text-xs text-slate-500 dark:border-slate-800">
              Backend: <code>$DPSIM_API_URL</code> (default http://localhost:8000) — see{" "}
              <code>docs/00_HANDOFF.md</code>
            </footer>
          </div>
        </QueryProvider>
      </body>
    </html>
  );
}
