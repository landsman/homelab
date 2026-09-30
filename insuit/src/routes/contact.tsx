import { createFileRoute } from "@tanstack/react-router";
import { pageMeta } from "@/app/page-meta";
import { ROUTES } from "@/app/routes";
import { ContactPage } from "@/features/contact/contact-page";
import { m } from "@/paraglide/messages.js";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: pageMeta({
      title: m.contact_title(),
      description: m.contact_description(),
      path: ROUTES.contact,
    }),
  }),
  component: ContactPage,
});
