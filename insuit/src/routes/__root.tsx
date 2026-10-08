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
import { FONTS, ICONS } from "@/app/assets";
import { Footer } from "@/app/components/footer";
import { Header } from "@/app/components/header";
import { ThemeToggle } from "@/app/components/theme-toggle";
import { ROUTES } from "@/app/routes";
import { THEME_BOOT } from "@/app/theme-boot";
import styles from "@/index.css?url";
import { m } from "@/paraglide/messages.js";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      // Which version this is: view source, or scripts/check-pages.ts.
      { name: "commit", content: __COMMIT__ },
      // What a page gets when no route says otherwise — and the one page with
      // no route to say it is "nothing here", so these are its tags. Every
      // real page replaces both through pageMeta() in its own `head`; one that
      // forgets is titled "Page not found", which a test notices.
      { title: m.not_found_title() },
      { name: "robots", content: "noindex, nofollow" },
    ],
    links: [
      // app/animated-favicon.ts swaps this href to animate; it stays the static
      // disc without JS.
      { rel: "icon", type: "image/svg+xml", href: ICONS.favicon },
      { rel: "apple-touch-icon", href: ICONS.appleTouch },
      {
        rel: "preload",
        href: FONTS.regular,
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

// Each page renders its own <main>; the header over it and the footer under it
// are shared. All three are laid out by <body> (styles/page.css).
function RootLayout() {
  useEffect(() => {
    loadAnalytics();
    return animateFavicon();
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

  // On the home page the theme switch sits top right, clear of the menu in
  // the footer; every other page has only Back there, and room beside it.
  const home = useRouterState({ select: (s) => s.location.pathname === ROUTES.home });

  return (
    <>
      <Header />
      <Outlet />
      <Footer />
      {/* Last, so page.css's `:first-child` still finds the page; its place on
          screen is the stylesheet's. */}
      {home && <ThemeToggle />}
    </>
  );
}
