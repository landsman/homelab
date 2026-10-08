import { Link, useMatches, useRouterState } from "@tanstack/react-router";
import { ROUTES } from "@/app/routes";
import { ThemeToggle } from "@/app/components/theme-toggle";
import { m } from "@/paraglide/messages.js";

export function Footer() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // Back is one level up, which the page's own route names (`staticData.up`,
  // as a post names the blog's list); home for every page that does not.
  const up = useMatches({ select: (matches) => matches.at(-1)?.staticData.up }) ?? ROUTES.home;

  return (
    <footer>
      <nav className="links" aria-label={m.common_nav_label()}>
        {pathname === ROUTES.home ? (
          <>
            <Link to={ROUTES.hire}>{m.hire_heading()}</Link>
            <Link to={ROUTES.cv}>{m.common_nav_cv()}</Link>
            <Link to={ROUTES.contact}>{m.contact_heading()}</Link>
          </>
        ) : (
          // The arrow is for the eye; a screen reader is told "Back", not
          // "leftwards arrow, Back". Exact: the page Back leads to is not the
          // page it is on, though /blog is the start of a post's address.
          <Link to={up} aria-label={m.common_nav_back()} activeOptions={{ exact: true }}>
            {`← ${m.common_nav_back()}`}
          </Link>
        )}
      </nav>

      {/* Beside a lone Back there is room; the home page's menu has none, and
          there it sits top right (routes/__root.tsx). */}
      {pathname !== ROUTES.home && <ThemeToggle />}
    </footer>
  );
}
