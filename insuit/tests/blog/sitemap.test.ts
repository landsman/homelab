import { expect, test } from "vitest";
import { sitemaps } from "../../vite/sitemap.ts";

const post = (slug: string, date: string) => ({ slug, date, title: slug, description: slug });

test("the index links each sitemap, robots.txt the index, all on the given site", () => {
  const files = sitemaps("https://example.com", []);
  expect(files["sitemap.xml"]).toContain("<loc>https://example.com/sitemap-pages.xml</loc>");
  expect(files["sitemap.xml"]).toContain("<loc>https://example.com/sitemap-blog.xml</loc>");
  expect(files["robots.txt"]).toContain("Sitemap: https://example.com/sitemap.xml");
});

test("the blog's sitemap lists every post, the list dated by the newest", () => {
  const blog = sitemaps("https://example.com", [
    post("older", "2026-01-02"),
    post("newer", "2026-03-04"),
  ])["sitemap-blog.xml"];
  expect(blog).toContain(
    "<url><loc>https://example.com/blog</loc><lastmod>2026-03-04</lastmod></url>",
  );
  expect(blog).toContain(
    "<url><loc>https://example.com/blog/older</loc><lastmod>2026-01-02</lastmod></url>",
  );
  expect(blog).toContain("<loc>https://example.com/blog/newer</loc>");
});

test("the pages' sitemap leaves out the CV, which asks search engines to stay out", () => {
  expect(sitemaps("https://example.com", [])["sitemap-pages.xml"]).not.toContain("/cv<");
});
