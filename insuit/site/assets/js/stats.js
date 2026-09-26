// Matomo on stats.insuit.cz (homelab matomo/), site 1. Cookieless, so no
// consent banner; link tracking also records outbound and mailto: clicks.
// matomo.js itself is loaded by the next <script>, which runs after this one.
const _paq = (window._paq = window._paq || []);
_paq.push(
  ["disableCookies"],
  ["setTrackerUrl", "https://stats.insuit.cz/matomo.php"],
  ["setSiteId", "1"],
  ["trackPageView"],
  ["enableLinkTracking"],
);
