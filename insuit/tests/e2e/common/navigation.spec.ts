import { test, expect } from "../fixture";
import { waitForApp } from "../takeover";
import { ROUTES } from "@/app/routes";

test("the footer leads to the contact page and back", async ({ page }) => {
  await page.goto(ROUTES.home);
  await expect(page.getByRole("heading", { name: "Hello there!" })).toBeVisible();

  await page.getByRole("link", { name: "Let's talk" }).click();
  await expect(page).toHaveURL(ROUTES.contact);
  await expect(page).toHaveTitle("Let's talk — Michal Landsman");
  await expect(page.getByRole("link", { name: "GitHub" })).toHaveAttribute(
    "href",
    "https://github.com/landsman",
  );
  // The address comes from the environment at build time; this is the fallback.
  await expect(page.getByRole("link", { name: "hello@example.com" })).toHaveAttribute(
    "href",
    "mailto:hello@example.com",
  );

  await page.getByRole("link", { name: "Back" }).click();
  await expect(page).toHaveURL(ROUTES.home);
  await expect(page).toHaveTitle("Michal Landsman");
});

test("/work-with-me opens with the name, leading home", async ({ page }) => {
  // The home page is the name; the CV and the contact page keep only the room.
  for (const path of [ROUTES.home, ROUTES.cv, ROUTES.contact]) {
    await page.goto(path);
    await expect(page.getByRole("banner"), path).toHaveCount(0);
  }

  await page.goto(ROUTES.hire);
  await page.getByRole("banner").getByRole("link", { name: "Michal Landsman" }).click();
  await expect(page).toHaveURL(ROUTES.home);
});

test("a page opens from its own address", async ({ page }) => {
  await page.goto(ROUTES.cv);
  await expect(page).toHaveTitle("Curriculum Vitae - Michal Landsman");
  await expect(page.getByRole("heading", { name: "Michal Landsman", level: 1 })).toBeVisible();
});

test("an address that is no page answers 404, says so and leads home", async ({ page }) => {
  const response = await page.goto("/no-such-page");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Nothing here" })).toBeVisible();
  await expect(page).toHaveTitle("Page not found — Michal Landsman");

  await page.getByRole("link", { name: "Go to the homepage" }).click();
  await expect(page).toHaveURL(ROUTES.home);
  await expect(page.getByRole("heading", { name: "Hello there!" })).toBeVisible();
  await expect(page).toHaveTitle("Michal Landsman");
});

test("following a link moves focus to the new page", async ({ page }) => {
  // The next page's code arrives late, as on a slow connection: focus has to
  // wait for the page, not move when the address changes.
  await page.route(/contact-.*\.js/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 600));
    await route.continue();
  });
  await page.goto(ROUTES.home);
  // Before the app runs a link is a plain page load, which starts at the top
  // of the document on its own.
  await waitForApp(page);

  await page.getByRole("link", { name: "Let's talk" }).click();
  await expect(page.getByRole("heading", { name: "Let's talk" })).toBeVisible();
  await expect(page.locator("main")).toBeFocused();
});

test("on a phone every page starts at the same height, /work-with-me under its header", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 740 });
  const top = () => page.locator("h1").evaluate((h) => h.getBoundingClientRect().top);
  const paths = [ROUTES.home, ROUTES.cv, ROUTES.contact, ROUTES.blog, `${ROUTES.blog}/hello`];
  const tops = [];
  for (const path of [...paths, "/no-such-page"]) {
    await page.goto(path);
    tops.push(await top());
  }
  for (const t of tops) expect(t).toBeCloseTo(tops[0], 0);

  // The header's own margin is the room; nothing is added on top of it.
  await page.goto(ROUTES.hire);
  const header = await page.getByRole("banner").boundingBox();
  const section = await page.evaluate(() =>
    parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--space-section")),
  );
  expect((await top()) - (header!.y + header!.height)).toBeCloseTo(section, 0);
});

test("on a wide screen a long page without the header starts where /work-with-me does", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const top = () => page.locator("h1").evaluate((h) => h.getBoundingClientRect().top);
  await page.goto(ROUTES.hire);
  const underHeader = await top();
  for (const path of [ROUTES.cv, `${ROUTES.blog}/hello`]) {
    await page.goto(path);
    expect(await top(), path).toBeCloseTo(underHeader, 0);
  }
});
