#!/usr/bin/env bash
set -euo pipefail

# Downloads a band's artwork into public/bands/<band>/: each album's front cover and, when
# archived, scans of the printed CD and the back insert, plus the booklet's back page where
# band.json lists one. Albums and their MusicBrainz release groups come from band.json, and the
# paths of the files found are written back into it. Sources: MusicBrainz release data and the
# Cover Art Archive. Requires curl and jq.
#
# Usage: scripts/download-covers.sh <band> [album id ...]   (no ids: every album)

USER_AGENT="discography-demo/0.1 (local demo)"

if (($# < 1)); then
  echo "Usage: $0 <band> [album id ...]" >&2
  exit 1
fi
dir="public/bands/$1"
config="$dir/band.json"
shift
if [[ ! -f $config ]]; then
  echo "No $config" >&2
  exit 1
fi
mkdir -p "$dir/covers" "$dir/discs" "$dir/backs" "$dir/booklets"

# Records an album's file in band.json (field relative to the band folder), if the file exists.
set_path() {
  local slug=$1 field=$2 file=$3 updated
  [[ -f "$dir/$file" ]] || return 0
  updated=$(jq --arg id "$slug" --arg field "$field" --arg file "$file" \
    '(.albums[] | select(.id == $id))[$field] = $file' "$config")
  printf '%s\n' "$updated" >"$config"
}

fetch() {
  # MusicBrainz answers 503 when it is rate limiting, so retry with a pause.
  curl --silent --show-error --location --fail --retry 4 --retry-delay 5 --max-time 60 --user-agent "$USER_AGENT" "$@"
}

# Downloads to a temporary file and only then replaces the target, so a failed request (the
# Cover Art Archive answers 500 now and then) keeps the existing file and the run goes on.
save() {
  local url=$1 file=$2
  if fetch "$url" --output "$file.part"; then
    mv "$file.part" "$file"
  else
    rm -f "$file.part"
    echo "  could not download $url; kept any existing file"
    return 1
  fi
}

# Scans are sometimes only archived at full scanner resolution; 1200 px is plenty for a texture.
shrink() {
  if command -v sips >/dev/null; then
    sips --resampleHeightWidthMax 1200 "$1" >/dev/null
  fi
}

# Keeps the left or right half of a two-page scan. sips reads a crop offset of 0 as "centred", so
# the left half is cut as the right half of a mirrored copy.
take_half() {
  local file=$1 half=$2 width height
  command -v sips >/dev/null || return 0
  width=$(sips -g pixelWidth "$file" | awk '/pixelWidth/ { print $2 }')
  height=$(sips -g pixelHeight "$file" | awk '/pixelHeight/ { print $2 }')
  [[ $half == left ]] && sips --flip horizontal "$file" >/dev/null
  sips --cropToHeightWidth "$height" $((width / 2)) --cropOffset 0 $((width - width / 2)) "$file" >/dev/null
  [[ $half == left ]] && sips --flip horizontal "$file" >/dev/null
}

# Prints two lines: the URL of a disc scan (a "Medium" image) and of a back insert ("Back"). Both
# come from the earliest CD release that has both, so they show the same edition; failing that,
# each comes from the earliest release that has it. band.json can pin the edition instead
# (musicbrainz.release). A line is empty if nothing is archived. Fails if MusicBrainz could not be
# reached.
find_scans() {
  local group=$1 releases=${2:-} release images disc='' back='' found_disc found_back
  # MusicBrainz allows about one request per second.
  sleep 1
  [[ -n $releases ]] || releases=$(fetch "https://musicbrainz.org/ws/2/release?release-group=$group&inc=media&limit=100&fmt=json" 2>/dev/null \
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

# Saves the booklet's back page. No tag marks it reliably, so band.json lists it per album
# (musicbrainz.bookletBack) as release/image ID, with @left or @right to take one half of a
# two-page spread.
fetch_booklet_back() {
  local slug=$1 source=$2 half='' file
  if [[ $source == *@* ]]; then
    half=${source#*@}
    source=${source%@*}
  fi
  file="$dir/booklets/$slug-back.jpg"
  save "https://coverartarchive.org/release/${source%/*}/${source#*/}-1200.jpg" "$file" || return 0
  [[ -n $half ]] && take_half "$file" "$half"
  echo "  booklet back: $source${half:+ ($half half)}"
}

# musicbrainz.coverRelease takes the front cover from that release instead of the release group's
# chosen image (when that one is small). musicbrainz.backHalf takes one half of a back scan that shows a whole spread (some editions only
# have the digipak's outside archived).
# Fields are split on the unit separator: tabs count as whitespace, so empty fields would collapse.
while IFS=$'\x1f' read -r slug group booklet_back release back_half cover_release; do
  if (($#)) && [[ " $* " != *" $slug "* ]]; then continue; fi
  echo "Downloading $slug"
  cover="release-group/$group"
  [[ -n $cover_release ]] && cover="release/$cover_release"
  save "https://coverartarchive.org/$cover/front-1200" "$dir/covers/$slug.jpg" >/dev/null 2>&1 \
    || save "https://coverartarchive.org/$cover/front-500" "$dir/covers/$slug.jpg" || true
  if ! scans=$(find_scans "$group" "$release"); then
    echo "  could not reach MusicBrainz; kept any existing scans"
  else
    # With neither scan archived the output is empty, and the second read fails at end of input.
    { read -r disc; read -r back; } <<<"$scans" || true
    if [[ -n $disc ]]; then
      save "$disc" "$dir/discs/$slug.jpg" && shrink "$dir/discs/$slug.jpg" && echo "  disc scan: $disc"
    else
      echo "  no disc scan archived; the disc uses the cover"
    fi
    if [[ -n $back ]]; then
      save "$back" "$dir/backs/$slug.jpg" && { [[ -z $back_half ]] || take_half "$dir/backs/$slug.jpg" "$back_half"; } \
        && shrink "$dir/backs/$slug.jpg" && echo "  back insert: $back${back_half:+ ($back_half half)}"
    else
      echo "  no back insert archived; the case uses a generated one"
    fi
  fi
  if [[ -n ${booklet_back:-} ]]; then
    fetch_booklet_back "$slug" "$booklet_back"
  fi
  set_path "$slug" cover "covers/$slug.jpg"
  set_path "$slug" disc "discs/$slug.jpg"
  set_path "$slug" back "backs/$slug.jpg"
  set_path "$slug" bookletBack "booklets/$slug-back.jpg"
done < <(jq -r '.albums[] | [.id, .musicbrainz.releaseGroup, (.musicbrainz.bookletBack // ""), (.musicbrainz.release // ""), (.musicbrainz.backHalf // ""), (.musicbrainz.coverRelease // "")] | join("\u001f")' "$config")
