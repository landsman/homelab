import { Link } from "@tanstack/react-router";
import { ROUTES } from "@/app/routes";
import { m } from "@/paraglide/messages.js";

/**
 * Shown for an address that is no page: the router's answer when no route
 * matches, which is also what 404.html is prerendered from (src/server.ts).
 * Its title comes from the root route's `head`.
 */
export function NotFoundPage() {
  return (
    <main className="wrapper">
      <h1>{m.not_found_heading()}</h1>

      <div className="content">
        <p>
          {m.not_found_body()} <Link to={ROUTES.home}>{m.not_found_home_link()}</Link>
        </p>
      </div>
    </main>
  );
}
