import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, expect, test } from "vitest";
import { createHandler, parseHeaders } from "../../scripts/preview.ts";

// The local preview stands in for Cloudflare Pages, so its rules are pinned
// here. scripts/check-pages.ts asks a real deployment the same questions.

let dir: string;
let ask: (path: string) => Promise<Response>;

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "preview-"));
  await Bun.write(join(dir, "index.html"), "home");
  await Bun.write(join(dir, "contact.html"), "contact");
  await Bun.write(join(dir, "404.html"), "nothing here");
  await Bun.write(join(dir, "assets/icon.svg"), "<svg/>");
  await Bun.write(join(dir, "_build/app-abc123.js"), "app");
  await Bun.write(
    join(dir, "_headers"),
    "# hashed files\n/_build/*\n  Cache-Control: public, max-age=31536000, immutable\n",
  );
  const handler = await createHandler(dir);
  ask = (path) => handler(new Request(`http://localhost${path}`));
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

test("a page is served at its name without .html", async () => {
  const response = await ask("/contact");
  expect(response.status).toBe(200);
  expect(await response.text()).toBe("contact");
  expect(response.headers.get("content-type")).toContain("text/html");
  expect(await (await ask("/")).text()).toBe("home");
});

test("the other spellings of a page redirect to the one without .html or a slash", async () => {
  for (const path of ["/contact.html", "/contact/"]) {
    const response = await ask(path);
    expect(response.status, path).toBe(308);
    expect(response.headers.get("location"), path).toBe("/contact");
  }
  expect((await ask("/index.html")).headers.get("location")).toBe("/");
  // The query survives the redirect.
  expect((await ask("/contact.html?a=1")).headers.get("location")).toBe("/contact?a=1");
});

test("an address that is no file gets 404.html, with a 404", async () => {
  // A folder, the file that configures Pages, a way out of the folder.
  for (const path of ["/no-such-page", "/assets", "/assets/", "/_headers", "/../secret"]) {
    const response = await ask(path);
    expect(response.status, path).toBe(404);
    expect(await response.text(), path).toBe("nothing here");
  }
});

test("a file is served as it is, with Pages' default caching", async () => {
  const response = await ask("/assets/icon.svg");
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toContain("image/svg+xml");
  expect(response.headers.get("cache-control")).toBe("public, max-age=0, must-revalidate");
});

test("_headers adds its headers to the paths it names, and to no others", async () => {
  expect((await ask("/_build/app-abc123.js")).headers.get("cache-control")).toBe(
    "public, max-age=31536000, immutable",
  );
  expect((await ask("/contact")).headers.get("cache-control")).toBe(
    "public, max-age=0, must-revalidate",
  );
});

test("a _headers pattern is literal except for its star", () => {
  const [rule] = parseHeaders("/a.b/*\n  X-Test: yes: really\n");
  expect(rule.pattern.test("/a.b/c/d")).toBe(true);
  // The dot is a dot, not "any character".
  expect(rule.pattern.test("/axb/c")).toBe(false);
  // A value may hold a colon.
  expect(rule.headers).toEqual([["x-test", "yes: really"]]);
});
