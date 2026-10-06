import { Link, useRouterState } from "@tanstack/react-router";
import { ROUTES } from "@/app/routes";
import { ThemeToggle } from "@/app/components/theme-toggle";
import { m } from "@/paraglide/messages.js";

export function Footer() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // Back is one level up: from a post to the blog's list, from the rest home.
  const back = pathname.startsWith(`${ROUTES.blog}/`) ? ROUTES.blog : ROUTES.home;

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
          // "leftwards arrow, Back".
          // Exact: /blog is where a post's Back leads, not the page it is on.
          <Link to={back} aria-label={m.common_nav_back()} activeOptions={{ exact: true }}>
            {`← ${m.common_nav_back()}`}
          </Link>
        )}
      </nav>

      <ThemeToggle />
    </footer>
  );
}
