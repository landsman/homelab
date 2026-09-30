import { After, AfterAll, Before, BeforeAll } from "@cucumber/cucumber";
import { chromium, type Browser } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { AppWorld, BASE_URL } from "./world.ts";

let browser: Browser;
let server: ChildProcess | undefined;

async function isUp(): Promise<boolean> {
  try {
    await fetch(BASE_URL);
    return true;
  } catch {
    return false;
  }
}

// Playwright starts the site through its own `webServer`; Cucumber has no such
// thing, so the same job is done here — reuse a running `make preview`, else
// build the site and serve it.
async function startApp(): Promise<void> {
  if (await isUp()) return;

  server = spawn("npm run build && npm run preview", {
    shell: true,
    stdio: "ignore",
    // Its own process group, so stopping it takes the server down with the shell.
    detached: true,
  });
  for (let attempt = 0; attempt < 120; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    if (await isUp()) return;
  }
  throw new Error(`the preview never answered on ${BASE_URL}`);
}

BeforeAll(async function () {
  await startApp();
  browser = await chromium.launch({
    headless: !process.env.HEADED,
    slowMo: Number(process.env.SLOW_MO) || 0,
  });
});

Before(async function (this: AppWorld) {
  this.context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  this.page = await this.context.newPage();
});

After(async function (this: AppWorld) {
  await this.context?.close();
});

AfterAll(async function () {
  await browser?.close();
  if (server?.pid) process.kill(-server.pid);
});
