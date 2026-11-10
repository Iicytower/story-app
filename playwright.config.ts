import { defineConfig, devices } from "@playwright/test";
import {
  E2E_BASE_URL,
  E2E_IP_HEADER,
  E2E_MONGODB_URI,
  E2E_PORT,
  E2E_TOOLS_PORT,
  E2E_TOOLS_SECRET,
} from "./tests/e2e/env";

export default defineConfig({
  testDir: "tests/e2e",
  // All workers would share one database, and tests clear the stories collection.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  reporter: "list",
  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  use: {
    baseURL: E2E_BASE_URL,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /.*\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },
  ],
  webServer: [
    {
      command: `node tests/e2e/fake-tools.mjs ${E2E_TOOLS_PORT} ${E2E_TOOLS_SECRET}`,
      url: `http://127.0.0.1:${E2E_TOOLS_PORT}`,
      reuseExistingServer: false,
    },
    {
      command: `npm run build && npm run start -- --port ${E2E_PORT}`,
      url: E2E_BASE_URL,
      reuseExistingServer: false,
      timeout: 180_000,
      // Values from the process environment take precedence over .env.local.
      env: {
        MONGODB_URI: E2E_MONGODB_URI,
        AUTH_SECRET: "e2e-auth-secret-not-for-production",
        NEXT_DIST_DIR: ".next-e2e",
        // Never the tools server from .env.local (npm run up).
        TOOLS_API_URL: `http://127.0.0.1:${E2E_TOOLS_PORT}`,
        TOOLS_API_SECRET: E2E_TOOLS_SECRET,
        // Stands in for Vercel's header (D74): only tests that send it get limits per address.
        TRUSTED_IP_HEADER: E2E_IP_HEADER,
      },
    },
  ],
});
