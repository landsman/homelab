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
# Match both quote styles — Prettier normalizes CSS strings to single quotes.
find public/assets -type f -name '*.css' -print0 \
  | xargs -0 sed -i.bak -E \
    -e "s|url\(\"([^\"?]+)\"\)|url(\"\1?v=${ASSET_VERSION}\")|g" \
    -e "s|url\('([^'?]+)'\)|url('\1?v=${ASSET_VERSION}')|g"
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
# Overridable so tests can point the listing generator at a fixture dir.
SETUP_SRC="${SETUP_SRC:-src/setup}"

setup_items=""
aliases=()
raw_paths=()

# Split scripts from non-script config files (e.g. mise.toml) so we can nest
# each config under the script that consumes it.
sh_files=()
other_files=()
while IFS= read -r f; do
  if [[ "${f}" == *.sh ]]; then sh_files+=("${f}"); else other_files+=("${f}"); fi
done < <(cd "${SETUP_SRC}" && find -L . -maxdepth 1 -type f ! -name "index.html" | sed 's|^\./||' | sort)

# `child_li <file> <parent-script>` — a config file rendered as an indented
# child of the script that fetches it. Served raw like the scripts.
child_li() {
  setup_items+="<li class=\"child\"><span class=\"branch\" aria-hidden=\"true\">└─</span><a href=\"${1}\" hx-boost=\"false\">${1}</a><span class=\"note\">fetched by ${2}</span></li>"$'\n'
  raw_paths+=("/setup/${1}")
}

# Associative array (the script is bash) so a config is marked consumed by exact
# key — robust against filenames with spaces or glob characters.
declare -A consumed=()
for f in "${sh_files[@]}"; do
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
  # Nest config files under the script that uses them. THIS is where the
  # parent↔child relationship is defined: there is no hardcoded map — we grep
  # each script for the config's filename, so the single source of truth is the
  # reference inside the script itself (001-init.sh does
  # `curl .../mise.toml` → mise.toml nests under it). Add a config + reference it
  # from a script and it auto-nests; reference nothing and it falls through to
  # the standalone list below.
  #
  # Caveats (harmless for today's distinctly-named, single-reference files):
  #   - grep -F is a plain substring match, not whole-word — a generic name like
  #     config.toml could match unintended paths.
  #   - `consumed` makes the FIRST script (sorted) that references a config win,
  #     so a config used by several scripts nests under the lowest-numbered one.
  for o in "${other_files[@]}"; do
    [[ -n "${consumed[$o]:-}" ]] && continue
    if grep -qF -- "${o}" "${SETUP_SRC}/${f}"; then
      child_li "${o}" "${f}"
      consumed["${o}"]=1
    fi
  done
done

# Config files not referenced by any script — list them standalone at the end.
for o in "${other_files[@]}"; do
  [[ -n "${consumed[$o]:-}" ]] && continue
  setup_items+="<li><a href=\"${o}\" hx-boost=\"false\">${o}</a></li>"$'\n'
  raw_paths+=("/setup/${o}")
done

if [[ -z "${setup_items}" ]]; then
  setup_items="<li><em>(empty)</em></li>"
fi

# _headers — CF Pages matches by incoming URL, so each alias (and each raw
# non-.sh setup file) needs its own rule in addition to the /setup/*.sh
# catch-all from src/_headers.
header_paths=("${raw_paths[@]}")
for a in "${aliases[@]}"; do
  header_paths+=("/${a}")
done
{
  echo ""
  echo "# Auto-generated raw-file header rules"
  for p in "${header_paths[@]}"; do
    echo "${p}"
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