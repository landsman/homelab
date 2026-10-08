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
    <main className="wrapper contact">
      <h1>{m.contact_heading()}</h1>

      <div className="content">
        {/* The address first and largest: it is what the page is for. The line
            is there before the address is, so nothing below it moves. */}
        <p className="contact-email">{email && <a href={`mailto:${email}`}>{email}</a>}</p>

        <p className="label" id="elsewhere">
          {m.contact_elsewhere()}
        </p>
        <nav className="links links-shown" aria-labelledby="elsewhere">
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
