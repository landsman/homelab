// Asks the live link.insuit.cz whether every code in links/_redirects goes
// where the file says. The file can be right while the domain is not: when the
// domain was never attached, every printed QR code was a 404 and every test
// still passed. The deploy runs it once the links are uploaded:
//
//   bun scripts/check-links.ts https://link.insuit.cz
//
// With --targets it also follows each target and fails on one that is gone.
// Those are other people's sites, which change without a commit here, so that
// half runs nightly (insuit-links.yml) rather than on a deploy.

import { readFileSync } from "node:fs";

const base = process.argv[2]?.replace(/\/$/, "");
const targets = process.argv.includes("--targets");
if (!base) {
  console.error("usage: bun scripts/check-links.ts <base-url> [--targets]");
  process.exit(2);
}

const rules = readFileSync(new URL("../links/_redirects", import.meta.url), "utf8")
  .split("\n")
  .map((line) => line.trim().split(/\s+/))
  .filter(([from, to]) => from?.startsWith("/") && to?.startsWith("http"))
  .map(([from, to, status]) => ({ from, to, status: Number(status ?? 302) }));

// Right after a deploy the edge can still answer with the previous file, and a
// domain being verified answers 522, so the first code is asked for half a
// minute and the rest twice — a domain that is down fails in one wait, not 34.
async function shortLink(
  from: string,
  to: string,
  status: number,
  tries: number,
): Promise<string | null> {
  let got = "";
  for (let attempt = 0; attempt < tries; attempt++) {
    const response = await fetch(base + from, { redirect: "manual" }).catch(() => null);
    const location = response?.headers.get("location");
    // Pages writes a bare domain with its slash: https://a.cz becomes https://a.cz/.
    if (response?.status === status && location && new URL(location).href === new URL(to).href)
      return null;
    got = response ? `${response.status} ${location ?? ""}`.trim() : "no answer";
    await Bun.sleep(3000);
  }
  return `answers ${got}, not ${status} ${to}`;
}

// Only a page that says it is gone fails. A 403 or a 5xx is a site turning
// away a bot, or down for an hour; neither means the link should change.
const GONE = [404, 410];
async function target(to: string): Promise<{ problem: string | null; note?: string }> {
  try {
    const response = await fetch(to, {
      signal: AbortSignal.timeout(20_000),
      headers: { "user-agent": "Mozilla/5.0 (compatible; insuit-link-check)" },
    });
    if (GONE.includes(response.status)) return { problem: `${response.status} at ${response.url}` };
    if (!response.ok) return { problem: null, note: `${response.status}, not counted` };
    return { problem: null };
  } catch (error) {
    // No DNS or no server at all is what a lapsed domain looks like.
    return { problem: (error as Error).message };
  }
}

let failed = 0;
for (const [i, { from, to, status }] of rules.entries()) {
  const problem = await shortLink(from, to, status, i === 0 ? 10 : 2);
  console.log(`${problem ? "FAIL" : "ok  "}  ${base}${from}${problem ? ` — ${problem}` : ""}`);
  if (problem) failed++;
}
if (targets) {
  for (const { to } of rules) {
    const { problem, note } = await target(to);
    console.log(
      `${problem ? "FAIL" : "ok  "}  ${to}${problem ? ` — ${problem}` : note ? ` (${note})` : ""}`,
    );
    if (problem) failed++;
  }
}

process.exit(failed ? 1 : 0);
