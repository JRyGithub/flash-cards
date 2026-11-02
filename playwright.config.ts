import { defineConfig, devices } from "@playwright/test"

import { APP_PORT, AUTH_PORT, BASE_URL, DB_PORT } from "./e2e/fixtures"

const appEnv = {
  NEXT_TELEMETRY_DISABLED: "1",
  NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${AUTH_PORT}`,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "e2e-anon-key",
  // PGlite serves one connection at a time.
  DATABASE_URL: `postgres://postgres:postgres@127.0.0.1:${DB_PORT}/postgres?max=1`,
  ADMIN_EMAIL: "owner@example.com",
  CRON_SECRET: "e2e-cron-secret-0123456789",
}

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: BASE_URL, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "tsx e2e/stubs.ts",
      url: `http://127.0.0.1:${AUTH_PORT}/health`,
      reuseExistingServer: false,
    },
    {
      command: `next build && next start -p ${APP_PORT}`,
      url: `${BASE_URL}/login`,
      env: appEnv,
      timeout: 240_000,
      reuseExistingServer: false,
    },
  ],
})
