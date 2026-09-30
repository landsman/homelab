import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ROUTES } from "@/app/routes";
import { m } from "@/paraglide/messages.js";

// What I can take on, one heading and one paragraph each, in the order a
// product goes through them: thought up, designed, built, run, sold; the
// team comes last. No employer or
// client is named: this page is indexed, the CV that names them is not.
const OFFERS = [
  [m.hire_idea_heading, m.hire_idea_body],
  [m.hire_design_heading, m.hire_design_body],
  [m.hire_product_heading, m.hire_product_body],
  [m.hire_agents_heading, m.hire_agents_body],
  [m.hire_infrastructure_heading, m.hire_infrastructure_body],
  [m.hire_market_heading, m.hire_market_body],
  [m.hire_order_heading, m.hire_order_body],
  [m.hire_rebuild_heading, m.hire_rebuild_body],
  [m.hire_team_heading, m.hire_team_body],
];

// The CV in six lines, for whoever reads no further. Each opens with its
// point in bold, so the list reads by those alone.
const IN_SHORT = [
  [m.hire_short_generalist_term, m.hire_short_generalist],
  [m.hire_short_oop_term, m.hire_short_oop],
  [m.hire_short_devops_term, m.hire_short_devops],
  [m.hire_short_team_term, m.hire_short_team],
  [m.hire_short_agents_term, m.hire_short_agents],
  [m.hire_short_learn_term, m.hire_short_learn],
];

// The year I started, at fifteen. The lead counts the years from it.
const STARTED = 2007;

// A sentence for a translator, who places its link where their language wants
// it: the message marks the spot with a line break, and the link goes there.
function linked(message: string, link: ReactNode) {
  const [before, after] = message.split("\n");
  return (
    <>
      {before}
      {link}
      {after}
    </>
  );
}

export function HirePage() {
  // The file says the year of the build, so the render in the browser matches
  // it; then the browser counts from today, and a build from last year does
  // not stay a year behind.
  const [year, setYear] = useState(__BUILD_YEAR__);
  useEffect(() => setYear(new Date().getFullYear()), []);

  return (
    <main className="wrapper hire">
      <h1>{m.hire_heading()}</h1>

      <div className="content">
        <p>{m.hire_lead({ years: year - STARTED })}</p>

        <p className="label" id="in-short">
          {m.hire_short_label()}
        </p>
        <ul aria-labelledby="in-short">
          {IN_SHORT.map(([term, text]) => (
            <li key={term()}>
              <strong>{term()}</strong> {text()}
            </li>
          ))}
        </ul>
        <p className="long">
          {linked(m.hire_long({ cv: "\n" }), <Link to={ROUTES.cv}>{m.hire_long_cv()}</Link>)}
        </p>

        {OFFERS.map(([heading, body]) => (
          <section key={heading()}>
            <h2>{heading()}</h2>
            <p>{body()}</p>
          </section>
        ))}

        <p className="closing">
          {linked(
            m.hire_ask({ talk: "\n" }),
            <Link to={ROUTES.contact}>{m.contact_heading()}</Link>,
          )}
        </p>
      </div>
    </main>
  );
}
