#!/usr/bin/env bash
# Sourceable renderer for pollos.cz. Wraps a content fragment in
# templates/layout.html and writes it to OUT.
#
# Layout placeholders: {{TITLE}}, {{CONTENT}}.
# Everything else (lang, robots, OG, description, favicons, stylesheet)
# is hardcoded in templates/layout.html.

# bash 5.2 enabled patsub_replacement by default — `&` in the replacement of
# ${var//pat/repl} then expands to the matched text. Our CONTENT contains
# HTML entities like &amp;, so every `&` would become `{{CONTENT}}`.
# Older bash ignores the unknown shopt.
shopt -u patsub_replacement 2>/dev/null || true

render_page() {
  local title="" content="" out=""

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --title)   title="$2"; shift 2 ;;
      --content) content="$2"; shift 2 ;;
      --out)     out="$2"; shift 2 ;;
      *) echo "render_page: unknown arg '$1'" >&2; return 2 ;;
    esac
  done

  for k in title content out; do
    if [[ -z "${!k}" ]]; then
      echo "render_page: --${k} is required" >&2
      return 2
    fi
  done

  : "${ASSET_VERSION:?ASSET_VERSION env var must be set before render_page}"

  local template
  template="$(cat templates/layout.html)"
  template="${template//\{\{TITLE\}\}/${title}}"
  template="${template//\{\{ASSET_VERSION\}\}/${ASSET_VERSION}}"
  template="${template//\{\{CONTENT\}\}/${content}}"

  mkdir -p "$(dirname "${out}")"
  printf '%s' "${template}" > "${out}"
  echo "wrote ${out}"
}