// Asks a deployed copy of the site the questions scripts/preview.ts answers
// locally, so the local preview cannot drift from what Cloudflare Pages really
// does. CI runs it against each PR's preview:
//
//   bun scripts/check-pages.ts https://<branch>.insuit-cz.pages.dev

const base = process.argv[2]?.replace(/\/$/, "");
if (!base) {
  console.error("usage: bun scripts/check-pages.ts <base-url>");
  process.exit(2);
}

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
  const cache = (await fetch(base + hashed)).headers.get("cache-control") ?? "";
  return cache.includes("immutable") ? null : `${hashed} has cache-control "${cache}"`;
}

// A deployment takes a moment to answer on its alias; the first page is asked
// until it does.
for (let attempt = 0; attempt < 20; attempt++) {
  if ((await fetch(base + "/").catch(() => null))?.status === 200) break;
  await Bun.sleep(3000);
}

let failed = 0;
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

process.exit(failed ? 1 : 0);
