#!/usr/bin/env bash
# Render all pollos.cz pages by wrapping their content in templates/layout.html.
# Add new pages by appending another render_page call below.
set -eu

# See note in lib-render.sh — `&` in CONTENT must NOT expand to the match.
shopt -u patsub_replacement 2>/dev/null || true

cd "$(dirname "$0")/.."
source cli/lib-render.sh

# -----------------------------------------------------------------------------
# Vendor pinned third-party JS — fetched once into .vendor-cache (gitignored)
# and copied into the build output. Pin the version explicitly so deploys are
# reproducible and a CDN outage can't break the build.
# -----------------------------------------------------------------------------
# Derive the pinned htmx version from the literal filename in layout.html —
# single source of truth, no duplicate constant to keep in sync.
HTMX_FILE="$(grep -oE 'htmx-[0-9.]+\.min\.js' templates/layout.html | head -n1)"
HTMX_VERSION="${HTMX_FILE#htmx-}"
HTMX_VERSION="${HTMX_VERSION%.min.js}"
HTMX_CACHE=".vendor-cache/${HTMX_FILE}"
HTMX_URL="https://unpkg.com/htmx.org@${HTMX_VERSION}/dist/htmx.min.js"

mkdir -p .vendor-cache
if [[ ! -f "${HTMX_CACHE}" ]]; then
  echo "fetching ${HTMX_URL}"
  curl -fsSL "${HTMX_URL}" -o "${HTMX_CACHE}"
fi

mkdir -p public/assets/vendor
cp "${HTMX_CACHE}" "public/assets/vendor/${HTMX_FILE}"

# Asset version — short content hash across every file we ship that can
# be referenced via a `?v=` URL: CSS, JS, and icons embedded by CSS.
# Vendored htmx is excluded — its version lives in the filename.
ASSET_VERSION="$(
  find src/assets -type f \( -name '*.css' -o -name '*.js' -o -path 'src/assets/img/icons/*' -o -path 'src/assets/img/favicon/*' \) \
    | sort \
    | xargs shasum \
    | shasum \
    | cut -c1-8
)"
export ASSET_VERSION
echo "asset version: ${ASSET_VERSION}"

# Append ?v=ASSET_VERSION to every url(...) reference inside any built CSS,
# so @imports and CSS-referenced icons all bust when content changes.
find public/assets -type f -name '*.css' -print0 \
  | xargs -0 sed -i.bak -E "s|url\(\"([^\"?]+)\"\)|url(\"\1?v=${ASSET_VERSION}\")|g"
find public/assets -type f -name '*.css.bak' -delete

# -----------------------------------------------------------------------------
# /  — home page (spinning logo)
# -----------------------------------------------------------------------------
render_page \
  --title "Los Pollos Hermanos" \
  --content "$(cat src/index.html)" \
  --out public/index.html

# -----------------------------------------------------------------------------
# /setup/  — directory listing (Cloudflare Pages has no native autoindex)
# -----------------------------------------------------------------------------
SETUP_SRC="src/setup"

setup_items=""
aliases=()
while IFS= read -r f; do
  if [[ "${f}" == *.sh ]]; then
    # Strip leading "NNN-" → alias; keep ".sh" so `wget URL` saves with extension.
    alias="$(echo "${f}" | sed -E 's/^[0-9]+-//')"
    # hx-boost="false" → htmx-boosted body must not intercept these; browser
    # navigates to raw text/plain script (otherwise htmx tries to swap script
    # source into the page).
    setup_items+="<li><a href=\"${f}\" hx-boost=\"false\">${f}</a><a class=\"alias\" href=\"/${alias}\" hx-boost=\"false\">/${alias}</a></li>"$'\n'
    # Copy the script to public/<alias> so the short URL serves it directly
    # (no redirect, no `_redirects` file needed). -L follows symlinks.
    cp -L "${SETUP_SRC}/${f}" "public/${alias}"
    aliases+=("${alias}")
  else
    setup_items+="<li><a href=\"${f}\">${f}</a></li>"$'\n'
  fi
done < <(cd "${SETUP_SRC}" && find -L . -maxdepth 1 -type f ! -name "index.html" | sed 's|^\./||' | sort)

if [[ -z "${setup_items}" ]]; then
  setup_items="<li><em>(empty)</em></li>"
fi

# _headers — CF Pages matches by incoming URL, so each alias needs its own
# header rule in addition to the /setup/*.sh catch-all from src/_headers.
{
  echo ""
  echo "# Auto-generated per-alias header rules"
  for a in "${aliases[@]}"; do
    echo "/${a}"
    echo "  Content-Type: text/plain; charset=utf-8"
    echo "  X-Content-Type-Options: nosniff"
    echo "  Content-Disposition: inline"
  done
} >> public/_headers

GENERATED_AT="$(TZ=Europe/Prague date +"%Y-%m-%d %H:%M %Z")"

# First alias becomes the concrete example in usage instructions, so the
# docs always show a real working URL instead of an abstract <alias> token.
EXAMPLE_ALIAS="${aliases[0]:-init.sh}"

# Load the body fragment and substitute dynamic bits.
SETUP_CONTENT="$(cat src/setup/index.html)"
SETUP_CONTENT="${SETUP_CONTENT//\{\{LISTING\}\}/${setup_items}}"
SETUP_CONTENT="${SETUP_CONTENT//\{\{GENERATED_AT\}\}/${GENERATED_AT}}"
SETUP_CONTENT="${SETUP_CONTENT//\{\{EXAMPLE_ALIAS\}\}/${EXAMPLE_ALIAS}}"

render_page \
  --title "Index of /setup — pollos.cz" \
  --content "${SETUP_CONTENT}" \
  --out public/setup/index.html