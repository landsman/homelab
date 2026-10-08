import { expect, test } from "@playwright/test";
import { rules } from "./redirects";

// Where each short link leads is someone else's site, which changes without a
// commit here — so this runs nightly, never as part of a deploy. Only a page
// that says it is gone fails. A 403 or a 5xx is a site turning a bot away, or
// down for an hour; neither means the link should change, so it is annotated
// rather than counted.
const GONE = [404, 410];

for (const { to } of rules) {
  test(to, async ({ request }) => {
    // A thrown error — no DNS, no server — is what a lapsed domain looks like.
    const response = await request.get(to, {
      timeout: 20_000,
      headers: { "user-agent": "Mozilla/5.0 (compatible; insuit-smoke)" },
    });
    if (!response.ok() && !GONE.includes(response.status()))
      test.info().annotations.push({ type: "not counted", description: `${response.status()}` });
    expect(GONE, `${to} answers ${response.status()} at ${response.url()}`).not.toContain(
      response.status(),
    );
  });
}
