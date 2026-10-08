// Every page carries <meta name="commit">. With SMOKE_COMMIT set, the run waits
// until the site says it is that commit, so a deploy that did not land, or has
// not reached the address yet, fails here instead of passing on the old one.
export const commitOf = (html: string) => html.match(/<meta name="commit" content="([^"]*)"/)?.[1];

export default async function waitForCommit() {
  const commit = process.env.SMOKE_COMMIT;
  if (!commit) return;
  const site = process.env.SMOKE_URL?.replace(/\/$/, "") ?? "https://www.insuit.cz";
  let serving: string | undefined;
  for (let attempt = 0; attempt < 30; attempt++) {
    const response = await fetch(site + "/").catch(() => null);
    if (response?.status === 200) serving = commitOf(await response.text());
    if (serving === commit) return;
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  throw new Error(`${site} serves commit ${serving ?? "(none named)"}, not ${commit}`);
}
