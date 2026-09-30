import { Given, When, Then } from "@cucumber/cucumber";
import { expect } from "@playwright/test";
// A relative path with its extension: Node resolves this itself, and the `@`
// alias only exists for the bundler and for Playwright.
import { ROUTES } from "../../../src/app/routes.ts";
import { AppWorld, BASE_URL } from "../support/world.ts";

Given("I am on the home page", async function (this: AppWorld) {
  await this.page.goto(`${BASE_URL}${ROUTES.home}`);
  await expect(this.page.getByRole("heading", { name: "Hello there!" })).toBeVisible();
});

When("I follow {string}", async function (this: AppWorld, name: string) {
  await this.page.getByRole("link", { name }).click();
});

When("I press {string}", async function (this: AppWorld, key: string) {
  await this.page.keyboard.press(key);
});

Then("I am offered a link to {string}", async function (this: AppWorld, name: string) {
  await expect(this.page.getByRole("link", { name })).toBeVisible();
});
