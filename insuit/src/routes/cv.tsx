import { createFileRoute } from "@tanstack/react-router";
import { FONTS } from "@/app/assets";
import { pageMeta } from "@/app/page-meta";
import { ROUTES } from "@/app/routes";
import { CvPage } from "@/features/cv/cv-page";
import { m } from "@/paraglide/messages.js";
import styles from "@/styles/components/cv.css?url";

export const Route = createFileRoute("/cv")({
  head: () => ({
    meta: pageMeta({
      title: m.cv_title(),
      description: m.cv_description(),
      path: ROUTES.cv,
      type: "profile",
      hidden: true,
    }),
    // The name and the companies are set in the medium weight, which only this
    // page uses; preloaded so they do not show in the regular one first.
    links: [
      // The CV's styles load on its page only, not with the site's (index.css).
      { rel: "stylesheet", href: styles },
      { rel: "preload", href: FONTS.medium, as: "font", type: "font/woff2", crossOrigin: "" },
    ],
  }),
  component: CvPage,
});
