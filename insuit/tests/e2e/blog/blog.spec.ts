import { AxeBuilder } from "@axe-core/playwright";
import { test, expect } from "../fixture";
import { expectCleanTakeover, waitForApp } from "../takeover";
import { ROUTES } from "@/app/routes";

// The blog is being prepared: no menu links to it yet. Search engines find it
// through its sitemap (common/sitemap.spec.ts).

// hello.mdx stays for these tests. It is hidden: in no list and no sitemap,
// found by its address only.
const HELLO = `${ROUTES.blog}/hello`;

test("no page links to the blog yet", async ({ page }) => {
  await page.goto(ROUTES.home);
  await expect(page.locator(`a[href^="${ROUTES.blog}"]`)).toHaveCount(0);
});

test("the blog's styles load on its pages, not on the rest", async ({ page }) => {
  const blogStyles = page.locator('link[rel="stylesheet"][href*="/blog-"]');
  await page.goto(ROUTES.home);
  await expect(blogStyles).toHaveCount(0);
  await page.goto(ROUTES.blog);
  await expect(blogStyles).toHaveCount(1);
  await page.goto(`${ROUTES.blog}/hello`);
  await expect(blogStyles).toHaveCount(1);
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("a hidden post is a page of its own, its text in the file", async ({ page }) => {
    await page.goto(HELLO);
    await expect(page).toHaveTitle("Hello — Michal Landsman");
    await expect(page.getByRole("heading", { level: 1, name: "Hello" })).toBeVisible();
    // The body is a chunk of its own; the build still writes it into the file.
    await expect(page.getByText("The blog starts here.")).toBeVisible();
    await expect(page.locator('meta[property="og:type"]')).toHaveAttribute("content", "article");
    // Read in its own language, which its head names too.
    await expect(page.getByRole("article")).toHaveAttribute("lang", "en");
    await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute("content", "en_US");
    await expect(page.locator('meta[property="article:published_time"]')).toHaveAttribute(
      "content",
      "2026-10-06",
    );
    // Hidden from search results as well as from the list.
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      "noindex, nofollow",
    );
  });

  test("a post that does not exist is a 404", async ({ page }) => {
    const response = await page.goto(`${ROUTES.blog}/no-such-post`);
    expect(response?.status()).toBe(404);
  });
});

test("React takes a post over without an error, and back to the list", async ({ page }) => {
  await expectCleanTakeover(page, HELLO);

  await page.getByRole("link", { name: "All posts" }).click();
  await expect(page.getByRole("heading", { name: "Posts" })).toBeVisible();
});

test("the list shows the posts, but not a hidden one", async ({ page }) => {
  await page.goto(ROUTES.blog);
  await expect(page.getByRole("heading", { level: 1, name: "Posts" })).toBeVisible();
  await expect(page.getByRole("main").getByRole("link", { name: "Hello" })).toHaveCount(0);
});

test("with ?qa=true the list shows the hidden posts too, marked", async ({ page }) => {
  await expectCleanTakeover(page, `${ROUTES.blog}?qa=true`);
  const hello = page.getByRole("main").getByRole("listitem").filter({ hasText: "Hello" });
  await expect(hello.getByRole("link", { name: "Hello" })).toHaveAttribute("href", HELLO);
  await expect(hello.locator("time")).toHaveAttribute("datetime", "2026-10-06");
  await expect(hello).toContainText("hidden");

  await hello.getByRole("link", { name: "Hello" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Hello" })).toBeVisible();
});

test("Hello opens by its address, its body loaded in the browser", async ({ page }) => {
  await page.goto(ROUTES.blog);
  // So the next address is a navigation in the app, which loads the post's own
  // chunk, rather than a page load that brings it in the file.
  await waitForApp(page);
  await page.evaluate((path) => {
    history.pushState({}, "", path);
    dispatchEvent(new PopStateEvent("popstate"));
  }, HELLO);

  await expect(page).toHaveTitle("Hello — Michal Landsman");
  await expect(page.getByRole("heading", { level: 1, name: "Hello" })).toBeVisible();
  await expect(page.getByText("The blog starts here.")).toBeVisible();
});

test("the video in Hello plays on a click, and loads nothing before it", async ({ page }) => {
  // Never the network: what the click starts is the player, at its address.
  const youtube: string[] = [];
  await page.route(/youtube/, (route) => {
    youtube.push(route.request().url());
    return route.abort();
  });
  await page.goto(HELLO);
  await waitForApp(page);

  const play = page.getByRole("button", {
    name: "Play the video: Rick Astley — Never Gonna Give You Up",
  });
  await expect(play).toBeVisible();
  await expect(page.locator("iframe")).toHaveCount(0);
  expect(youtube).toEqual([]);

  await play.click();
  const player = page.getByTitle("Play the video: Rick Astley — Never Gonna Give You Up");
  await expect(player).toHaveAttribute(
    "src",
    "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1",
  );
  // Asked to play straight away, and allowed to.
  await expect(player).toHaveAttribute("allow", /autoplay/);
  await expect.poll(() => youtube[0]).toContain("youtube-nocookie.com/embed/dQw4w9WgXcQ");
});

test("a post, its video included, has no accessibility violations", async ({ page }) => {
  await page.goto(HELLO);
  await waitForApp(page);
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
    .analyze();
  expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});
