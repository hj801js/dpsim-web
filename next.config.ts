import type { NextConfig } from "next";

// Proxy all /api/dpsim/* calls to the Rust dpsim-api backend.
// This avoids CORS setup on the backend during development and production
// (behind the same Next.js server / reverse proxy).
const nextConfig: NextConfig = {
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
