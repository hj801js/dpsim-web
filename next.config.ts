import type { NextConfig } from "next";

// /api/dpsim/:path* is proxied by a Next route handler
// (src/app/api/dpsim/[...path]/route.ts) rather than a rewrite, because
// the handler needs to inject Authorization from the httpOnly cookie.
// See docs/43 #2.
const nextConfig: NextConfig = {
  // `standalone` emits .next/standalone with only the runtime + node_modules
  // the compiled app actually needs — keeps the production docker image small
  // (≈200 MB vs 800 MB for the full workspace copy).
  output: "standalone",
  // Fail the build on type errors instead of skipping them.
  typescript: { ignoreBuildErrors: false },
  eslint: { ignoreDuringBuilds: false },
};

export default nextConfig;
