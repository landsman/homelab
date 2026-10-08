// The theme switch: the system's preference, the override, and a next visit.
import { Given, When, Then } from "@cucumber/cucumber";
import { expect } from "@playwright/test";
import { AppWorld } from "../support/world.ts";

Given("my system prefers a light theme", async function (this: AppWorld) {
  await this.page.emulateMedia({ colorScheme: "light" });
});

When("I switch to the {word} theme", async function (this: AppWorld, theme: string) {
  await this.page.getByRole("button", { name: `Switch to ${theme} theme` }).click();
});

When("I come back to the page", async function (this: AppWorld) {
  await this.page.reload();
});

Then("the page is dark", async function (this: AppWorld) {
  await expect(this.page.locator("html")).toHaveAttribute("data-theme", "dark");
});

// No override left: the page is whatever the system says, now and later.
Then("the page follows my system", async function (this: AppWorld) {
  await expect(this.page.locator("html")).not.toHaveAttribute("data-theme");
  await expect(this.page.getByRole("button", { name: "Switch to dark theme" })).toBeVisible();
});
