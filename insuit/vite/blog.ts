// The blog's posts are MDX files in content/blog/<year>/, markdown that takes
// JSX. The year is the files' order only: a post's address is its name alone,
// /blog/<slug>.
// @mdx-js/rollup compiles each into a component of its own, so each post is a
// chunk of its own and no MDX compiler reaches the browser. Vite compiles a
// file again only when it changes. Added here is `?meta`, a post's front matter
// as a module of its own, for the list, so the list carries no post's text
// (src/features/blog/posts.ts).
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import mdx from "@mdx-js/rollup";
import remarkFrontmatter from "remark-frontmatter";
import type { Plugin } from "vite";
import { POST_LANGS, type PostLang, type PostMeta } from "../src/features/blog/post.types.ts";

const DIR = fileURLToPath(new URL("../content/blog/", import.meta.url));
const REQUIRED = ["title", "description", "lang", "published"] as const;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A post's front matter, from its path under content/blog/ (`2026/hello.mdx`)
 * and its source: `key: value` lines between `---` fences. Every one of
 * REQUIRED has to be there, and the folder has to be the year it was
 * published, so a post that breaks either stops the build instead of shipping.
 */
export function parsePost(file: string, source: string): PostMeta {
  const [, year, slug] = /^(\d{4})\/([^/]+)\.mdx$/.exec(file) ?? [];
  if (!slug) throw new Error(`blog: ${file} — a post goes in content/blog/<year>/<slug>.mdx`);
  // The name is the address, and goes into the sitemap's XML as it is.
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug))
    throw new Error(`blog: ${file} — name a post in lowercase letters, digits and dashes`);
  const match = /^---\n([\s\S]*?)\n---\n/.exec(source);
  if (!match) throw new Error(`blog: ${file} has no front matter`);

  const fields = new Map(
    match[1].split("\n").map((line) => {
      const colon = line.indexOf(":");
      return [line.slice(0, colon).trim(), line.slice(colon + 1).trim()] as const;
    }),
  );
  const missing = REQUIRED.filter((field) => !fields.get(field));
  if (missing.length) throw new Error(`blog: ${file} has no ${missing.join(", ")}`);

  const published = fields.get("published")!;
  const updated = fields.get("updated") || undefined;
  for (const [field, day] of [
    ["published", published],
    ["updated", updated],
  ] as const)
    if (day !== undefined && !DAY.test(day))
      throw new Error(`blog: ${file}'s ${field} is ${day}, not YYYY-MM-DD`);
  if (!published.startsWith(year))
    throw new Error(
      `blog: ${file} was published ${published}, so it goes in ${published.slice(0, 4)}/`,
    );
  if (updated && updated <= published)
    throw new Error(`blog: ${file} is updated ${updated}, not after it was published`);

  const hidden = fields.get("hidden");
  if (hidden !== undefined && hidden !== "true")
    throw new Error(`blog: ${file}'s hidden is ${hidden}; leave it out, or say true`);

  const lang = fields.get("lang")!;
  if (!(lang in POST_LANGS))
    throw new Error(
      `blog: ${file}'s lang is ${lang}, not one of ${Object.keys(POST_LANGS).join(", ")}`,
    );

  return {
    slug,
    title: fields.get("title")!,
    description: fields.get("description")!,
    lang: lang as PostLang,
    published,
    ...(updated && { updated }),
    ...(hidden && { hidden: true }),
  };
}

/** Two posts of one name would be one address, whatever their years. */
export function checkUnique(posts: PostMeta[]): PostMeta[] {
  const seen = new Set<string>();
  for (const { slug } of posts) {
    if (seen.has(slug)) throw new Error(`blog: two posts are named ${slug}.mdx`);
    seen.add(slug);
  }
  return posts;
}

/** Every post's front matter, for what is built from all of them at once. */
export const readPosts = (): PostMeta[] =>
  checkUnique(
    readdirSync(DIR, { recursive: true, encoding: "utf8" })
      .filter((file) => file.endsWith(".mdx"))
      .map((file) => parsePost(file, readFileSync(DIR + file, "utf8"))),
  );

export function blogPlugin(): Plugin[] {
  const compiler = mdx({
    include: /\/content\/blog\/\d{4}\/[^/]+\.mdx$/,
    // Recognised, so it is left out of the body; read by parsePost.
    remarkPlugins: [remarkFrontmatter],
  });
  // Its transform is a plain function of the file, and its result, source map
  // included, is what Vite takes.
  const compile = compiler.transform as (code: string, id: string) => Promise<{ code: string }>;

  const body: Plugin = {
    name: "blog:mdx",
    enforce: "pre",
    // @mdx-js/rollup drops the query before matching, so it would compile
    // `?meta` too. A post's own file only.
    transform(code, id) {
      if (!id.includes("?")) return compile(code, id);
    },
  };
  const meta: Plugin = {
    name: "blog:meta",
    // Every post at once, so two of one name stop the build before anything
    // is built from either.
    buildStart() {
      readPosts();
    },
    load(id) {
      const match = /\/content\/blog\/(\d{4}\/[^/]+\.mdx)\?meta$/.exec(id);
      if (!match) return;
      const front = parsePost(match[1], readFileSync(id.split("?")[0], "utf8"));
      return `export default ${JSON.stringify(front)}`;
    },
  };
  return [body, meta];
}
