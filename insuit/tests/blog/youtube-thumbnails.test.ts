import { existsSync, readdirSync, readFileSync } from "node:fs";
import { expect, test } from "vitest";

const posts = new URL("../../content/blog/", import.meta.url);
const thumbnails = new URL("../../public/assets/blog/youtube/", import.meta.url);

// A post's video shows its thumbnail from the site (features/blog/youtube.tsx);
// one never saved would be an empty frame, which nothing else would notice.
test("every video in a post has its thumbnail saved, or a poster of its own", () => {
  const missing = readdirSync(posts, { recursive: true, encoding: "utf8" })
    .filter((file) => file.endsWith(".mdx"))
    .flatMap((file) =>
      [...readFileSync(new URL(file, posts), "utf8").matchAll(/<YouTube\b[^>]*>/g)]
        .map(([tag]) => tag)
        .filter((tag) => !/\bposter=/.test(tag))
        .map((tag) => /\bid="([^"]+)"/.exec(tag)?.[1])
        .filter((id) => !id || !existsSync(new URL(`${id}.jpg`, thumbnails)))
        .map((id) => `${file}: make youtube-thumbnail ID=${id}`),
    );
  expect(missing).toEqual([]);
});
