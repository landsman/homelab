import { createFileRoute } from "@tanstack/react-router";
import { pageMeta } from "@/app/page-meta";
import { ROUTES } from "@/app/routes";
import { HomePage } from "@/features/home/home-page";
import { m } from "@/paraglide/messages.js";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: pageMeta({
      title: m.home_title(),
      description: m.home_description(),
      path: ROUTES.home,
    }),
  }),
  component: HomePage,
});
