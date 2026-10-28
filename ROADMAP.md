# Discography: roadmap and project state

A visual experiment for browsing an artist's discography in 3D, built with Solid and three.js. Each
album is a CD jewel case that turns over and opens to show the disc and the booklet; the next phases
make the booklet leafable and the disc playable. A title screen lists the artists.

This file is the hand-off document between sessions. It records what exists, why it is built that
way, what was tried and rejected, and what comes next. Keep it up to date when a phase lands or a
decision changes.

## Status at a glance

| Phase | Scope | Status |
| --- | --- | --- |
| 0 | CD gallery: motion, CD look, real disc scans, loading screen, performance | Done (initial commit `bb3b070`) |
| 1 | Jewel cases instead of discs, opening the front case | Done |
| Pre-2 | Title screen, artist selection and menu, four more artists | Done |
| 2a | Booklet as a flip book with LeafThrough | Planned |
| 2b | Disc to CD player animation, tracklist, 30-second previews | First version (28 October 2026), in review |
| Audit | Complete discographies, booklet back pages for every artist | Done (28 October 2026) |

## Artwork audit and complete discographies (28 October 2026)

Before the audit, every album had a cover, all but *Amnesty (I)* had a disc scan and back insert,
and only Nirvana's 7 albums had a booklet back page (7/28).

### Albums

Each artist was checked against its MusicBrainz release groups (album type: studio, live,
compilation, soundtrack; the many bootleg compilations ignored) under the existing rules: studio
albums plus major official live albums and compilations, single-disc only.

- **The Knife:** *Hannah med H* removed (a film soundtrack; the user's call), with its files. Now 3
  albums. *Tomorrow, in a Year* (2 CDs everywhere) and *Shaking the Habitual* (96 minutes; the only
  single-CD listings have no back scan) stay out. *Silent Shout: An Audio Visual Experience* is
  CD + DVD.
- **The Prodigy:** added *The Day Is My Enemy* (2015) and *No Tourists* (2018). Now 8. *World's on
  Fire* (live) is CD + DVD.
- **Rammstein:** added *Made in Germany 1995–2011* (2011, the single-CD standard edition),
  *Rammstein* (2019, untitled; MusicBrainz calls it "[Rammstein]") and *Zeit* (2022). Now 10.
  *Völkerball* and *Paris* are multi-disc, *XXI* is a box set.
- **Nirvana and Crystal Castles:** complete. Nirvana keeps the phase 0 scope (up to the 2002
  compilation; *Sliver*, *Live at Reading* and *Icon* were dropped then on purpose).

New albums' editions: *The Day Is My Enemy* the 2015 UK CD (`5fc2e3e2`, automatic pick); *No
Tourists* the 2018 European CD (`0e356708`, the only CD edition; it has no disc scan, so the disc
shows the cover); *Made in Germany* the European single CD `f6edb0e9`, whose back is the digipak's
whole three-panel outside, so `backHalf: "2/3"` keeps the middle panel, and whose primary front is
that same wide scan, so the cover comes from `434b542a`; *Rammstein* the standard edition
`b0c5fe24` (the automatic pick was the Special Edition, with a sticker saying so), left half of the
outside scan as the back; *Zeit* the European CD `f680b786`, cover included, since its front has
the red logo band that continues past the spine onto the back (the release group's front is the
digital artwork without it). Colours are each cover's mean colour and a strong accent, measured.

### Booklet back pages

Picked by eye from contact sheets of every image of the album's editions, as for Nirvana. The
order of preference: the edition the disc and back come from, an outer spread (back page beside the
booklet's front) or a page labelled as the back in the archive's comments, then another single-CD
edition. Coverage is now 28/32.

| Album | Source | How it was identified |
| --- | --- | --- |
| *Experience* | `5143cebd/31705841412`, same edition | Credits page; `c31de678` labels it "page 8, back page of closed booklet" |
| *Jilted Generation* | `2579bfbb/34013918252`, same edition | Labelled "page 8"; `ecbd4dc8`'s outer spread has it beside the cover |
| *The Fat of the Land* | `8417d94a/27141657376@left`, same edition | Outer spread; `acefbe79` labels the same page "page 20" |
| *Always Outnumbered* | `00bc3621/3508432304`, another edition | **Unconfirmed.** Every edition has a single `Booklet` scan (the drummers collage); nothing shows where it sits |
| *Their Law* | `ad53c255/3507834441`, same edition | `27c88429` labels the same page "Back page of booklet" |
| *Invaders Must Die* | `6a75994d/32087538740@1/4`, same edition | Outer side of a four-panel foldout. The panels are equal, so it is accordion-folded and the first panel ("Protect yourself") is the back |
| *The Knife* | `365bf4dc/28486015348`, same edition | The edition's only booklet scan, credits with the dancing figures; likely the back, not labelled |
| *Deep Cuts* | `d314ad58/28493498229`, another edition | Scanned front, three inner spreads, then this page (the cover pattern without lettering) |
| *Silent Shout* | `099094f6/23129607098@left`, another edition | Outer spread: plain dark page beside the cover |
| *Herzeleid* | `315858ef/13287378209@left`, same edition | Outer spread; `e81d9bf9` labels the page "page 16" |
| *Sehnsucht* | `f7cba0e8/33510216422`, same edition | The six-faces foldout; `68da350f`'s outer spread shows this logo-less profile beside the cover |
| *Live aus Berlin* | `7cac8c44/18631425084@left`, another edition | Outer spread (the edition the disc comes from has no booklet scans) |
| *Mutter*, *Reise, Reise*, *Rosenrot* | `eed328a1/9614674636@left`, `8ec370f8/16019138335@left`, `b48e5591/13288280417@left`, same editions | Outer spreads |
| *Liebe ist für alle da* | `3798a530/27820317897`, same edition | Last page of the sequence ("Zensiert") |
| *Made in Germany* | `f6edb0e9/34434317343@left`, same edition | Outer spread: the back of the head beside the cover |
| *Rammstein* | `b0c5fe24/34264581678@left`, same edition | Outer spread: tracklist page beside the match |
| *Zeit* | `183678eb/34229312359`, another edition | The red booklet's back (that edition tags the booklet's front as its Front) |
| *Crystal Castles* | `f5dde22a/42703574279@left`, another edition | Outer spread: black page with the credits line |
| *Crystal Castles (II)* | `15310e2d/34914987623@1/2,2/2`, same edition | A poster folded in four; this scan is its whole outer side, cover bottom right. The girl's face runs across both top panels as one image, which only shows as a spread if the poster folds top behind bottom first, then left behind right; folded that way the bottom-left panel (plain dark) is the back. 269 × 299 px, since the whole side was scanned at 538 px |

Still a plain page in the album colour, because no archived scan shows the back page:

- *The Day Is My Enemy*: only the two inner spreads are archived; the Japanese edition's
  `Booklet` scans are its liner-notes insert.
- *No Tourists* and *Amnesty (I)*: no booklet scans at all. *Amnesty (I)*'s two CD editions with
  images (`e11a49ac`, `8fffbd04` has none) only have the front, so it keeps the cover on the disc
  and a generated insert. The 12" vinyl (`c917ef1b`) has a back, but it is the sleeve's layout (a
  full-bleed photo, "Side A" and "Side B"), so it isn't used as the CD's back insert.
- *(III)*: the only CD edition with booklet scans (`dde16355`) has the two lyric sides of the inner
  sheet; the outer side was never scanned. Every other CD edition has only a front.

Current coverage: discs 30/32 (not *No Tourists*, *Amnesty (I)*), back inserts 31/32 (not
*Amnesty (I)*), booklet back pages 28/32. These gaps were checked against every release of each
album in the archive, not only the official single-CD ones.

### Changes to existing albums

- *Sehnsucht*'s cover was the release group's front, which is the 2017 Anniversary Edition (small
  "Anniversary Edition" lettering). Now the 1997 front of `f7cba0e8`, the edition its disc and back
  come from (576 px; the other 1997 scan is 599 px).
- *Crystal Castles (I)*'s disc and back were a promo pressing ("PROMO COPY NOT FOR SALE" on the
  back), from before the script skipped promos. The rerun picked the retail Australian CD
  (`f760baf8`). Every other existing cover, disc and back came out byte-identical on the rerun.

### Download script

- `take_half` became `take_part`: besides `left` and `right` it takes `n/m`, the nth of m equal
  panels, for `bookletBack` (`…@1/4`) and `backHalf` (`"2/3"`), and `n/m,r/s` for one panel of a
  poster folded in four (column, then row). `left` and `right` crop exactly as before (checked
  byte for byte). sips silently refuses a crop that ends on the bottom edge (one ending on the
  right edge works) and sometimes leaves a file uncropped when it writes in place, so rows are cut
  as columns of the scan turned a quarter, and crops are written to a copy.
- Disc scans prefer a `Medium` image without `Matrix/Runout`: *Made in Germany* and *Zeit* list the
  silver data side first.
- Non-JPEG downloads are re-encoded to JPEG (*The Day Is My Enemy*'s disc is archived only as a
  2 MB PNG, which was saved under a `.jpg` name). JPEGs are left alone, so reruns stay
  byte-identical.

Verified with contact sheets of the local files, and in headless Chrome: every album of the four
artists opened (booklet back page on the lid), the new albums turned over (back inserts) and
closed (covers), no page errors; `npm run typecheck` passes.

The favicon is a full-size rounded square in the page's warm beige, with a solid dark CD, a beige
hub ring and a dark center hole (`public/favicon.svg`). The page links directly to this SVG. The
earlier reflective and outlined disc versions were less legible at tab size.

## Running the project

```bash
npm install
npm run dev        # Vite dev server
npm run typecheck  # tsc, strict, no emit
npm run build      # type-check, then production build into dist/
npm run preview    # serve the build
bash scripts/download-covers.sh nirvana   # refresh a band's artwork (needs curl and jq)
bash scripts/download-covers.sh nirvana nevermind   # refresh only the listed albums
bash scripts/download-covers.sh the-prodigy   # the same for any band folder
node scripts/fetch-tracks.mjs nirvana   # tracklists and Apple Music IDs (Node 18+), same arguments
# / is the title screen; /?band=<folder> opens a band from public/bands/ directly,
# &album=<id> brings an album to the front, &open opens it, &listen puts its disc in the player
# (the page keeps these up to date).
```

## Phase 0: what is implemented

### Files

| File | Role |
| --- | --- |
| `src/scene.ts` | Everything 3D: the `GalleryScene` class (called `DiscScene` in phase 0), materials, shaders, input, motion, loading. All tuning lives in the `C` object at the top. |
| `src/main.tsx` | Solid app: title screen, menu, loading screen, masthead, caption and album arrows, bubble cursor, keyboard shortcuts, routing. Talks to the scene through its public methods. |
| `public/bands/<band>/band.json` | Everything band-specific (since phase 1; was `src/data.js`): `name`, optional `logo`, optional `theme` (`background`, `backgroundCenter`, `backgroundEdge`, `ink`; no band sets one since the pre-phase) and `albums`. Each album: `id`, `title`, `year`, `kind`, `cover`, optional `disc`, `back`, `bookletBack` and `tracks`, `color`, `accent`, `motif` for generated art, and `musicbrainz` (`releaseGroup`, optional `bookletBack` pick) for the download script (see the pre-phase for its pinning options). Paths are relative to the JSON file. `public/bands/index.json` lists the bands in order. |
| `src/band.ts` | Types for the band and album JSON (`BandConfig`, `AlbumConfig`) and what the page gets (`Band`, `Album`). Loads a band (cached, so the title screen and menu fetch each once), resolves its paths and adds the band name to each album; `loadBands()` loads the list. Documents the JSON shape. |
| `src/style.css` | Page shell (warm beige background with a grain overlay, bottom bar, loading screen). |
| `scripts/fetch-tracks.mjs` | `node scripts/fetch-tracks.mjs <band> [album id ...]`: writes each album's CD tracklist (MusicBrainz) and its Apple Music match (album and track IDs, for previews) into `band.json`. See phase 2b. |
| `scripts/download-covers.sh` | `download-covers.sh <band> [album id ...]`: fetches covers, disc scans, back inserts and booklet back pages for the albums in the band's `band.json` from MusicBrainz and the Cover Art Archive, and writes the paths it found back into the JSON. A failed image keeps the existing file. |
| `public/bands/<band>/` | The band's `band.json`, `logo.svg`, and local artwork in `covers/`, `discs/`, `backs/`, `booklets/`, so the demo runs without network access. |

### Scene API used by the UI

`new GalleryScene(element, albums, onIndexChange, { onProgress, onReady, onPointer })`, then `reveal()` once
`onReady` has fired and the page is ready to show it, `step(delta)`,
`goTo(index, source)`, `toggle(index?)`, `open(index?)`, `close()`, `setAlbums(albums)` and
`destroy()`. The scene owns the position and reports the front case through `onIndexChange`.
Phase 0 had `flip(index?)` instead of the open methods.

### Motion

The motion constants live in `C`, named after what they do.

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

- **Model** (`makeCase` and the `make*Geometry` functions in `src/scene.ts`), built in millimetres
  (one unit is 60 mm, the disc radius, so the phase 0 disc fits unchanged). Back to front: clear
  base plate; back insert, whose ends fold forward into the two spines behind the base's clear side
  walls; black tray with a rosette (platform and ring of teeth through the disc's hole); the disc
  itself, turned up to ±25° per album; a black hinge strip, part of the tray, finely ribbed, full
  height and reaching up to just under the lid (`hingeStrip`, `hingeRibs`); the booklet, 120 × 120 mm, centred over the disc (as in real cases; an earlier offset of 2 mm let the disc's edge show beside it); the
  clear lid plate, with flanges along the top and bottom. Hinge on the left. Dimensions and depths
  are in `C` and the derived `CASE` object.
- **Moulded details** (from a photo of an open Nevermind case and Wikimedia Commons' "Cd jewel
  case, no art, right angle"): four clear half-round tabs on the lid's top and bottom flanges hold
  the booklet's edges, placed symmetrically `lidTabInset` in from each side of the booklet
  (`lidTabRadius`; they replaced two rectangular tabs); two short ribs just inside the free edge
  stop the booklet (`lidStopY`); half-ring clips stand on the tray's top and bottom edges,
  `trayClipSpread` either side of the disc's centre. A first version placed tabs and clips
  unevenly and looked off. The tabs sit 0.05 mm clear of the booklet's back, since a shared face
  z-fought. The bottom tabs were first made by mirroring the top ones with a
  negative scale, which flipped their normals and made them over-reflect; they are turned instead.
- **Hinge side:** the tray (with its black spine strip) is 121 mm tall, nearly the full height
  as in real cases, and the base's spine walls match it. Knuckles with the hinge pins sit at the
  hinge's top and bottom corners, where the lid's flanges turn. Before, the tray stopped 3.5 mm
  short, the pins sat mid-height, and gaps at the hinge corners made it look like separate parts.
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
  cases, Escape, moving to another album (wheel, buttons, clicking a side case; arrows, Home and End
  until the pre-phase, which made them do nothing while a case is open) or scrubbing
  the row closes it. Dragging the closed front case turns it with the phase 0 soft limit, counted
  from where it rests. On release it turns over to its back (over `flipDuration`) if it was turned
  past halfway or flicked fast (`flipFlickVelocity`; mouse only, since horizontal touch drags
  browse); otherwise it eases back. A turned-over case stays there until the gallery moves: any navigation or scrub turns the front case back to its
  front. While a case is open no drag turns or scrubs anything, on the case or beside it (since
  the pre-phase; before, a drag beside it closed it and scrubbed); the open case only follows the cursor a little
  (`openHoverTilt` of the hover tilt, both axes). Hover tilt, wipe nudges, trailing, lean, wheel
  and keyboard behaviour are otherwise unchanged.
- **Layout retune:** `caseScale` 0.78 and `hGap` 2.8 (was 2.3) leave more room between cases than
  between the discs. The gallery tilt is −22° on X and Y (was −30° in phase 0): at −30°
  the square cases looked oddly skewed, so they now turn more toward the viewer.
- **Loading sequence:** the scene compiles its shaders when everything has loaded (`prepare`), then
  reports `onReady`. The page fades the loading screen out, and on its `transitionend` calls
  `reveal()`, which fades the gallery in with the intro; the caption follows 0.3 s later. With
  reduced motion there is no fade, so the page reveals at once.
- **Disc in the closed case:** always drawn, but shaded (`discClosedShade`, 0.1) while the lid
  covers it, brightening as the lid opens (`withShade`, a per-disc uniform on all four disc
  materials). The scene has no shadows, so an unshaded disc glowed white through the thin gaps
  around the booklet. An earlier version hid the disc while closed and showed it when the lid
  started to move, which made a white arc pop in between the hinge strip and the booklet.
  Checked by rendering the closed case with the disc on and off in 17 poses (turned, tilted,
  hovered, starting to open): about 300 differing pixels at rest before, 4 dark ones after.
- **Performance:** navigation plus opening and closing at 1440 × 900 with vsync: no frames over
  25 ms, with every disc always drawn.

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

- Masthead, top centre: "Discography" in Instrument Serif italic, a thin drawn ×, then the band's
  logo from `band.json`, like a collaboration logo. Compared with an upright and a spaced-caps
  wordmark. Below, the history of the band logo itself:
- The Nirvana wordmark sits top centre, 39 px from the top (24 px on phones). (Since the pre-phase every band's logo is drawn at its height; see there.) It is `public/bands/nirvana/logo.svg`, cleaned
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
- Bubble cursor (prototype, mouse only): a dot that sits on the pointer (a lagging follow was
  tried and rejected). Over something interactive it grows a little (about 23 px), and only once
  the pointer has rested for `labelDelay` (5 s then; 3 s since the pre-phase, in `src/main.tsx`) does it open like a tooltip to
  show the action; showing the label at once felt busy. Moving more than `restSlop` (3 px) or a
  change of action hides it and restarts the wait. The scene re-checks the case
  under the pointer every frame, not only when the mouse moves: before, after a click the gallery
  glided under a still pointer and the label went stale (it said "Open" over the next case).
  Tested with scripted clicks, comparing the label with a fresh 1 px nudge. The actions: Open on the front case, Prev or Next on side cases, Drag while
  dragging, Close beside an open case (a click there closes it), and a small dot otherwise,
  including over the open case itself (a "Close" label there was rejected). An open case closes with a Back button top left (42 px / 39 px, like the caption's
  inset), Escape, Space or a click beside it; a click on the open case itself does nothing yet,
  leaving it for the disc and booklet in phase 2. Over the Back button the bubble becomes a 40 px black dot, and
  a white copy of the button, clipped to the dot's circle, shows the text white
  inside it.
- Type is Instrument Serif throughout. Newsreader (wider, normal proportions) was tried as a
  replacement and rejected: Instrument Serif looked better. Also compared Fraunces, Playfair
  Display, Libre Caslon Text, DM Serif Display, Source Serif 4 and Crimson Pro. Its condensed, high-contrast letters echo the Onyx-style logo; Georgia read as generic.
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

## Pre-phase before phase 2: title screen and artists

Goal: a front page for the project, and more artists than Nirvana. The artists come from
`ARTIST_BOOKLET_HANDOFF.md` (a source list for booklet scans, written for phase 2a): The Prodigy,
The Knife, Rammstein and Crystal Castles. Booklet interiors are still phase 2a work.

### What is implemented

- **Routing** (`Root` in `src/main.tsx`): `/` is the title screen, `/?band=<folder>` a band's
  gallery. Choosing an artist keeps the page: it pushes the URL, applies the band's theme and mounts
  a fresh gallery, keyed by band, so the old scene is destroyed (`destroy()` now also calls
  `forceContextLoss()`, since browsers keep only a few WebGL contexts). The browser's back button
  works through `popstate`. A late response for an earlier choice is ignored.
- **Fades between views**: a curtain drawn like the page (`.curtain`: the same gradient and grain)
  fades in over the view (0.4 s), the next view is swapped in under it, and it fades out (0.5 s).
  The swap waits for the curtain's `transitionend` (a timer fallback at 0.7 s), not a timer alone:
  leaving a gallery, the scene can hold up the main thread. The first version faded the view's own
  opacity instead, and was replaced: an ancestor with opacity below 1 cuts off a descendant's
  backdrop blur at once, so switching artist from the menu dropped the blurred menu out ahead of
  the fade. No fade with reduced motion.
- **Title screen** (`Home`): the Discography wordmark (Instrument Serif italic, 56 px; 44 px on
  phones; 112 px was too big), a one-sentence description, the artist list, and a small, faint
  footer (12 px upright, 40% ink): "Made by Dmytro Barylo" bottom left, linking to dmytrobarylo.com
  (address taken from the user's GitHub profile), and "Source on GitHub" bottom right, linking to
  the repository; both open in a new tab and sit at the corner buttons' insets. It fades in once every logo has its size.
- **Artist list** (`ArtistList`, shared by the title screen and the menu): each band's logo
  (`BandMark`, as in the masthead: 30 px tall, at most 190 px wide; 22 and 130 px on phones) on the
  centre axis, the years to its left and the album count to its right, both faint (42% ink). The
  list is one grid and the rows use `subgrid`, so the years and counts line up in columns, and
  every row is the same height whatever the logo. Hovering one dims the others; in the menu the
  current artist is dimmed. They are real links (`?band=…`), so a modifier click opens a new tab.
  Earlier version, replaced: names set in 40 px type with years and count together beside them.
- **`BandMark`**: draws a logo as a mask in the ink colour, or the name in capitals, measuring the
  logo's proportions or the name's width in em. The name must be measured in Instrument Serif, and
  `document.fonts.ready` (or `fonts.load`) resolves at once while the Google Fonts stylesheet,
  imported from CSS, hasn't registered the face yet; the name then came out too small on the title
  screen. `serifLoaded` retries `fonts.load` until it returns a face (up to 5 s).
- **Menu**: a "Menu" button top right, in the Back button's italic, opens an overlay over the
  blurred gallery with the artist list (logos, as on the title screen) and a Home link; the
  button becomes "Close". Escape closes
  it, focus moves to the current artist and back to the button, and keys don't reach the scene
  while it is open.
- **Masthead**: the "Discography" wordmark links to the title screen. Every band's logo is drawn at
  Nirvana's height (28.75 px, 20 px on phones), its width following the logo's proportions, but no
  wider than the wordmark (4.45 em of its font size, about 151 px on desktop); a wider logo shrinks
  to fit, keeping its proportions. Bands without a logo show their name in Instrument Serif capitals
  of the same height, made smaller the same way if needed (the page measures the name's width in em
  once the fonts load). Sizing logos to equal area was tried and rejected (logos should line up
  with the wordmark at heading size), and so was letting wide logos run to their full width at that
  height (Rammstein was 340 px and looked out of proportion). On phones the Back and Menu buttons
  sit below the masthead (56 px from the top).
- **Bubble cursor everywhere** (`createBubble`, shared by the gallery, the menu and the title
  screen): the same dot, growth over anything clickable and label after 3 s of rest (5 s until the pre-phase) (Close beside
  the menu's list). Over text buttons and links (Back, Menu/Close, the masthead wordmark, the
  menu's Home, the credit link) and over each artist row it becomes the 40 px dot with the element
  white inside (logo, years and count for an artist; a "View" label there was replaced by this).
  The white version is a clone of the hovered element, placed over it in one layer above the bubble
  (`.bubble-copy`). The earlier hand-made copy per button couldn't work in the menu: its blur makes
  a stacking context that keeps any copy inside it beneath the bubble. Getting the clone exact
  took three fixes, each measured with Range rects (now 0 px off everywhere): the clone is shifted
  by the difference between its content and the original's; an inline original (the credit link)
  is cloned as a block, since inline boxes ignore `translate` and an inline-block sat on the
  layer's baseline 2 to 4 px low; an artist row (a subgrid) gets the list's resolved columns and
  gap, and the logo size variables, which it loses outside the list.
- **Type**: the loading counter is Instrument Serif italic like the caption's eyebrow (was DM Mono
  caps). The credit is upright, 12 px. The description no longer says "the way it used to sit on a
  shelf": the gallery isn't a shelf view.
- **One background for every page**: the Nirvana beige, now just the default theme. Per-band
  backgrounds were tried (cool greys and lilacs) and rejected. `theme` still works in `band.json`.
  The gradient is on `html` and the grain on `body::before`, not on each view: when the views
  each had their own, a switch faded them out too and showed the flat page colour underneath, a
  pale flash. Checked by sampling page pixels every 50 ms through switches.
- **Album state in the URL**: `?band=<folder>&album=<id>`, plus `&open` while it is open
  (`galleryUrl`, `albumFromUrl` in `src/band.ts`). The gallery updates it with `replaceState`, so
  browsing and opening don't add history entries and the back button still steps between artists
  and the title screen; switching artist pushes one entry. It only writes while the URL is still
  its band's, so a gallery fading out can't overwrite the next one's address. A link restores it:
  the scene's `startIndex` puts that case in front, and `openOnReveal` sets it fully open before
  the intro, so the intro grows in the open case (`openAtOnce`). Opening it after the intro was
  tried first and replaced: the case sat closed for the 1.15 s intro and then opened, a visible
  delay. An unknown album starts at the first, closed. Since
  every history entry keeps its band's last album and open state, the back button restores them
  too. Tested: links with and without `&open`, an unknown album, browsing, opening and closing
  (history length unchanged), switching artist (one entry), back and forward.
- **Album arrows**: "←" and "→" in the bottom corners, level with the caption's title (DM Sans,
  like Back's arrow), replacing the screen-reader-only buttons. Disabled and dimmed (25%) at the
  first and last album; they fade out and turn inert while a case is open. The caption is narrower
  to leave room for them.
- **Logo scale**: `logoScale` in `band.json` evens out logos that look too big or small at the
  shared height, still within the width cap: The Knife 0.87, The Prodigy 1.13.
- **Cursor after clicks and keys**: a click or key can change or remove the button under a still
  pointer with no pointer event to say so (Menu becomes Close, Back hides, the menu closes, an arrow
  becomes disabled). For a second afterwards the bubble hit-tests every frame (`recheck`): it drops
  the white copy if the element is gone, disabled, inert, aria-hidden or still fading in, redraws
  it if the element changed, or moves to a button now under the pointer. Surfaces also treat
  `pointerenter` as a move, so the dot stays when a menu closes under it. Tested with a still
  pointer through 22 cases (Menu/Close by click and Escape, Back by click, Escape and Space, Back
  fading in, current artist, menu background, Home, artists, the wordmark, the credit link).
- **Keyboard and screen readers**: Enter opens the front case, like Space (Space toggles), unless
  a control has focus, which then gets the key. The caption is a button between the arrows in Tab
  order, named "Open <title> (<year>, <kind>)"; Enter, Space or a click on it opens the album, and
  it goes inert while a case is open, like the arrows. The title inside is a styled span
  (`.album-title`), since a button can't contain a heading; the caption's live region still
  announces album changes. Focus moves only when the control holding it is about to go away: from
  the keyboard-focused caption (inert while open) to Back when the case opens, and from Back back to
  the caption when it closes, if Back got focus by keyboard (noted when it gets focus: any key press,
  Escape included, makes the focused element count as keyboard-focused from then on). Anywhere else
  focus stays put. Two earlier versions were rejected as odd: one moved focus whenever the last input
  was a key (clicking a case then pressing Escape put a ring on the caption), and one keyed the effect
  on `pointer()`, which changes with every step, so each arrow key focused the caption. The
  open/closed state and the cursor label are memos, so they react only when they change. Back is now visible at once
  when shown (only its fade is delayed): with `visibility` transitioning from hidden it couldn't
  take focus in the first frame. Outline (`:focus-visible`) for keyboard focus only. Tested: Tab
  order, Enter and Space on the caption, Escape, Enter on Back, Enter with nothing focused, Enter
  on an arrow, a link with `&open`, mouse clicks (no outline).
- **Back and Menu centred on the masthead** (desktop): their ink sat about 2.4 px below the heading's
  (box tops lined up instead of centres), which read as sitting on the heading's bottom line. Now
  `top: 40.5px`, measured from screenshots: the ink centres of Back and Menu (53 to 53.25 px) match
  the logo's and wordmark's (52.5 to 52.75 px). On phones they keep their own row under the heading.
- **Loading counter**: "Loading 64", 0 to 100 with no percent sign (was "Loading 03 / 07", the
  album count, which said little). Progress arrives album by album, so the number eases towards
  it every frame instead of jumping in sevenths; once the gallery is ready it hurries to 100, and
  the loading screen only fades once it shows 100 (before, it faded at about 60 and never showed
  100). The bar follows the same value. Screen readers get a `progressbar` with the real value; the
  counter itself is hidden from them, since a live region would announce every step.
- **Cursor label and keyboard focus**: the cursor's text label stays closed while anything shows a
  keyboard focus ring (`:focus-visible`), and closes at once when one appears (after a key press or a
  focus change). The keyboard is in use then, and a tooltip by the mouse competed with the ring. The
  dot still follows and grows; the label works again once the ring is gone.
- **Booklet edges in the cover's colours**: the booklet is a 0.8 mm box whose edges were white paper.
  Turned or tilted, the right and bottom edges caught the light as thin white lines along the cover
  (reported on Muddy Banks). Each edge now takes the mean colour of the matching side of the cover (a
  strip 2% wide; `setBookletEdges`), set with the cover print, so the placeholder's colours apply
  until the scan loads. A real booklet's edge is white paper; this was the user's call, since the
  white line read as a rendering fault. `materials.paper` and `paperColor` were removed.
- **Menu and Close cross-fade** (0.2 s): both words sit stacked, right-aligned, in the button, so its
  right edge and the word Menu stay exactly where they were. The button is named by `aria-label`
  ("Menu", "Close menu"). The cursor's white copy shows only the current word, and its re-check
  also compares `aria-label`, since the button's text no longer changes. With the mouse on the
  button the dot covers the word, so the fade has to run in the copy too: when only an element's
  state changed (same size, same words, different classes) the re-check updates the copy's classes
  in place (`syncClone`) instead of rebuilding it, so the copy's own transition runs. The first
  version rebuilt it, and the word in the dot switched instantly while the page faded underneath.
- **Focus ring, the same on every control**: one `:focus-visible` rule draws a 1 px ink ring 4 px
  outside a 4 × 10 px padding round the content, with 2 px rounded corners (the caption's look).
  Every control carries that padding, cancelled by negative margins or shifted offsets (corner
  buttons at 32 px instead of 42, arrows 9 px from the edge with padding instead of a 40 px box),
  so nothing moved: the content of all 39 controls checked was in the same place before and after,
  to half a pixel, on desktop and phone. The artist rows changed most: each link is now just the
  logo column (as wide as the widest logo, so every ring matches), with the years and count hung
  either side (`--meta-gap`) and a row gap plus list padding keeping the old spacing. A ring round
  the whole 760 px row would have been a long, mostly empty bar. Dimming (hover, current artist)
  now applies to a row's contents, so a ring on a dimmed row stays full ink. The cursor's white
  copy carries `--meta-gap` like the logo sizes, and its old subgrid handling was removed.
- **Drag, keys and wheel while open**: no drag does anything while a case is open, and neither do
  the arrow keys, Home, End or the wheel (see phase 1 interactions). The wheel still follows the
  gesture's momentum while open, so the tail of a trackpad swipe doesn't step the row once the
  case closes.

### Artists and artwork

Album choice follows the project's earlier scope: studio albums plus a major live album or
compilation, mostly 1990s to 2000s. **Single-disc albums only** (the user's decision, also stated
in the README): the demo shows one CD per jewel case, so double albums are out (The Knife's
Tomorrow, in a Year, 2 CDs in every edition, and Shaking the Habitual, 2 CDs in most, including
the scanned one), and an album whose scans came from a special edition with a second disc was
re-pinned to a single-CD edition: Invaders Must Die (was CD+DVD; now the 2009 UK CD `6a75994d`)
and Rosenrot (was the CD+DVD `bf7c54d3`; now the 2005 Russian single CD `b48e5591`, whose outer
digipak scan `13288278590` has the back panel as its right half; no single-CD jewel case
edition has a back scan). Checked for every album on MusicBrainz: the original release's media
and the scanned edition's media. (The album lists below are as of the pre-phase; the artwork audit
at the top removed *Hannah med H* and added five albums.)

| Band | Albums | Logo |
| --- | --- | --- |
| The Prodigy | Experience, Jilted Generation, Fat of the Land, Always Outnumbered, Their Law, Invaders Must Die | Wikimedia Commons `The Prodigy logo 2009.svg` (the FOTL version has white fills, which a mask loses) |
| The Knife | The Knife, Deep Cuts, Hannah med H, Silent Shout | No fixed logo exists (the lettering changes per album, and none is on Commons or Wikipedia). `logo.svg` is traced from the logo image the user chose on TheAudioDB (`r2.theaudiodb.com/images/media/artist/logo/knife-the-505af40099c0c.png`, 400 × 155, white letters with a drop shadow; community-uploaded, licence unknown). Traced in Chrome, since no tracing tool is installed: alpha from the white letters (whiteness × alpha, which drops the shadow), upsampled 6× with smoothing, outlines followed along the pixel grid, simplified (Ramer-Douglas-Peucker, 5.5 px at 6×; a smaller tolerance kept the pixel staircase on the slanted strokes), straightened (edges within 9° of horizontal or of the 5.9° slant snapped to it, corners rebuilt where neighbours meet) and sharpened (edges under 2.5 source px collapsed). 8 outlines, 99 points. Rejected on the way: the debut cover's "THE KN|FE" with a knife as the I (looked off), the Deep Cuts disc label's lettering traced the same way (a different, lighter typeface; "still not ok"), and the Shaking the Habitual serif "THE KNIΦE" (read as a generic font). |
| Rammstein | Herzeleid, Sehnsucht, Live aus Berlin, Mutter, Reise Reise, Rosenrot, Liebe ist für alle da | Wikimedia Commons `Rammstein logo.svg` |
| Crystal Castles | (I), (II), (III), Amnesty (I) | Wikimedia Commons `Crystal Castels (Logo).png` (sic; public domain), the doubled wordmark on the debut CD, cropped to its letters. |

Logos were cropped to their letters as Nirvana's was. Setting The Knife and Crystal Castles in
Instrument Serif capitals was tried and rejected: it read as a generic font, not the band. The
typeset fallback stays in `BandMark` for future bands without a logo.

Every album has a disc scan and back insert except Amnesty (I), which has none archived (cover on
the disc, generated insert). No new album has a `bookletBack` yet, so their open lids show a plain page in the album
colour; `color` and `accent` were picked from each cover. Fixes after a visual check:

- Crystal Castles (II): the default pick was a wide photo of the disc beside its tray; pinned to the
  2010 US CD (`15310e2d`, also the handoff's booklet source).
- Liebe ist für alle da: the default back was a 2.2:1 spread; pinned to `3798a530` (1.29:1 back,
  plus 12 booklet scans for phase 2a).
- Rosenrot: every archived back is a digipak's whole outside; pinned to `bf7c54d3` and the left
  half kept, which is the back panel (spines are generated).
- Mutter: the scans came from a promotional pressing (`dbc3dfab`, "FOR PROMOTION ONLY" on the
  disc) after the first download hit a Cover Art Archive error and the retry fell through to it.
  Pinned to the Finnish launch-day jewel case CD (`eed328a1`, 2 April 2001: disc, back with spines,
  8 booklet scans). The script now also skips anything MusicBrainz doesn't mark Official.
- Silent Shout: the release group's front is 350 px; the 500 px front of the 2006 US CD is used. A
  1426 px Australian scan was tried and rejected: a different, much darker print that read as a
  black square.

### Download script changes

- `musicbrainz.release` pins the edition for the disc and back; `backImage` picks the back image in
  it; `coverRelease` takes the front from a release; `backHalf` (`left` or `right`) keeps half of a
  back scan; `take_half` is shared with the booklet back page (it returned failure for `right`,
  which skipped the shrink; fixed). Automatic picks now consider only single-CD releases.
- Bug fixes: with neither scan archived, the second `read` hit end of input and `set -e` ended the
  whole run silently (it skipped the rest of The Knife); fields are now split on the unit separator,
  since tab is whitespace to `read` and empty fields collapsed. Rerunning Nevermind gave
  byte-identical files.

### Verification

Headless Chrome (as in phase 1): title screen at 1440 × 900 and 390 × 844; every new album closed
and open; mastheads of all five bands on desktop and phone with measured boxes; scripted checks
the bubble's state over every kind of target on the title screen, the gallery and the menu (with
crops around the pointer), that the view fades fully out and in for every kind of switch (opacity sampled every 100 ms),
that the title screen and menu draw every logo at the same size, that drags beside and on an open
case change nothing, a click beside still closes it, a drag on a
closed row still scrubs, the wordmark and menu Home reach the title screen with the canvas removed,
the browser back button returns, and Escape closes the menu and restores focus.

### TypeScript

The code was moved to TypeScript at the end of the pre-phase, with no behaviour change: `src/band.ts`
(the JSON types and loader), `src/main.tsx`, `src/scene.ts`, `vite.config.ts`. `tsconfig.json` is
strict (also `noUnusedLocals` and `noUnusedParameters`); `typescript` 5.9 (the stable line the
Vite and Solid tooling targets; 7.0, the native rewrite, was available) and `@types/three` 0.186,
both pinned. `npm run build` type-checks first. `scene.ts` has no `any`; its few casts and `!`
each carry a comment (2D canvas contexts, three's untyped `userData`, `removeEventListener`
options). Checked by diffing esbuild output of the old and new scene (only class field
declarations and two no-op guards differ) and by rerunning the browser checks above.

Possible latent issues the types exposed, left as they were:

- Discs carry hover, spin, push and tween fields from when they were standalone; nothing uses them.
- `endPress` reads `this.cases[spinning]` without a guard; `setAlbums` with fewer albums during a
  drag would throw. (Nothing calls `setAlbums` after construction today.)
- `destroy()` calls `setAlbums([])`, which reports `onProgress(0, 0)`.
- `removeEventListener(…, { passive: false })`: `passive` is ignored there (harmless).
- The last branch of `makeFallbackArt` only runs for a motif outside the `Motif` type.

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

First version landed on 28 October 2026, after a discussion with two product photos of a square,
lidless top-loading CD player (body about 210 × 210 × 45 mm, in black and in white). Awaiting review.

### Decisions

- **Player:** a top-loader with an open circular well, so the disc stays visible while it plays.
  Graphite. Fixed pose, no hover tilt, in the same perspective scene and camera, so the disc's
  flight into it matches. After review it is posed like the open case: square to the camera with the
  front and its controls facing the viewer, tipped back much further (56°) so it lies on a surface
  seen from above. A first version turned 45° like the product photos (isometric), with its turn
  corrected for sitting off centre; it looked odd beside the flat page and was dropped.
  Minimal but realistic, as the user asked: no full set of controls. Model the look, not the
  product: no maker's logo or text, our own labels, and textures painted in code rather than cut from
  the photos (they are someone else's product shots, and angled photos distort on a model).
- **Flow:** a click on the disc in the open case (or the caption, or Enter) switches to the player
  view. The disc does not flip, since a top-loader takes it label up: it lifts out of the tray, the
  row with the case slides up out of view while the player rises into its place, and the disc drops
  onto the spindle. The view then shows only the player, with the disc, and the tracklist. Nothing
  plays until a track is clicked. Back or Escape ejects: the same path backwards.
- **Spin:** only while a track plays; pausing pauses it. 200 rpm (`spinRpm`), the slow end of a real
  disc, spinning up and coasting down (`spinUp`, `spinDown`). 48 and then 100 rpm were too slow in
  review. At that speed the print would strobe at 60 fps, so it gets a rotational motion blur
  (`withSpinBlur`): the colour map is averaged over the arc the disc turns in `spinBlur` (25 ms, like
  a camera exposure), `spinBlurSamples` samples with a per-pixel jitter, a single sample at rest.
  Still with reduced motion.
- **Previews:** Apple's iTunes Search API, chosen after comparing alternatives (below). No key,
  works from the browser. Its terms tie previews to a store link, so the tracklist carries one.
- **Links under the tracklist,** quiet and in our own type: "Apple Music" (the album there) and
  "Buy the CD": the artist's official shop when it sells that CD (`buy` in `band.json`, picked by
  hand), otherwise an Amazon search for the artist, title and CD (the user's call). MusicBrainz has
  almost no physical shop links (checked on Nevermind and Sehnsucht: one each, from random
  retailers). Official shops found so far, not yet linked per album: `shop.nirvana.com` (CD section,
  mostly current reissues), `shop.rammstein.de` (CD category), a store on `theprodigy.com`
  (catalogue not checked). The Crystal Castles store page only links to an old merch shop and Amazon;
  The Knife have none.

### What is implemented

- **Model** (`makePlayer` and the `makePlayer*` functions in `src/scene.ts`, tuning in `C.player*`),
  in millimetres, y up, the front face +z. Geometry: an extruded rounded square slab with softened
  edges and the well cut through it, the well floor, a lathed spindle (platform and centring pin), a
  thin satin ring round the well's lip, and on the front six rounded buttons and a display panel.
  The front between the rounded corners is a brushed aluminium panel (`makePlayerFrontCanvases`:
  colour and roughness maps with the same horizontal grain; `playerFront*`) with a "Discography"
  wordmark in the page's heading font (Instrument Serif italic) at its left end, as asked in review.
  It replaced a painted speaker grille there. A darker, more metallic panel (`#8f9298`, metalness
  0.9) reflected the dark lower half of the room and read as graphite, hiding the wordmark.
  Painted (canvas textures): the top plate's satin grain, engraved panel lines, a set of rings and
  pairs of dots (the body's caps keep millimetre UVs for this); two ports with small labels on the right side, which perspective shows a little; the floor's pickup
  slot, lens and laser mark; the button icons. The top plate takes the soft strip reflection
  (`withSoftReflection`, `playerTopSheen`). The labels and display use DM Mono, so they are
  repainted once the font has loaded (`prepare`).
- **Display:** the number of tracks while stopped, the track number and elapsed time while playing
  (`setDisplay`, `drawPlayerDisplay`), lit pale blue through the emissive map.
- **Pose and layout** (`resize`): on wide screens (aspect 1.1 and up) the player sits `playerShift`
  of the half-width left of centre with the tracklist on the right; on narrow ones it sits above the
  list (`playerRaise`) and shrinks to fit. It is tipped by `playerTilt` only; being off centre, plain
  perspective shows a little of its right side.
- **Transfer** (`insert`, `eject`, `updatePlayer`): one `listen` value, tweened over
  `insertDuration` (`ejectDuration` back), drives everything. 0 to 0.3: the disc lifts `insertLift`
  off the tray toward the camera. 0.2 to 0.7: the gallery group moves up by `insertPan` and the
  player rises from the same distance below, like a pan down. 0.35 to 0.8: the disc glides to
  `insertHover` above the spindle, turning to lie in the well and scaling to the player's size;
  then it drops. While out of its case the disc is a child of the scene; its start pose is the
  tray's pose with the gallery's pan taken out, so it is held where it was lifted instead of
  leaving with the case. When the eject finishes it goes back into the case body at its rest
  transform (`discRest`). The open case stays open meanwhile, and `close`, `open`, `goTo`, clicks and
  drags do nothing until the disc is back. Reduced motion jumps.
- **Scene API added:** `insert()`, `eject()`, `setPlaying(playing)`, `setDisplay(track, seconds)`,
  the `listenOnReveal` option, and `overDisc`, `listening` (player view wanted) and `discOut` (disc
  out of its case, until the eject finishes) in the pointer state.
- **Page** (`Tracklist` in `src/main.tsx`, styles under `.tracklist`): eyebrow, title, the tracks
  (number, title, length; the current one shows a play or pause icon and its progress as a hairline),
  then the two links. A click plays a track's preview, a second click pauses it, the next track with a
  preview follows when one ends. Space plays and pauses, Escape and Back eject. The list fades in once
  the disc has landed; the caption bar stays hidden until the disc is back in its case. The caption
  is usable while the case is open ("Listen to …") and focus no longer moves from it to Back on
  opening. Keyboard focus moves into the list when the disc goes in by keyboard, and back to the
  caption when it comes out. The bubble cursor says "Listen" over the disc in the open case. The URL
  gets `&listen` (implies `&open`), and a link with it restores the player view.
- **Previews at runtime:** one `lookup?id=<collection>&entity=song&country=us` request per album,
  cached for the visit, gives each Apple track ID's `previewUrl` (`loadPreviews`). Preview URLs
  aren't stored, since Apple may change them.

### Data (`scripts/fetch-tracks.mjs`)

- **Tracklist** (`tracks`: `title`, `length` in seconds, `apple` track ID): from the CD on MusicBrainz,
  `musicbrainz.release` when pinned, otherwise the earliest official single-CD release of the
  release group (as in `download-covers.sh`). Replaces the old `tracks: string[]`; the generated back
  insert reads the titles.
- **Apple Music match** (`appleMusic`, a collection ID): the artist's Apple ID comes from the artist's
  MusicBrainz links (`appleArtist` in `band.json` overrides). A plain iTunes search was too noisy
  (Nevermind itself wasn't in the top 20 results), so the script lists the artist's albums by that
  ID, takes those whose name matches ignoring edition notes ("(Deluxe Edition)", "(Remastered
  2020)", "(Live)"), and compares up to four track by track: most tracks matched, then fewest extras.
  Titles match exactly, then without version notes, then by position. Many albums exist on Apple only
  as a remaster or deluxe edition, which this handles (Bleach, In Utero, Herzeleid). "ß" is compared
  as "ss" (Weißes Fleisch).
- **Coverage:** all 32 albums matched; 396 of 406 tracks have a preview. The rest are missing on
  Apple's US store or are hidden tracks: Kept (Amnesty (I)), Where Did You Sleep Last Night
  (Nirvana), the English versions of Engel and Du hast (Sehnsucht), [silence] and Pussy (Liebe ist
  für alle da), Pussy (Made in Germany), Wind It Up, Hyperspeed and the Charly remix (Experience).
- Rate limits: about one MusicBrainz request a second and 20 iTunes requests a minute, so a band
  takes a minute or two.

### Verification

Headless Chrome with the GPU flags above, at 1440 × 900, 1024 × 768 and 390 × 844, on Nirvana,
Rammstein and The Prodigy: the transition posed at fixed points (0.15 to 1, through a temporary
debug handle, since removed), a real insert, play, pause, resume and eject (spin 5.0 rad/s, the
48 rpm then set, while playing; coasting after pause; the URL switching between `&listen` and
`&open`), the
"Listen" label and a click on the disc, and a link with `&listen`. The insert, and playback with the
motion blur, ran at a steady 60 fps (median frame 16.7 ms, none over 50 ms). `npm run typecheck` passes.

### Possible follow-ups

- Hand-pick official `buy` links per album (Nirvana, Rammstein, maybe The Prodigy).
- Clicking the spinning disc to pause, and the player's buttons as real controls.
- Previews from other storefronts for the tracks missing in the US store.

### Preview services compared

| Service | Previews | Direct browser use | Notes |
| --- | --- | --- | --- |
| Apple iTunes Search API | Yes, no key | Yes (`Access-Control-Allow-Origin: *`) | A lookup by album returns all tracks with `previewUrl` in one request. Chosen. |
| Deezer API | Yes, no key; lookup by ISRC is precise | No (no CORS allow-origin header) | Needs JSONP or a small proxy; terms also require attribution. |
| Spotify Web API | Removed for new apps in late 2024 | | Skip. |
| YouTube embeds | Full songs | Only through the visible YouTube player | Would hide the CD player look. |
| Hosting clips ourselves | | | Not allowed without a licence. |

## Open questions

None at the moment.

Answered: every album uses a standard jewel case; a drag on the closed case turns it to show the
spines and back (both phase 1). Player: a lidless top-loader in graphite; the case leaves upward and
only the player and the tracklist stay; a click on the disc switches views and a click on a track
plays (phase 2b).

## Later ideas (from the original README)

- Artist search: search MusicBrainz for an artist, list album release groups, resolve artwork through
  the Cover Art Archive, normalise to the `band.json` album shape and call `scene.setAlbums()`. Needs
  debouncing, rate limiting, caching and handling of missing artwork.
