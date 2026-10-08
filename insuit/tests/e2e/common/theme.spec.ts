import { test, expect } from "../fixture";
import { ROUTES } from "@/app/routes";

test.use({ colorScheme: "light" });

test("the toggle overrides the system theme and the override survives a reload", async ({
  page,
}) => {
  await page.goto(ROUTES.home);
  const html = page.locator("html");
  await expect(html).not.toHaveAttribute("data-theme");

  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await expect(html).toHaveAttribute("data-theme", "dark");

  await page.reload();
  await expect(html).toHaveAttribute("data-theme", "dark");

  // Back on what the system says: the override is dropped, not set to "light".
  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await expect(html).not.toHaveAttribute("data-theme");
  await expect(page.getByRole("button", { name: "Switch to dark theme" })).toBeVisible();
});

test("on a phone the footer links keep one row, the toggle sits beneath them", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
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
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto(ROUTES.contact);
  const back = await page.getByRole("link", { name: "Back" }).boundingBox();
  const toggle = await page.getByRole("button", { name: /theme$/ }).boundingBox();
  expect(toggle!.y).toBeLessThan(back!.y + back!.height);
});
