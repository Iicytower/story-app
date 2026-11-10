import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { SECURITY_HEADERS } from "./lib/security-headers";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  // E2E builds go to a separate directory so they don't overwrite the regular build.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // Without it the dev server refuses the LAN and ngrok: the page renders but never hydrates.
  allowedDevOrigins: ["192.168.1.*", "*.ngrok-free.app", "*.ngrok-free.dev"],
  experimental: {
    // Imported text is sent as one request (D34); Vercel caps a request at 4.5 MB.
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default createNextIntlPlugin()(nextConfig);
