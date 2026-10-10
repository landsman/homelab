// Where things sit on the screen: a phone, and what fits beside what.
import { Given, When, Then } from "@cucumber/cucumber";
import { expect } from "@playwright/test";
import { recordLayoutShifts, shiftedWithin } from "../../layout-shifts.ts";
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

Then("the theme switch sits top right", async function (this: AppWorld) {
  const viewport = this.page.viewportSize()!;
  const toggle = await this.page.getByRole("button", { name: /theme$/ }).boundingBox();
  expect(toggle!.y).toBeLessThan(viewport.height / 4);
  expect(toggle!.x).toBeGreaterThan(viewport.width / 2);
});

// Safari on iOS 26 floats its address bar over the bottom ~90px of the page.
Then("the menu clears the browser's bottom bar", async function (this: AppWorld) {
  const viewport = this.page.viewportSize()!;
  const nav = await this.page.getByRole("contentinfo").getByRole("navigation").boundingBox();
  expect(viewport.height - (nav!.y + nav!.height)).toBeGreaterThan(90);
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

Then("the page's few lines sit in the middle under its heading", async function (this: AppWorld) {
  const heading = await this.page.locator("h1").boundingBox();
  const content = await this.page.locator("main .content").boundingBox();
  const footer = await this.page.getByRole("contentinfo").boundingBox();
  const above = content!.y - (heading!.y + heading!.height);
  const below = footer!.y - (content!.y + content!.height);
  expect(Math.abs(above - below)).toBeLessThan(80);
});

Given("the page's script arrives late", async function (this: AppWorld) {
  await recordLayoutShifts(this.page);
});

// Ready once the app runs: the theme switch is its last piece to appear.
When("the page is ready", async function (this: AppWorld) {
  await expect(this.page.getByRole("button", { name: /theme$/ })).toBeVisible();
});

Then("the menu has not moved", async function (this: AppWorld) {
  expect(await shiftedWithin(this.page, "footer")).toEqual([]);
});
