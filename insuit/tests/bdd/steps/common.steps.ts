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

Given("I open the blog with {string}", async function (this: AppWorld, query: string) {
  await this.page.goto(`${BASE_URL}${ROUTES.blog}${query}`);
});

Given("I open the post {string}", async function (this: AppWorld, slug: string) {
  await this.page.goto(`${BASE_URL}${ROUTES.blog}/${slug}`);
});

When("I follow {string}", async function (this: AppWorld, name: string) {
  await this.page.getByRole("link", { name }).click();
});

When("I press {string}", async function (this: AppWorld, key: string) {
  await this.page.keyboard.press(key);
});

Then("I see the heading {string}", async function (this: AppWorld, name: string) {
  await expect(this.page.getByRole("heading", { name })).toBeVisible();
});

Then("I am offered a button to play the video", async function (this: AppWorld) {
  await expect(this.page.getByRole("button", { name: /^Play the video: / })).toBeVisible();
});

Then("I am not offered a link to {string}", async function (this: AppWorld, name: string) {
  await expect(this.page.getByRole("main").getByRole("link", { name })).toHaveCount(0);
});

Then("I am offered a link to {string}", async function (this: AppWorld, name: string) {
  await expect(this.page.getByRole("link", { name })).toBeVisible();
});
