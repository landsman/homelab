import { usePageTitle } from "../../app/hooks/use-page-title";

export function HomePage() {
  usePageTitle("Michal Landsman");

  return (
    <main className="wrapper">
      <h1>Hello there!</h1>

      <div className="content">
        <p>I'm Michal, a developer in Prague.</p>
        <p>
          Infrastructure, backends, and the client apps on top of them. Some of it as CTO, all of it
          hands-on.
        </p>
        <p>
          Design taken as seriously as the deploy — down to the wording. Rebuildable from zero, or
          it isn't done.
        </p>
      </div>
    </main>
  );
}
