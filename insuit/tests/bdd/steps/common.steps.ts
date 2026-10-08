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
  // Exact: "Back" is not a footnote's "Back to reference 1".
  await this.page.getByRole("link", { name, exact: true }).click();
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

When("I point at the video", async function (this: AppWorld) {
  await this.page.getByRole("button", { name: /^Play the video: / }).hover();
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

Then("the code's keywords stand out from the rest of it", async function (this: AppWorld) {
  const block = this.page.getByRole("group", { name: "Code" }).first();
  const keyword = block.getByText("export", { exact: true });
  const plain = await block.evaluate((el) => getComputedStyle(el).color);
  await expect(keyword).not.toHaveCSS("color", plain);
});

Then("I see a table with a header row", async function (this: AppWorld) {
  await expect(
    this.page.getByRole("table").filter({ has: this.page.getByRole("columnheader") }),
  ).not.toHaveCount(0);
});

Then("I see a table without one", async function (this: AppWorld) {
  await expect(
    this.page.getByRole("table").filter({ hasNot: this.page.getByRole("columnheader") }),
  ).not.toHaveCount(0);
});

Then("the link {string} opens in a new tab", async function (this: AppWorld, name: string) {
  const link = this.page.getByRole("link", { name: `${name} (opens in a new tab)` });
  await expect(link).toHaveAttribute("target", "_blank");
});

Given("I am on a phone", async function (this: AppWorld) {
  await this.page.setViewportSize({ width: 360, height: 740 });
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
