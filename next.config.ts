import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // E2E builds go to a separate directory so they don't overwrite the regular build.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // Without it the dev server refuses other devices on the LAN: the page renders but never hydrates.
  allowedDevOrigins: ["192.168.1.*"],
  experimental: {
    // Imported text is sent as one request (D34); Vercel caps a request at 4.5 MB.
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;
