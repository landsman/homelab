import { defineConfig, configDefaults } from "vitest/config";
import react from "@vitejs/plugin-react";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import { cvPlugin } from "./vite/cv.ts";

export default defineConfig({
  plugins: [TanStackRouterVite({ target: "react", autoCodeSplitting: true }), react(), cvPlugin()],
  resolve: {
    // `@` is the src root — tests reach into the app without counting ../
    alias: { "@": "/src" },
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
