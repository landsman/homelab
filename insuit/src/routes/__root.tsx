import { useEffect, type ReactNode } from "react";
import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { loadAnalytics } from "@/app/analytics";
import { animateFavicon } from "@/app/animated-favicon";
import { Footer } from "@/app/components/footer";
import { pageMeta } from "@/app/page-meta";
import { ROUTES } from "@/app/routes";
import { THEME_BOOT } from "@/app/theme-boot";
import styles from "@/index.css?url";
import { m } from "@/paraglide/messages.js";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      // The home page's tags; a route's own `head` replaces them by name.
      ...pageMeta({ title: m.home_title(), description: m.home_description(), path: ROUTES.home }),
    ],
    links: [
      // app/animated-favicon.ts swaps this href to animate; it stays the static
      // disc without JS.
      { rel: "icon", type: "image/svg+xml", href: "/assets/icons/favicon.svg" },
      { rel: "apple-touch-icon", href: "/assets/icons/apple-touch-icon.png" },
      {
        rel: "preload",
        href: "/assets/fonts/fira-mono-latin-400-normal.woff2",
        as: "font",
        type: "font/woff2",
        crossOrigin: "",
      },
      { rel: "stylesheet", href: styles },
    ],
  }),
  shellComponent: Shell,
  component: RootLayout,
});

// Every page is rendered to HTML at build time, this document around it, and
// React takes it over in the browser.
function Shell({ children }: { children: ReactNode }) {
  return (
    // The boot script below sets data-theme before React sees the element.
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        {/* Inline and blocking: a stored theme override has to land on <html>
            before first paint, or the page flashes the OS theme first. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

// Each page renders its own <main>; the footer under it is shared. Both are
// laid out by <body> (styles/page.css).
function RootLayout() {
  useEffect(() => {
    animateFavicon();
    loadAnalytics();
  }, []);

  return (
    <>
      <Outlet />
      <Footer />
    </>
  );
}
