// Getting around: the steps every feature speaks, whatever page it is about.
import { Given, When, Then } from "@cucumber/cucumber";
import { expect } from "@playwright/test";
import { ROUTES } from "@/app/routes";
import { AppWorld } from "../support/world.ts";

Given("I am on the home page", async function (this: AppWorld) {
  await this.page.goto(ROUTES.home);
  await expect(this.page.getByRole("heading", { name: "Hello there!" })).toBeVisible();
});

Given("I open an address that is no page", async function (this: AppWorld) {
  await this.page.goto("/no-such-page");
});

When("I follow {string}", async function (this: AppWorld, name: string) {
  // Exact: "Back" is not a footnote's "Back to reference 1".
  await this.page.getByRole("link", { name, exact: true }).click();
});

When("I press {string}", async function (this: AppWorld, key: string) {
  await this.page.keyboard.press(key);
});

Then("I see the heading {string}", async function (this: AppWorld, name: string) {
  await expect(this.page.getByRole("heading", { name })).toBeVisible();
});

Then("I see the hint {string}", async function (this: AppWorld, hint: string) {
  // The hint is drawn by CSS (tooltip.css), so it is checked where it is drawn.
  const hinted = this.page.locator(`[data-tooltip="${hint}"]`);
  await expect
    .poll(() => hinted.evaluate((el) => getComputedStyle(el, "::after").opacity))
    .toBe("1");
});

Then("I am not offered a link to {string}", async function (this: AppWorld, name: string) {
  await expect(this.page.getByRole("main").getByRole("link", { name })).toHaveCount(0);
});

Then("I am offered a link to {string}", async function (this: AppWorld, name: string) {
  await expect(this.page.getByRole("link", { name })).toBeVisible();
});

When("I open the picture {string}", async function (this: AppWorld, alt: string) {
  await this.page.getByRole("button", { name: new RegExp(alt) }).click();
});

When("I swipe left on it", async function (this: AppWorld) {
  const figure = this.page.getByRole("dialog", { name: "Photo" }).locator("figure");
  await figure.dispatchEvent("touchstart", {
    touches: [{ identifier: 0, clientX: 400, clientY: 300 }],
  });
  await figure.dispatchEvent("touchend", {
    touches: [],
    changedTouches: [{ identifier: 0, clientX: 200, clientY: 300 }],
  });
});

Then("I see the picture captioned {string}", async function (this: AppWorld, caption: string) {
  const figcaption = this.page.getByRole("dialog", { name: "Photo" }).locator("figcaption");
  await expect(figcaption).toHaveText(new RegExp(caption));
});
