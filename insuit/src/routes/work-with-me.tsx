import { createFileRoute } from "@tanstack/react-router";
import { pageMeta } from "@/app/page-meta";
import { ROUTES } from "@/app/routes";
import { HirePage } from "@/features/hire/hire-page";
import { m } from "@/paraglide/messages.js";

export const Route = createFileRoute("/work-with-me")({
  head: () => ({
    meta: pageMeta({
      title: m.hire_title(),
      description: m.hire_description(),
      path: ROUTES.hire,
    }),
  }),
  component: HirePage,
});
