#!/usr/bin/env bash
# Render all pollos.cz pages by wrapping their content in templates/layout.html.
# Add new pages by appending another render_page call below.
set -eu

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
while IFS= read -r f; do
  setup_items+="<li><a href=\"${f}\">${f}</a></li>"$'\n'
done < <(cd "${SETUP_SRC}" && find -L . -maxdepth 1 -type f ! -name "index.html" | sed 's|^\./||' | sort)

if [[ -z "${setup_items}" ]]; then
  setup_items="<li><em>(empty)</em></li>"
fi

GENERATED_AT="$(TZ=Europe/Prague date +"%Y-%m-%d %H:%M %Z")"

SETUP_CONTENT=$(cat <<HTML
<main class="listing">
  <h1>Index of /setup</h1>
  <ul>
${setup_items}
  </ul>
  <footer>generated ${GENERATED_AT}</footer>
</main>
HTML
)

render_page \
  --title "Index of /setup — pollos.cz" \
  --content "${SETUP_CONTENT}" \
  --out public/setup/index.html