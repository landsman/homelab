import type { Page } from "@playwright/test";
import { expect } from "./fixture";

/**
 * Loads a page and waits for React to take it over, failing on anything the
 * browser console reports as an error on the way — which is where React says
 * that what it rendered differs from the HTML it was given.
 */
export async function expectCleanTakeover(page: Page, path: string) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  const response = await page.goto(path);
  // The toggle only shows once the app runs, so it marks the takeover.
  await expect(page.getByRole("button", { name: /Switch to (dark|light) theme/ })).toBeVisible();

  // The one expected line: the browser's own report of a 404 response.
  const unexpected = errors.filter((text) => !(response?.status() === 404 && text.includes("404")));
  expect(unexpected).toEqual([]);
}

/** Every page, and an address that is none. */
export const TAKEOVER_PATHS = ["/", "/contact", "/cv", "/no-such-page"];
