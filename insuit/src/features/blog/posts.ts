import { use } from "react";
import { notFound } from "@tanstack/react-router";
import type { MDXContent, MDXModule } from "mdx/types";
import type { PostMeta } from "@/features/blog/post.types";

// One MDX file per post in content/blog, its name the slug. Its front matter
// comes from vite/blog.ts (bundled with the list, newest first); its body is
// the component @mdx-js/rollup compiles it to, a chunk fetched when the post
// is opened.
export const POSTS = Object.values(
  import.meta.glob<PostMeta>("/content/blog/*.mdx", {
    query: "?meta",
    import: "default",
    eager: true,
  }),
).sort((a, b) => b.date.localeCompare(a.date));

const bodies = import.meta.glob<MDXModule>("/content/blog/*.mdx");
const path = (slug: string) => `/content/blog/${slug}.mdx`;

// One fetch per post, shared by the loader and the page.
const fetches = new Map<string, Promise<MDXModule>>();
const fetchBody = (slug: string) => {
  if (!fetches.has(slug)) fetches.set(slug, bodies[path(slug)]());
  return fetches.get(slug)!;
};
const loaded = new Map<string, MDXContent>();

export async function loadPost(slug: string) {
  const meta = POSTS.find((post) => post.slug === slug);
  if (!meta) throw notFound();
  loaded.set(slug, (await fetchBody(slug)).default);
  return meta;
}

/**
 * The post's body. The loader has it at build time and before a link opens a
 * post, so the HTML file holds the whole text. Only the page the browser loads
 * first is taken over without the loader running; there the body's chunk is
 * fetched while the prerendered text stays on screen (the <Suspense> in
 * post-page.tsx).
 */
export const usePostBody = (slug: string) => loaded.get(slug) ?? use(fetchBody(slug)).default;

// UTC, so the build and the browser print the same day.
const format = new Intl.DateTimeFormat("en", { dateStyle: "long", timeZone: "UTC" });
export const formatDate = (date: string) => format.format(new Date(date));
