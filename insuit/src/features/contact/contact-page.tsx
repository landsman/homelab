import { useEffect, useState } from "react";
import { m } from "@/paraglide/messages.js";

// Names of the services, not words to translate. The title is the address
// without its scheme — what the link leads to.
const PROFILES = [
  { name: "Twitter/X", url: "https://x.com/Landsman" },
  { name: "Bluesky", url: "https://bsky.app/profile/landsman.bsky.social" },
  { name: "LinkedIn", url: "https://www.linkedin.com/in/landsmanmichal" },
  { name: "GitHub", url: "https://github.com/landsman" },
];

export function ContactPage() {
  // The address is the one thing left out of the prerendered HTML, where a
  // scraper would read it: it is decoded and shown once the page runs.
  const [email, setEmail] = useState<string>();
  useEffect(() => setEmail(atob(__CONTACT_EMAIL__)), []);

  return (
    <main className="wrapper">
      <h1>{m.contact_heading()}</h1>

      <div className="content">
        <p>{m.contact_lead()}</p>

        <nav className="links links-stacked" aria-label={m.contact_links_label()}>
          {email && <a href={`mailto:${email}`}>{email}</a>}
          {PROFILES.map(({ name, url }) => (
            <a
              key={url}
              href={url}
              title={url.replace(/^https:\/\/(www\.)?/, "")}
              target="_blank"
              rel="noopener"
            >
              {name}
              <span className="visually-hidden"> {m.common_opens_new_tab()}</span>
            </a>
          ))}
        </nav>
      </div>
    </main>
  );
}
