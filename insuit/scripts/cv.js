// Renders site/cv.md into site/cv.html — the markdown is the source, the page is
// a build output (gitignored), so the two can never drift. `make cv` runs it.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { imageSize } from "image-size";
import { marked } from "marked";
import QRCode from "qrcode";

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
mkdirSync(new URL("qr/", fragments), { recursive: true });

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

// The dialogs only exist on screen, so a printed CV would show cards and no
// details. Each project is also written out in full, hidden on screen and shown
// in print instead of the cards (cv.css): name, text, links.
//
// Paper cannot be clicked, so a project's links print as QR codes, each with
// the site's name under it, in place of the line of links. The codes are SVG
// files next to the project fragments, drawn from qrcode's module grid. Not
// lazy: a lazy image hidden on screen is never fetched, so it would miss print.
let codes = 0;
const qr = (href) => {
  const { modules } = QRCode.create(href, { errorCorrectionLevel: "M" });
  const size = modules.size;
  let path = "";
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) if (modules.get(y, x)) path += `M${x} ${y}h1v1h-1z`;
  const file = `qr/${++codes}.svg`;
  writeFileSync(
    new URL(file, fragments),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><path d="${path}"/></svg>`,
  );
  return `/cv/${file}`;
};
const isLinkLine = (t) =>
  t.type === "paragraph" &&
  t.tokens.every((i) => i.type === "link" || (i.type === "text" && /^[\s·]*$/.test(i.text)));

// A printed code never points at the project's site directly: it points at
// link.insuit.cz/<code>, a separate Pages project whose links/_redirects is
// kept by hand. The code for a link is the rule whose target is that link; a
// link without one stops the build with a code to add, so nothing prints a QR
// that leads nowhere.
const shortCodes = new Map(
  readFileSync(new URL("../links/_redirects", import.meta.url), "utf8")
    .split("\n")
    .map((line) => line.trim().split(/\s+/))
    .filter(([from, to]) => from?.startsWith("/") && to?.startsWith("http"))
    .map(([from, to]) => [to, from.slice(1)]),
);
const shortLink = (key, href) => {
  const code = shortCodes.get(href);
  if (!code) {
    const suggestion = createHash("sha256").update(key).digest("hex").slice(0, 6);
    throw new Error(
      `cv: no short link for ${href} — add to links/_redirects:\n/${suggestion} ${href} 302`,
    );
  }
  return `https://link.insuit.cz/${code}`;
};
const printed = ({ heading, rest }) => {
  const links = [];
  marked.walkTokens(rest, (t) => {
    if (t.type === "link" && /^https?:\/\//.test(t.href)) links.push(t.href);
  });
  const qrs = links
    .map((href, i) => {
      const short = shortLink(`${slug(heading.text)}-${i + 1}`, href);
      // A long hostname may wrap beside its code, but only after a dot, and
      // the domain itself (its last two labels) stays whole when it fits the
      // caption's width, about 16 characters (cv.css).
      const labels = new URL(href).hostname.replace(/^www\./, "").split(".");
      const tail = labels.slice(-2).join(".").length <= 16 ? labels.splice(-2).join(".") : "";
      const host = [...labels, ...(tail ? [`<span class="print-domain">${tail}</span>`] : [])].join(
        ".<wbr>",
      );
      return `<figure class="print-qr"><img src="${qr(short)}" alt="" fetchpriority="low" /><figcaption>${host}</figcaption></figure>`;
    })
    .join("");
  // The text, and the codes in a column beside it. No picture: on paper it is
  // decoration, and the text is what gets read.
  return `<section class="project-print">
  <div class="print-text">
  <h4>${marked.parseInline(heading.text)}</h4>
${render(rest.filter((t) => !isLinkLine(t)))}
  </div>
  ${qrs ? `<div class="print-qrs">${qrs}</div>` : ""}
</section>`;
};

const out = [];
let group = null;
// A job's own block — its heading, dates, text, list and technologies — stays
// together too, so print never strands a technologies line or half a paragraph
// on the next page (cv.css). It ends where the job's projects begin.
let intro = null;
// The line under a company — role · details · dates — is split into spans on
// its separators, which stay as text: the screen shows the same line, print
// sets the role on a line of its own and keeps the dates in one piece (cv.css).
const meta = (t) => {
  const [role, ...details] = t.text.split(" · ").map((part) => marked.parseInline(part));
  const parts = details.map((d) => (d.includes("–") ? `<span class="job-dates">${d}</span>` : d));
  return `<p class="job-meta"><span class="job-role">${role}</span><span class="job-sep"> · </span><span class="job-details">${parts.join(" · ")}</span></p>\n`;
};
const closeIntro = () => {
  if (intro) {
    const [heading, ...rest] = intro;
    const i = rest.findIndex((t) => t.type !== "space");
    const html =
      rest[i]?.type === "paragraph"
        ? render(rest.slice(0, i)) + meta(rest[i]) + render(rest.slice(i + 1))
        : render(rest);
    out.push(`<div class="job-intro">\n${render([heading])}${html}</div>\n`);
  }
  intro = null;
};
const flush = () => {
  // A small label names the row of cards, the way "Experience" names the jobs.
  if (group)
    out.push(
      `<p class="projects-label">Projects</p>\n<div class="projects">\n${group.map(card).join("\n")}\n</div>\n<div class="projects-print">\n${group.map(printed).join("\n")}\n</div>`,
    );
  group = null;
};
for (const t of tokens) {
  if (t.type === "heading" && t.depth < 4) flush();
  if (t.type === "heading" && t.depth <= 4) closeIntro();
  if (t.type === "heading" && t.depth === 3) {
    intro = [t];
  } else if (intro) {
    intro.push(t);
  } else if (t.type === "heading" && t.depth === 4) {
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
    // The contact line closes the header on paper only; on screen the site's
    // own contact page does that job.
    if (t.type === "heading" && t.depth === 2 && !out.some((h) => h.includes("print-contact")))
      out.push(
        `<p class="print-contact"><a href="https://insuit.cz">insuit.cz</a> · <a href="https://www.linkedin.com/in/landsmanmichal">linkedin.com/in/landsmanmichal</a> · <a href="https://github.com/landsman">github.com/landsman</a></p>\n`,
      );
    out.push(render([t]));
  }
}
closeIntro();
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
    <!-- Kept out of search results. -->
    <meta name="robots" content="noindex, nofollow" />

    <title>${title}</title>
    <meta name="description" content="${description}" />

    <meta property="og:type" content="profile" />
    <meta property="og:url" content="https://www.insuit.cz/cv" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="https://www.insuit.cz/assets/icons/og-image.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="Michal Landsman, developer in Prague." />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="https://www.insuit.cz/assets/icons/og-image.png" />

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
    <script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "fcaeacb7b58e4ab2a5b2fd9ed4683b92"}'></script>
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
