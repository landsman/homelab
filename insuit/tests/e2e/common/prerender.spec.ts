import { test, expect } from "../fixture";
import { expectCleanTakeover, PAGES, TAKEOVER_PATHS } from "../takeover";
import { ROUTES } from "@/app/routes";

// Every page is an HTML file written at build time. These pin that down: the
// text is there with no JavaScript at all, and React takes the page over
// without complaining that what it rendered differs from the file.

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the home page has its text and its links", async ({ page }) => {
    await page.goto(ROUTES.home);
    await expect(page.getByRole("heading", { name: "Hello there!" })).toBeVisible();
    await expect(page.getByText("I'm Michal, a developer in Prague.")).toBeVisible();

    await page.getByRole("link", { name: "Let's talk" }).click();
    await expect(page).toHaveURL(ROUTES.contact);
    await expect(page).toHaveTitle("Let's talk — Michal Landsman");
    await expect(page.getByRole("link", { name: "GitHub" })).toBeVisible();
  });

  test("the CV has every job and project in the page itself", async ({ page }) => {
    await page.goto(ROUTES.cv);
    await expect(page).toHaveTitle("Curriculum Vitae - Michal Landsman");
    await expect(page.getByRole("heading", { name: "Experience" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "The Police of the Czech Republic" }),
    ).toBeVisible();
    // Out of search results, said by the page itself.
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      "noindex, nofollow",
    );
  });

  test("the theme toggle stays hidden, since it could do nothing", async ({ page }) => {
    await page.goto(ROUTES.home);
    await expect(page.getByRole("button", { name: "Switch theme" })).toBeHidden();
  });

  test("the contact page's file does not hold the address", async ({ page }) => {
    await page.goto(ROUTES.contact);
    // The fallback address of a build with no CONTACT_EMAIL (vite.config.ts).
    expect(await page.content()).not.toContain("hello@example.com");
    await expect(page.locator('a[href^="mailto:"]')).toHaveCount(0);
  });

  test("an unknown address gets a page that says so, in its head too", async ({ page }) => {
    const response = await page.goto("/no-such-page");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Nothing here" })).toBeVisible();
    await expect(page).toHaveTitle("Page not found — Michal Landsman");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      "noindex, nofollow",
    );
    // Not the home page's link-preview tags under another address.
    await expect(page.locator('meta[property="og:url"]')).toHaveCount(0);
  });

  for (const path of PAGES) {
    test(`every link and picture on ${path} leads to something`, async ({ page, request }) => {
      await page.goto(path);
      const targets = await page.evaluate(() => [
        ...new Set(
          [...document.querySelectorAll("a[href], img[src], link[href]")]
            .map((el) => el.getAttribute("href") ?? el.getAttribute("src") ?? "")
            // Its own files only: the tests never reach the network.
            .filter((url) => url.startsWith("/")),
        ),
      ]);
      expect(targets.length).toBeGreaterThan(0);

      const broken: string[] = [];
      for (const target of targets) {
        const response = await request.get(target);
        if (response.status() !== 200) broken.push(`${response.status()} ${target}`);
      }
      expect(broken).toEqual([]);
    });
  }

  test("the CV's printed QR codes are files the build wrote", async ({ page, request }) => {
    await page.goto(ROUTES.cv);
    const codes = await page
      .locator('img[src^="/assets/cv-qr/"]')
      .evaluateAll((images) => images.map((image) => image.getAttribute("src") ?? ""));
    expect(codes.length).toBeGreaterThan(0);
    // One code per link: two links never share a file.
    expect(new Set(codes).size).toBe(codes.length);

    const first = await request.get(codes[0]);
    expect(first.headers()["content-type"]).toContain("image/svg+xml");
    expect(await first.text()).toMatch(/^<svg .*<path d="M/);
  });
});

for (const path of TAKEOVER_PATHS) {
  // Elements and text only: a production build says nothing about an attribute
  // that differs. dev/hydration.spec.ts covers those.
  test(`React takes ${path} over without an error`, async ({ page }) => {
    await expectCleanTakeover(page, path);
  });
}
