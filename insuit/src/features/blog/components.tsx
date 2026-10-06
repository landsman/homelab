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
  // so a keyboard has to be able to reach it to scroll it (WCAG 2.1.1). A
  // block is a named group rather than a region, so ten of them do not bury
  // the page's landmarks; named, as a stop on the way through, by its number
  // and language (vite/blog.ts), in the site's language — the post around it
  // may be in another (WCAG 3.1.2).
  pre: ({
    "data-block": n,
    "data-language": language,
    ...props
  }: ComponentProps<"pre"> & { "data-block": number; "data-language"?: string }) => (
    <pre
      tabIndex={0}
      role="group"
      aria-label={language ? m.blog_code_language({ n, language }) : m.blog_code({ n })}
      lang={getLocale()}
      {...props}
    />
  ),
  // A table fills the column, so it scrolls in a frame of its own: a table
  // that scrolls itself cannot stretch its cells.
  table: (props: ComponentProps<"table">) => (
    <div className="blog-table" tabIndex={0} role="group" aria-label={m.blog_table()}>
      <table {...props} />
    </div>
  ),
  // A link in a post opens a new tab, so the post stays where it was read;
  // a screen reader is told so, in the site's language (contact-page.tsx). A
  // jump within the page — a footnote and its way back — stays in this one.
  a: ({ children, ...props }: ComponentProps<"a">) =>
    props.href?.startsWith("#") ? (
      <a {...props}>{children}</a>
    ) : (
      <a target="_blank" rel="noopener" {...props}>
        {children}
        <span className="visually-hidden" lang={getLocale()}>
          {" "}
          {m.common_opens_new_tab()}
        </span>
      </a>
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
