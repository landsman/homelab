import { defineConfig, devices } from '@playwright/test'

const PORT = 5173
// `make e2e-head` sets this so a watched run moves at human speed; 0 otherwise.
const SLOW_MO = Number(process.env.SLOW_MO) || 0

// Chromium only: the dashboard runs on one browser on one Raspberry Pi — a
// three-browser matrix would triple CI time to cover engines nobody opens it in.
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
    launchOptions: { slowMo: SLOW_MO },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
