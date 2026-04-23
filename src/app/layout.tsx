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
          <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 md:px-6">
            <header className="flex items-center justify-between border-b border-slate-200 py-5 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <Link
                  href="/"
                  className="group flex items-center gap-2 text-base font-semibold tracking-tight text-slate-900 hover:text-blue-700 dark:text-slate-100 dark:hover:text-blue-300"
                  aria-label="DPsim — home"
                >
                  {/* Simple waveform-inspired mark, inlined SVG so no asset fetch */}
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="h-6 w-6 text-blue-600 transition-transform group-hover:scale-110 dark:text-blue-400"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 12 C 6 4, 9 20, 12 12 S 18 4, 21 12" />
                  </svg>
                  <span>DPsim</span>
                </Link>
                <span className="hidden text-xs font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500 sm:inline">
                  Console
                </span>
              </div>
              <nav className="flex items-center gap-1 text-sm">
                <Link
                  href="/"
                  className="btn-ghost btn-sm"
                >
                  Submit
                </Link>
                <a
                  href="http://localhost:8000/swagger/"
                  target="_blank"
                  rel="noreferrer"
                  className="btn-ghost btn-sm"
                >
                  API docs <span aria-hidden>↗</span>
                </a>
                <AuthChip />
              </nav>
            </header>
            <main className="flex-1 py-8">{children}</main>
            <footer className="border-t border-slate-200 py-4 text-xs text-slate-500 dark:border-slate-800">
              DPsim · dual-engine console · <a
                href="https://github.com/hj801js/dpsim-hk"
                target="_blank"
                rel="noreferrer"
                className="hover:text-slate-700 dark:hover:text-slate-300"
              >source</a>
            </footer>
          </div>
        </QueryProvider>
      </body>
    </html>
  );
}
