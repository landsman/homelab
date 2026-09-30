// The shape vite/cv.ts builds from cv.md and the page renders. Prose stays
// HTML, rendered from the markdown at build time; everything the page acts on
// (a card, a gallery, a video, a QR code) is data.

export type CvImage = {
  src: string;
  alt: string;
  title?: string;
  /** In pixels, when the build could read them. */
  width?: number;
  height?: number;
};

/** A printed link: its QR code (one view of the shared file), and the host it
    leads to, split for wrapping. */
export type CvQr = { src: string; labels: string[]; domain?: string };

export type CvProject = {
  slug: string;
  title: string;
  /** The first is the card; the dialog shows them all. */
  images: CvImage[];
  /** Mostly phone screenshots: the gallery keeps their height, not their width. */
  tallGallery: boolean;
  /** A YouTube id; the dialog plays it in place of the pictures. */
  video?: string;
  html: string;
  /** The same text without the line of links, which print shows as QR codes. */
  printHtml: string;
  qrs: CvQr[];
};

export type CvBlock = { kind: "prose"; html: string } | { kind: "projects"; projects: CvProject[] };

export type Cv = CvBlock[];
