import { defineConfig, devices } from "@playwright/test";

/**
 * Flows against a `local` build and the local Supabase stack seeded by backend B0 (`npm run e2e:local`).
 * Needs a build made with NEXT_PUBLIC_DATA_MODE=local, NEXT_PUBLIC_SUPABASE_URL / _KEY of the local stack and
 * CLIENT_DEV_PASSWORD (the seed's password) in the environment. Nothing here can reach a hosted project: the
 * build refuses Supabase URLs that are not https or localhost, and the seed accounts exist only locally.
 */
const PORT = 3100;
const external = process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: "tests/e2e-local",
  // The flows share three seeded accounts; one at a time keeps their sessions apart.
  workers: 1,
  forbidOnly: !!process.env.CI,
  reporter: "list",
  use: { baseURL: external ?? `http://localhost:${PORT}`, trace: "retain-on-failure", locale: "pt-AO" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: external
    ? undefined
    : { command: `npm run start -- --port ${PORT}`, url: `http://localhost:${PORT}`, reuseExistingServer: true },
});
