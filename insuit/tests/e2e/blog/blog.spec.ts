import { test, expect } from "../fixture";
import { expectCleanTakeover } from "../takeover";
import { ROUTES } from "@/app/routes";

// The blog is being prepared: no menu links to it yet. Search engines find it
// through its sitemap (common/sitemap.spec.ts).

test("no page links to the blog yet", async ({ page }) => {
  await page.goto(ROUTES.home);
  await expect(page.locator(`a[href^="${ROUTES.blog}"]`)).toHaveCount(0);
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the list leads to a post, whose text is in the file", async ({ page }) => {
    await page.goto(ROUTES.blog);
    await expect(page).toHaveTitle("Posts — Michal Landsman");

    const first = page.getByRole("main").getByRole("listitem").first().getByRole("link");
    const title = await first.textContent();
    await first.click();

    await expect(page).toHaveURL(new RegExp(`^[^#]*${ROUTES.blog}/[a-z0-9-]+$`));
    await expect(page.getByRole("heading", { level: 1, name: title ?? "" })).toBeVisible();
    await expect(page).toHaveTitle(`${title} — Michal Landsman`);
    // The body is a chunk of its own; the build still writes it into the file.
    await expect(page.getByRole("article").locator(".content > *").first()).toBeVisible();
    await expect(page.locator('meta[property="og:type"]')).toHaveAttribute("content", "article");
  });

  test("a post that does not exist is a 404", async ({ page }) => {
    const response = await page.goto(`${ROUTES.blog}/no-such-post`);
    expect(response?.status()).toBe(404);
  });
});

test("React takes a post over without an error, and back to the list", async ({ page }) => {
  await page.goto(ROUTES.blog);
  const href = await page.getByRole("main").getByRole("link").first().getAttribute("href");
  await expectCleanTakeover(page, href ?? "");

  await page.getByRole("link", { name: "All posts" }).click();
  await expect(page.getByRole("heading", { name: "Posts" })).toBeVisible();
});
