import { createFileRoute } from "@tanstack/react-router";
import { pageMeta } from "@/app/page-meta";
import { ROUTES } from "@/app/routes";
import { HirePage } from "@/features/hire/hire-page";
import { m } from "@/paraglide/messages.js";
import styles from "@/styles/components/hire.css?url";

export const Route = createFileRoute("/work-with-me")({
  head: () => ({
    meta: pageMeta({
      title: m.hire_title(),
      description: m.hire_description(),
      path: ROUTES.hire,
    }),
    // The page's styles load on it only, not with the site's (index.css).
    links: [{ rel: "stylesheet", href: styles }],
  }),
  component: HirePage,
});
