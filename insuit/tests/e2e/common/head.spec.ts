import { test, expect } from "../fixture";
import { PAGES, waitForApp } from "../takeover";
import { ROUTES } from "@/app/routes";

test.describe("in the file, without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  // What a search engine or a link preview reads. A page that sets no head of
  // its own silently gets the home page's, which is what this catches.
  test("every page describes itself, not another page", async ({ page }) => {
    const titles: string[] = [];
    const descriptions: string[] = [];
    const commits: string[] = [];

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

      // Its own address, on whatever site this build is for (VITE_SITE_URL) —
      // and the link-preview picture on that same site.
      const address = new URL((await content('meta[property="og:url"]')) ?? "");
      expect(address.pathname, path).toBe(path);
      const picture = new URL((await content('meta[property="og:image"]')) ?? "");
      expect(picture.origin, path).toBe(address.origin);

      commits.push((await content('meta[name="commit"]')) ?? "");
      titles.push(title);
      descriptions.push(description ?? "");
    }

    // Each page names the commit it was built from, and all name the same one.
    expect(new Set(commits).size).toBe(1);
    expect(commits[0]).toMatch(/^[0-9a-f]{40}$/);

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
  // So the links below are navigations, not page loads.
  await waitForApp(page);
  await expect(page).toHaveTitle(titles.home);

  await page.getByRole("link", { name: "Let's talk" }).click();
  await expect(page).toHaveTitle(titles.contact);

  await page.getByRole("link", { name: "Back" }).click();
  await expect(page).toHaveTitle(titles.home);

  await page.getByRole("link", { name: "CV", exact: true }).click();
  await expect(page).toHaveTitle(titles.cv);

  await page.goBack();
  await expect(page).toHaveTitle(titles.home);
  await page.goBack();
  await expect(page).toHaveTitle(titles.contact);
  await page.goForward();
  await expect(page).toHaveTitle(titles.home);

  // Out through an address that is no page, and back in by its link.
  await page.goto("/no-such-page");
  await waitForApp(page);
  await expect(page).toHaveTitle(titles.notFound);
  await page.getByRole("link", { name: "Go to the homepage" }).click();
  await expect(page.getByRole("heading", { name: "Hello there!" })).toBeVisible();
  await expect(page).toHaveTitle(titles.home);
});
