// Renders site/cv.md into site/cv.html — the markdown is the source, the page is
// a build output (gitignored), so the two can never drift. `make cv` runs it.
import { readFileSync, writeFileSync } from "node:fs";
import { marked } from "marked";

const site = new URL("../site/", import.meta.url);
// ponytail: the markdown is ours, so marked's output goes in unsanitised.
const body = marked.parse(readFileSync(new URL("cv.md", site), "utf8"));

const title = "CV — Michal Landsman";
const description = "Michal Landsman, full-stack developer in Prague — experience and projects.";

writeFileSync(
  new URL("cv.html", site),
  `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <!-- Hidden: linked from nowhere, and kept out of search results. -->
    <meta name="robots" content="noindex, nofollow" />

    <title>${title}</title>
    <meta name="description" content="${description}" />

    <link rel="icon" type="image/svg+xml" href="/assets/icons/favicon.svg" />
    <link rel="apple-touch-icon" href="/assets/icons/apple-touch-icon.png" />

    <link
      rel="preload"
      href="/assets/fonts/fira-mono-latin-400-normal.woff2"
      as="font"
      type="font/woff2"
      crossorigin
    />
    <link rel="stylesheet" href="/assets/style.css" />

    <script src="/assets/js/theme.js"></script>
    <script src="/assets/js/favicon.js" defer></script>
  </head>
  <body>
    <main class="wrapper cv">
${body}
    </main>

    <footer>
      <nav class="links"><a href="/">← Back</a></nav>

      <button
        id="theme-toggle"
        class="theme-toggle"
        type="button"
        title="Switch theme"
        aria-label="Switch theme"
        hidden
      >
        <span class="icon-theme" aria-hidden="true"></span>
      </button>
    </footer>
  </body>
</html>
`,
);
