// Builds the CV page's data from content/cv/cv.md — the markdown is the
// source, the page imports the result as `virtual:cv`, so the two can never
// drift. Runs inside Vite: on `make dev` (again on every edit of the markdown),
// on `make build` and under the tests.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Marked, type Token, type Tokens } from "marked";
import QRCode from "qrcode";
import type { Plugin } from "vite";
import type { Cv, CvImage, CvProject, CvQr } from "../src/features/cv/cv.types.ts";

// Links out of the site — every project's website — open in a new tab, so the
// CV stays open behind them. Links within the site keep the default. Its own
// instance, so the next thing to render markdown does not inherit this.
const marked = new Marked({
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
    // A paragraph that opens with a bold label — "Technologies:", "I work
    // with:" — is a list of technologies, set smaller and quieter (cv.css).
    // Named here, so the stylesheet does not have to guess it from the markup.
    paragraph({ tokens: text }) {
      const label = text[0]?.type === "strong" ? ' class="technologies"' : "";
      return `<p${label}>${this.parser.parseInline(text)}</p>\n`;
    },
  },
});

const slug = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const isLinkLine = (t: Token) =>
  t.type === "paragraph" &&
  (t.tokens ?? []).every(
    (i) => i.type === "link" || (i.type === "text" && /^[\s·]*$/.test(i.text)),
  );

/** Where the page asks for the QR codes; the plugin below writes the file. */
const QR_SPRITE = "/assets/cv-qr.svg";
// The codes stand this far apart in the file, in modules. The largest QR code
// there is has 177 to a side.
const QR_PITCH = 200;

type Draft = { heading: Tokens.Heading; images: CvImage[]; rest: Token[] };

/** What the build knows of a picture: its size in pixels and, for a wide one,
    the small copy the cards and galleries show. Nothing for a picture it was
    not told about. */
export type PictureOf = (
  href: string,
) => { width: number; height: number; thumb?: string } | undefined;

/**
 * cv.md and links/_redirects in, the page's data and its QR codes out.
 * `pictureOf` knows each picture's size and thumbnail; it is the one thing that
 * needs the files on disk, so a test can stand in for it.
 */
export function buildCv(
  md: string,
  redirects: string,
  pictureOf: PictureOf,
): { cv: Cv; qrSprite: string } {
  // ponytail: the markdown is ours, so marked's output goes in unsanitised.
  const tokens = marked.lexer(md);
  const render = (list: Token[]) =>
    marked.parser(Object.assign(list, { links: tokens.links }) as Token[]);

  // Paper cannot be clicked, so a project's links print as QR codes, each with
  // the site's name under it, in place of the line of links. The codes are
  // drawn from qrcode's module grid into one SVG file, side by side, each with
  // a <view> that frames it: `cv-qr.svg#q3` shows the third. One file, because
  // the screen never shows them and yet has to fetch them — a picture hidden
  // until print is not there in time if it is only asked for then.
  const codes: string[] = [];
  const qr = (href: string) => {
    const { modules } = QRCode.create(href, { errorCorrectionLevel: "M" });
    const size = modules.size;
    const left = codes.length * QR_PITCH;
    // One rectangle per run of dark modules in a row, not one per module.
    let path = "";
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        if (!modules.get(y, x)) continue;
        let run = 1;
        while (x + run < size && modules.get(y, x + run)) run++;
        path += `M${left + x} ${y}h${run}v1h-${run}z`;
        x += run;
      }
    const id = `q${codes.length + 1}`;
    codes.push(`<view id="${id}" viewBox="${left} 0 ${size} ${size}"/><path d="${path}"/>`);
    return `${QR_SPRITE}#${id}`;
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
  const project = ({ heading, images, rest }: Draft): CvProject => {
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
      // each one to a strip of its status bar. A picture of unknown size
      // counts as wide.
      tallGallery:
        images.filter((i) => (i.height ?? 0) > (i.width ?? 0)).length > images.length / 2,
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
    if (last?.kind === "prose") last.html += text;
    else cv.push({ kind: "prose", html: text });
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
    if (group) cv.push({ kind: "projects", projects: group.map(project) });
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
      (group ??= []).push({ heading: t as Tokens.Heading, images: [], rest: [] });
    } else if (group) {
      const draft = group.at(-1)!;
      // A paragraph of nothing but images — one per line, or several side by side.
      const inline = t.type === "paragraph" ? (t.tokens ?? []) : [];
      const pictures = inline.filter((i): i is Tokens.Image => i.type === "image");
      const onlyImages =
        pictures.length > 0 &&
        inline.every((i) => i.type === "image" || (i.type === "text" && !i.text.trim()));
      if (onlyImages) {
        for (const i of pictures)
          // The size lets the browser keep the picture's place before it loads.
          draft.images.push({
            src: i.href,
            alt: i.text,
            title: i.title ?? undefined,
            ...pictureOf(i.href),
          });
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
      // The picture the CV opens with is the portrait, set beside the name.
      const opensWithPicture =
        cv.length === 0 &&
        t.type === "paragraph" &&
        t.tokens?.length === 1 &&
        t.tokens[0].type === "image";
      html(
        opensWithPicture
          ? `<p class="portrait">${marked.parseInline(t.raw.trim())}</p>\n`
          : render([t]),
      );
    }
  }
  closeIntro();
  flush();

  const qrSprite = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Math.max(codes.length, 1) * QR_PITCH} ${QR_PITCH}" shape-rendering="crispEdges">${codes.join("")}</svg>`;
  return { cv, qrSprite };
}

const root = new URL("../", import.meta.url);
const source = fileURLToPath(new URL("content/cv/cv.md", root));
const redirects = fileURLToPath(new URL("links/_redirects", root));
const publicDir = new URL("public/", root);
const qrSprite = new URL(`.${QR_SPRITE}`, publicDir);

/** Where the thumbnails are written, and the width they are cut down to. */
const THUMBS = "/assets/cv-thumbs/";
// A card is about 240 px wide and a gallery picture 200: twice that for a
// dense screen. The full picture is fetched only when it is opened.
const THUMB_WIDTH = 480;

/**
 * Reads every picture cv.md names and writes a small WebP of each one wider
 * than a thumbnail, with Bun's own image reader — no image library. A
 * thumbnail newer than its picture is left alone, so an edit to the text
 * redraws nothing.
 */
async function readPictures(md: string): Promise<PictureOf> {
  const known = new Map<string, NonNullable<ReturnType<PictureOf>>>();
  const taken = new Map<string, string>();
  for (const [, href] of md.matchAll(/!\[[^\]]*\]\((\/assets\/cv\/[^\s)]+)/g)) {
    if (known.has(href)) continue;
    const source = Bun.file(new URL(`.${href}`, publicDir));
    const image = new Bun.Image(await source.bytes());
    const { width, height } = await image.metadata();
    if (width <= THUMB_WIDTH) {
      known.set(href, { width, height });
      continue;
    }
    const thumb = `${THUMBS}${href
      .split("/")
      .at(-1)!
      .replace(/\.[^.]+$/, "")}.webp`;
    // Two pictures that differ only in their extension would share one.
    if (taken.has(thumb))
      throw new Error(`cv: ${href} and ${taken.get(thumb)} need one thumbnail name`);
    taken.set(thumb, href);
    const target = Bun.file(new URL(`.${thumb}`, publicDir));
    if (!(await target.exists()) || target.lastModified < source.lastModified)
      await Bun.write(target, await image.resize(THUMB_WIDTH).webp({ quality: 80 }).bytes());
    known.set(href, { width, height, thumb });
  }
  return (href) => known.get(href);
}

/** Serves the CV's data as `virtual:cv`, and writes its QR codes and its
    thumbnails into public/assets. */
export function cvPlugin(): Plugin {
  const id = "\0virtual:cv";
  return {
    name: "cv",
    resolveId: (name) => (name === "virtual:cv" ? id : undefined),
    async load(loaded) {
      if (loaded !== id) return;
      if (typeof Bun === "undefined")
        throw new Error("cv: the pictures are read with Bun.Image — run the build with bun");
      const md = readFileSync(source, "utf8");
      const built = buildCv(md, readFileSync(redirects, "utf8"), await readPictures(md));
      writeFileSync(qrSprite, built.qrSprite);
      return `export default ${JSON.stringify(built.cv)}`;
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
