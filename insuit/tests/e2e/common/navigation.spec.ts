import { test, expect } from "../fixture";
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

  await page.getByRole("link", { name: "← Back" }).click();
  await expect(page).toHaveURL(ROUTES.home);
  await expect(page).toHaveTitle("Michal Landsman");
});

test("a page opens from its own address", async ({ page }) => {
  await page.goto(ROUTES.cv);
  await expect(page).toHaveTitle("Curriculum Vitae - Michal Landsman");
  await expect(page.getByRole("heading", { name: "Michal Landsman", level: 1 })).toBeVisible();
});

test("an address that is no page says so and leads home", async ({ page }) => {
  await page.goto("/no-such-page");
  await expect(page.getByRole("heading", { name: "Nothing here" })).toBeVisible();

  await page.getByRole("link", { name: "Go to the homepage" }).click();
  await expect(page).toHaveURL(ROUTES.home);
});
