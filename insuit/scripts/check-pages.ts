// Asks a deployed copy of the site the questions scripts/preview.ts answers
// locally, so the local preview cannot drift from what Cloudflare Pages really
// does. CI runs it against each PR's preview:
//
//   bun scripts/check-pages.ts https://<branch>.insuit-preview.pages.dev [commit]
//
// With a commit, it first waits until the site says it is that commit — every
// page carries <meta name="commit"> — so a deploy that did not land, or has not
// reached the address yet, fails here instead of passing on the old version.

const base = process.argv[2]?.replace(/\/$/, "");
const commit = process.argv[3];
if (!base) {
  console.error("usage: bun scripts/check-pages.ts <base-url> [commit]");
  process.exit(2);
}

/** The commit a page says it was built from. */
const commitOf = (html: string) => html.match(/<meta name="commit" content="([^"]*)"/)?.[1];

type Expect = { status: number; location?: string; header?: [string, string] };

const checks: [string, Expect][] = [
  ["/", { status: 200 }],
  ["/contact", { status: 200 }],
  ["/contact.html", { status: 308, location: "/contact" }],
  ["/contact/", { status: 308, location: "/contact" }],
  ["/no-such-page", { status: 404 }],
  ["/assets/icons/favicon.svg", { status: 200, header: ["content-type", "image/svg+xml"] }],
];

async function ask(path: string, expect: Expect): Promise<string | null> {
  const response = await fetch(base + path, { redirect: "manual" });
  if (response.status !== expect.status) return `status ${response.status}, not ${expect.status}`;
  const location = response.headers.get("location");
  if (expect.location && location !== expect.location)
    return `redirects to ${location}, not ${expect.location}`;
  if (expect.header && !response.headers.get(expect.header[0])?.includes(expect.header[1]))
    return `${expect.header[0]} is ${response.headers.get(expect.header[0])}`;
  return null;
}

// The hashed files are named in the home page; one of them has to be cached for good.
async function hashedFileIsImmutable(): Promise<string | null> {
  const html = await (await fetch(base + "/")).text();
  const hashed = html.match(/\/_build\/[\w.-]+\.js/)?.[0];
  if (!hashed) return "the home page names no /_build/ file";
  // Right after a deploy the edge can still answer "no-store" for a while,
  // before the _headers rule reaches it — asked again before it counts. As
  // long as the wait for the deployment itself: 30 s once fell short.
  let cache = "";
  for (let attempt = 0; attempt < 30; attempt++) {
    cache = (await fetch(base + hashed)).headers.get("cache-control") ?? "";
    if (cache.includes("immutable")) return null;
    await Bun.sleep(3000);
  }
  return `${hashed} has cache-control "${cache}"`;
}

// A deployment takes a moment to answer on its address; the home page is asked
// until it does, and until it is the commit that was asked for.
let serving: string | undefined;
for (let attempt = 0; attempt < 30; attempt++) {
  const response = await fetch(base + "/").catch(() => null);
  if (response?.status === 200) {
    serving = commitOf(await response.text());
    if (!commit || serving === commit) break;
  }
  await Bun.sleep(3000);
}

// A page names its own address and its link-preview card with a full URL, set
// at build time (VITE_SITE_URL). Both have to be this deployment's, and the
// card has to be there — or a shared link shows another site's, or none.
async function namesItself(): Promise<string | null> {
  const html = await (await fetch(base + "/")).text();
  const tag = (property: string) =>
    html.match(new RegExp(`property="${property}" content="([^"]*)"`))?.[1] ?? "(none)";
  if (!tag("og:url").startsWith(base)) return `og:url is ${tag("og:url")}`;
  const card = tag("og:image");
  if (!card.startsWith(base)) return `og:image is ${card}`;
  const response = await fetch(card);
  const type = response.headers.get("content-type") ?? "";
  if (response.status !== 200 || !type.includes("image/png"))
    return `${card} answers ${response.status} ${type}`;
  return null;
}

let failed = 0;
if (commit) {
  const landed = serving === commit;
  console.log(
    `${landed ? "ok  " : "FAIL"}  serves commit ${serving ?? "(none named)"}${landed ? "" : `, not ${commit}`}`,
  );
  if (!landed) failed++;
} else {
  console.log(`      serves commit ${serving ?? "(none named)"}`);
}
for (const [path, expect] of checks) {
  const problem = await ask(path, expect);
  console.log(`${problem ? "FAIL" : "ok  "}  ${path}${problem ? ` — ${problem}` : ""}`);
  if (problem) failed++;
}
const cacheProblem = await hashedFileIsImmutable();
console.log(
  `${cacheProblem ? "FAIL" : "ok  "}  hashed files are cached for good${cacheProblem ? ` — ${cacheProblem}` : ""}`,
);
if (cacheProblem) failed++;

// A build for localhost names the real site, as it has no address of its own.
if (new URL(base).hostname !== "localhost") {
  const problem = await namesItself();
  console.log(
    `${problem ? "FAIL" : "ok  "}  names its own address and link-preview card${problem ? ` — ${problem}` : ""}`,
  );
  if (problem) failed++;
}

process.exit(failed ? 1 : 0);
