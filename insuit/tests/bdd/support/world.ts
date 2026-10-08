import { World, setWorldConstructor, setDefaultTimeout } from "@cucumber/cucumber";
import type { BrowserContext, Page } from "@playwright/test";

setDefaultTimeout(30_000);

export const BASE_URL = process.env.BASE_URL ?? "http://localhost:8788";

/** One browser context per scenario, so nothing leaks between them. */
export class AppWorld extends World {
  context!: BrowserContext;
  page!: Page;
  /** Where the heading started, to compare the next page against. */
  headingTop?: number;
}

setWorldConstructor(AppWorld);
