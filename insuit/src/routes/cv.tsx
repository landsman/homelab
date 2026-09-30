import { createFileRoute } from "@tanstack/react-router";
import { pageMeta } from "@/app/page-meta";
import { ROUTES } from "@/app/routes";
import { CvPage } from "@/features/cv/cv-page";
import { m } from "@/paraglide/messages.js";

export const Route = createFileRoute("/cv")({
  head: () => ({
    meta: pageMeta({
      title: m.cv_title(),
      description: m.cv_description(),
      path: ROUTES.cv,
      type: "profile",
      hidden: true,
    }),
  }),
  component: CvPage,
});
