/**
 * Where this build of the site lives — the base of every address a page gives
 * for itself (og:url, the link-preview image). Configuration, not a constant:
 * a build for somewhere else, such as a PR preview, sets VITE_SITE_URL.
 */
export const SITE_URL: string = import.meta.env.VITE_SITE_URL || "https://www.insuit.cz";
