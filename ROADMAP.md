# Discography: roadmap and project state

A visual experiment for browsing an artist's discography in 3D, built with Solid and three.js. The
first version shows each album as a CD in a gallery modelled on the
[A24 films disc gallery](https://a24.raviklaassens.com/). The next phases replace the discs with CD
jewel cases that open to show a playable disc and a booklet you can leaf through.

This file is the hand-off document between sessions. It records what exists, why it is built that
way, what was tried and rejected, and what comes next. Keep it up to date when a phase lands or a
decision changes.

## Status at a glance

| Phase | Scope | Status |
| --- | --- | --- |
| 0 | CD gallery: motion, CD look, real disc scans, loading screen, performance | Done (initial commit `bb3b070`) |
| 1 | Jewel cases instead of discs, opening the front case | Next, waiting on open questions |
| 2a | Booklet as a flip book with LeafThrough | Planned |
| 2b | Disc to CD player animation, tracklist, 30-second previews | Planned |

## Running the project

```bash
npm install
npm run dev        # Vite dev server
npm run build      # production build into dist/
npm run preview    # serve the build
bash scripts/download-covers.sh   # refresh covers and disc scans (needs curl and jq)
```

## Phase 0: what is implemented

### Files

| File | Role |
| --- | --- |
| `src/scene.js` | Everything 3D: the `DiscScene` class, materials, shaders, input, motion, loading. All tuning lives in the `C` object at the top. |
| `src/main.jsx` | Solid app: loading screen, caption, prev/next buttons, counter, keyboard shortcuts. Talks to the scene through its public methods. |
| `src/data.js` | The album list. Each item: `id`, `title`, `year`, `kind`, `cover`, optional `disc`, plus `color`, `accent`, `motif` for the generated placeholder art. |
| `src/style.css` | Page shell (beige background, grain, bottom bar, loading screen). |
| `scripts/download-covers.sh` | Fetches covers and disc scans from MusicBrainz and the Cover Art Archive. |
| `public/covers/`, `public/discs/` | Local artwork, so the demo runs without network access. |

### Scene API used by the UI

`new DiscScene(element, albums, onIndexChange, { onProgress, onReady })`, then `step(delta)`,
`goTo(index, source)`, `flip(index?)`, `setAlbums(albums)` and `destroy()`. The scene owns the
position and reports the front disc through `onIndexChange`.

### Motion (ported from the reference)

The reference site's bundle keeps readable config names, so its constants were read directly from
its source rather than guessed. They live in `C` with the same names.

- Layout: discs sit on a shallow arc (`angle = offset × 0.35`, `x = sin(angle) × hGap × 2.4`,
  `z = 2.4 × (1 − cos(angle))`) inside a group rotated −30° on X and Y. Camera: 40° field of view at
  4.4 units. Next discs come toward the viewer on the right; earlier ones recede left into fog.
- Each disc eases toward its slot at its own rate (`followBase`, `followFalloff`), so the row trails
  during fast moves. The row leans, banks and dips with scroll speed (`flowLean`, `flowBank`,
  `flowDip`).
- Hover tilts the disc under the cursor toward it (`hoverTiltStrength` 0.21). A fast mouse pass
  nudges a disc (`wipe*`). A click on a side disc presses it in, then glides to it.
- Dragging the front disc spins it in 3D, with a soft limit past 144°, and it eases back on release.
  Dragging elsewhere scrubs the row with inertia (`friction` 0.89 per frame), then a spring snaps to
  the nearest disc (`snapFreq`, `snapDamping`).
- The wheel moves one album per gesture. A decaying envelope tells trackpad momentum apart from a
  fresh flick (`wheel*` constants).
- Keys: arrows, Home, End, Space (flip). Clicking the front disc also flips it.
- Touch: horizontal drags browse, flicks step one album.
- Reduced motion: transitions jump instead of animating.

### The CD look

Proportions follow a real disc and the reference photos, as fractions of the disc radius (1 unit):

| Zone | Radius | Notes |
| --- | --- | --- |
| Hole | 0 to 0.127 | |
| Clear plastic hub | 0.127 to 0.31 | One flat ring, 8% opaque, faint moulded rings drawn in the shader. |
| Mirror band | 0.31 to 0.345 | Front: the cover darkened 20% (only for square covers; scans have their own). Back: silver, slightly see-through. |
| Label / data area | 0.345 to 0.995 | Front: artwork. Back: silver data side. |
| Rim | 0.995 to 1 | Hairline clear plastic with a faint thin-film shimmer. |

- **Front artwork:** a scan of the printed disc when one exists (`album.disc`), otherwise the square
  cover, otherwise a generated placeholder. `findDiscInScan` locates the disc in a scan by comparing
  rows and columns against the corner colour, so tight crops, margins, white or black backgrounds,
  and discs cut off at the sides all fit.
- **Data side (back):** custom shader in `makeBackMaterial`. Bright silver base, plus diffraction
  from the concentric tracks using the grating equation with `light + view` (an earlier `light − view`
  version was physically wrong and looked fake). Only orders 1 and 2, blurred like a soft light,
  washed to pastel, and concentrated where the reflection also works radially. That produces soft
  wedges through the centre that move with the disc, as in photos. Two light directions give the
  X pattern. Also faint track lines and a few scratches whose direction is stored in the texture, so
  they only glint where their angle catches the light. Spectrum fit and grating maths follow Alan
  Zucconi's CD-ROM shader.
- **Seams:** the rim and hub tuck under the artwork rings (`seamOverlap`) so no background shows
  through the gap between differently segmented geometry. Lathed parts use three.js's own normals,
  because `computeVertexNormals()` splits them at the wrap-around seam.

### Loading and performance

- The gallery stays hidden, and input is ignored, until every disc has its final artwork and the
  fonts are loaded. Then shaders compile and the intro plays. A 12-second timeout (`loadTimeout`)
  reveals it anyway with placeholders.
- No refraction (`transmission`) anywhere: it renders the scene twice per frame and showed a blurred
  copy of the artwork through the hub.
- Textures are uploaded at load (`renderer.initTexture`) and shaders compiled at reveal, so nothing
  stalls when a disc scrolls into view.
- Adaptive resolution: the pixel ratio steps down (`QUALITY` levels) when frames run long, and the
  canvas is capped at 8 megapixels. MSAA is off on high-DPI screens.
- The render loop stops when nothing moves.
- Measured on an Apple M2 Max at 1440 × 900 with vsync off: about 2.5 to 3.5 ms per frame. With
  vsync on, navigation has no frames over 50 ms at 1440, 1920 and 2560 wide. Occasional slow runs
  were traced to other load on the machine by A/B testing against an older build.

### Artwork sources

`scripts/download-covers.sh`, per album (release group IDs are listed in the script):

1. Front cover: `coverartarchive.org/release-group/<id>/front-500` into `public/covers/`.
2. Disc scan: lists the release group's CD releases on MusicBrainz, oldest first (ties broken by
   ID, so reruns are stable), and takes the first Cover Art Archive image tagged `Medium`. Saved to
   `public/discs/`, shrunk to 1200 px with `sips` when available.
3. MusicBrainz rate limits (about one request per second, 503 when exceeded). The script waits,
   retries, and keeps an existing scan if MusicBrainz can't be reached.

Current coverage: 9 of 10 albums have a disc scan; Icon has none, so it uses its cover. After
editing scans, update `disc:` paths in `src/data.js` by hand.

### Design decisions from review (do not reintroduce)

These came from rounds of feedback on the look. Each was tried and rejected:

- Refraction through the hub (blurred artwork, double render cost).
- Three stepped hub rings with ripples (looked like shadows and steps).
- A wide, chrome-like rim (looked like a grinding disc). Keep it a hairline.
- A diffraction rainbow on the front rim (looked unrealistic).
- A rainbow in the clear hub.
- A dark, grey or separately shaded outer zone on the data side, such as a "recording ends here"
  boundary (read as a separate ring).
- Many, long or uniformly bright scratches (looked drawn on).
- Saturated rainbow spokes all around the disc with dark gaps (looked fake). Real discs show soft
  pastel wedges on bright silver.
- A light outline around the clear hub or at the print edge.

General preference: match real photos of CDs rather than stylised effects. When in doubt, compare
against reference photos (Wikimedia Commons has several freely licensed ones) before tuning.

### Verifying changes

Visual and performance checks so far used headless Chrome driven by `playwright-core`, kept outside
the repo:

- Launch Chrome with `--use-angle=metal --enable-gpu --ignore-gpu-blocklist` for real GPU numbers.
  SwiftShader works but runs at about 9 fps, so animations look slow there.
- Navigate with arrow keys and record `requestAnimationFrame` intervals to count frames over 50 ms.
- Load with `waitUntil: 'commit'` when testing the loading screen, because the page `load` event
  waits for the artwork.

## Phase 1: jewel cases

Goal: replace each disc with a CD jewel case showing the real cover, displayed and navigated
exactly like the discs today. Clicking the front case opens it.

- **Model:** a standard jewel case is about 142 × 125 × 10 mm. It has a clear lid hinged on the left
  with the booklet's front cover behind it, and a black or clear tray holding the disc. Behind the
  tray sits the back insert, whose ends fold into the two printed spines.
- **Reuse:** the disc inside the tray is the existing disc model with its scan and data side.
- **Opened state:** the lid swings open on its hinge; the disc sits in the tray on the right and the
  booklet's inside on the left. Build the opened state in this phase, because phases 2a and 2b
  start from it.
- **Clear plastic:** reflections and edge highlights like the disc hub, no refraction.
- **Layout:** retune spacing (`hGap`, `depthGap`, scale) for a square, thicker object. Keep the arc,
  trailing, lean, hover tilt, wheel and keyboard behaviour.
- **Interactions to redefine:** click on the front case opens it (today it flips the disc). Drag on
  the closed case might rotate it to show the spine and back (open question).
- **Artwork:** extend the download script to fetch Cover Art Archive images tagged `Back`, `Spine`,
  `Tray` and `Booklet`. Coverage is patchier than covers, so plan fallbacks: a generated back insert
  with the tracklist from MusicBrainz, and generated spines with artist and title.
- **Suggested first step:** build one album end to end (Nevermind has the best artwork coverage),
  then scale to all.

## Phase 2a: booklet as a flip book

Use [LeafThrough](https://github.com/dmtrbrl/leafthrough), the user's own library (npm
`leafthrough`, MIT, 0.1.3 at the time of writing).

What it is: a three.js flip book (needs three r160 or newer; this project uses r186) with spread and
single layouts, bending paper, drag and keyboard turning, accessibility, reduced motion support, and
a flat fallback without WebGL. Pages can be URLs, `<img>`, `<canvas>`, `ImageBitmap` or three.js
textures. It creates its own transparent canvas and renderer inside the element you give it; it
cannot render into an existing scene.

Integration plan:

1. Settings: `pageAspect: 1` (booklets are square, 120 × 120 mm) and the `spread` layout.
2. Handoff between canvases: in our scene the booklet lifts out of the opened case toward the
   camera and stops exactly where LeafThrough will draw its closed cover. At that moment LeafThrough's
   canvas appears over ours. Closing reverses it. Our render loop is idle meanwhile.
3. Hide the seam by matching LeafThrough's `lighting` and `paper` options to our scene, plus a very
   short cross-fade.
4. Fallback if the handoff still shows: add an embedded mode to LeafThrough that renders into an
   existing scene and renderer. Bigger change; only if needed.
5. Pages: Cover Art Archive `Booklet` scans where available (some are full two-page spreads; split
   them in the download script). Otherwise generate pages from MusicBrainz data such as the
   tracklist and credits.

## Phase 2b: disc to player, tracklist and previews

- **Animation:** the disc lifts from the tray, flips and drops into a CD player. The player model is
  probably the largest single piece of work in the whole plan.
- **Tracklist:** from MusicBrainz, per release.
- **30-second previews** (checked during planning):

  | Service | Previews | Direct browser use | Notes |
  | --- | --- | --- | --- |
  | Apple iTunes Search API | Yes, no key | Yes (`Access-Control-Allow-Origin: *`) | A lookup by album can return all tracks with `previewUrl` in one request. Recommended. |
  | Deezer API | Yes, no key; lookup by ISRC is precise | No (no CORS allow-origin header) | Needs JSONP or a small proxy. Preview URLs are signed and expire, so fetch them at play time. |
  | Spotify Web API | Removed for new apps in late 2024, as far as known | | Skip unless an older app still has access. |

  Check each service's terms before shipping; previews usually require attribution or a store link.
- **Data approach:** fetch tracklists and other static data in the download script and store them
  locally, like the artwork. Fetch only short-lived preview URLs at runtime.

## Open questions

1. Standard jewel case for every album, or some digipaks or slim cases?
2. On the closed case, should a drag rotate it to show the spine and back?
3. Player style: portable Discman, hi-fi deck with a sliding tray, or sketch both? (Phase 2b.)

## Later ideas (from the original README)

- Artist search: search MusicBrainz for an artist, list album release groups, resolve artwork through
  the Cover Art Archive, normalise to the `data.js` shape and call `scene.setAlbums()`. Needs
  debouncing, rate limiting, caching and handling of missing artwork.
