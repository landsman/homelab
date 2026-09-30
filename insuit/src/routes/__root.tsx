import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import { Footer } from "../app/components/footer";
import { usePageTitle } from "../app/hooks/use-page-title";
import { ROUTES } from "../app/routes";

// Each page renders its own <main>; the footer under it is shared. Both are
// laid out by <body> (styles/page.css), which #root steps out of the way of.
function RootLayout() {
  return (
    <>
      <Outlet />
      <Footer />
    </>
  );
}

function NotFound() {
  usePageTitle("Page not found — Michal Landsman");

  return (
    <main className="wrapper">
      <h1>Nothing here</h1>

      <div className="content">
        <p>
          This page does not exist. <Link to={ROUTES.home}>Go to the homepage</Link>
        </p>
      </div>
    </main>
  );
}

export const Route = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFound,
});
