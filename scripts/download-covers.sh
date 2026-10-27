#!/usr/bin/env bash
set -euo pipefail

# Downloads each album's front cover and, when archived, scans of the printed CD and the back
# insert, plus the booklet's back page where one is listed below. Sources: MusicBrainz release data
# and the Cover Art Archive. Requires curl and jq.
#
# Usage: scripts/download-covers.sh [slug ...]   (no slugs: every album)

USER_AGENT="discography-demo/0.1 (local demo)"

mkdir -p public/covers public/discs public/backs public/booklets

fetch() {
  # MusicBrainz answers 503 when it is rate limiting, so retry with a pause.
  curl --silent --show-error --location --fail --retry 4 --retry-delay 5 --max-time 60 --user-agent "$USER_AGENT" "$@"
}

# Scans are sometimes only archived at full scanner resolution; 1200 px is plenty for a texture.
shrink() {
  if command -v sips >/dev/null; then
    sips --resampleHeightWidthMax 1200 "$1" >/dev/null
  fi
}

# Prints two lines: the URL of a disc scan (a "Medium" image) and of a back insert ("Back"). Both
# come from the earliest CD release that has both, so they show the same edition; failing that,
# each comes from the earliest release that has it. A line is empty if nothing is archived. Fails
# if MusicBrainz could not be reached.
find_scans() {
  local group=$1 releases release images disc='' back='' found_disc found_back
  # MusicBrainz allows about one request per second.
  sleep 1
  releases=$(fetch "https://musicbrainz.org/ws/2/release?release-group=$group&inc=media&limit=100&fmt=json" 2>/dev/null \
    | jq -r '[.releases[]
        | select(any(.media[]?; .format == "CD") and .["cover-art-archive"].count > 0)]
        | sort_by([(if (.date // "") == "" then "9999" else .date end), .id])
        | .[].id') || return 1
  for release in $releases; do
    images=$(fetch "https://coverartarchive.org/release/$release" 2>/dev/null) || continue
    found_disc=$(jq -r 'first(.images[] | select(.types | index("Medium")) | .thumbnails["1200"] // .image) // empty' <<<"$images")
    found_back=$(jq -r 'first(.images[] | select(.types | index("Back")) | .thumbnails["1200"] // .image) // empty' <<<"$images")
    if [[ -n $found_disc && -n $found_back ]]; then
      disc=$found_disc back=$found_back
      break
    fi
    disc=${disc:-$found_disc}
    back=${back:-$found_back}
  done
  echo "${disc/#http:/https:}"
  echo "${back/#http:/https:}"
}

# Saves the booklet's back page. No tag marks it reliably, so it is listed per album as
# release/image ID, with @left or @right to take one half of a two-page spread.
fetch_booklet_back() {
  local slug=$1 source=$2 half='' file width height
  if [[ $source == *@* ]]; then
    half=${source#*@}
    source=${source%@*}
  fi
  file="public/booklets/$slug-back.jpg"
  fetch "https://coverartarchive.org/release/${source%/*}/${source#*/}-1200.jpg" --output "$file"
  if [[ -n $half ]] && command -v sips >/dev/null; then
    width=$(sips -g pixelWidth "$file" | awk '/pixelWidth/ { print $2 }')
    height=$(sips -g pixelHeight "$file" | awk '/pixelHeight/ { print $2 }')
    # sips reads a crop offset of 0 as "centred", so the left half is cut as the right half of a
    # mirrored copy.
    [[ $half == left ]] && sips --flip horizontal "$file" >/dev/null
    sips --cropToHeightWidth "$height" $((width / 2)) --cropOffset 0 $((width - width / 2)) "$file" >/dev/null
    [[ $half == left ]] && sips --flip horizontal "$file" >/dev/null
  fi
  echo "  booklet back: $source${half:+ ($half half)}"
}

while read -r slug group booklet_back; do
  if (($#)) && [[ " $* " != *" $slug "* ]]; then continue; fi
  echo "Downloading $slug"
  fetch "https://coverartarchive.org/release-group/$group/front-1200" --output "public/covers/$slug.jpg" 2>/dev/null \
    || fetch "https://coverartarchive.org/release-group/$group/front-500" --output "public/covers/$slug.jpg"
  if ! scans=$(find_scans "$group"); then
    echo "  could not reach MusicBrainz; kept any existing scans"
  else
    { read -r disc; read -r back; } <<<"$scans"
    if [[ -n $disc ]]; then
      fetch "$disc" --output "public/discs/$slug.jpg"
      shrink "public/discs/$slug.jpg"
      echo "  disc scan: $disc"
    else
      echo "  no disc scan archived; the disc uses the cover"
    fi
    if [[ -n $back ]]; then
      fetch "$back" --output "public/backs/$slug.jpg"
      shrink "public/backs/$slug.jpg"
      echo "  back insert: $back"
    else
      echo "  no back insert archived; the case uses a generated one"
    fi
  fi
  if [[ -n ${booklet_back:-} ]]; then
    fetch_booklet_back "$slug" "$booklet_back"
  fi
done <<'ALBUMS'
bleach f1afec0b-26dd-3db5-9aa1-c91229a74a24 02b23593-ad18-4c8c-b30a-5c96b4796289/45223444350
nevermind 1b022e01-4da6-387b-8658-8678046e4cef 350a8190-2c4b-4010-9bd2-437857325ac5/27145200195@left
incesticide 01cf1391-141b-3c87-8650-45ade6e59070 756577ba-cdef-4924-9069-ebe1e1ada168/27144906539@left
in-utero 2a0981fb-9593-3019-864b-ce934d97a16e b9f84ee2-3690-4a76-a53e-ee0cbccf2639/39564868348
mtv-unplugged fb3770f6-83fb-32b7-85c4-1f522a92287e 2ff3be28-f74f-40c9-bdde-c19b6e4384ee/46180379880
muddy-banks 249e7835-5c39-3a10-b15b-e2d3470fb40c 6213251a-9e62-3d27-a772-de423115dccc/40724467330
nirvana 5ab32af4-c62e-3cbf-aa8c-c761581d3b94 15df9d9e-cd02-447d-99b6-c25abfce1b81/39573619956
ALBUMS
