import { usePageTitle } from "../../app/hooks/use-page-title";

const email = atob(__CONTACT_EMAIL__);

// The title is the address without its scheme — what the link leads to.
const PROFILES = [
  { name: "Twitter/X", url: "https://x.com/Landsman" },
  { name: "Bluesky", url: "https://bsky.app/profile/landsman.bsky.social" },
  { name: "LinkedIn", url: "https://www.linkedin.com/in/landsmanmichal" },
  { name: "GitHub", url: "https://github.com/landsman" },
];

export function ContactPage() {
  usePageTitle("Let's talk — Michal Landsman");

  return (
    <main className="wrapper">
      <h1>Let's talk</h1>

      <div className="content">
        <p>You'll find me here:</p>

        <nav className="links links-stacked">
          <a href={`mailto:${email}`}>{email}</a>
          {PROFILES.map(({ name, url }) => (
            <a
              key={url}
              href={url}
              title={url.replace(/^https:\/\/(www\.)?/, "")}
              target="_blank"
              rel="noopener"
            >
              {name}
            </a>
          ))}
        </nav>
      </div>
    </main>
  );
}
