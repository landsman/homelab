import { Given, When, Then } from "@cucumber/cucumber";
import { expect } from "@playwright/test";
import { ROUTES } from "../../../src/app/routes.ts";
import { AppWorld, BASE_URL } from "../support/world.ts";

Given("I am on the CV", async function (this: AppWorld) {
  await this.page.goto(`${BASE_URL}${ROUTES.cv}`);
  await expect(this.page.getByRole("heading", { name: "Experience" })).toBeVisible();
});

When("I open the project {string}", async function (this: AppWorld, name: string) {
  await this.page.getByRole("button", { name }).click();
});

Then("I read {string}", async function (this: AppWorld, text: string) {
  await expect(this.page.getByRole("dialog").getByText(text)).toBeVisible();
});

Then("no project is open", async function (this: AppWorld) {
  await expect(this.page.getByRole("dialog")).toBeHidden();
});
