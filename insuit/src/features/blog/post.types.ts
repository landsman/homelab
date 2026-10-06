/** A post's front matter, from vite/blog.ts; the slug is its file's name. */
export type PostMeta = {
  slug: string;
  title: string;
  /** YYYY-MM-DD */
  date: string;
  description: string;
};
