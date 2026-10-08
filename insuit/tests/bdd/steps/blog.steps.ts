// The blog's posts and what a post can carry: video, code, tables, links out.
import { Given, When, Then } from "@cucumber/cucumber";
import { expect } from "@playwright/test";
import { ROUTES } from "@/app/routes";
import { AppWorld } from "../support/world.ts";

Given("I open the blog with {string}", async function (this: AppWorld, query: string) {
  await this.page.goto(`${ROUTES.blog}${query}`);
});

Given("I open the post {string}", async function (this: AppWorld, slug: string) {
  await this.page.goto(`${ROUTES.blog}/${slug}`);
});

Then("I am offered a button to play the video", async function (this: AppWorld) {
  await expect(this.page.getByRole("button", { name: /^Play the video: / })).toBeVisible();
});

When("I point at the video", async function (this: AppWorld) {
  await this.page.getByRole("button", { name: /^Play the video: / }).hover();
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
