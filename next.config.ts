import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // E2E builds go to a separate directory so they don't overwrite the regular build.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
};

export default nextConfig;
