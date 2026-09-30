/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Cloudflare Web Analytics token; unset outside a deploy, so no beacon loads. */
  readonly VITE_CF_BEACON_TOKEN?: string;
  /** Where the build will live, if not the real site (app/site.ts). */
  readonly VITE_SITE_URL?: string;
}

/** The contact address, base64-encoded by vite.config.ts. */
declare const __CONTACT_EMAIL__: string;

/** The CV, built from src/features/cv/cv.md by vite/cv.ts. */
declare module "virtual:cv" {
  const cv: import("@/features/cv/cv.types").Cv;
  export default cv;
}
