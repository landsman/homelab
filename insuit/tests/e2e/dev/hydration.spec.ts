import { test } from "../fixture";
import { expectCleanTakeover, TAKEOVER_PATHS } from "../takeover";

// The same check as common/prerender.spec.ts, against `make dev` instead of the
// built site. A production build of React reports a differing element or text
// and stays silent about a differing attribute — a `title`, an `href`, a
// `hidden` that the render at build time and the one in the browser disagree
// on. The development build reports those too, so this is where they fail.
for (const path of TAKEOVER_PATHS) {
  test(`React takes ${path} over without an error, attributes included`, async ({ page }) => {
    await expectCleanTakeover(page, path);
  });
}
