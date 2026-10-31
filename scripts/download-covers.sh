#!/usr/bin/env bash
set -euo pipefail

# Downloads the collection's artwork into public/albums/<id>/: each album's front cover and, when
# archived, scans of the printed CD and the back insert, plus the booklet's back page where
# collection.json lists one. Albums and their MusicBrainz release groups come from collection.json,
# and the paths of the files found (relative to the album's folder) are written back into it.
# Sources: MusicBrainz release data and the Cover Art Archive. Requires curl and jq.
#
# Usage: scripts/download-covers.sh [album id ...]   (no ids: every album)
#
# The archive's JPEGs are two to five times larger than the page needs: afterwards run
# node scripts/optimize-images.mjs [album id ...], which converts them to AVIF and WebP at the
# sizes the page draws and points collection.json at the results.

USER_AGENT="discography-demo/0.1 (local demo)"

dir="public/albums"
config="$dir/collection.json"
if [[ ! -f $config ]]; then
  echo "No $config" >&2
  exit 1
fi

# Records an album's file in collection.json (field relative to the album's folder), if the file exists.
set_path() {
  local slug=$1 field=$2 file=$3 updated
  [[ -f "$dir/$slug/$file" ]] || return 0
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
# Some originals are PNG (without a 1200 px thumbnail), so those are re-encoded to match the name.
shrink() {
  if command -v sips >/dev/null; then
    sips --resampleHeightWidthMax 1200 "$1" >/dev/null 2>&1
    if [[ $(sips -g format "$1" | awk '/format/ { print $2 }') != jpeg ]]; then
      sips -s format jpeg "$1" --out "$1.part" >/dev/null 2>&1 && mv "$1.part" "$1"
    fi
  fi
}

# Keeps one panel of a scan that shows several: left or right for a two-page spread, n/m for the
# nth of m equal panels side by side (a foldout), or n/m,r/s for the panel in column n of m and
# row r of s (a poster folded in four).
take_part() {
  local file=$1 part=$2 column row
  command -v sips >/dev/null || return 0
  case $part in
    left) column=1/2 ;;
    right) column=2/2 ;;
    */*,*/*) column=${part%,*} row=${part#*,} ;;
    */*) column=$part ;;
    *) echo "  unknown part $part; kept the whole scan"; return 0 ;;
  esac
  crop_column "$file" "$column"
  if [[ -n ${row:-} ]]; then
    # sips silently refuses a crop that ends on the bottom edge (one ending on the right edge
    # works), so a row is cut as a column of the scan turned a quarter: row r of s from the top is
    # then column s - r + 1 from the left.
    sips --rotate 90 "$file" >/dev/null
    crop_column "$file" "$((${row#*/} - ${row%/*} + 1))/${row#*/}"
    sips --rotate 270 "$file" >/dev/null
  fi
  return 0
}

# Crops a file to the nth of m equal columns. sips reads a crop offset of 0 as "centred", so the
# first column is cut as the last column of a mirrored copy. The crop is written to a copy, since
# in place sips sometimes leaves the file uncropped without an error.
crop_column() {
  local file=$1 n=${2%/*} m=${2#*/} width height size offset
  width=$(sips -g pixelWidth "$file" | awk '/pixelWidth/ { print $2 }')
  height=$(sips -g pixelHeight "$file" | awk '/pixelHeight/ { print $2 }')
  size=$((width / m))
  offset=$(((n - 1) * width / m))
  ((n == 1 || n == m)) && offset=$((width - size))
  ((n == 1)) && sips --flip horizontal "$file" >/dev/null
  sips --cropToHeightWidth "$height" "$size" --cropOffset 0 "$offset" "$file" --out "${file%.*}.crop.jpg" >/dev/null
  mv "${file%.*}.crop.jpg" "$file"
  ((n == 1)) && sips --flip horizontal "$file" >/dev/null
  return 0
}

# Prints two lines: the URL of a disc scan (a "Medium" image, preferring the printed side over one
# also tagged Matrix/Runout, which is usually the silver data side) and of a back insert ("Back"). Both
# come from the earliest single-CD release that has both, so they show the same edition; failing
# that, each comes from the earliest release that has it. The demo only shows single-disc cases, so
# editions with a second CD or a DVD are skipped, and so are promotional and bootleg releases (only
# "Official" counts). collection.json can pin the edition instead
# (musicbrainz.release), and pick its back image (musicbrainz.backImage) when the first one tagged
# Back is the wrong side. A line is empty if nothing is archived. Fails if MusicBrainz could not be
# reached.
find_scans() {
  local group=$1 releases=${2:-} back_image=${3:-} release images disc='' back='' found_disc found_back
  # MusicBrainz allows about one request per second.
  sleep 1
  [[ -n $releases ]] || releases=$(fetch "https://musicbrainz.org/ws/2/release?release-group=$group&inc=media&limit=100&fmt=json" 2>/dev/null \
    | jq -r '[.releases[]
        | select(.status == "Official" and (.media | length) == 1 and .media[0].format == "CD" and .["cover-art-archive"].count > 0)]
        | sort_by([(if (.date // "") == "" then "9999" else .date end), .id])
        | .[].id') || return 1
  for release in $releases; do
    images=$(fetch "https://coverartarchive.org/release/$release" 2>/dev/null) || continue
    found_disc=$(jq -r '[.images[] | select(.types | index("Medium"))] | sort_by(.types | index("Matrix/Runout") != null)
      | first(.[] | .thumbnails["1200"] // .image) // empty' <<<"$images")
    found_back=$(jq -r --arg id "$back_image" 'first(.images[] | select(if $id == "" then .types | index("Back") else (.id | tostring) == $id end) | .thumbnails["1200"] // .image) // empty' <<<"$images")
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

# Saves the booklet's back page. No tag marks it reliably, so collection.json lists it per album
# (musicbrainz.bookletBack) as release/image ID, with @left or @right to take one half of a
# two-page spread, @n/m for the nth of m panels of a foldout, or @n/m,r/s for one panel of a poster
# folded in four (column, then row).
fetch_booklet_back() {
  local slug=$1 source=$2 half='' file
  if [[ $source == *@* ]]; then
    half=${source#*@}
    source=${source%@*}
  fi
  file="$dir/$slug/booklet-back.jpg"
  save "https://coverartarchive.org/release/${source%/*}/${source#*/}-1200.jpg" "$file" || return 0
  [[ -n $half ]] && take_part "$file" "$half"
  echo "  booklet back: $source${half:+ ($half)}"
}

# musicbrainz.coverRelease takes the front cover from that release instead of the release group's
# chosen image (when that one is small). musicbrainz.backHalf takes one half of a back scan that
# shows a whole spread (some editions only have the digipak's outside archived); like the booklet
# back page, it also takes n/m and n/m,r/s.
# Fields are split on the unit separator: tabs count as whitespace, so empty fields would collapse.
while IFS=$'\x1f' read -r slug group booklet_back release back_half cover_release back_image; do
  if (($#)) && [[ " $* " != *" $slug "* ]]; then continue; fi
  echo "Downloading $slug"
  mkdir -p "$dir/$slug"
  cover="release-group/$group"
  [[ -n $cover_release ]] && cover="release/$cover_release"
  save "https://coverartarchive.org/$cover/front-1200" "$dir/$slug/cover.jpg" >/dev/null 2>&1 \
    || save "https://coverartarchive.org/$cover/front-500" "$dir/$slug/cover.jpg" || true
  if ! scans=$(find_scans "$group" "$release" "$back_image"); then
    echo "  could not reach MusicBrainz; kept any existing scans"
  else
    # With neither scan archived the output is empty, and the second read fails at end of input.
    { read -r disc; read -r back; } <<<"$scans" || true
    if [[ -n $disc ]]; then
      save "$disc" "$dir/$slug/disc.jpg" && shrink "$dir/$slug/disc.jpg" && echo "  disc scan: $disc"
    else
      echo "  no disc scan archived; the disc uses the cover"
    fi
    if [[ -n $back ]]; then
      save "$back" "$dir/$slug/back.jpg" && { [[ -z $back_half ]] || take_part "$dir/$slug/back.jpg" "$back_half"; } \
        && shrink "$dir/$slug/back.jpg" && echo "  back insert: $back${back_half:+ ($back_half)}"
    else
      echo "  no back insert archived; the case uses a generated one"
    fi
  fi
  if [[ -n ${booklet_back:-} ]]; then
    fetch_booklet_back "$slug" "$booklet_back"
  fi
  set_path "$slug" cover "cover.jpg"
  set_path "$slug" disc "disc.jpg"
  set_path "$slug" back "back.jpg"
  set_path "$slug" bookletBack "booklet-back.jpg"
done < <(jq -r '.albums[] | [.id, .musicbrainz.releaseGroup, (.musicbrainz.bookletBack // ""), (.musicbrainz.release // ""), (.musicbrainz.backHalf // ""), (.musicbrainz.coverRelease // ""), (.musicbrainz.backImage // "")] | join("\u001f")' "$config")
