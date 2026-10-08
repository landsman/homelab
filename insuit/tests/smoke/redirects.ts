import { readFileSync } from "node:fs";

/** links/_redirects, one `/<code> <target> <status>` rule per entry. */
export const rules = readFileSync(new URL("../../links/_redirects", import.meta.url), "utf8")
  .split("\n")
  .map((line) => line.trim().split(/\s+/))
  .filter(([from, to]) => from?.startsWith("/") && to?.startsWith("http"))
  .map(([from, to, status]) => ({ from, to, status: Number(status ?? 302) }));
