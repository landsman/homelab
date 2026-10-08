import { test, expect } from "../fixture";
import { ROUTES } from "@/app/routes";
import { PHONE, WIDE } from "../../viewports";

// Where a page and its chrome sit on the screen: where the heading starts, and
// what fits beside what in the footer. A phone stacks and starts every page at
// the top; a wider screen centres a short page and keeps the header's room.

test("on a phone every page starts at the same height, /work-with-me under its header", async ({
  page,
}) => {
  await page.setViewportSize(PHONE);
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
  await page.setViewportSize(WIDE);
  const top = () => page.locator("h1").evaluate((h) => h.getBoundingClientRect().top);
  await page.goto(ROUTES.hire);
  const underHeader = await top();
  for (const path of [ROUTES.cv, `${ROUTES.blog}/hello`]) {
    await page.goto(path);
    expect(await top(), path).toBeCloseTo(underHeader, 0);
  }
});

test("on a phone the footer links keep one row, the toggle sits beneath them", async ({ page }) => {
  await page.setViewportSize(PHONE);
  await page.goto(ROUTES.home);
  const nav = page.getByRole("contentinfo").getByRole("navigation");
  const tops = await nav
    .getByRole("link")
    .evaluateAll((links) => links.map((a) => a.getBoundingClientRect().top));
  expect(new Set(tops).size).toBe(1);

  const navBox = await nav.boundingBox();
  const toggleBox = await page.getByRole("button", { name: "Switch to dark theme" }).boundingBox();
  // Not just below: far enough that the icon does not read as part of the row.
  expect(toggleBox!.y - (navBox!.y + navBox!.height)).toBeGreaterThanOrEqual(30);
});

test("on a phone a lone Back keeps the toggle beside it", async ({ page }) => {
  await page.setViewportSize(PHONE);
  await page.goto(ROUTES.contact);
  const back = await page.getByRole("link", { name: "Back" }).boundingBox();
  const toggle = await page.getByRole("button", { name: /theme$/ }).boundingBox();
  expect(toggle!.y).toBeLessThan(back!.y + back!.height);
});

test("on a phone the contact page's few lines sit in the middle under its heading", async ({
  page,
}) => {
  await page.setViewportSize(PHONE);
  await page.goto(ROUTES.contact);
  const heading = await page.locator("h1").boundingBox();
  const content = await page.locator("main .content").boundingBox();
  const footer = await page.getByRole("contentinfo").boundingBox();
  const above = content!.y - (heading!.y + heading!.height);
  const below = footer!.y - (content!.y + content!.height);
  expect(above).toBeGreaterThan(100);
  expect(Math.abs(above - below)).toBeLessThan(80);
});
