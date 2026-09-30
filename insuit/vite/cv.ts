// Builds the CV page's data from src/features/cv/cv.md — the markdown is the
// source, the page imports the result as `virtual:cv`, so the two can never
// drift. Runs inside Vite: on `make dev` (again on every edit of the markdown),
// on `make build` and under the tests.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { imageSize } from "image-size";
import { marked, type Token, type Tokens } from "marked";
import QRCode from "qrcode";
import type { Plugin } from "vite";
import type { Cv, CvImage, CvProject, CvQr } from "../src/features/cv/cv.types.ts";

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

const slug = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const isLinkLine = (t: Token) =>
  t.type === "paragraph" &&
  (t.tokens ?? []).every(
    (i) => i.type === "link" || (i.type === "text" && /^[\s·]*$/.test(i.text)),
  );

type Draft = { heading: Tokens.Heading; images: CvImage[]; tall: boolean[]; rest: Token[] };

/**
 * cv.md and links/_redirects in, the page's data and its QR codes out.
 * `isTall` says whether a picture is taller than wide; it is the one thing
 * that needs the files on disk, so a test can stand in for it.
 */
export function buildCv(
  md: string,
  redirects: string,
  isTall: (href: string) => boolean,
): { cv: Cv; qrs: Map<string, string> } {
  // ponytail: the markdown is ours, so marked's output goes in unsanitised.
  const tokens = marked.lexer(md);
  const render = (list: Token[]) =>
    marked.parser(Object.assign(list, { links: tokens.links }) as Token[]);

  // Paper cannot be clicked, so a project's links print as QR codes, each with
  // the site's name under it, in place of the line of links. The codes are SVG
  // files, drawn from qrcode's module grid and written next to the other assets.
  const qrs = new Map<string, string>();
  const qr = (href: string) => {
    const { modules } = QRCode.create(href, { errorCorrectionLevel: "M" });
    const size = modules.size;
    let path = "";
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) if (modules.get(y, x)) path += `M${x} ${y}h1v1h-1z`;
    const file = `${qrs.size + 1}.svg`;
    qrs.set(
      file,
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><path d="${path}"/></svg>`,
    );
    return `/assets/cv-qr/${file}`;
  };

  // A printed code never points at the project's site directly: it points at
  // link.insuit.cz/<code>, a separate Pages project whose links/_redirects is
  // kept by hand. The code for a link is the rule whose target is that link; a
  // link without one stops the build with a code to add, so nothing prints a QR
  // that leads nowhere.
  const shortCodes = new Map(
    redirects
      .split("\n")
      .map((line) => line.trim().split(/\s+/))
      .filter(([from, to]) => from?.startsWith("/") && to?.startsWith("http"))
      .map(([from, to]) => [to, from.slice(1)] as const),
  );
  const shortLink = (key: string, href: string) => {
    const code = shortCodes.get(href);
    if (!code) {
      const suggestion = createHash("sha256").update(key).digest("hex").slice(0, 6);
      throw new Error(
        `cv: no short link for ${href} — add to links/_redirects:\n/${suggestion} ${href} 302`,
      );
    }
    return `https://link.insuit.cz/${code}`;
  };

  // Every `####` is a project. A run of them under one job becomes a row of
  // cards — logo and name — and each card's details, like LinkedIn's project
  // view, open in the page's one modal <dialog>. The dialogs only exist on
  // screen, so each project also carries its text for print: no picture, and
  // its links as QR codes beside it.
  const project = ({ heading, images, tall, rest }: Draft): CvProject => {
    const key = slug(heading.text);
    const links: string[] = [];
    marked.walkTokens(rest, (t) => {
      if (t.type === "link" && /^https?:\/\//.test(t.href)) links.push(t.href);
    });
    return {
      slug: key,
      title: heading.text,
      images,
      // A gallery of mostly tall pictures — phone screenshots — gets a row of
      // equal-height frames instead of the equal-size grid, which would crop
      // each one to a strip of its status bar.
      tallGallery: tall.filter(Boolean).length > tall.length / 2,
      // A project that links a YouTube video shows its first picture with a
      // play button in the dialog; nothing loads from YouTube until that is
      // pressed.
      video: rest
        .map((t) => t.raw)
        .join("")
        .match(/youtube\.com\/watch\?v=([\w-]+)/)?.[1],
      html: render(rest),
      printHtml: render(rest.filter((t) => !isLinkLine(t))),
      qrs: links.map((href, i): CvQr => {
        // A long hostname may wrap beside its code, but only after a dot, and
        // the domain itself (its last two labels) stays whole when it fits the
        // caption's width, about 16 characters (cv.css).
        const labels = new URL(href).hostname.replace(/^www\./, "").split(".");
        const domain =
          labels.slice(-2).join(".").length <= 16 ? labels.splice(-2).join(".") : undefined;
        return { src: qr(shortLink(`${key}-${i + 1}`, href)), labels, domain };
      }),
    };
  };

  const cv: Cv = [];
  // Consecutive prose is one block, so the stylesheet's sibling selectors
  // (`h1 + p`, `h2 + .job-intro`) see the same neighbours the markdown has.
  const html = (text: string) => {
    const last = cv.at(-1);
    if (last && "html" in last) last.html += text;
    else cv.push({ html: text });
  };

  let group: Draft[] | null = null;
  // A job's own block — its heading, dates, text, list and technologies — stays
  // together too, so print never strands a technologies line or half a paragraph
  // on the next page (cv.css). It ends where the job's projects begin.
  let intro: Token[] | null = null;
  let contact = false;
  // The line under a company — role · details · dates — is split into spans on
  // its separators, which stay as text: the screen shows the same line, print
  // sets the role on a line of its own and keeps the dates in one piece (cv.css).
  const meta = (t: Tokens.Paragraph) => {
    const [role, ...details] = t.text.split(" · ").map((part) => marked.parseInline(part));
    const parts = details.map((d) =>
      (d as string).includes("–") ? `<span class="job-dates">${d}</span>` : d,
    );
    return `<p class="job-meta"><span class="job-role">${role}</span><span class="job-sep"> · </span><span class="job-details">${parts.join(" · ")}</span></p>\n`;
  };
  const closeIntro = () => {
    if (intro) {
      const [heading, ...rest] = intro;
      const i = rest.findIndex((t) => t.type !== "space");
      const first = rest[i];
      const body =
        first?.type === "paragraph"
          ? render(rest.slice(0, i)) + meta(first as Tokens.Paragraph) + render(rest.slice(i + 1))
          : render(rest);
      html(`<div class="job-intro">\n${render([heading])}${body}</div>\n`);
    }
    intro = null;
  };
  const flush = () => {
    if (group) cv.push({ projects: group.map(project) });
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
      (group ??= []).push({ heading: t as Tokens.Heading, images: [], tall: [], rest: [] });
    } else if (group) {
      const draft = group.at(-1)!;
      // A paragraph of nothing but images — one per line, or several side by side.
      const inline = t.type === "paragraph" ? (t.tokens ?? []) : [];
      const pictures = inline.filter((i): i is Tokens.Image => i.type === "image");
      const onlyImages =
        pictures.length > 0 &&
        inline.every((i) => i.type === "image" || (i.type === "text" && !i.text.trim()));
      if (onlyImages) {
        for (const i of pictures) {
          draft.images.push({ src: i.href, alt: i.text, title: i.title ?? undefined });
          draft.tall.push(isTall(i.href));
        }
      } else draft.rest.push(t);
    } else {
      // The contact line closes the header on paper only; on screen the site's
      // own contact page does that job.
      if (t.type === "heading" && t.depth === 2 && !contact) {
        contact = true;
        html(
          `<p class="print-contact"><a href="https://insuit.cz">insuit.cz</a> · <a href="https://www.linkedin.com/in/landsmanmichal">linkedin.com/in/landsmanmichal</a> · <a href="https://github.com/landsman">github.com/landsman</a></p>\n`,
        );
      }
      html(render([t]));
    }
  }
  closeIntro();
  flush();

  // The one check this needs: no project dropped or doubled by the grouping.
  const expected = tokens.filter((t) => t.type === "heading" && t.depth === 4).length;
  const built = cv.reduce((n, block) => n + ("projects" in block ? block.projects.length : 0), 0);
  if (built !== expected) throw new Error(`cv: ${expected} projects in cv.md, ${built} built`);

  return { cv, qrs };
}

const root = new URL("../", import.meta.url);
const source = fileURLToPath(new URL("src/features/cv/cv.md", root));
const redirects = fileURLToPath(new URL("links/_redirects", root));
const publicDir = new URL("public/", root);
const qrDir = new URL("assets/cv-qr/", publicDir);

// A picture whose size cannot be read (a few JPEGs trip the reader, browsers
// render them fine) counts as wide.
const isTall = (href: string) => {
  try {
    const { width, height } = imageSize(readFileSync(new URL(`.${href}`, publicDir)));
    return height > width;
  } catch (error) {
    console.warn(
      `cv: cannot read the size of ${href} (${(error as Error).message}), treating it as wide`,
    );
    return false;
  }
};

/** Serves the CV's data as `virtual:cv` and writes its QR codes into public/. */
export function cvPlugin(): Plugin {
  const id = "\0virtual:cv";
  return {
    name: "cv",
    resolveId: (name) => (name === "virtual:cv" ? id : undefined),
    load(loaded) {
      if (loaded !== id) return;
      const { cv, qrs } = buildCv(
        readFileSync(source, "utf8"),
        readFileSync(redirects, "utf8"),
        isTall,
      );
      mkdirSync(qrDir, { recursive: true });
      for (const [file, svg] of qrs) writeFileSync(new URL(file, qrDir), svg);
      return `export default ${JSON.stringify(cv)}`;
    },
    // An edit to either file rebuilds the page while `make dev` runs: a
    // virtual module has no file of its own for the dev server to watch.
    // Called once for the browser's modules and once for the renderer's.
    hotUpdate({ file }) {
      if (file !== source && file !== redirects) return;
      const module = this.environment.moduleGraph.getModuleById(id);
      return module ? [module] : [];
    },
  };
}
