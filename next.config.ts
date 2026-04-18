import type { NextConfig } from "next";

// Proxy all /api/dpsim/* calls to the Rust dpsim-api backend.
// This avoids CORS setup on the backend during development and production
// (behind the same Next.js server / reverse proxy).
const nextConfig: NextConfig = {
  // `standalone` emits .next/standalone with only the runtime + node_modules
  // the compiled app actually needs — keeps the production docker image small
  // (≈200 MB vs 800 MB for the full workspace copy).
  output: "standalone",
  async rewrites() {
    const target = process.env.DPSIM_API_URL ?? "http://localhost:8000";
    return [
      {
        source: "/api/dpsim/:path*",
        destination: `${target}/:path*`,
      },
    ];
  },
  // Fail the build on type errors instead of skipping them.
  typescript: { ignoreBuildErrors: false },
  eslint: { ignoreDuringBuilds: false },
};

export default nextConfig;
