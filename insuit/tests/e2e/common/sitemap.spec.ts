import { test, expect } from "../fixture";

// Every address the sitemaps give is a page that is there and lets search
// engines in: a page that says noindex, or is gone, does not belong in one.
test("every address in the sitemaps is a page search engines may index", async ({
  page,
  request,
}) => {
  const locs = async (path: string) =>
    [...(await (await request.get(path)).text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map(
      // The build's own site may not be this server: the path is what counts.
      ([, url]) => new URL(url).pathname,
    );

  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toMatch(/^Sitemap: \S+\/sitemap\.xml$/m);

  const sitemaps = await locs("/sitemap.xml");
  expect(sitemaps).toEqual(["/sitemap-pages.xml", "/sitemap-blog.xml"]);

  const pages = (await Promise.all(sitemaps.map(locs))).flat();
  expect(pages).toContain("/blog");
  for (const path of pages) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    await expect(page.locator('meta[name="robots"]'), path).toHaveAttribute(
      "content",
      "index, follow",
    );
  }
});
