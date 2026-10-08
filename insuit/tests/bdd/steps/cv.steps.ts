import { Given, When, Then } from "@cucumber/cucumber";
import { expect } from "@playwright/test";
import { ROUTES } from "../../../src/app/routes.ts";
import { AppWorld } from "../support/world.ts";

Given("I am on the CV", async function (this: AppWorld) {
  await this.page.goto(ROUTES.cv);
  await expect(this.page.getByRole("heading", { name: "Experience" })).toBeVisible();
});

When("I open the project {string}", async function (this: AppWorld, name: string) {
  await this.page.getByRole("button", { name }).click();
  // Open for certain, so a later "no project is open" means it was closed.
  await expect(this.page.getByRole("dialog", { name })).toBeVisible();
});

Then("I read {string}", async function (this: AppWorld, text: string) {
  await expect(this.page.getByRole("dialog").getByText(text)).toBeVisible();
});

Then("no project is open", async function (this: AppWorld) {
  await expect(this.page.getByRole("dialog")).toBeHidden();
});

When("I open the photo of {string}", async function (this: AppWorld, what: string) {
  await this.page
    .getByRole("dialog")
    .getByRole("button", { name: new RegExp(what) })
    .click();
});

Then("the photo reads {string}", async function (this: AppWorld, caption: string) {
  await expect(this.page.getByRole("dialog", { name: "Photo" }).getByText(caption)).toBeVisible();
});

// Escape closes the photo only; the project behind it stays open.
Then("the project {string} is still open", async function (this: AppWorld, name: string) {
  await expect(this.page.getByRole("dialog", { name: "Photo" })).toBeHidden();
  await expect(this.page.getByRole("dialog", { name })).toBeVisible();
});
