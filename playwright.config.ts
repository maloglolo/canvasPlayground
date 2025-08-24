import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  retries: 0,
  reporter: [["list"]],
  use: {
    headless: true,
    viewport: { width: 1000, height: 700 },
    deviceScaleFactor: 1,
    ignoreHTTPSErrors: true,
    actionTimeout: 15_000,
    navigationTimeout: 15_000,
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
  },

  webServer: {
    command: "npx sirv-cli . --single --dev --port 5173",
    port: 5173,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
