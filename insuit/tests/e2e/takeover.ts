import type { Page } from "@playwright/test";
import { ROUTES } from "@/app/routes";
import { expect } from "./fixture";

/** Every page of the site: a new entry in ROUTES is tested without being listed again. */
export const PAGES = Object.values(ROUTES).filter((path) => path !== ROUTES.notFound);

/**
 * Waits until React has taken the page over. Before that a link is a plain
 * page load and nothing reacts to a click; the theme toggle only shows once
 * the app runs, so it marks the moment.
 */
export async function waitForApp(page: Page) {
  await expect(page.getByRole("button", { name: /Switch to (dark|light) theme/ })).toBeVisible();
}

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
  await waitForApp(page);

  // The one expected line: the browser's own report of a 404 response.
  const unexpected = errors.filter((text) => !(response?.status() === 404 && text.includes("404")));
  expect(unexpected).toEqual([]);
}

/** Every page, and an address that is none. */
export const TAKEOVER_PATHS = [...PAGES, "/no-such-page"];
