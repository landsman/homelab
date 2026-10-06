import type { ComponentProps } from "react";
import { Gallery } from "@/features/blog/gallery";
import { YouTube } from "@/features/blog/youtube";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";

/**
 * What a post can use without importing it — `<YouTube … />`, `<Gallery … />`
 * in any .mdx — and the few elements markdown makes that need more than it
 * gives them.
 */
export const POST_COMPONENTS = {
  Gallery,
  YouTube,
  // A code block or a table scrolls sideways when it is wider than the column,
  // so a keyboard has to be able to reach it to scroll it (WCAG 2.1.1).
  // Named, as a stop on the way through, in the site's language — the post
  // around it may be in another (WCAG 3.1.2).
  // Numbered by vite/blog.ts, since a post with two would have two of one name.
  pre: ({ "data-block": n, ...props }: ComponentProps<"pre"> & { "data-block": number }) => (
    <pre tabIndex={0} role="region" aria-label={m.blog_code({ n })} lang={getLocale()} {...props} />
  ),
  table: (props: ComponentProps<"table">) => (
    <table tabIndex={0} aria-label={m.blog_table()} {...props} />
  ),
  // A picture's title (`![alt](src "title")`) is its caption, shown, rather
  // than a tooltip nobody on a keyboard or a phone sees. vite/blog.ts lifts a
  // picture alone in its paragraph out of it, so the figure is not in a <p>.
  img: ({ title, ...props }: ComponentProps<"img">) =>
    title ? (
      <figure>
        <img {...props} />
        <figcaption>{title}</figcaption>
      </figure>
    ) : (
      <img {...props} />
    ),
  // A GFM task's box (`- [x]`) shows a state and is no control: it is named
  // by that state, since its text is not a label for it.
  input: (props: ComponentProps<"input">) =>
    props.type === "checkbox" ? (
      <input
        {...props}
        aria-label={props.checked ? m.blog_task_done() : m.blog_task_open()}
        lang={getLocale()}
      />
    ) : (
      <input {...props} />
    ),
};
