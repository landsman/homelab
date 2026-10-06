import type { ComponentProps } from "react";
import { Gallery } from "@/features/blog/gallery";
import { YouTube } from "@/features/blog/youtube";
import { m } from "@/paraglide/messages.js";

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
  pre: (props: ComponentProps<"pre">) => <pre tabIndex={0} {...props} />,
  table: (props: ComponentProps<"table">) => <table tabIndex={0} {...props} />,
  // A GFM task's box (`- [x]`) shows a state and is no control: it is named
  // by that state, since its text is not a label for it.
  input: (props: ComponentProps<"input">) =>
    props.type === "checkbox" ? (
      <input {...props} aria-label={props.checked ? m.blog_task_done() : m.blog_task_open()} />
    ) : (
      <input {...props} />
    ),
};
