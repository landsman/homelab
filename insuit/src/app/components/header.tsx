import { Link, useRouterState } from "@tanstack/react-router";
import { ROUTES } from "@/app/routes";
import { m } from "@/paraglide/messages.js";

// The home page is the name and sits in the middle of the screen, so it has no
// header. /work-with-me opens with the name, leading home. The rest get the same room
// at the top without it: the CV starts with the name in large type already, and
// "Let's talk" is a few lines in the middle, where a header only adds noise.
export function Header() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname === ROUTES.home) return null;
  if (pathname !== ROUTES.hire) return <div className="header-space" />;

  return (
    <header>
      <Link to={ROUTES.home}>{m.common_site_name()}</Link>
    </header>
  );
}
