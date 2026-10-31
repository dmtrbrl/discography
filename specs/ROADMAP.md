# Discography: state, open items and decisions

The hand-off document between sessions: what exists, what is still open, and the decisions from
review that later work must respect (including looks that were tried and rejected). How to run the
project, its layout, the data scripts and the checks are in [README.md](../README.md); the booklet
animation's implementation is in [BOOKLET_ANIMATION.md](BOOKLET_ANIMATION.md).

Until 31 October 2026 this file was a dated log of every round of work, about 1,650 lines, at the
repository's root. That history is in git (`ROADMAP.md` at commit `fe2455b` and before); this
file keeps only what still applies. Keep it that way: when something lands or a decision changes, update the section it
belongs to rather than appending a dated entry.

## What exists (31 October 2026)

- **The gallery**: ten jewel cases on a shallow arc, browsed by drag, wheel, arrow keys and touch,
  with hover tilt, a bubble cursor and a caption (artist and year, title) under the front case.
  Dragging the closed front case turns it over to show the spines and back insert.
- **The open case**: the lid swings open to show the booklet's back page in the lid and the printed
  disc in its tray. On phones it opens like a book (110°) and is scaled to the screen's width.
  Booklet and Listen sit either side of the caption.
- **The booklet**: a LeafThrough `LeafThroughObject` in the gallery's own scene. It rolls out of
  the lid over one cylinder, lands read head-on, and turns its pages as a spread (desktop) or one
  page at a time (phones, where the back cover turns and shuts it back onto the cover). Close or
  Escape play the same path back.
- **The player**: a graphite top-loading CD player. The disc lifts from the tray, the case pans up
  out of view, the player rises and the disc drops onto the spindle. Play, pause, next and
  previous on the player and in a transport row under it; 30-second previews from Apple;
  Apple, Spotify and Buy the CD links in the bottom row. Eject reverses the path.
- **Routes** in the hash (`#/<id>`, `/open`, `/listen`, `/booklet`, `#/about`), one history entry
  per view, jumps for distant changes and steps for adjacent ones; an about page.
- **Loading**: AVIF artwork at the drawn sizes with WebP twins, self-hosted type, preloads after the
  script, procedural textures from a worker, a reveal that waits for the row's discs and covers
  only. Lighthouse 12: 63 mobile, 98 desktop.
- **The data**: `public/albums/collection.json` and `public/albums/<id>/`. The ten albums are
  final, each with a verified stapled booklet, the printed disc and the back insert of a real
  edition, recorded in `sources`.

## Open

1. **LeafThrough 0.1.7.** The library's single layout had a glitch in the closing turn with
   `loop`: the pages settled flat under the pile lay newest on top, so the back cover uncovered an
   inside page, and they all crossed as the magazine shut. Fixed in the library's working tree on
   31 October 2026 (`SingleEngine`: settled pages in closed order, cover first; a depth test
   covers the mid-turn). Release it, bump `leafthrough` here, and drop this item. Until then the
   deployed gallery shows the glitch on phones.
2. **Booklet motion sign-off.** Still marked "in review" when the log closed: the way out (two
   arcs, then round one cylinder), the landing and the lighting crossfade; the paper's
   show-through amount; and the single layout on phones, where the next page shows at the right
   edge under the current one.
3. **Mobile loading.** The mobile Lighthouse score is held by the time to the reveal on its
   emulated 3G (LCP is the album title, which appears with the gallery) and by LeafThrough's
   start cost for ten booklets (`createSpreadGeometry`, about 8 ms each, 320 ms at a phone's
   speed). The library-side items below would help most.
4. **LeafThrough upstream notes** (found while profiling): `createPaperPattern` runs for every
   magazine (78 ms each; a module-level cache would do; the gallery passes one shared grain
   instead); `createSpreadGeometry` runs for every magazine too; a `Texture` passed as a page is
   uploaded again on every load (`needsUpdate = true` in `load`); `update({ pages })` uploads every
   preloaded page in one task (a dozen 1024 px pages, 55 ms; the gallery applies pages at the
   landing to hide it).
5. **Official shop links.** No album has a `buy` link; Buy the CD falls back to an Amazon search
   for the artist, title and CD. MusicBrainz has almost no shop links; pick them by hand if wanted.
6. **One preview missing**: "Lose It" (Feel It Break) has no Apple track ID in the Austrian
   storefront. Another storefront might have it.
7. **Loose ends in the code** (noted when the project moved to TypeScript, left as they were):
   discs still carry hover, spin, push and tween fields from when they were standalone, unused;
   `endPress` reads `this.cases[spinning]` without a guard; `destroy()` calls `setAlbums([])`,
   which reports `onProgress(0, 0)`.
8. **Ideas, not planned**: clicking the spinning disc to pause; clear trays (needs `Tray` scans
   or a generated inside of the insert); glossier paper (LeafThrough `paper.roughness` 0.3 gave the
   curl a faint highlight and changed nothing else; a one-line option).

## Decisions to keep

All visual and motion tuning lives in the `C` object at the top of `src/scene.ts`. The general
rule from every round of review: match real photos of CDs, cases and players rather than stylised
effects. When in doubt, compare against reference photos (Wikimedia Commons has several freely
licensed ones) before tuning.

### The discs

Proportions follow a real disc, as fractions of its radius (1 unit): hole to 0.127, clear hub to
0.31 (one flat ring, 8% opaque, faint moulded rings in the shader), mirror band to 0.345, label and
data area to 0.995, the print stopping at `discPrintEdge` (0.978) with the near-black
`discFallback` outside it. The front is a scan of the printed disc when one exists, else the square
cover, else generated placeholder art; `findDiscInScan` finds the disc in a scan against the corner
colour, and the render crops 1.2% inside the detected circle so scanner background never reaches the
spinning edge. The data side is a shader: bright silver with diffraction from the concentric tracks
(grating equation with `light + view`; `light − view` was wrong and looked fake), orders 1 and 2
only, blurred and washed to pastel, two light directions for the X pattern, faint track lines. The
hub's clear plastic draws only the faces toward the viewer (both faces blended read as scratches).
Lathed parts keep three.js's normals (`computeVertexNormals()` splits the seam).

Tried and rejected (do not reintroduce): refraction through the hub (blurred artwork, double render
cost); three stepped hub rings with ripples; a wide chrome rim, and later even the hairline clear
rim, which read as a white line in the case and the player, so the disc has no rim; a diffraction
rainbow on the front rim; a rainbow in the clear hub; a dark, grey or separately shaded outer zone
on the data side; many, long or uniformly bright scratches, and since 30 October any scratches on
the discs at all (`texScratches` and `scratchAmount` are 0 at the user's request; the code stays);
saturated rainbow spokes with dark gaps (real discs show soft pastel wedges on bright silver); a
light outline round the hub or at the print edge. Spin in the player: 150 rpm (`spinRpm`). A real
disc's 500 to 200 rpm looked weird, 400 and 260 too fast, 100 and 48 too slow; 200 read as too much
moving metal. Rotational motion blur (`withSpinBlur`, a 25 ms exposure) keeps the print from
strobing.

### The cases

- A standard jewel case for every album, built in millimetres (one unit is 60 mm): clear base with
  side walls, back insert folded into the two spines, black tray with rosette and a full-height
  ribbed hinge strip (121 mm, with knuckles at the corners), the disc turned up to ±25° per album,
  the booklet 120 × 120 mm centred over the disc, the clear lid with flanges. Moulded details from
  photos: four half-round tabs on the lid's flanges hold the booklet, two short ribs stop it,
  half-ring clips stand on the tray's edges; all placed symmetrically (uneven placement looked off).
- Clear plastic at 4% opacity, no refraction. It drops the direct lights' reflections (the strip
  light showed as a sharp pale rectangle) and reflects one long soft band instead (`caseSheen`),
  like a softbox; the disc print and hub reflect the same band. Cut edges get a little extra opacity
  (`caseEdgeAlpha`); a brighter, tinted version read as white outlines. Wear from a shared tiling
  map: scratches almost only inside the reflected band, smudges that make it patchy. The tray is
  satin black with a fine stipple and a low ring round the well.
- The page is a warm beige (`#ebe3d4`, radial gradient, fog to match) with a light grain over it
  at 15% (24% read as a matte haze over everything; removing it entirely lost an effect the user
  liked). A black page was rejected: the case's edges read as white outlines on it.
- The disc in the closed case is always drawn but shaded (`discClosedShade` 0.1), brightening as the
  lid opens; hiding it popped a white arc in as the lid started to move.
- Opening turns the case to face the camera with no sideways angle (a sideways open case was
  rejected; it should face the viewer like an open book), tipped back `openTilt`, brought forward
  and scaled; the lid swings 180° from 30% on; the neighbours leave the screen (`openSpread` 5,
  `openRecede` 1.6). Hovering the open case tilts it only vertically, a little. While a case is
  open no drag turns or scrubs anything; the arrows, Home, End and the wheel do nothing to the
  row.
- Dragging the closed front case turns it with a soft limit; on release it turns over if past
  halfway or flicked (mouse only, since horizontal touch drags browse), and stays turned until the
  gallery moves. Layout: `caseScale` 0.78, `hGap` 2.8, gallery tilt −22° (−30° skewed the squares).
- Phones (650 px and narrower): the case opens into a V (`lidOpenAngleNarrow` 110°; 100° darkened
  the disc, 120° was compared), the spine in the middle, scaled to the width less 32 px a side
  (`openFit`); the disc half keeps its reflections turned with it (`envTurn`) so it reads silver.
  Row gap `hGapNarrow` 0.9 (0.8 too tight, 1.0 pushed the neighbours off). Landscape phones:
  `openFitShortMargin` 100 px, so the case's booklet grows to the reader's size rather than
  shrinking; the picture is raised to even the gaps (`rowRaiseShort`, `openRaiseShort`).

### The booklet

The implementation, the tuning table and the full list of rejected approaches are in
[BOOKLET_ANIMATION.md](BOOKLET_ANIMATION.md) (section 13 for the rejections). The decisions in
short:

- One physical page stack from the start: each case holds a `LeafThroughObject` with the real page
  count, the cover and back page it already shows, and blank inside pages; the inside scans load
  on opening and go in at the landing. The same object flies and is read. A thin cover swapped for
  a thick stack after landing was rejected.
- Out by hand, then round one cylinder: the edge lifts over the hinge strip on a steep arc, eases
  on a gentle one, and the paper goes round a 100 mm cylinder along the spine (150 mm on phones,
  which take it out the other way, fore-edge first over the lid's open edge). One continuous roll
  and carry; a rigid rectangle on a circle, an extract-level-carry-flip sequence and a two-wave
  motion were all rejected. The bend relaxes as it is carried so the paper lands flat; retiming the
  roll to end sooner read as two pauses and a sudden stop. **Never retime the roll into pauses**:
  the roll check prints the paper's speed profile, compare it with the committed version after any
  change.
- The case leaves exactly as it does for Listen: the same pan curve, 2.4 s out and 1.9 s back, the
  same lens, at constant depth and scale; nothing shrinks, retreats or shakes. The booklet is read
  head-on (`bookletTilt` 0, the camera level; only Listen raises it): facing a raised camera the
  square page drew 10% taller than wide.
- It stays on its cover until a page is turned (no automatic first turn). Spreads centre as they
  open, a closed cover only once its turn has landed. Outside clicks close nothing; Close and
  Escape do. On phones the single layout loops: the back cover turns and the booklet shuts back
  onto the cover, and Next stays enabled there (see Open, 1, for the library glitch in that turn).
- The pages shown are announced only by the hidden live region. The count in the caption and a
  label under the landed booklet were both reverted at the user's request.
- Paper: a gentle resting curve everywhere (`bookletWrinkles` 0.055, `bookletBulge` 0.22); flat
  paper and the demo's full bulge were both rejected. Sheets stand LeafThrough's `paper.sheetGap`
  apart (0.007 mm) in the lid and open to a 1.2 mm stack out of it (`bookletStackOut`, widened per
  draw through `stackLoft`); a thicker stack in the lid came through the lid plate. The sheets under
  the outer one draw in 1.5 mm (`bookletTuck`) in the case, so their edges don't show past the cover
  as a broken white line. Camera near plane 1 for depth precision.
- Shadows and light: the booklet shadows its case from the start of the extraction (`bookletSunIn`
  0 to 0.35); the floor shadow under the landed spread (0.15) fades in 0.6 s after the landing and
  out 0.25 s into the return (following the flight it was large and heavy; switched on at the
  landing it read as a step); none on a phone's single page, as in the library. The reader's
  lighting replaces the gallery's over 0.6 to 0.86 of the way out, finished while the paper still
  moves (0.74 to 1 played on a still booklet). Lit as LeafThrough lights its demo: sun 2, hemisphere
  1.5 (spread) or 1.7 (single), single-page shadow 0.4, soft shadow edges. Rejected: the key light
  as a second caster; glossier paper.
- Dev only: Shift+D opens a slow-motion panel (1×, 0.5×, 0.25×, 0.1×, pause). A scrub slider and a
  motion dashboard with persisted overrides were removed; tuning goes through `C`.

### The player

- A lidless top-loader with an open round well, slim (18 mm), a little larger than the disc, in
  glossy graphite with a matte black edge round the top and a thin ring of polished dark metal
  round the well, worn like the cases. Modelled, not painted: no textures but the screen and the
  contact shadow, no logo or text. The front has a dot-matrix-style screen (DM Sans and DM Mono
  seen through a fine dot grid; a 5 × 7 pixel font read badly) and four buttons; the left side a
  headphone jack and speaker holes. A title too long for the screen rests 1.5 s, scrolls past once
  and rests again (phased on the clock alone it came in mid-pass). Fixed pose, turned 45° so a corner faces the camera, seen from
  26° above through a lens shift (`setLens`, FOV 18°), verticals kept vertical. Rejected: tilting
  the player (30°, 56°) or an isometric turn; a floor reflection; white and silver versions; a
  brushed aluminium panel with a wordmark; grilles, ports and engraved lines on the top; a plain box
  with six buttons and a blue display; black anodised with smoked glass and a knob; glossy white
  with eight buttons and a seven-segment display; darker, thicker trim; an amber screen; chrome
  rails and a chrome lens ring in the well (stray white lines).
- Flow: a click on the disc in the open case (or Listen) lifts the disc label up out of the tray
  (a top-loader takes it that way, no flip), the case pans up and the player rises, the disc
  glides over the spindle and drops. Eject is the same path backwards; the open case waits
  meanwhile. The disc never enters the player: 108 points of it are kept 3 mm above the top (a 45°
  slope off the edges, the well's floor over the well), and `insertLift` is 0.6 (36 mm) so the
  tilted case passes behind the disc on its way up and down (at 0.45 the tray drew over it).
- Nothing works until the disc has landed (`seated`): the screen stays dark, the buttons and Space
  do nothing, the transport row is hidden. Only Play starts the music, as on a CD player: stopped,
  next and previous cue a track at 0:00. Pausing coasts the spin down in 1 s; ejecting brakes it in
  0.25 s. A click on the landed disc ejects. The player leans toward the cursor at 0.35 of the open
  case's tilt (0.5 felt too strong).
- The page: no tracklist (removed 29 October). A transport row under the player repeats its four
  buttons as SVG symbols (a row with arrows, a Play word and the track and time was rejected: the
  screen shows those), one 40% see-through layer, 20 px under the player's measured bottom, a
  bubble group so the dot shows the whole row. On phones a line under the row names the track.
  The bottom row keeps the caption (inactive, it only names the album) with Apple and Spotify on
  the left (Apple first: the previews are theirs) and Buy the CD on the right, shown with the
  transport row. "Apple", not "Apple Music": next to Spotify the service is clear and the pair
  stays as wide as Buy the CD on phones.
  Booklet and Listen come back only once an ejected disc is back in its case.

### The page and its controls

- One page, the gallery; the project description is in the README. The tab is "Discography" on
  the row and on the about page, and "Discography · <title> · <artist>" while the route is one of
  an album's views (open case, player, booklet); no view name. It follows the route, not the
  scene, so the browser's Back changes it at once. The wordmark is plain text on
  the row (a click would do nothing) and a link to `#/` elsewhere; "GitHub" top right; "About" top
  left on the row, replaced by "Close" (open case) or "Eject" (player), which say what they do
  ("Back" didn't). Type is Instrument Serif throughout, italic for the controls and the artist
  line (Newsreader, Fraunces, Playfair Display, Libre Caslon, DM Serif Display, Source Serif 4,
  Crimson Pro and several mono and grotesk faces were compared and rejected). Caption 34 / 16 px on
  desktop, 28 / 14 on phones. The masthead is a band of the caption's height at the caption's inset
  (`--bar-inset`, `--caption-height`, `--masthead-top`), so the two bars match; not on short
  landscape screens, where the scene evens the gaps instead.
- The bubble cursor: a dot on the pointer (a lagging follow was rejected) that grows over anything
  clickable and opens a label only after 3 s of rest (at once felt busy; 5 s was too long); moving
  3 px, a click or a change of action restarts the wait. It re-checks what is under a still pointer
  every frame for a second after clicks and keys. A 40 px dot with a white clone of the control
  inside over text controls; the plain dot over disabled controls and over the open case itself (a
  "Close" label there was rejected); a thin 26 px ring over the player's small buttons (hiding the
  cursor there felt lost). The label stays closed while a keyboard focus ring shows. Hovered text
  in the dot is the page beige.
- The bottom bar's side pairs hand over in turn (arrows on the row; Booklet and Listen on an open
  case; the store links in the player): the outgoing pair fades out in 0.3 s, then the other fades
  in, shown at once so it can take focus. On phones the pairs sit a row above the caption. Links
  16 px on phones, 15 px in landscape, 18 px on desktop.
- Routes and history: `HashRouter`, one route with `matchFilters`, so views never rebuild the
  scene. Browsing replaces the entry; each view adds one and records its parent, so Close, Escape
  and Eject go back through the history. A hash change the gallery didn't write that lands one step
  away plays as the page's own controls would; anything further jumps: the view leaves in one
  move (the player drops, the booklet slides down, 0.6 s), the gallery resets unseen and fades in
  with the intro. Shrinking the cases away before the new intro was rejected (it read as a reset).
  Old `?album=` links move into the hash. Close steps back only over entries this page pushed
  (the router stamps each entry's history index as `_depth`; beyond the index the page started at
  means pushed here); on the start entry, a link straight into a view or a reload there, it
  replaces instead. Before, the reveal's two writes in one tick were merged by the router into a
  replace of the start entry carrying a parent, and Close stepped back out of the site.
- No input during a view change (`viewBusy()`): Back, Escape, Enter, Space, the wordmark, the
  caption, Booklet, Listen, clicks and drags do nothing while the intro, a jump, an opening, a
  closing or the disc's transfer plays; moving along the row still works. A double click on a
  closed case must not put the disc in the player (the case counts as open only once fully open).
- Keyboard: Enter or Space opens the front case; arrows, Home and End move along the row (and turn
  pages while the booklet is out); Escape closes; focus moves only to what replaces a control that
  is going away (About to Close, arrows to Booklet or Listen, the caption to Listen, and back;
  Listen to Play; a store link or the transport row to Booklet or Listen after an eject). One
  `:focus-visible` ring for every control. The caption is a button on the row only.
- Loading screen: a hairline ring filling clockwise from the top with the count inside, 0 to 100
  and no word ("Loading" and a plain bar until 31 October 2026), eased toward the real progress,
  fading only once it shows 100; a `progressbar` for screen readers. Reduced motion: transitions jump, the page reveals at
  once. The favicon is a rounded beige square with a dark disc (reflective and outlined versions
  were less legible at tab size).

### Loading and performance

- Artwork is AVIF at the drawn size (covers and booklet backs 1024 px, discs 1200 px since the
  scan is cropped to the disc before scaling, back inserts 1320 px, booklet spreads 2048 px) with a
  WebP twin beside each file; `collection.ts` decodes a 2 × 2 AVIF once and swaps every path to
  `.webp` where that fails. WebP alone is about a third larger at like quality.
- The reveal waits for the row only: each case's disc and cover (1.5 MB); the back inserts and
  booklet backs load right after and go in as they arrive. A 12 s timeout reveals with placeholder
  art. `index.html` preloads the fonts and `collection.json`; a Vite plugin writes a preload for
  every disc and cover, then the inserts and booklet backs at `fetchpriority="low"`, all after the
  script tag (ahead of it, forty image requests starved the script on 3G), and a `modulepreload`
  for the strip light's lookup tables, which are their own chunk. `fetchpriority="high"` on the
  images was rejected (the script arrived at 13.9 s instead of 6.9 s on 3G); no preloads at all
  was 300 ms worse at 10 Mbps.
- The type is served from `public/fonts/` (woff2, OFL, `font-display: swap`); no Google Fonts
  `@import`.
- The start: the disc print's and tray's procedural maps and LeafThrough's paper grain are
  generated in a worker, one grain for all ten booklets; the scene is built after the loading
  screen's first paint; placeholder art isn't uploaded; the booklet shares the case's cover and
  back-page textures; shaders compile with `compileAsync`; images decode off the main thread.
  Longest task before the reveal: 79 ms (was 1,064 ms). Booklet scans that arrive during the flight
  wait for the landing (`pendingPages`).
- Frame budget: adaptive resolution (the pixel ratio steps down when frames run long), an 8 MP
  canvas cap, no MSAA on high-DPI screens, no `transmission` anywhere (two renders a frame and a
  blurred copy of the art), textures uploaded at load, the render loop idle when nothing moves.
  Every view ran at 60 fps at 1440 × 900 (2×) and 390 × 844 (3×) in the last audit.

### The data

- `collection.json`: the collection's name and theme and the ten albums; paths relative to each
  album's folder. Each album's `sources` records the exact edition and image used for the cover,
  disc, back insert and booklet. Fronts are official digital artwork from Apple Music; discs,
  inserts and booklet pages are scans from the Cover Art Archive, chosen by hand (verified
  stapled booklets, the same edition where possible); `bookletFit: contain` keeps each scanned
  panel whole when artwork crosses a spread's centre. `download-covers.sh` takes the earliest
  official single-CD release with scans unless `musicbrainz.release` pins one, and takes a named
  back image or half (`backImage`, `backHalf`) and the booklet back page by release and image ID
  with `@left`, `@right` or `@n/m` panel picks.
- `fetch-tracks.mjs`: the tracklist from the CD on MusicBrainz; the Apple album found through the
  artist's Apple ID (from MusicBrainz), by name without edition notes, then track by track (most
  matched, fewest extras); "ß" compares as "ss". Preview URLs are fetched at runtime
  (`lookup?id=…&entity=song`) and never stored, since Apple changes them. Storefront `at` for all
  but Mutter (`us`).
- Previews come from Apple's iTunes Search API: no key, usable from the browser, one request per
  album. Deezer (no CORS), Spotify's Web API (previews removed in 2024), YouTube embeds (hide the
  player) and self-hosted clips (no licence) were compared and rejected.
- Spotify album IDs were found by searching Spotify's album pages and checked against Spotify's
  embed page for each ID (title, artist, type album, a track count equal to the CD's). Mutter has
  two identical 11-track entries; the one search engines rank as the main page is used
  (`7ikuEzL6xeAgu6yT6YVLy7`; the other is `2tHCY2fDMi0NqeGZcAxNSc`). MusicBrainz has no Spotify
  links for these albums and Odesli's public API is closed.

## Verifying

The checks in `scripts/` (how to run them: README) cover the booklet's lifecycle, the roll's
geometry on the GPU, the case's exit against Listen's, the disc's path into the player, and any
album end to end, with its expectations read from `collection.json`. The first four run on the
current gallery: Surrender as the thin eight-page booklet, Mutter as the thick sixteen-page one,
Citizen of Glass for the lazy interior requests. Run them
after a change to the case, the booklet, the player or the data; `npm run build` type-checks.

Beyond the checks, review has used ad-hoc scripts kept outside the repo, with `playwright-core`
and headless Chrome on the GPU (`--use-angle=metal --enable-gpu --ignore-gpu-blocklist`;
SwiftShader runs at about 9 fps):

- Screenshots and frame-by-frame captures of a motion, diffed pixel by pixel against the committed
  build served from a `git worktree`; crops around the pointer for the bubble.
- `requestAnimationFrame` intervals and `longtask` entries per segment of a scripted session, and
  the time in `compileShader`, `linkProgram` and `texSubImage2D` patched on the WebGL prototypes.
- Time to the reveal under CDP `Network.emulateNetworkConditions` (3G, 4G, 10 Mbps), the order and
  timing of every request, Lighthouse against a local server that gzips text as GitHub Pages
  does (`vite preview` doesn't), and CDP `Profiler` runs of the start at 1× and 4× CPU throttling.
- Load with `waitUntil: 'commit'` when timing the loading screen: the page's `load` event waits for
  the artwork. Keep source files unchanged during a run; a Vite reload breaks a lifecycle check.
