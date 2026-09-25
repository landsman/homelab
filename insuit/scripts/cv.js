// Renders site/cv.md into site/cv.html — the markdown is the source, the page is
// a build output (gitignored), so the two can never drift. `make cv` runs it.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { imageSize } from "image-size";
import { marked } from "marked";

// Links out of the site — every project's website — open in a new tab, so the
// CV stays open behind them. Links within the site keep the default.
marked.use({
  renderer: {
    link({ href, title, tokens: text }) {
      const external = /^https?:\/\//.test(href);
      const attrs = external ? ' target="_blank" rel="noopener"' : "";
      const tip = title ? ` title="${title}"` : "";
      // The icon shows in the project dialog only (cv.css); the hidden text
      // tells a screen reader the tab changes wherever the link sits.
      const hint = external
        ? '<span class="icon-external" aria-hidden="true"></span><span class="visually-hidden"> (opens in a new tab)</span>'
        : "";
      return `<a href="${href}"${tip}${attrs}>${this.parser.parseInline(text)}${hint}</a>`;
    },
  },
});

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

// A project without a logo still gets a tile the size of one, so the row of
// cards stays even: the name before the colon, set as a wordmark. Decorative —
// the button's own text already names the project.
const tile = (text) => `<span class="project-tile" aria-hidden="true">${text.split(":")[0]}</span>`;

// A project can carry any number of images: the first is its card, and the
// dialog shows them all — one on its own, several as a gallery.
// A gallery of mostly tall pictures — phone screenshots — gets a row of
// equal-height frames instead of the equal-size grid, which would crop each one
// to a strip of its status bar. A picture whose size cannot be read (a few
// JPEGs trip the reader, browsers render them fine) counts as wide.
const isTall = (href) => {
  try {
    const { width, height } = imageSize(readFileSync(new URL(`.${href}`, site)));
    return height > width;
  } catch (error) {
    console.warn(`cv: cannot read the size of ${href} (${error.message}), treating it as wide`);
    return false;
  }
};

const card = ({ heading, images, tall, rest }) => {
  const name = marked.parseInline(heading.text);
  const [logo = ""] = images;
  // In the dialog every image is a button that opens it full size (assets/js/cv.js).
  const zoomable = images.map((i) => `<button type="button" class="photo-zoom">${i}</button>`);
  // A project that links a YouTube video shows its first picture with a play
  // button in the dialog; nothing loads from YouTube until that is pressed, and
  // then the player replaces it and starts (assets/js/cv.js).
  const video = rest
    .map((t) => t.raw)
    .join("")
    .match(/youtube\.com\/watch\?v=([\w-]+)/)?.[1];
  const pictures = video
    ? `<button type="button" class="photo-zoom video-play" data-video="${video}" aria-label="Play the video: ${heading.text}">${logo}<span class="video-badge" aria-hidden="true"><span class="icon-play"></span></span></button>`
    : images.length > 1
      ? `<div class="project-gallery${tall.filter(Boolean).length > tall.length / 2 ? " project-gallery-tall" : ""}">${zoomable.join("")}</div>`
      : zoomable.join("");
  const file = slug(heading.text);
  writeFileSync(
    new URL(`${file}.html`, fragments),
    `<h4 id="project-dialog-title">${name}</h4>\n${pictures}\n${render(rest)}`,
  );
  return `<h4 class="project">
  <button
    type="button"
    hx-get="/cv/${file}"
    hx-target="#project-dialog-content"
    hx-on::after-request="if (event.detail.successful) { const d = document.getElementById('project-dialog'); d.showModal(); d.focus(); }"
  ><span class="frame">${logo || tile(heading.text)}</span><span class="project-name">${name}</span></button>
</h4>`;
};

const out = [];
let group = null;
const flush = () => {
  // A small label names the row of cards, the way "Experience" names the jobs.
  if (group)
    out.push(
      `<p class="projects-label">Projects</p>\n<div class="projects">\n${group.map(card).join("\n")}\n</div>`,
    );
  group = null;
};
for (const t of tokens) {
  if (t.type === "heading" && t.depth < 4) flush();
  if (t.type === "heading" && t.depth === 4) {
    (group ??= []).push({ heading: t, images: [], tall: [], rest: [] });
  } else if (group) {
    const project = group.at(-1);
    // A paragraph of nothing but images — one per line, or several side by side.
    const pictures = t.type === "paragraph" ? t.tokens.filter((i) => i.type === "image") : [];
    const onlyImages =
      pictures.length > 0 &&
      t.tokens.every((i) => i.type === "image" || (i.type === "text" && !i.text.trim()));
    if (onlyImages) project.images.push(...pictures.map((i) => marked.parseInline(i.raw)));
    if (onlyImages) project.tall.push(...pictures.map((i) => isTall(i.href)));
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

const title = "Curriculum Vitae - Michal Landsman";
const description = "Michal Landsman, full-stack developer in Prague: experience and projects.";

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
        tabindex="-1"
      >
        <button
          class="project-dialog-close"
          type="button"
          commandfor="project-dialog"
          command="close"
          aria-label="Close"
          title="Close"
        >
          ×
        </button>
        <div id="project-dialog-content"></div>
      </dialog>

      <dialog id="photo-dialog" class="photo-dialog" closedby="any" aria-label="Photo" tabindex="-1">
        <button
          class="project-dialog-close"
          type="button"
          commandfor="photo-dialog"
          command="close"
          aria-label="Close"
          title="Close"
        >
          ×
        </button>
        <button id="photo-previous" class="photo-step" type="button" aria-label="Previous photo">
          ‹
        </button>
        <button id="photo-next" class="photo-step" type="button" aria-label="Next photo">›</button>
        <figure>
          <img id="photo-dialog-image" src="data:," alt="" />
          <figcaption id="photo-dialog-caption"></figcaption>
        </figure>
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
