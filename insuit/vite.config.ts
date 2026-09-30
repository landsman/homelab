import { fileURLToPath } from "node:url";
import { paraglideVitePlugin } from "@inlang/paraglide-js";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, configDefaults } from "vitest/config";
import { ROUTES } from "./src/app/routes.ts";
import { cvPlugin } from "./vite/cv.ts";

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
      // The second is linked from nowhere, so the crawl would not find it. It
      // is what the router shows for no route (src/server.ts), written as the
      // 404.html Pages answers every unknown address with.
      pages: [
        { path: ROUTES.home },
        { path: ROUTES.notFound, prerender: { outputPath: "/404.html" } },
      ],
    }),
    react(),
    cvPlugin(),
  ],
  resolve: {
    // `@` is the src root — tests reach into the app without counting ../
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  define: {
    // The address on /contact comes from the environment at build time, so it
    // is in no file of the repo — and goes into the bundle base64-encoded, so
    // it is not in the deployed files as text a scraper can grep either.
    __CONTACT_EMAIL__: JSON.stringify(btoa(process.env.CONTACT_EMAIL || "hello@example.com")),
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
