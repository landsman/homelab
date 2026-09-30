/**
 * A run of the CV's text, rendered from cv.md at build time (vite/cv.ts). The
 * wrapper has no box of its own (`.cv-prose` in cv.css), so the text lays out
 * as if it sat directly in the page.
 */
export function Prose({ html }: { html: string }) {
  // The markdown is ours, so the HTML built from it is trusted.
  return <div className="cv-prose" dangerouslySetInnerHTML={{ __html: html }} />;
}
