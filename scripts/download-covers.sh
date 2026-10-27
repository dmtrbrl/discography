#!/usr/bin/env bash
set -euo pipefail

# Downloads each album's front cover and, when one is archived, a scan of the printed CD.
# Sources: MusicBrainz release data and the Cover Art Archive. Requires curl and jq.

USER_AGENT="discography-demo/0.1 (local demo)"

mkdir -p public/covers public/discs

fetch() {
  # MusicBrainz answers 503 when it is rate limiting, so retry with a pause.
  curl --silent --show-error --location --fail --retry 4 --retry-delay 5 --max-time 60 --user-agent "$USER_AGENT" "$@"
}

# Prints the URL of a disc scan (a "Medium" image) from the earliest CD release that has one.
# Prints nothing if none is archived, and fails if MusicBrainz could not be reached.
find_disc_scan() {
  local group=$1 releases release url
  # MusicBrainz allows about one request per second.
  sleep 1
  releases=$(fetch "https://musicbrainz.org/ws/2/release?release-group=$group&inc=media&limit=100&fmt=json" 2>/dev/null \
    | jq -r '[.releases[]
        | select(any(.media[]?; .format == "CD") and .["cover-art-archive"].count > 0)]
        | sort_by([(if (.date // "") == "" then "9999" else .date end), .id])
        | .[].id') || return 1
  for release in $releases; do
    url=$(fetch "https://coverartarchive.org/release/$release" 2>/dev/null \
      | jq -r 'first(.images[] | select(.types | index("Medium")) | .thumbnails["1200"] // .image) // empty') || true
    if [[ -n $url ]]; then
      echo "${url/#http:/https:}"
      return
    fi
  done
}

while read -r slug group; do
  echo "Downloading $slug"
  fetch "https://coverartarchive.org/release-group/$group/front-500" --output "public/covers/$slug.jpg"
  if ! disc=$(find_disc_scan "$group"); then
    echo "  could not reach MusicBrainz; kept any existing disc scan"
  elif [[ -n $disc ]]; then
    fetch "$disc" --output "public/discs/$slug.jpg"
    # Some scans are only archived at full scanner resolution; 1200 px is plenty for the texture.
    if command -v sips >/dev/null; then
      sips --resampleHeightWidthMax 1200 "public/discs/$slug.jpg" >/dev/null
    fi
    echo "  disc scan: $disc"
  else
    echo "  no disc scan archived; the slider uses the cover"
  fi
done <<'ALBUMS'
bleach f1afec0b-26dd-3db5-9aa1-c91229a74a24
nevermind 1b022e01-4da6-387b-8658-8678046e4cef
incesticide 01cf1391-141b-3c87-8650-45ade6e59070
in-utero 2a0981fb-9593-3019-864b-ce934d97a16e
mtv-unplugged fb3770f6-83fb-32b7-85c4-1f522a92287e
muddy-banks 249e7835-5c39-3a10-b15b-e2d3470fb40c
nirvana 5ab32af4-c62e-3cbf-aa8c-c761581d3b94
sliver e9674d41-d94b-344a-89f5-734736853d5f
live-at-reading 48f5d526-0fa6-4ca6-ac59-9b2cf9ef464f
icon 5cc5dc44-8860-462e-8aa5-2cf9b71af237
ALBUMS
