import { defineConfig, devices } from "@playwright/test";

/**
 * Two suites:
 *  - e2e/public.spec.ts   runs anywhere (works in preview mode without credentials)
 *  - e2e/journeys.spec.ts the six critical journeys; needs a Supabase project
 *                         (local `supabase start` or a test project) + Razorpay TEST keys.
 *                         Enabled with E2E_FULL=1. See README → Testing.
 */
const port = Number(process.env.E2E_PORT ?? 3100);
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? `http://localhost:${port}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: executablePath ? { executablePath } : undefined,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /public\.spec\.ts/ },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: `npx next start -p ${port}`, port, reuseExistingServer: true, timeout: 120_000 },
});
