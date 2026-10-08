import { expect, test } from "@playwright/test";
import { PAGES, ROUTES } from "@/app/routes";

// The questions scripts/preview.ts answers locally, asked of a deployed copy,
// so the local preview cannot drift from what Cloudflare Pages really does.
// Every page comes from ROUTES, so a new one is asked without being listed here.

const checks: [string, { status: number; location?: string; header?: [string, string] }][] = [
  ...PAGES.map((path): [string, { status: number }] => [path, { status: 200 }]),
  [`${ROUTES.contact}.html`, { status: 308, location: ROUTES.contact }],
  [`${ROUTES.contact}/`, { status: 308, location: ROUTES.contact }],
  ["/no-such-page", { status: 404 }],
  ["/assets/icons/favicon.svg", { status: 200, header: ["content-type", "image/svg+xml"] }],
];

for (const [path, want] of checks) {
  test(`${path} answers ${want.status}`, async ({ request }) => {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status()).toBe(want.status);
    if (want.location) expect(response.headers().location).toBe(want.location);
    if (want.header) expect(response.headers()[want.header[0]]).toContain(want.header[1]);
  });
}

// The hashed files are named in the home page; one of them has to be cached for
// good. Right after a deploy the edge can still answer "no-store" for a while,
// before the _headers rule reaches it — once fell short at 30 s, so 90.
test("hashed files are cached for good", async ({ request }) => {
  const html = await (await request.get("/")).text();
  const hashed = html.match(/\/_build\/[\w.-]+\.js/)?.[0];
  expect(hashed, "the home page names no /_build/ file").toBeTruthy();
  await expect
    .poll(async () => (await request.get(hashed!)).headers()["cache-control"], {
      timeout: 90_000,
      intervals: [3000],
    })
    .toContain("immutable");
});

// A page names its own address and its link-preview card with a full URL, set
// at build time (VITE_SITE_URL). Both have to be this deployment's, and the card
// has to be there — or a shared link shows another site's, or none.
test("names its own address and link-preview card", async ({ request, baseURL }) => {
  test.skip(new URL(baseURL!).hostname === "localhost", "a local build names the real site");
  const html = await (await request.get("/")).text();
  const tag = (property: string) =>
    html.match(new RegExp(`property="${property}" content="([^"]*)"`))?.[1] ?? "(none)";
  expect(tag("og:url").startsWith(baseURL!), `og:url is ${tag("og:url")}`).toBe(true);
  const card = tag("og:image");
  expect(card.startsWith(baseURL!), `og:image is ${card}`).toBe(true);
  const response = await request.get(card);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("image/png");
});
