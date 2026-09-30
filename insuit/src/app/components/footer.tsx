import { Link, useRouterState } from "@tanstack/react-router";
import { ROUTES } from "@/app/routes";
import { ThemeToggle } from "@/app/components/theme-toggle";

export function Footer() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <footer>
      <nav className="links">
        {pathname === ROUTES.home ? (
          <>
            <Link to={ROUTES.contact}>Let's talk</Link>
            <Link to={ROUTES.cv}>Curriculum vitae</Link>
          </>
        ) : (
          <Link to={ROUTES.home}>← Back</Link>
        )}
      </nav>

      <ThemeToggle />
    </footer>
  );
}
