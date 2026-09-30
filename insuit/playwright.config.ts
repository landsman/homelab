import { defineConfig, devices } from "@playwright/test";

const PORT = 8788;
// `make e2e-head` sets this so a watched run moves at human speed; 0 otherwise.
const SLOW_MO = Number(process.env.SLOW_MO) || 0;

// Chromium only: the pages are plain markup and the two <dialog>s, and a
// three-browser matrix would triple CI time to cover them.
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [[process.env.CI ? "github" : "list"], ["./tests/e2e/reporter.ts"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
    launchOptions: { slowMo: SLOW_MO },
  },
  projects: [
    {
      name: "chromium",
      // Roomier than the 1280x720 default, so a watched run shows a whole page.
      use: { ...devices["Desktop Chrome"], viewport: { width: 1600, height: 1000 } },
    },
  ],
  // The built site, served the way Pages serves it — not the dev server: what
  // is under test is the prerendered HTML, its flat URLs and its 404.
  webServer: {
    command: "npm run build && npm run preview",
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
