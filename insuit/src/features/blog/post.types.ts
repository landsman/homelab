/** The languages a post can be written in, and each one's Open Graph locale. */
export const POST_LANGS = { en: "en_US", cs: "cs_CZ" } as const;
export type PostLang = keyof typeof POST_LANGS;

/** A post's front matter, from vite/blog.ts; the slug is its file's name. */
export type PostMeta = {
  slug: string;
  title: string;
  description: string;
  lang: PostLang;
  /** YYYY-MM-DD, the day it came out. */
  published: string;
  /** YYYY-MM-DD, the last time its content changed, when it has. */
  updated?: string;
  /** Left out of the list (but for /blog?qa=true) and the sitemap, and out of
      search results: found by its address only. */
  hidden?: true;
};
