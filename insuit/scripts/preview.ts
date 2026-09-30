// Serves the built site the way Cloudflare Pages serves it, for `make preview`
// and the browser tests. Pages' own local server (`wrangler pages dev`) needs
// Node: under Bun it accepts a connection and never answers. So this is those
// rules written out — the ones this site relies on, not all of Pages:
//
//   /contact        → contact.html                     200
//   /contact.html   → /contact                         308
//   /contact/       → /contact                         308
//   /               → index.html                       200
//   anything else   → 404.html                         404
//   _headers        → added to the responses it names
//
// scripts/check-pages.ts asks the real thing the same questions after a
// deploy, so the two cannot drift apart unnoticed.

/** The default Pages gives everything, until a `_headers` rule says otherwise. */
const DEFAULT_HEADERS = {
  "cache-control": "public, max-age=0, must-revalidate",
  "x-content-type-options": "nosniff",
};

type HeaderRule = { pattern: RegExp; headers: [string, string][] };

/** `_headers`: a path on its own line, then its indented `Name: value` lines. */
export function parseHeaders(text: string): HeaderRule[] {
  const rules: HeaderRule[] = [];
  for (const line of text.split("\n")) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    if (/^\s/.test(line)) {
      const [name, ...value] = line.trim().split(":");
      rules.at(-1)?.headers.push([name.toLowerCase(), value.join(":").trim()]);
    } else {
      // `*` stands for anything, a slash included; the rest is literal.
      const pattern = line
        .trim()
        .split("*")
        .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
        .join(".*");
      rules.push({ pattern: new RegExp(`^${pattern}$`), headers: [] });
    }
  }
  return rules;
}

/** A request in, the response Pages would give for the files in `dir`. */
export async function createHandler(dir: string) {
  const file = (path: string) => Bun.file(`${dir}${path}`);
  const exists = (path: string) => file(path).exists();
  const headersFile = file("/_headers");
  const rules = (await headersFile.exists()) ? parseHeaders(await headersFile.text()) : [];

  const respond = (path: string, served: string, status = 200) => {
    const headers = new Headers(DEFAULT_HEADERS);
    headers.set("content-type", file(served).type);
    for (const rule of rules)
      if (rule.pattern.test(path))
        for (const [name, value] of rule.headers) headers.set(name, value);
    return new Response(file(served), { status, headers });
  };
  const redirect = (to: string) => new Response(null, { status: 308, headers: { location: to } });

  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    const path = decodeURIComponent(url.pathname);
    // Nothing above the folder, and not the files that configure Pages.
    if (path.includes("..") || path === "/_headers" || path === "/_redirects")
      return respond(path, "/404.html", 404);

    if (path === "/") return respond(path, "/index.html");
    if (path === "/index.html") return redirect("/" + url.search);
    if (path.endsWith(".html") && (await exists(path)))
      return redirect(path.slice(0, -".html".length) + url.search);
    if (path.endsWith("/") && (await exists(`${path.slice(0, -1)}.html`)))
      return redirect(path.slice(0, -1) + url.search);

    if (await exists(`${path}.html`)) return respond(path, `${path}.html`);
    // A folder is not a file: Bun.file() says a directory exists.
    if (!path.endsWith("/") && (await exists(path)) && (await file(path).stat()).isFile())
      return respond(path, path);
    return respond(path, "/404.html", 404);
  };
}

if (import.meta.main) {
  const port = Number(process.env.PORT) || 8788;
  const fetch = await createHandler("dist/client");
  Bun.serve({ port, fetch });
  console.log(`serving dist/client on http://localhost:${port}`);
}
