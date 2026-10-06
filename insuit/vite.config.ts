import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { paraglideVitePlugin } from "@inlang/paraglide-js";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, configDefaults } from "vitest/config";
import { ROUTES } from "./src/app/routes.ts";
import { blogPlugin, readPosts } from "./vite/blog.ts";
import { cvPlugin } from "./vite/cv.ts";
import { sitemapPlugin } from "./vite/sitemap.ts";

// The commit the site is built from, written into every page's <head> so a
// deployed page says which version it is. CI names it (a PR is checked out as a
// merge commit, which is not the commit that was pushed); locally it is HEAD.
function commit(): string {
  if (process.env.COMMIT_SHA) return process.env.COMMIT_SHA;
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

export default defineConfig({
  plugins: [
    // Every word of the interface is a key in messages/<locale>.json, compiled
    // into src/paraglide (not committed). One locale, so no URL carries it; a
    // second one starts in project.inlang/settings.json — see the README.
    paraglideVitePlugin({
      project: "./project.inlang",
      outdir: "./src/paraglide",
      outputStructure: "message-modules",
      strategy: ["baseLocale"],
    }),
    // Every page is rendered to an HTML file at build time, so its text is in
    // the page source; React then takes the page over in the browser. The
    // crawl starts at `/` and follows the links it finds.
    tanstackStart({
      prerender: {
        enabled: true,
        crawlLinks: true,
        // `contact.html`, which Pages serves at `/contact` — flat URLs, no
        // trailing slash.
        autoSubfolderIndex: false,
      },
      // No menu links to the blog yet, so it is named here; the crawl finds
      // each post from its list. The 404 is linked from nowhere either. It is what the router shows for no route (src/server.ts), written as the
      // 404.html Pages answers every unknown address with.
      pages: [
        { path: ROUTES.home },
        { path: ROUTES.blog },
        // A hidden post is in no list for the crawl to follow.
        ...readPosts()
          .filter((post) => post.hidden)
          .map((post) => ({ path: `${ROUTES.blog}/${post.slug}` })),
        { path: ROUTES.notFound, prerender: { outputPath: "/404.html" } },
      ],
    }),
    // Before React's plugin: it compiles the blog's MDX into the JSX that one reads.
    blogPlugin(),
    react(),
    cvPlugin(),
    sitemapPlugin(),
  ],
  build: {
    // Everything Vite names by a hash of its content goes in a folder of its
    // own, apart from public/assets, so public/_headers can tell the two apart.
    assetsDir: "_build",
  },
  resolve: {
    // `@` is the src root — tests reach into the app without counting ../
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  define: {
    // The address on /contact comes from the environment at build time, so it
    // is in no file of the repo — and goes into the bundle base64-encoded, so
    // it is not in the deployed files as text a scraper can grep either.
    __CONTACT_EMAIL__: JSON.stringify(btoa(process.env.CONTACT_EMAIL || "hello@example.com")),
    __COMMIT__: JSON.stringify(commit()),
    // The year of the build, for what a page counts from it (/work-with-me); the
    // browser recounts once the page runs.
    __BUILD_YEAR__: new Date().getFullYear(),
  },
  server: {
    port: 4321,
    strictPort: true,
  },
  test: {
    // tests/e2e belongs to Playwright; vitest would otherwise pick the specs up.
    exclude: [...configDefaults.exclude, "tests/e2e/**"],
  },
});
