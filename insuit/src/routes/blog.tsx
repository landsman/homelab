import { createFileRoute } from "@tanstack/react-router";
import { pageMeta } from "@/app/page-meta";
import { ROUTES } from "@/app/routes";
import { BlogPage } from "@/features/blog/blog-page";
import styles from "@/styles/components/blog.css?url";
import { m } from "@/paraglide/messages.js";

export const Route = createFileRoute("/blog")({
  head: () => ({
    meta: pageMeta({
      title: m.blog_title(),
      description: m.blog_description(),
      path: ROUTES.blog,
    }),
    // The blog's styles load on its pages only, not with the site's (index.css).
    links: [{ rel: "stylesheet", href: styles }],
  }),
  component: BlogPage,
});
