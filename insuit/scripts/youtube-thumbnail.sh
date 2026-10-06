#!/usr/bin/env bash
# Saves a YouTube video's thumbnail as public/assets/blog/youtube/<id>.jpg, for
# a post's <YouTube> to show under its play button. The page then serves it from
# the site itself: a reader asks YouTube for nothing until they press play.
#
#   youtube-thumbnail.sh <video id>
set -euo pipefail

id=${1:?usage: youtube-thumbnail.sh <video id>}
[[ $id =~ ^[A-Za-z0-9_-]{11}$ ]] || { echo "not a YouTube video id: $id" >&2; exit 1; }

out="$(dirname "$0")/../public/assets/blog/youtube/$id.jpg"
mkdir -p "$(dirname "$out")"
# The 1280×720 one where YouTube made it, else the 480×360 every video has
# (letterboxed; the frame crops it to 16:9).
curl -fsSL -o "$out" "https://i.ytimg.com/vi/$id/maxresdefault.jpg" ||
  curl -fsSL -o "$out" "https://i.ytimg.com/vi/$id/hqdefault.jpg"
echo "wrote $out ($(wc -c <"$out" | tr -d ' ') bytes)"
