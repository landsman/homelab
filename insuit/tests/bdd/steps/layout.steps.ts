// Where things sit on the screen: a phone, and what fits beside what.
import { Given, Then } from "@cucumber/cucumber";
import { expect } from "@playwright/test";
import { PHONE } from "../../viewports.ts";
import { AppWorld } from "../support/world.ts";

Given("I am on a phone", async function (this: AppWorld) {
  await this.page.setViewportSize(PHONE);
});

Then("the menu's links share one row", async function (this: AppWorld) {
  const tops = await this.page
    .getByRole("contentinfo")
    .getByRole("link")
    .evaluateAll((links) => links.map((a) => a.getBoundingClientRect().top));
  expect(new Set(tops).size).toBe(1);
});

Then("the theme switch sits beneath the menu", async function (this: AppWorld) {
  const menu = await this.page.getByRole("contentinfo").getByRole("navigation").boundingBox();
  const toggle = await this.page.getByRole("button", { name: /theme$/ }).boundingBox();
  expect(toggle!.y).toBeGreaterThanOrEqual(menu!.y + menu!.height);
});

const headingTop = (world: AppWorld) =>
  world.page.locator("h1").evaluate((h) => h.getBoundingClientRect().top);

Given("I note where the heading starts", async function (this: AppWorld) {
  this.headingTop = await headingTop(this);
});

Then("the heading starts where it did", async function (this: AppWorld) {
  await expect.poll(() => headingTop(this)).toBeCloseTo(this.headingTop!, 0);
});

Then("the theme switch sits beside {string}", async function (this: AppWorld, name: string) {
  const link = await this.page.getByRole("link", { name, exact: true }).boundingBox();
  const toggle = await this.page.getByRole("button", { name: /theme$/ }).boundingBox();
  expect(toggle!.y).toBeLessThan(link!.y + link!.height);
  expect(toggle!.x).toBeGreaterThan(link!.x + link!.width);
});
