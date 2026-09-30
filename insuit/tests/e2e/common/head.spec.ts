import { test, expect } from "../fixture";
import { SITE_URL } from "@/app/site";
import { ROUTES } from "@/app/routes";

const PAGES = [ROUTES.home, ROUTES.contact, ROUTES.cv];

test.describe("in the file, without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  // What a search engine or a link preview reads. A page that sets no head of
  // its own silently gets the home page's, which is what this catches.
  test("every page describes itself, not another page", async ({ page }) => {
    const titles: string[] = [];
    const descriptions: string[] = [];

    for (const path of PAGES) {
      await page.goto(path);
      const content = (selector: string) => page.locator(selector).getAttribute("content");

      const title = await page.title();
      expect(title, path).not.toBe("");
      expect(await page.locator("title").count(), path).toBe(1);
      expect(await content('meta[property="og:title"]'), path).toBe(title);
      expect(await content('meta[name="twitter:title"]'), path).toBe(title);

      const description = await content('meta[name="description"]');
      expect(description, path).toBeTruthy();
      expect(await content('meta[property="og:description"]'), path).toBe(description);

      expect(await content('meta[property="og:url"]'), path).toBe(SITE_URL + path);

      titles.push(title);
      descriptions.push(description ?? "");
    }

    expect(new Set(titles).size).toBe(PAGES.length);
    expect(new Set(descriptions).size).toBe(PAGES.length);
  });
});

// The title is one element React keeps up to date; anything that writes to it
// behind React's back stays on the next page. Back and forward included, since
// they skip the links.
test("the tab's title follows every navigation", async ({ page }) => {
  const titles = {
    home: "Michal Landsman",
    contact: "Let's talk — Michal Landsman",
    cv: "Curriculum Vitae - Michal Landsman",
    notFound: "Page not found — Michal Landsman",
  };

  await page.goto(ROUTES.home);
  // Once the app runs, so the links below are navigations, not page loads.
  await expect(page.getByRole("button", { name: /Switch to (dark|light) theme/ })).toBeVisible();
  await expect(page).toHaveTitle(titles.home);

  await page.getByRole("link", { name: "Let's talk" }).click();
  await expect(page).toHaveTitle(titles.contact);

  await page.getByRole("link", { name: "← Back" }).click();
  await expect(page).toHaveTitle(titles.home);

  await page.getByRole("link", { name: "Curriculum vitae" }).click();
  await expect(page).toHaveTitle(titles.cv);

  await page.goBack();
  await expect(page).toHaveTitle(titles.home);
  await page.goBack();
  await expect(page).toHaveTitle(titles.contact);
  await page.goForward();
  await expect(page).toHaveTitle(titles.home);

  // Out through an address that is no page, and back in by its link.
  await page.goto("/no-such-page");
  await expect(page.getByRole("button", { name: /Switch to (dark|light) theme/ })).toBeVisible();
  await expect(page).toHaveTitle(titles.notFound);
  await page.getByRole("link", { name: "Go to the homepage" }).click();
  await expect(page.getByRole("heading", { name: "Hello there!" })).toBeVisible();
  await expect(page).toHaveTitle(titles.home);
});
