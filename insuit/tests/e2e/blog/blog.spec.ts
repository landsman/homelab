import { AxeBuilder } from "@axe-core/playwright";
import { test, expect } from "../fixture";
import { expectCleanTakeover, waitForApp } from "../takeover";
import { ROUTES } from "@/app/routes";

// The blog is being prepared: no menu links to it yet. Search engines find it
// through its sitemap (common/sitemap.spec.ts).

// hello.mdx stays for these tests. It is hidden: in no list and no sitemap,
// found by its address only.
const HELLO = `${ROUTES.blog}/hello`;

// Never the network. hello.mdx's pictures are remote stock photos: each is
// answered with a tall picture drawn here, so a test still has a picture to lay
// out, the viewer's fit to the screen included. Anything else off this server
// is refused.
const TALL_PICTURE =
  '<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1500"><rect width="100%" height="100%" fill="#888"/></svg>';
test.beforeEach(async ({ page }) => {
  await page.route(
    (url) => url.hostname !== "localhost",
    (route) =>
      new URL(route.request().url()).hostname === "picsum.photos"
        ? route.fulfill({ body: TALL_PICTURE, contentType: "image/svg+xml" })
        : route.abort(),
  );
});

test("no page links to the blog yet", async ({ page }) => {
  await page.goto(ROUTES.home);
  await expect(page.locator(`a[href^="${ROUTES.blog}"]`)).toHaveCount(0);
});

test("the blog's and the CV's styles each load on their own pages only", async ({ page }) => {
  const styles = (name: string) => page.locator(`link[rel="stylesheet"][href*="/${name}-"]`);
  for (const [path, blog, cv] of [
    [ROUTES.home, 0, 0],
    [ROUTES.blog, 1, 0],
    [`${ROUTES.blog}/hello`, 1, 0],
    [ROUTES.cv, 0, 1],
  ] as const) {
    await page.goto(path);
    await expect(styles("blog"), path).toHaveCount(blog);
    await expect(styles("cv"), path).toHaveCount(cv);
  }
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

// Coloured at build time (vite/blog.ts), so the colours are in the page; the
// theme picks which, the OS first and the toggle over it.
test("code is coloured by its language, in the theme the page is in", async ({ page }) => {
  await page.goto(HELLO);
  const keyword = page
    .getByRole("group", { name: "Code" })
    .first()
    .getByText("export", { exact: true });
  const color = () => keyword.evaluate((el) => getComputedStyle(el).color);

  await page.emulateMedia({ colorScheme: "light" });
  const light = await color();
  await page.emulateMedia({ colorScheme: "dark" });
  const dark = await color();
  expect(light).not.toBe(dark);

  await page.evaluate(() => (document.documentElement.dataset.theme = "light"));
  expect(await color()).toBe(light);
  await page.emulateMedia({ colorScheme: "light" });
  await page.evaluate(() => (document.documentElement.dataset.theme = "dark"));
  expect(await color()).toBe(dark);

  // Paper is white whatever the screen is, so it gets the light colours.
  await page.emulateMedia({ media: "print", colorScheme: "dark" });
  expect(await color()).toBe(light);
});

test("a table's rows alternate and light up under the pointer, its header is optional", async ({
  page,
}) => {
  await page.goto(HELLO);
  const [withHead, rowsOnly] = [0, 1].map((i) => page.getByRole("table").nth(i));
  await expect(withHead.getByRole("columnheader")).toHaveCount(3);
  // An empty header row in the markdown is no header at all, not an empty one.
  await expect(rowsOnly.getByRole("columnheader")).toHaveCount(0);
  await expect(rowsOnly.getByRole("row").first()).toContainText("Light theme");

  const rows = rowsOnly.getByRole("row");
  const background = (i: number) =>
    rows.nth(i).evaluate((el) => getComputedStyle(el).backgroundColor);
  const [odd, even] = [await background(0), await background(1)];
  expect(odd).not.toBe(even);
  await rows.nth(0).hover();
  expect(await background(0)).not.toBe(odd);
  expect(await background(0)).not.toBe(even);
});

test("a link in a post opens a new tab and says so, a footnote's mark does not", async ({
  page,
}) => {
  await page.goto(HELLO);
  const out = page.getByRole("link", { name: "link out (opens in a new tab)" });
  await expect(out).toHaveAttribute("target", "_blank");
  await expect(out).toHaveAttribute("rel", "noopener");
  await expect(
    page.getByRole("link", { name: "link within the site (opens in a new tab)" }),
  ).toHaveAttribute("target", "_blank");
  const mark = page.locator("a[data-footnote-ref]");
  await expect(mark).not.toHaveAttribute("target", /./);
  await mark.click();
  await expect(page).toHaveURL(/#user-content-fn-1$/);
});

test("React takes a post over without an error, and back to the list", async ({ page }) => {
  await expectCleanTakeover(page, HELLO);

  // Back is one level up, to the list, not home.
  await page.getByRole("link", { name: "Back", exact: true }).click();
  await expect(page).toHaveURL(ROUTES.blog);
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
  // What the page asks YouTube for; the thumbnail is the site's own file.
  const youtube: string[] = [];
  page.on("request", (request) => {
    if (/youtube|ytimg/.test(new URL(request.url()).hostname)) youtube.push(request.url());
  });
  await page.goto(HELLO);
  await waitForApp(page);

  const play = page.getByRole("button", {
    name: "Play the video: Rick Astley — Never Gonna Give You Up",
  });
  await expect(play).toBeVisible();
  // Its thumbnail, served by the site.
  await expect(play.locator("img")).toHaveJSProperty("complete", true);
  expect(await play.locator("img").evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(
    1280,
  );
  await expect(page.locator("iframe")).toHaveCount(0);
  expect(youtube).toEqual([]);

  await play.click();
  const player = page.getByTitle("Rick Astley — Never Gonna Give You Up");
  await expect(player).toHaveAttribute(
    "src",
    "https://www.youtube-nocookie.com/embed/DLzxrzFCyOs?autoplay=1",
  );
  // Asked to play straight away, and allowed to.
  await expect(player).toHaveAttribute("allow", /autoplay/);
  await expect.poll(() => youtube[0]).toContain("youtube-nocookie.com/embed/DLzxrzFCyOs");
});

test("a gallery in Hello opens a picture full size, and the arrows step through", async ({
  page,
}) => {
  await page.goto(HELLO);
  await waitForApp(page);

  await page.getByRole("button", { name: /A pug wrapped up/ }).click();
  const photo = page.getByRole("dialog", { name: "Photo" });
  await expect(photo).toBeVisible();
  // A caption of its own wins over the alt text.
  await expect(photo.locator("figcaption")).toHaveText(/Ready for autumn/);

  await page.keyboard.press("ArrowRight");
  await expect(photo.locator("figcaption")).toHaveText(/Christian Joudrey/);
  await page.keyboard.press("Escape");
  await expect(photo).toBeHidden();
});

test("a post fits a 320 px screen: a long address wraps, wide parts scroll in place", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto(HELLO);
  // WCAG 1.4.10: nothing pushes the page sideways.
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
});

test("a tall picture in the viewer fits the screen, its close button on it", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(HELLO);
  await waitForApp(page);
  await page.getByRole("button", { name: /A pug wrapped up/ }).click();
  const photo = page.getByRole("dialog", { name: "Photo" });
  await expect(photo).toBeVisible();
  await expect(photo.getByRole("button", { name: "Close" })).toBeInViewport({ ratio: 1 });
  await expect(photo.locator("figcaption")).toBeInViewport();

  // The page behind it does not scroll while it is open.
  const before = await page.evaluate(() => scrollY);
  await page.mouse.wheel(0, 600);
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => scrollY)).toBe(before);
});

test("pressing play hands focus to the player, named by its video", async ({ page }) => {
  await page.goto(HELLO);
  await waitForApp(page);
  await page.getByRole("button", { name: /^Play the video: / }).click();
  const player = page.locator("iframe");
  await expect(player).toBeFocused();
  await expect(player).toHaveAttribute("title", "Rick Astley — Never Gonna Give You Up");
});

test("the video says what a click does, on hover and on keyboard focus", async ({ page }) => {
  await page.goto(HELLO);
  await waitForApp(page);
  const play = page.getByRole("button", { name: /^Play the video: / });
  await expect(play).toHaveAttribute("data-tooltip", "Play video");
  const shown = () => play.evaluate((el) => getComputedStyle(el, "::after").opacity);

  expect(await shown()).toBe("0");
  await play.hover();
  await expect.poll(shown).toBe("1");

  await page.mouse.move(0, 0);
  await expect.poll(shown).toBe("0");
  await play.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect.poll(shown).toBe("1");
});

test("a picture's title is its caption, shown under it", async ({ page }) => {
  await page.goto(HELLO);
  const figure = page.getByRole("figure").filter({ hasText: "A fjord." });
  await expect(figure.getByRole("img")).toBeVisible();
  await expect(figure.locator("figcaption")).toBeVisible();
});

test("Back on a post is a way out, not the page it is on", async ({ page }) => {
  await page.goto(HELLO);
  await waitForApp(page);
  await expect(page.getByRole("link", { name: "Back", exact: true })).not.toHaveAttribute(
    "aria-current",
    /.*/,
  );
});

test("a post's footnotes are titled for a screen reader only", async ({ page }) => {
  await page.goto(HELLO);
  const heading = page.getByRole("heading", { name: "Footnotes" });
  await expect(heading).toHaveCount(1);
  expect(await heading.evaluate((el) => el.getBoundingClientRect().height)).toBeLessThanOrEqual(1);
});

test("a post, its video included, has no accessibility violations", async ({ page }) => {
  await page.goto(HELLO);
  await waitForApp(page);
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
    .analyze();
  expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});
