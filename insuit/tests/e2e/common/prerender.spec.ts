import { test, expect } from "../fixture";
import { ROUTES } from "@/app/routes";

// Every page is an HTML file written at build time. These pin that down: the
// text is there with no JavaScript at all, and React takes the page over
// without complaining that what it rendered differs from the file.
//
// That complaint covers elements and text only. An attribute that differs
// (title, href, hidden) is left as the file had it and reported nowhere in a
// production build — `make dev` is where React says so, in the console.

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the home page has its text and its links", async ({ page }) => {
    await page.goto(ROUTES.home);
    await expect(page.getByRole("heading", { name: "Hello there!" })).toBeVisible();
    await expect(page.getByText("I'm Michal, a developer in Prague.")).toBeVisible();

    await page.getByRole("link", { name: "Let's talk" }).click();
    await expect(page).toHaveURL(ROUTES.contact);
    await expect(page).toHaveTitle("Let's talk — Michal Landsman");
    await expect(page.getByRole("link", { name: "GitHub" })).toBeVisible();
  });

  test("the CV has every job and project in the page itself", async ({ page }) => {
    await page.goto(ROUTES.cv);
    await expect(page).toHaveTitle("Curriculum Vitae - Michal Landsman");
    await expect(page.getByRole("heading", { name: "Experience" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "The Police of the Czech Republic" }),
    ).toBeVisible();
    // Out of search results, said by the page itself.
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      "noindex, nofollow",
    );
  });

  test("the theme toggle stays hidden, since it could do nothing", async ({ page }) => {
    await page.goto(ROUTES.home);
    await expect(page.getByRole("button", { name: "Switch theme" })).toBeHidden();
  });
});

for (const path of [ROUTES.home, ROUTES.contact, ROUTES.cv, "/no-such-page"]) {
  test(`React takes ${path} over without an error`, async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));

    const response = await page.goto(path);
    // The toggle only shows once the app runs, so it marks the takeover.
    await expect(page.getByRole("button", { name: /Switch to (dark|light) theme/ })).toBeVisible();

    // The one expected line: the browser's own report of the 404 response.
    const unexpected = errors.filter(
      (text) => !(response?.status() === 404 && text.includes("404")),
    );
    expect(unexpected).toEqual([]);
  });
}
