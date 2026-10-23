/**
 * Google Tag Manager. The container is written into every page's <head> at
 * build time (routes/__root.tsx), so a visitor is measured even while the
 * container is still loading. The id comes from the environment like the Web
 * Analytics token (VITE_GTM_ID): a local build has none, so a `make dev` or
 * test visit is never counted. It is public either way — it is in the source.
 */
export const GTM_ID: string | undefined = import.meta.env.VITE_GTM_ID

/** Google's bootstrap, as they hand it out, with the container id in it. */
export function gtmScript(id: string): string {
  return `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${id}');`
}

/** The fallback for a visitor with no JavaScript: the container in an iframe. */
export function gtmNoscript(id: string): string {
  return `<iframe src="https://www.googletagmanager.com/ns.html?id=${id}" height="0" width="0" style="display:none;visibility:hidden"></iframe>`
}

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[]
  }
}

/**
 * A link swaps the page without loading a document, so the container sees no
 * page view of its own. Push one for the new page; the first page is the one
 * the container counts at load. Fire a Custom Event trigger on `page_view` in
 * GTM for this — a History Change trigger would count the same visit twice.
 */
export function trackPageView(pathname: string) {
  window.dataLayer?.push({
    event: 'page_view',
    page_path: pathname,
    page_location: window.location.href,
    page_title: document.title,
  })
}
