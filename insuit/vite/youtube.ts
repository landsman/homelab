// The thumbnails of the YouTube videos in the blog's posts, fetched from
// YouTube when the site is built and written into the build. Nothing of them is
// in the repo. A reader gets the picture from the site, so the page asks
// YouTube for nothing until play is pressed (src/features/blog/youtube.tsx).
// Each is fetched once per machine: kept in node_modules/.cache after that.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";
import { youtubeThumbnail } from "../src/app/assets.ts";

const POSTS = fileURLToPath(new URL("../content/blog/", import.meta.url));
const CACHE = fileURLToPath(new URL("../node_modules/.cache/youtube-thumbnails/", import.meta.url));

/** The videos in a post's source that show YouTube's thumbnail: every
    <YouTube id="…"> without a poster of its own. */
export const videoIds = (source: string): string[] =>
  [...source.matchAll(/<YouTube\b[^>]*>/g)]
    .map(([tag]) => tag)
    .filter((tag) => !/\bposter=/.test(tag))
    .flatMap((tag) => /\bid="([A-Za-z0-9_-]{11})"/.exec(tag)?.[1] ?? []);

const allVideoIds = () => [
  ...new Set(
    readdirSync(POSTS, { recursive: true, encoding: "utf8" })
      .filter((file) => file.endsWith(".mdx"))
      .flatMap((file) => videoIds(readFileSync(POSTS + file, "utf8"))),
  ),
];

/**
 * The thumbnail's bytes: the 1280×720 one where YouTube made it, else the
 * 480×360 every video has (letterboxed; the frame crops it to 16:9). The same
 * public address YouTube's own pages load it from; no API key involved.
 */
async function thumbnail(id: string): Promise<Uint8Array> {
  const cached = `${CACHE}${id}.jpg`;
  if (existsSync(cached)) return readFileSync(cached);
  for (const size of ["maxresdefault", "hqdefault"]) {
    const response = await fetch(`https://i.ytimg.com/vi/${id}/${size}.jpg`);
    if (!response.ok) continue;
    const bytes = new Uint8Array(await response.arrayBuffer());
    mkdirSync(CACHE, { recursive: true });
    writeFileSync(cached, bytes);
    return bytes;
  }
  throw new Error(`youtube: no thumbnail for video ${id} — is the id right?`);
}

export function youtubePlugin(): Plugin {
  return {
    name: "youtube-thumbnails",
    // `make dev`: answered from the cache, fetched on first ask.
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const id = /^\/assets\/blog\/youtube\/([A-Za-z0-9_-]{11})\.jpg$/.exec(
          request.url ?? "",
        )?.[1];
        if (!id) return next();
        try {
          response.setHeader("Content-Type", "image/jpeg");
          response.end(await thumbnail(id));
        } catch (error) {
          next(error);
        }
      });
    },
    // A build: into the files the browser is served. One that cannot be
    // fetched stops the build, rather than shipping an empty frame.
    applyToEnvironment: (environment) => environment.name === "client",
    async generateBundle() {
      for (const id of allVideoIds())
        this.emitFile({
          type: "asset",
          fileName: youtubeThumbnail(id).slice(1),
          source: await thumbnail(id),
        });
    },
  };
}
