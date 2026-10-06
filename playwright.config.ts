import { defineConfig, devices } from "@playwright/test";
import { E2E_BASE_URL, E2E_MONGODB_URI, E2E_PORT } from "./tests/e2e/env";

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
  webServer: {
    command: `npm run build && npm run start -- --port ${E2E_PORT}`,
    url: E2E_BASE_URL,
    reuseExistingServer: false,
    timeout: 180_000,
    // Values from the process environment take precedence over .env.local.
    env: {
      MONGODB_URI: E2E_MONGODB_URI,
      AUTH_SECRET: "e2e-auth-secret-not-for-production",
      AUTH_TRUST_HOST: "true",
      NEXT_DIST_DIR: ".next-e2e",
    },
  },
});
