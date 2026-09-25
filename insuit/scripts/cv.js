// Renders site/cv.md into site/cv.html — the markdown is the source, the page is
// a build output (gitignored), so the two can never drift. `make cv` runs it.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { marked } from "marked";

const site = new URL("../site/", import.meta.url);
// ponytail: the markdown is ours, so marked's output goes in unsanitised.
const md = readFileSync(new URL("cv.md", site), "utf8");
const tokens = marked.lexer(md);
const render = (list) => marked.parser(Object.assign(list, { links: tokens.links }));

// Every `####` is a project. A run of them under one job becomes a row of
// cards — logo and name — and each card's details, like LinkedIn's project
// view, open in the page's one modal <dialog>. The details are not in the page:
// each project is written out as its own fragment under site/cv/, and htmx
// fetches it into the dialog on click, then opens it.
const fragments = new URL("cv/", site);
rmSync(fragments, { recursive: true, force: true });
mkdirSync(fragments);

const slug = (text) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const card = ({ heading, image, rest }) => {
  const name = marked.parseInline(heading.text);
  const logo = image ? marked.parseInline(image.raw) : "";
  const file = slug(heading.text);
  writeFileSync(
    new URL(`${file}.html`, fragments),
    `<h4 id="project-dialog-title">${name}</h4>\n${logo}\n${render(rest)}`,
  );
  return `<h4 class="project">
  <button
    type="button"
    hx-get="/cv/${file}"
    hx-target="#project-dialog-content"
    hx-on::after-request="event.detail.successful && document.getElementById('project-dialog').showModal()"
  >${logo}<span>${name}</span></button>
</h4>`;
};

const out = [];
let group = null;
const flush = () => {
  if (group) out.push(`<div class="projects">\n${group.map(card).join("\n")}\n</div>`);
  group = null;
};
for (const t of tokens) {
  if (t.type === "heading" && t.depth < 4) flush();
  if (t.type === "heading" && t.depth === 4) {
    (group ??= []).push({ heading: t, image: null, rest: [] });
  } else if (group) {
    const project = group.at(-1);
    const isImage = t.type === "paragraph" && t.tokens.length === 1 && t.tokens[0].type === "image";
    if (isImage && !project.image) project.image = t.tokens[0];
    else project.rest.push(t);
  } else {
    out.push(render([t]));
  }
}
flush();
const body = out.join("");

// The one check this needs: no project dropped or doubled by the grouping.
const expected = tokens.filter((t) => t.type === "heading" && t.depth === 4).length;
const rendered = body.match(/hx-get=/g)?.length ?? 0;
if (rendered !== expected)
  throw new Error(`cv: ${expected} projects in cv.md, ${rendered} rendered`);

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
    <script src="/assets/js/htmx.min.js" defer></script>
    <script src="/assets/js/cv.js" defer></script>
  </head>
  <body>
    <main class="wrapper cv">
${body}

      <dialog
        id="project-dialog"
        class="project-dialog"
        closedby="any"
        aria-labelledby="project-dialog-title"
      >
        <button
          class="project-dialog-close"
          type="button"
          commandfor="project-dialog"
          command="close"
          aria-label="Close"
        >
          ×
        </button>
        <div id="project-dialog-content"></div>
      </dialog>
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
