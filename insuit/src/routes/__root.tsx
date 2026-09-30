import { useEffect, useRef, type ReactNode } from "react";
import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
  useRouterState,
} from "@tanstack/react-router";
import { loadAnalytics } from "@/app/analytics";
import { animateFavicon } from "@/app/animated-favicon";
import { Footer } from "@/app/components/footer";
import { pageMeta } from "@/app/page-meta";
import { ROUTES } from "@/app/routes";
import { THEME_BOOT } from "@/app/theme-boot";
import styles from "@/index.css?url";
import { m } from "@/paraglide/messages.js";

export const Route = createRootRoute({
  head: ({ matches }) => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      // Only the root matched: the address is no page, and the router shows the
      // "nothing here" page, which has no route whose `head` could say so.
      ...(matches.length === 1
        ? [{ title: m.not_found_title() }, { name: "robots", content: "noindex, nofollow" }]
        : // The home page's tags; a route's own `head` replaces them by name.
          pageMeta({
            title: m.home_title(),
            description: m.home_description(),
            path: ROUTES.home,
          })),
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

  // A link swaps the page without loading a document, so nothing tells a
  // keyboard or a screen reader that it changed: focus would stay on the link
  // that was followed. Move it to the new page's <main>, as a page load would
  // start there. Not on the first render, which is a page load. The resolved
  // location, not the current one: that changes on the click, while the next
  // page's code may still be on its way and the old <main> is still up.
  const pathname = useRouterState({ select: (s) => s.resolvedLocation?.pathname });
  const arrived = useRef(pathname);
  useEffect(() => {
    const from = arrived.current;
    arrived.current = pathname;
    if (from === undefined || from === pathname) return;
    const main = document.querySelector("main");
    if (!main) return;
    main.tabIndex = -1;
    main.focus({ preventScroll: true });
  }, [pathname]);

  return (
    <>
      <Outlet />
      <Footer />
    </>
  );
}
