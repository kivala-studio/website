import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
// Set to test a server that is already running (another machine, a container, a preview).
const external = process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: external ?? `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    // Other engines run the formatter table only (W1 exit criterion).
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
      grep: /@engines/,
    },
    { name: "webkit", use: { ...devices["Desktop Safari"] }, grep: /@engines/ },
  ],
  webServer: external
    ? undefined
    : {
        command: `npm run start -- --port ${PORT}`,
        url: `http://localhost:${PORT}`,
        reuseExistingServer: !process.env.CI,
        env: {
          NEXT_PUBLIC_DATA_MODE: "demo",
          SITE_URL: `http://localhost:${PORT}`,
        },
      },
});
