#!/usr/bin/env bash
# Render all pollos.cz pages by wrapping their content in templates/layout.html.
# Add new pages by appending another render_page call below.
set -eu

# See note in lib-render.sh — `&` in CONTENT must NOT expand to the match.
shopt -u patsub_replacement 2>/dev/null || true

cd "$(dirname "$0")/.."
source cli/lib-render.sh

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
    # Strip leading "NNN-" and ".sh" → alias.
    alias="$(basename "${f}" .sh | sed -E 's/^[0-9]+-//')"
    setup_items+="<li><a href=\"${f}\">${f}</a><a class=\"alias\" href=\"/${alias}\">/${alias}</a></li>"$'\n'
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

# Load the body fragment and substitute dynamic bits.
SETUP_CONTENT="$(cat src/setup/index.html)"
SETUP_CONTENT="${SETUP_CONTENT//\{\{LISTING\}\}/${setup_items}}"
SETUP_CONTENT="${SETUP_CONTENT//\{\{GENERATED_AT\}\}/${GENERATED_AT}}"

render_page \
  --title "Index of /setup — pollos.cz" \
  --content "${SETUP_CONTENT}" \
  --out public/setup/index.html