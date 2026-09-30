import { defineConfig, devices } from "@playwright/test";

const PORT = 8788;
const DEV_PORT = 4321;
// `make e2e-head` sets this so a watched run moves at human speed; 0 otherwise.
const SLOW_MO = Number(process.env.SLOW_MO) || 0;

// Roomier than the 1280x720 default, so a watched run shows a whole page.
const browser = { ...devices["Desktop Chrome"], viewport: { width: 1600, height: 1000 } };

// Chromium only: the pages are plain markup and the two <dialog>s, and a
// three-browser matrix would triple CI time to cover them.
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [[process.env.CI ? "github" : "list"], ["./tests/e2e/reporter.ts"]],
  use: {
    trace: "on-first-retry",
    launchOptions: { slowMo: SLOW_MO },
  },
  projects: [
    // The built site, served by the rules Pages serves it by (scripts/preview.ts):
    // what is under test is the prerendered HTML, its flat URLs and its 404.
    {
      name: "chromium",
      testIgnore: "dev/**",
      use: { ...browser, baseURL: `http://localhost:${PORT}` },
    },
    // The dev server, for the one thing only React's development build
    // reports (tests/e2e/dev/).
    {
      name: "dev",
      testMatch: "dev/**",
      use: { ...browser, baseURL: `http://localhost:${DEV_PORT}` },
    },
  ],
  webServer: [
    {
      command: "bun run build && bun run preview",
      url: `http://localhost:${PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: "bun run dev",
      url: `http://localhost:${DEV_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
