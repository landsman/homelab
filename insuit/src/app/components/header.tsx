import { Link, useRouterState } from "@tanstack/react-router";
import { ROUTES } from "@/app/routes";
import { m } from "@/paraglide/messages.js";

// /work-with-me opens with the name, leading home. No other page has a header:
// the home page is the name already, the CV starts with it in large type, and
// "Let's talk" is a few lines where a header only adds noise. They keep its
// room instead, which the page's own <main> holds (styles/page.css).
export function Header() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname !== ROUTES.hire) return null;

  return (
    <header>
      <Link to={ROUTES.home}>{m.common_site_name()}</Link>
    </header>
  );
}
