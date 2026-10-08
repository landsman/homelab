import { defineConfig } from "@playwright/test";

// Smoke tests: what a deployed site answers, asked over HTTP. Unlike tests/e2e
// they reach the network on purpose and start no server, so they have their own
// config and `make e2e` never runs them. No browser either: every spec uses
// Playwright's `request`, which is plain HTTP.
//
//   SMOKE_URL    the site to ask, www.insuit.cz by default (a PR's preview in CI)
//   SMOKE_COMMIT wait until the site says it is this commit before asking it
//
// One project per thing asked, so a caller picks what applies to it: a PR's
// preview has no short links, and a deploy does not fail on someone else's site.
const site = process.env.SMOKE_URL?.replace(/\/$/, "") ?? "https://www.insuit.cz";

export default defineConfig({
  testDir: "./tests/smoke",
  globalSetup: "./tests/smoke/wait-for-commit.ts",
  fullyParallel: true,
  // Plain requests, mostly waiting on the other end.
  workers: 8,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  projects: [
    { name: "site", testMatch: "site.spec.ts", use: { baseURL: site } },
    { name: "links", testMatch: "links.spec.ts", use: { baseURL: "https://link.insuit.cz" } },
    { name: "targets", testMatch: "targets.spec.ts" },
  ],
});
