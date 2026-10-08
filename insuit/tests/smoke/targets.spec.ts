import { expect, test } from "@playwright/test";
import { rules } from "./redirects";

// Where each short link leads is someone else's site, which changes without a
// commit here — so this runs nightly, never as part of a deploy. Only a site
// that says it is gone fails: a 404 or 410, or a name DNS no longer knows,
// which is what a lapsed domain looks like. Anything else — a 403, a 5xx, a
// connection dropped or timed out — is a site turning away a datacenter's
// address or down for an hour; neither means the link should change, so it is
// annotated rather than counted. mintmarket.cz hangs up on GitHub's runners and
// answers 200 everywhere else.
const GONE = [404, 410];

for (const { to } of rules) {
  test(to, async ({ request }) => {
    const response = await request
      .get(to, {
        timeout: 20_000,
        headers: { "user-agent": "Mozilla/5.0 (compatible; insuit-smoke)" },
      })
      .catch((error: Error) => error);
    if (response instanceof Error) {
      expect(response.message, `${to} has no DNS`).not.toContain("ENOTFOUND");
      test.info().annotations.push({
        type: "not counted",
        description: response.message.split("\n")[0],
      });
      return;
    }
    if (!response.ok() && !GONE.includes(response.status()))
      test.info().annotations.push({ type: "not counted", description: `${response.status()}` });
    expect(GONE, `${to} answers ${response.status()} at ${response.url()}`).not.toContain(
      response.status(),
    );
  });
}
