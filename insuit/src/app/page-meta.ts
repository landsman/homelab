import { ICONS } from "@/app/assets";
import { SITE_URL } from "@/app/site";
import { m } from "@/paraglide/messages.js";

type Page = {
  title: string;
  description: string;
  /** The page's own path, for the address a shared link shows. */
  path: string;
  type?: "website" | "profile";
  /** Kept out of search results. */
  hidden?: boolean;
};

/**
 * A page's <title> and the tags a search engine or a link preview reads, for a
 * route's `head`. A route's tags replace the root's of the same name — and the
 * root's say "page not found" (routes/__root.tsx), so every page needs these.
 */
export function pageMeta({ title, description, path, type = "website", hidden }: Page) {
  return [
    { title },
    { name: "description", content: description },
    { name: "robots", content: hidden ? "noindex, nofollow" : "index, follow" },

    { property: "og:type", content: type },
    { property: "og:url", content: SITE_URL + path },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:image", content: SITE_URL + ICONS.share },
    // The card's size, og/og.html's canvas — keep the two in sync.
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { property: "og:image:alt", content: m.common_share_image_alt() },

    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: SITE_URL + ICONS.share },
  ];
}
