import { AxeBuilder } from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { test, expect } from "../fixture";
import { TAKEOVER_PATHS, waitForApp } from "../takeover";
import { ROUTES } from "@/app/routes";

// What a machine can check of WCAG 2.2 AA, on every page and with each dialog
// open, in both themes: names, roles, landmarks, contrast, the language.
// It cannot judge what only a person can — whether an alt text describes its
// picture, whether the order things are read in makes sense.

async function expectNoViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
    .analyze();
  // One line per finding, so a failure says what and where.
  expect(
    violations.map((v) => `${v.id}: ${v.help} — ${v.nodes.map((n) => n.target).join(", ")}`),
  ).toEqual([]);
}

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`${colorScheme} theme`, () => {
    // No motion: a dialog fades in, and axe reading its title halfway through
    // the fade reports the half-transparent text as low contrast.
    test.use({ colorScheme, reducedMotion: "reduce" });

    for (const path of TAKEOVER_PATHS) {
      test(`${path} has no accessibility violations`, async ({ page }) => {
        await page.goto(path);
        await waitForApp(page);
        await expectNoViolations(page);
      });
    }

    test("an open project, and a photo over it, have none either", async ({ page }) => {
      await page.goto(ROUTES.cv);
      await waitForApp(page);

      await page.getByRole("button", { name: "Payment app kickoff" }).click();
      const project = page.getByRole("dialog", { name: "Payment app kickoff" });
      await expect(project).toBeVisible();
      await expectNoViolations(page);

      await project.getByRole("button", { name: /a hand holding a phone/ }).click();
      await expect(page.getByRole("dialog", { name: "Photo" })).toBeVisible();
      await expectNoViolations(page);
    });
  });
}

test("a project card is named by its project, not by its picture", async ({ page }) => {
  await page.goto(ROUTES.cv);
  // The picture's description, read before the name, was part of the name.
  await expect(
    page.getByRole("button", { name: "The Police of the Czech Republic", exact: true }),
  ).toBeVisible();
});

test("keyboard focus can be seen on the dialogs' round buttons", async ({ page }) => {
  await page.goto(ROUTES.cv);
  await waitForApp(page);
  await page.getByRole("button", { name: "Payment app kickoff" }).click();
  const project = page.getByRole("dialog", { name: "Payment app kickoff" });
  await expect(project).toBeVisible();

  const ring = (name: string, dialog = project) =>
    dialog
      .getByRole("button", { name })
      .evaluate((button) => getComputedStyle(button).outlineStyle);

  // The dialog itself has focus when it opens; Tab reaches the × first.
  await page.keyboard.press("Tab");
  await expect(project.getByRole("button", { name: "Close" })).toBeFocused();
  expect(await ring("Close")).toBe("solid");

  await project.getByRole("button", { name: /a hand holding a phone/ }).click();
  const photo = page.getByRole("dialog", { name: "Photo" });
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await expect(photo.getByRole("button", { name: "Previous photo" })).toBeFocused();
  expect(await ring("Previous photo", photo)).toBe("solid");
});

test("the landmarks on the contact page can be told apart", async ({ page }) => {
  await page.goto(ROUTES.contact);
  await expect(page.getByRole("navigation", { name: "Contact and profiles" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Site" })).toBeVisible();
  // Read out as "Back"; the arrow is for the eye.
  await expect(page.getByRole("link", { name: "Back", exact: true })).toHaveText("← Back");
});
