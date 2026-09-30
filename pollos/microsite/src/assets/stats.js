// Matomo on stats.insuit.cz (homelab matomo/), site 2. Cookieless, so no
// consent banner; link tracking also records outbound clicks. matomo.js itself
// is loaded by the next <script>, which runs after this one.
const _paq = (window._paq = window._paq || [])
_paq.push(
  ['disableCookies'],
  ['setTrackerUrl', 'https://stats.insuit.cz/matomo.php'],
  ['setSiteId', '2'],
  ['trackPageView'],
  ['enableLinkTracking']
)

// hx-boost swaps pages without a reload, so the first trackPageView is the only
// one Matomo would see. Count each boosted navigation, and each back/forward
// restore, as its own view — on the next tick, because htmx updates
// document.title after these events fire.
const trackBoostedView = () =>
  setTimeout(() => {
    _paq.push(
      ['setCustomUrl', location.href],
      ['setDocumentTitle', document.title],
      ['trackPageView']
    )
  })
document.addEventListener('htmx:pushedIntoHistory', trackBoostedView)
document.addEventListener('htmx:historyRestore', trackBoostedView)
