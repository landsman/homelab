import { Link, useRouterState } from "@tanstack/react-router";
import { ROUTES } from "@/app/routes";
import { ThemeToggle } from "@/app/components/theme-toggle";
import { m } from "@/paraglide/messages.js";

export function Footer() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <footer>
      <nav className="links">
        {pathname === ROUTES.home ? (
          <>
            <Link to={ROUTES.contact}>{m.contact_heading()}</Link>
            <Link to={ROUTES.cv}>{m.common_nav_cv()}</Link>
          </>
        ) : (
          <Link to={ROUTES.home}>{m.common_nav_back()}</Link>
        )}
      </nav>

      <ThemeToggle />
    </footer>
  );
}
