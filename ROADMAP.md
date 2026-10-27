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
| 1 | Jewel cases instead of discs, opening the front case | Done |
| 2a | Booklet as a flip book with LeafThrough | Planned |
| 2b | Disc to CD player animation, tracklist, 30-second previews | Planned |

## Running the project

```bash
npm install
npm run dev        # Vite dev server
npm run build      # production build into dist/
npm run preview    # serve the build
bash scripts/download-covers.sh nirvana   # refresh a band's artwork (needs curl and jq)
bash scripts/download-covers.sh nirvana nevermind   # refresh only the listed albums
# Open /?band=<folder> to show another band from public/bands/ (default: nirvana).
```

## Phase 0: what is implemented

### Files

| File | Role |
| --- | --- |
| `src/scene.js` | Everything 3D: the `GalleryScene` class (called `DiscScene` in phase 0), materials, shaders, input, motion, loading. All tuning lives in the `C` object at the top. |
| `src/main.jsx` | Solid app: loading screen, logo, caption, bubble cursor, screen-reader prev/next buttons, keyboard shortcuts. Talks to the scene through its public methods. |
| `public/bands/<band>/band.json` | Everything band-specific (since phase 1; was `src/data.js`): `name`, `logo`, `theme` (`background`, `backgroundCenter`, `backgroundEdge`, `ink`) and `albums`. Each album: `id`, `title`, `year`, `kind`, `cover`, optional `disc`, `back`, `bookletBack` and `tracks`, `color`, `accent`, `motif` for generated art, and `musicbrainz` (`releaseGroup`, optional `bookletBack` pick) for the download script. Paths are relative to the JSON file. |
| `src/band.js` | Loads the band picked by `?band=` (default `nirvana`), resolves its paths and adds the band name to each album. Documents the JSON shape. |
| `src/style.css` | Page shell (warm beige background with a grain overlay, bottom bar, loading screen). |
| `scripts/download-covers.sh` | `download-covers.sh <band> [album id ...]`: fetches covers, disc scans, back inserts and booklet back pages for the albums in the band's `band.json` from MusicBrainz and the Cover Art Archive, and writes the paths it found back into the JSON. A failed image keeps the existing file. |
| `public/bands/<band>/` | The band's `band.json`, `logo.svg`, and local artwork in `covers/`, `discs/`, `backs/`, `booklets/`, so the demo runs without network access. |

### Scene API used by the UI

`new GalleryScene(element, albums, onIndexChange, { onProgress, onReady, onPointer })`, then `reveal()` once
`onReady` has fired and the page is ready to show it, `step(delta)`,
`goTo(index, source)`, `toggle(index?)`, `open(index?)`, `close()`, `setAlbums(albums)` and
`destroy()`. The scene owns the position and reports the front case through `onIndexChange`.
Phase 0 had `flip(index?)` instead of the open methods.

### Motion (ported from the reference)

The reference site's bundle keeps readable config names, so its constants were read directly from
its source rather than guessed. They live in `C` with the same names.

- Layout: discs sit on a shallow arc (`angle = offset × 0.35`, `x = sin(angle) × hGap × 2.4`,
  `z = 2.4 × (1 − cos(angle))`) inside a group rotated −30° on X and Y (−22° since phase 1). Camera: 40° field of view at
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
- Keys: arrows, Home, End, Space (flip). Clicking the front disc also flips it. (Phase 1 replaced
  the flip with opening the case.)
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

`scripts/download-covers.sh`, per album (release group IDs come from `band.json`):

1. Front cover: `coverartarchive.org/release-group/<id>/front-1200` (500 px fallback) into `covers/`.
2. Disc scan: lists the release group's CD releases on MusicBrainz, oldest first (ties broken by
   ID, so reruns are stable), and takes the first Cover Art Archive image tagged `Medium`. Saved to
   `discs/`, shrunk to 1200 px with `sips` when available. (Phase 1 added back inserts and
   booklet pages; see below.)
3. MusicBrainz rate limits (about one request per second, 503 when exceeded). The script waits,
   retries, and keeps an existing scan if MusicBrainz can't be reached.

Current coverage: all 7 albums have a disc scan. (Phase 0 also had Sliver, Live at Reading and
Icon; they were dropped in phase 1 to keep the classic discography up to the 2002 compilation.)
The script records the paths of downloaded files in `band.json`; after editing scans by hand,
update the paths there.

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
- Sharp reflections of the lights on the jewel case lid, such as the strip light's rectangle
  (phase 1). Keep the lid's reflection a soft band.
- Bright or tinted case edges, and a black page (phase 1): both read as white outlines.
- An open case at a sideways angle (phase 1): it should face the viewer like an open book.

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
- Phase 1 used a small screenshot script (`playwright-core` from a sibling project, Chrome channel)
  that runs steps such as key presses, clicks, held drags and `page.evaluate`, and compared against
  the phase 0 build served from a temporary `git worktree`.

## Phase 1: jewel cases

Goal: replace each disc with a CD jewel case showing the real cover, displayed and navigated
exactly like the discs today. Clicking the front case opens it.

Decisions from the open questions: a standard jewel case for every album (no digipaks or slim
cases for now), and dragging the closed front case turns it to show the spines and back. Work
follows the suggested order: one album (Nevermind) end to end, then the rest.

### What is implemented

- **Model** (`makeCase` and the `make*Geometry` functions in `src/scene.js`), built in millimetres
  (one unit is 60 mm, the disc radius, so the phase 0 disc fits unchanged). Back to front: clear
  base plate; back insert, whose ends fold forward into the two spines behind the base's clear side
  walls; black tray with a rosette (platform and ring of teeth through the disc's hole); the disc
  itself, turned up to ±25° per album; a black hinge strip, part of the tray, finely ribbed, full
  height and reaching up to just under the lid (`hingeStrip`, `hingeRibs`); the booklet, 120 × 120 mm, pushed toward the open side; the
  clear lid plate, with flanges along the top and bottom and two tabs holding the booklet. Hinge on
  the left. Dimensions and depths are in `C` and the derived `CASE` object.
- **Clear plastic** (`makeCasePlastic`, one material per case): built on the disc hub's plastic at
  4% opacity, so edges seen side-on and glints stay opaque. No refraction. It drops reflections of
  the direct lights: on the flat lid
  the top strip light (a 6 × 0.4 area light) showed as a sharp pale rectangle whenever a hover tilt
  lined it up. Instead the lid reflects a long, soft strip light running left to right
  (`caseSheen`, `caseSheenWidth`, `caseSheenDir`): a soft band with no ends that slides across the
  lid as the case tilts, like a softbox in product photos. Found by rendering the frame with each
  light switched off and comparing.
- **Same lighting open and closed:** the disc print, its rim and its clear hub reflect the same
  soft strip light as the lid (`softReflection`, `withSoftReflection`, strength `discSheen`), not the
  direct lights. Before, the open case showed the disc lit the phase 0 way, with the strip light's
  hard white band across it. The gallery's lights are unchanged, so the disc's data side and the
  printed parts keep their shading.
- **Plastic detail** (so the case stops reading as a grey draft box, especially on black):
  - Cut edges: the geometry marks faces that cut through a sheet (`sheet()` sets a `plasticEdge`
    attribute), and the shader gives them a little extra opacity (`caseEdgeAlpha`) so they read as
    thicker plastic. A brighter, tinted version with its own wide reflection band read as white
    outlines ("fake 3D") and was removed.
  - Wear: a shared, tiling map (`makeCaseWearCanvas`) with fine scratches, a few long faint ones,
    cloth swirls, and smudges. Each case samples it at its own offset. Scratches show almost only
    inside the reflected band (`caseScratches`); smudges make the band patchy (`caseSmudges`). A
    first version with many scratches visible everywhere looked drawn on, as on the disc.
  - Tray: satin black polystyrene with a fine stipple (normal and roughness maps from
    `makeTrayMaps`, `trayStipple`), and a low ring outlining the disc well, cut by the tray's top
    and bottom edges as on real trays.
- **Page:** a warmer beige than phase 0 (`#ebe3d4`, radial gradient; fog to match). A solid black
  page with white text was tried and reverted: on black, the case's edges and clear parts read as
  white outlines.
- **Prints:** the cover sits behind the lid (square crop of `cover`). The back insert texture is the
  insert laid flat (spine, panel, spine), and the geometry folds it, so scans map without
  per-album fixes and spine text reads the right way. `makeInsertCanvas` uses a scan with spines
  as is, adds generated spines to a scan of the panel alone (told apart by aspect ratio), and
  generates the whole insert (title, tracklist when `tracks` exists, barcode, spine text) without
  a scan. The booklet's back page is a scan or a plain page in the album colour.
- **Opening** (`open`, `close`, `toggle`, `animateOpen`; layout in `layout()`): one `open` value
  per case, tweened over `openDuration`. In the first 60% the case turns most of the way to face
  the camera with no sideways angle, tipped back by `openTilt` like a book lying open on a table,
  comes forward (`openForward`) and settles at `openScale`, while the
  other cases move aside and back along the screen axes (`openSpread`, `openRecede`). From 30% on,
  the lid swings 180° about the hinge and the body slides right so the open case stays centred.
  (Since the bubble cursor, the case closes from the Back button rather than a click on it.)
  Hovering the open case tilts it only vertically.
  Open, the lid lies flat on the left showing the booklet's back page, and the disc sits in the
  tray on the right. Phases 2a and 2b start from this state.
- **Interactions:** click or Space opens the front case and closes it again. A click beside the
  cases, Escape, moving to another album (keys, wheel, buttons, clicking a side case) or scrubbing
  the row closes it. Dragging the closed front case turns it with the phase 0 soft limit, counted
  from where it rests. On release it turns over to its back (over `flipDuration`) if it was turned
  past halfway or flicked fast (`flipFlickVelocity`; mouse only, since horizontal touch drags
  browse); otherwise it eases back. A turned-over case stays there until the gallery moves: any navigation or scrub turns the front case back to its
  front. The open case doesn't turn or scrub when dragged; it only follows the cursor a little
  (`openHoverTilt` of the hover tilt, both axes). Hover tilt, wipe nudges, trailing, lean, wheel
  and keyboard behaviour are otherwise unchanged.
- **Layout retune:** `caseScale` 0.78 and `hGap` 2.8 (was 2.3) leave more room between cases than
  between the discs. The gallery tilt is −22° on X and Y (was −30°, the reference's value): at −30°
  the square cases looked oddly skewed, so they now turn more toward the viewer.
- **Loading sequence:** the scene compiles its shaders when everything has loaded (`prepare`), then
  reports `onReady`. The page fades the loading screen out, and on its `transitionend` calls
  `reveal()`, which fades the gallery in with the intro; the caption follows 0.3 s later. With
  reduced motion there is no fade, so the page reveals at once.
- **Performance:** discs are hidden while their case is closed (shown once for the shader compile at
  reveal). Navigation plus opening and closing at 1440 × 900 with vsync: no frames over 25 ms.

### Reference photos

Checked against 10 jewel case photos on Wikimedia Commons (search "jewel case CD"): front views
with black and clear trays, open cases on a table and in the hand, stacks and racks showing the
spines, and a close-up of the case edges. Findings: the lid is clear everywhere, including along
the hinge. On the base, the tray rises into a ribbed strip along the hinge in the tray's colour
(black in most), visible through the lid when closed and beside the disc when open. Spines show
the insert through the clear base walls. Earlier, the hinge side showed clear plastic over the
black tray floor; that was replaced by the strip.

### Artwork

- The download script now takes the disc scan and the back insert from the same edition: the
  earliest CD release with both a `Medium` and a `Back` image. For Nevermind that is a 1991 US BMG
  Direct pressing (release `347666eb`), which replaced the Canadian Columbia House disc scan used in
  phase 0. The Cover Art Archive answered that release with an error at first; when it does, the
  script falls back to the next release.
- Covers are now fetched at 1200 px (500 px fallback), since the case shows the cover larger.
- No release had a `Tray` image (the inside of the insert, seen through clear trays). With black
  trays it is hidden, so it is not fetched.
- The booklet's back page has no reliable tag: `Booklet` images come unordered, and `Front,Booklet`
  can be the whole fold-out (as on the German 1991 release). So the script lists it per album as
  `release/imageId@left|right`. Nevermind uses the left half of the Canadian release's outer spread
  (`350a8190`). `sips` reads a crop offset of 0 as "centred", so the left half is cut from a
  mirrored copy.
- All 7 albums have a disc scan, a back insert and a booklet back page from the archive. For the
  other six the same-edition rule picked the editions already used for their phase 0 disc scans,
  so those scans did not change. Bleach's back insert is a scan of the panel without spines, so
  its spines are generated. Booklet back pages were picked by eye from contact sheets: tagged
  "Back Page" where it exists (In Utero, Nirvana), the panel with the catalogue number (Bleach),
  the left half of the outer spread (Incesticide), the image tagged `Back,Booklet` (MTV
  Unplugged), and for Muddy Banks, whose edition has no booklet scans, a single back page from
  another release (`6213251a`). Checked by opening and turning every case.
- Since no album needs a generated back insert any more, tracklists (`tracks`) are not fetched yet.
  The generated insert and its tracklist support stay as the fallback for future albums.

### Page

- The Nirvana wordmark sits top centre, 39 px from the top (24 px on phones). It is `public/bands/nirvana/logo.svg`, cleaned
  from Wikimedia Commons' `NirvanaLogo.svg` (public domain as a simple text logo, taken from the
  2002 compilation cover; possibly trademarked): background removed, cropped to the letters. The
  page draws the band's logo as a CSS mask filled with the theme's ink colour, so any one-colour
  logo file works (no inline SVG from config). It fades in with the caption.
- Band config (`band.json`): the page loads it before rendering, applies the theme as CSS
  variables (muted text tones are `color-mix`es of ink and background), sets the fog to the
  background, and sets the title and browser bar colour. A missing band shows an error. Tested
  with a throwaway second band reusing the Nirvana assets through `../nirvana/` paths.
- The caption no longer names the band (the page is about one band): year and kind, then title,
  centred under the front case. When the album changes it fades out, swaps, and
  fades back in (0.22 s each way); several quick moves keep it hidden until they settle.
- No visible prev/next buttons or counter (they distracted); the buttons stay for screen readers.
- Bubble cursor (prototype, mouse only): a dark circle that sits on the pointer (a lagging follow
  was tried and rejected) and says what a click does: Open on the front case, Prev or Next on side cases, Drag while
  dragging, and a small dot otherwise, including over an open case (a "Close" label there was
  rejected). An open case closes with a Back button top left (42 px / 39 px, like the caption's
  inset), Escape, Space or a click beside it; a click on the open case itself does nothing yet,
  leaving it for the disc and booklet in phase 2. Over the Back button the bubble becomes a 40 px black dot, and
  a white copy of the button, clipped to the dot's circle, shows the text white
  inside it.
- Album title in Instrument Serif (Google Fonts) at 40 px (32 px on phones). Its condensed, high-contrast letters echo the Onyx-style logo; Georgia read as generic.
  Compared against Bodoni Moda, Gloock, Fraunces, Young Serif, Libre Caslon Display, Playfair
  Display SC, Anton and Oswald. Year and kind are in the same family, italic, sentence case, 18 px (15 px on phones), with a
  slash and 5 px either side (no word spaces). Tried for them and rejected: DM Mono caps (wide
  spaces around the slash), Instrument Sans caps (didn't sit well with the title); also compared
  Geist Mono, IBM Plex Mono, Inter Tight, Hanken, Schibsted and Space Grotesk. The Back button uses
  the same italic. The scene
  reports what the pointer is over through `onPointer({ hovered, active, opened, dragging })`.
- When a case opens the neighbours move fully off screen (`openSpread` 5, `openRecede` 1.6).

### Possible follow-ups

- Clear trays (needs `Tray` scans or a generated inside of the insert).
- A narrower open pose on phones (it fits at 390 px wide, with little margin).
- Fetch `tracks` from MusicBrainz in the download script if albums without back scans are added.

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

1. Player style: portable Discman, hi-fi deck with a sliding tray, or sketch both? (Phase 2b.)

Answered: every album uses a standard jewel case; a drag on the closed case turns it to show the
spines and back (both phase 1).

## Later ideas (from the original README)

- Artist search: search MusicBrainz for an artist, list album release groups, resolve artwork through
  the Cover Art Archive, normalise to the `band.json` album shape and call `scene.setAlbums()`. Needs
  debouncing, rate limiting, caching and handling of missing artwork.
