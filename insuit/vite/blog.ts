// The blog's posts are MDX files in content/blog/: markdown that takes JSX.
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
import type { PostMeta } from "../src/features/blog/post.types.ts";

const DIR = fileURLToPath(new URL("../content/blog/", import.meta.url));
const FIELDS = ["title", "date", "description"] as const;

/**
 * A post's front matter: `key: value` lines between `---` fences. Every one of
 * FIELDS is required, so a post missing one stops the build instead of
 * shipping an untitled page.
 */
export function parseFrontMatter(slug: string, source: string): PostMeta {
  // The name is the address, and goes into the sitemap's XML as it is.
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug))
    throw new Error(`blog: ${slug}.mdx — name a post in lowercase letters, digits and dashes`);
  const match = /^---\n([\s\S]*?)\n---\n/.exec(source);
  if (!match) throw new Error(`blog: ${slug}.mdx has no front matter`);

  const fields = new Map(
    match[1].split("\n").map((line) => {
      const colon = line.indexOf(":");
      return [line.slice(0, colon).trim(), line.slice(colon + 1).trim()] as const;
    }),
  );
  const missing = FIELDS.filter((field) => !fields.get(field));
  if (missing.length) throw new Error(`blog: ${slug}.mdx has no ${missing.join(", ")}`);
  const date = fields.get("date")!;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
    throw new Error(`blog: ${slug}.mdx's date is ${date}, not YYYY-MM-DD`);

  return { slug, title: fields.get("title")!, date, description: fields.get("description")! };
}

/** Every post's front matter, for what is built from all of them at once (vite/sitemap.ts). */
export const readPosts = (): PostMeta[] =>
  readdirSync(DIR)
    .filter((file) => file.endsWith(".mdx"))
    .map((file) =>
      parseFrontMatter(file.slice(0, -".mdx".length), readFileSync(DIR + file, "utf8")),
    );

export function blogPlugin(): Plugin[] {
  const compiler = mdx({
    include: /\/content\/blog\/[^/]+\.mdx$/,
    // Recognised, so it is left out of the body; read by parseFrontMatter.
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
    load(id) {
      const match = /\/content\/blog\/([^/]+)\.mdx\?meta$/.exec(id);
      if (!match) return;
      const front = parseFrontMatter(match[1], readFileSync(id.split("?")[0], "utf8"));
      return `export default ${JSON.stringify(front)}`;
    },
  };
  return [body, meta];
}
