import { Link, useRouterState } from "@tanstack/react-router";
import { ROUTES } from "@/app/routes";
import { ThemeToggle } from "@/app/components/theme-toggle";
import { m } from "@/paraglide/messages.js";

export function Footer() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <footer>
      <nav className="links" aria-label={m.common_nav_label()}>
        {pathname === ROUTES.home ? (
          <>
            <Link to={ROUTES.contact}>{m.contact_heading()}</Link>
            <Link to={ROUTES.cv}>{m.common_nav_cv()}</Link>
          </>
        ) : (
          // The arrow is for the eye; a screen reader is told "Back", not
          // "leftwards arrow, Back".
          <Link to={ROUTES.home} aria-label={m.common_nav_back()}>
            {`← ${m.common_nav_back()}`}
          </Link>
        )}
      </nav>

      <ThemeToggle />
    </footer>
  );
}
