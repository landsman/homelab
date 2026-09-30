// Every file under public/ that the code names, in one place: a rename or a
// new icon is one edit here, and "find usages" shows who shows it.
//
// The glyphs drawn as CSS masks (theme, external link, play) are not here —
// a stylesheet cannot read a constant. Their one place is
// styles/components/icons.css.

export const ICONS = {
  /** The tab's icon; app/animated-favicon.ts swaps it for the rotating disc. */
  favicon: "/assets/icons/favicon.svg",
  appleTouch: "/assets/icons/apple-touch-icon.png",
  /** The link-preview card: 1200×630, rendered from og/og.html by `make og`. */
  share: "/assets/icons/og-image.png",
} as const;

// The same two files styles/fonts.css declares; named here to preload them.
export const FONTS = {
  regular: "/assets/fonts/fira-mono-latin-400-normal.woff2",
  /** The CV, and the headings inside a page's text (/hire-me). */
  medium: "/assets/fonts/fira-mono-latin-500-normal.woff2",
} as const;
