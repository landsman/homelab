import { expect, test } from "vitest";
import { sitemaps } from "../../vite/sitemap.ts";

const post = (slug: string, published: string, updated?: string) => ({
  slug,
  published,
  updated,
  title: slug,
  description: slug,
  lang: "en" as const,
});

test("the index links each sitemap, robots.txt the index, all on the given site", () => {
  const files = sitemaps("https://example.com", []);
  expect(files["sitemap.xml"]).toContain("<loc>https://example.com/sitemap-pages.xml</loc>");
  expect(files["sitemap.xml"]).toContain("<loc>https://example.com/sitemap-blog.xml</loc>");
  expect(files["robots.txt"]).toContain("Sitemap: https://example.com/sitemap.xml");
});

test("the blog's sitemap dates each post by its last change, the list by the newest", () => {
  const blog = sitemaps("https://example.com", [
    post("older", "2026-01-02", "2026-05-06"),
    post("newer", "2026-03-04"),
  ])["sitemap-blog.xml"];
  // The older post was updated after the newer came out.
  expect(blog).toContain(
    "<url><loc>https://example.com/blog</loc><lastmod>2026-05-06</lastmod></url>",
  );
  expect(blog).toContain(
    "<url><loc>https://example.com/blog/older</loc><lastmod>2026-05-06</lastmod></url>",
  );
  expect(blog).toContain("<loc>https://example.com/blog/newer</loc>");
});

test("the pages' sitemap leaves out the CV, which asks search engines to stay out", () => {
  expect(sitemaps("https://example.com", [])["sitemap-pages.xml"]).not.toContain("/cv<");
});

test("a hidden post is in no sitemap", () => {
  const blog = sitemaps("https://example.com", [{ ...post("secret", "2026-01-02"), hidden: true }])[
    "sitemap-blog.xml"
  ];
  expect(blog).not.toContain("secret");
});
