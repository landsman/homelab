import { test, expect } from "../fixture";
import { ROUTES } from "@/app/routes";

test.beforeEach(async ({ page }) => {
  await page.goto(ROUTES.cv);
});

test("a project card opens its details in a dialog, and Escape closes it", async ({ page }) => {
  await page.getByRole("button", { name: "The Police of the Czech Republic" }).click();

  const dialog = page.getByRole("dialog", { name: "The Police of the Czech Republic" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("New website for the Police of the Czech Republic.")).toBeVisible();
  await expect(dialog.getByRole("link", { name: /^policie\.gov\.cz/ })).toHaveAttribute(
    "target",
    "_blank",
  );

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("a project's photo opens full size, and the arrow keys step through the rest", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Payment app kickoff" }).click();
  const project = page.getByRole("dialog", { name: "Payment app kickoff" });

  await project.getByRole("button", { name: /a hand holding a phone/ }).click();
  const photo = page.getByRole("dialog", { name: "Photo" });
  await expect(photo.getByText("Together without payment terminals")).toBeVisible();

  await page.keyboard.press("ArrowRight");
  await expect(photo.getByText("The native iOS app during mystery shopping")).toBeVisible();

  await photo.getByRole("button", { name: "Previous photo" }).click();
  await expect(photo.getByText("Together without payment terminals")).toBeVisible();

  // Escape closes the photo only; the project stays open behind it.
  await page.keyboard.press("Escape");
  await expect(photo).toBeHidden();
  await expect(project).toBeVisible();
});

test("a project with a video waits behind a play button", async ({ page }) => {
  await page.getByRole("button", { name: "Talk at DrupalCamp CS 2017 in Brno" }).click();
  const dialog = page.getByRole("dialog", { name: "Talk at DrupalCamp CS 2017 in Brno" });

  // Nothing loads from YouTube until the button is pressed.
  await expect(dialog.getByRole("button", { name: /Play the video/ })).toBeVisible();
  await expect(dialog.locator("iframe")).toHaveCount(0);
});
