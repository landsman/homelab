import { test, expect } from "../fixture";
import { ROUTES } from "@/app/routes";

test("the home page leads to what I offer, and that to the CV behind it", async ({ page }) => {
  await page.goto(ROUTES.home);
  await page.getByRole("link", { name: "Work with me" }).click();
  await expect(page).toHaveURL(ROUTES.hire);
  await expect(page).toHaveTitle("Work with me — Michal Landsman");
  await expect(page.getByRole("heading", { name: "Work with me", level: 1 })).toBeVisible();

  // Counted from the year I started, not written down: it is right next year too.
  await expect(
    page.getByText(`software and graphics for ${new Date().getFullYear() - 2007} years`),
  ).toBeVisible();

  // The short version comes first, for whoever reads no further.
  await expect(page.getByRole("list", { name: "In short" }).getByRole("listitem")).toHaveCount(6);

  // Every offer is a heading of its own, so the page can be skimmed.
  await expect(page.getByRole("heading", { level: 2 })).toHaveText([
    "Think it up with you",
    "Make it look and feel right",
    "Build a product from the first commit",
    "Get more done with AI",
    "Run the infrastructure under it",
    "Care how it sells",
    "Tidy up first",
    "Rebuild what no longer keeps up",
    "Lead the team",
  ]);

  // The CV is a link inside the sentence that mentions it.
  await page.getByRole("main").getByRole("link", { name: "my CV" }).click();
  await expect(page).toHaveURL(ROUTES.cv);
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the offer is in the file, and its one call to action leads to the contacts", async ({
    page,
  }) => {
    await page.goto(ROUTES.hire);
    await expect(
      page.getByRole("heading", { name: "Rebuild what no longer keeps up" }),
    ).toBeVisible();

    const cta = page.getByRole("main").getByRole("link", { name: "Let's talk" });
    await cta.click();
    await expect(page).toHaveURL(ROUTES.contact);
  });
});
