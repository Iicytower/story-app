import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    environment: "node",
    // next-auth and next-intl import "next/server" without an extension, which plain Node ESM cannot resolve.
    server: { deps: { inline: ["next-auth", "next-intl"] } },
    globalSetup: ["tests/global-setup.ts"],
    include: ["**/*.test.ts", "tests/integration/**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**", "tests/e2e/**"],
  },
});
