import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    environment: "node",
    hookTimeout: 30_000,
    // Dots and only the console output of failed tests keep runs readable for agents; --reporter=default for detail.
    reporters: ["dot"],
    silent: "passed-only",
    // next-auth and next-intl import "next/server" without an extension, which plain Node ESM cannot resolve.
    server: { deps: { inline: ["next-auth", "next-intl"] } },
    globalSetup: ["tests/global-setup.ts"],
    setupFiles: ["tests/setup/next-intl.ts", "tests/setup/next-server.ts"],
    include: [
      "**/*.test.ts",
      "**/*.test.tsx",
      "tests/integration/**/*.test.ts",
    ],
    exclude: ["node_modules/**", ".next/**", "tests/e2e/**"],
  },
});
