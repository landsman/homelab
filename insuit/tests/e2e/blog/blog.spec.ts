import { AxeBuilder } from "@axe-core/playwright";
import { test, expect } from "../fixture";
import { expectCleanTakeover, waitForApp } from "../takeover";
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

// hello.mdx holds one, the post that shows a component works in MDX.
const WITH_VIDEO = `${ROUTES.blog}/hello`;

test("a video in a post loads nothing from YouTube until it is played", async ({ page }) => {
  // Never the network: the player's address is what counts.
  await page.route(/youtube/, (route) => route.abort());
  await page.goto(WITH_VIDEO);
  await waitForApp(page);

  const play = page.getByRole("button", { name: /^Play the video: / });
  await expect(play).toBeVisible();
  await expect(page.locator("iframe")).toHaveCount(0);

  await play.click();
  await expect(page.locator("iframe")).toHaveAttribute(
    "src",
    /^https:\/\/www\.youtube-nocookie\.com\/embed\/[\w-]+\?autoplay=1$/,
  );
});

test("a post, its video included, has no accessibility violations", async ({ page }) => {
  await page.goto(WITH_VIDEO);
  await waitForApp(page);
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
    .analyze();
  expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});
