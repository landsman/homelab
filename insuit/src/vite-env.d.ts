/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Cloudflare Web Analytics token; unset outside a deploy, so no beacon loads. */
  readonly VITE_CF_BEACON_TOKEN?: string
  /** Google Tag Manager container; unset outside a deploy, so nothing is counted. */
  readonly VITE_GTM_ID?: string
  /** Where the build will live, if not the real site (app/site.ts). */
  readonly VITE_SITE_URL?: string
}

/** The commit the site was built from (vite.config.ts). */
declare const __COMMIT__: string
/** The day content/cv last changed, YYYY-MM-DD (vite.config.ts). */
declare const __CV_DATE__: string

/** The year the site was built in (vite.config.ts). */
declare const __BUILD_YEAR__: number

/** The contact address, base64-encoded by vite.config.ts. */
declare const __CONTACT_EMAIL__: string

/** The CV, built from content/cv/cv.md by vite/cv.ts. */
declare module 'virtual:cv' {
  const cv: import('@/features/cv/cv.types').Cv
  export default cv
}
