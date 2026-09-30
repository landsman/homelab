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
