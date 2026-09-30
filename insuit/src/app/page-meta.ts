import { SITE_URL } from "@/app/site";
import { m } from "@/paraglide/messages.js";

// 1200×630, rendered from og/og.html by `make og` — keep the two in sync.
const SHARE_IMAGE = `${SITE_URL}/assets/icons/og-image.png`;

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
 * route's `head`. A route's tags replace the root's of the same name, so a page
 * that sets none gets the home page's.
 */
export function pageMeta({ title, description, path, type = "website", hidden }: Page) {
  return [
    { title },
    { name: "description", content: description },
    ...(hidden ? [{ name: "robots", content: "noindex, nofollow" }] : []),

    { property: "og:type", content: type },
    { property: "og:url", content: SITE_URL + path },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:image", content: SHARE_IMAGE },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { property: "og:image:alt", content: m.common_share_image_alt() },

    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: SHARE_IMAGE },
  ];
}
