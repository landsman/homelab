// The sitemaps, written into the build next to the pages. sitemap.xml is the
// index robots.txt points at; it links one sitemap for the pages and one for
// the blog, which grows with every post. The addresses are absolute, on the
// site this build is for (SITE_URL), so a preview's sitemap names the preview.
import type { Plugin } from "vite";
import { ROUTES } from "../src/app/routes.ts";
import { SITE_URL } from "../src/app/site.ts";
import type { PostMeta } from "../src/features/blog/post.types.ts";
import { readPosts } from "./blog.ts";

// What search engines are told about. Not /cv: that page asks them to stay out
// (routes/cv.tsx), and tests/e2e/common/sitemap.spec.ts holds every address
// here to it.
const PAGES = [ROUTES.home, ROUTES.hire, ROUTES.contact];

const XML = '<?xml version="1.0" encoding="UTF-8"?>';
const NS = 'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"';

const urlset = (urls: { loc: string; lastmod?: string }[]) =>
  `${XML}\n<urlset ${NS}>\n${urls
    .map(({ loc, lastmod }) =>
      lastmod
        ? `  <url><loc>${loc}</loc><lastmod>${lastmod}</lastmod></url>\n`
        : `  <url><loc>${loc}</loc></url>\n`,
    )
    .join("")}</urlset>\n`;

/** File name → contents, for the site at `site` with these posts. */
export function sitemaps(site: string, all: PostMeta[]): Record<string, string> {
  // A hidden post is found by its address only.
  const posts = all.filter((post) => !post.hidden);
  // A post counts as changed on the day it was last updated, or came out.
  const changed = (post: PostMeta) => post.updated ?? post.published;
  const newest = posts.map(changed).sort().at(-1);
  const files = {
    "sitemap-pages.xml": urlset(PAGES.map((path) => ({ loc: site + path }))),
    "sitemap-blog.xml": urlset([
      { loc: site + ROUTES.blog, lastmod: newest },
      ...posts.map((post) => ({
        loc: `${site}${ROUTES.blog}/${post.slug}`,
        lastmod: changed(post),
      })),
    ]),
  };
  const index = `${XML}\n<sitemapindex ${NS}>\n${Object.keys(files)
    .map((name) => `  <sitemap><loc>${site}/${name}</loc></sitemap>\n`)
    .join("")}</sitemapindex>\n`;
  return {
    ...files,
    "sitemap.xml": index,
    "robots.txt": `User-agent: *\nAllow: /\n\nSitemap: ${site}/sitemap.xml\n`,
  };
}

export function sitemapPlugin(): Plugin {
  return {
    name: "sitemap",
    // Into the files the browser is served, not the renderer's.
    applyToEnvironment: (environment) => environment.name === "client",
    generateBundle() {
      for (const [fileName, source] of Object.entries(sitemaps(SITE_URL, readPosts())))
        this.emitFile({ type: "asset", fileName, source });
    },
  };
}
