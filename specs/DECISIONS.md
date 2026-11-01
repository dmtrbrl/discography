# Discography: what is built and the decisions to keep

The reference between sessions: what exists, and the decisions from review that later work must
respect, including looks that were tried and rejected, and at the end the known gaps and the ideas
not planned. Nothing is open: the project is complete (1 November 2026). How to run the project,
its layout, the data scripts and the checks are in [README.md](../README.md); the booklet
animation's implementation is in [BOOKLET_ANIMATION.md](BOOKLET_ANIMATION.md).

Until 31 October 2026 all of this was a dated log of every round of work, about 1,650 lines, in a
`ROADMAP.md` at the repository's root; a slimmed roadmap of open items followed until the last of
them closed on 1 November 2026. That history is in git (commit `fe2455b` and before, and `4a7b195`
for the last roadmap); this file keeps only what still applies. Keep it that way: when something lands or a decision changes,
update the section it belongs to rather than appending a dated entry.

## What is built (31 October 2026)

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
- **Loading**: AVIF artwork at the drawn sizes with WebP twins, small copies first on phones,
  self-hosted type, procedural textures from a worker, a reveal that waits for the front case and
  its neighbours only, the rest arriving one job per frame. Lighthouse 12.8 (1 November 2026): 76
  mobile, 98 desktop; on a slow 4G phone the row is up in 5 s (was 12).
- **The data**: `public/albums/collection.json` and `public/albums/<id>/`. The ten albums are
  final, each with a verified stapled booklet, the printed disc and the back insert of a real
  edition, recorded in `sources`.

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
light outline round the hub or at the print edge. Spin in the player: 120 rpm (`spinRpm`; 150 until
1 November 2026, when it read as too fast on a phone). A real disc's 500 to 200 rpm looked weird,
400 and 260 too fast, 100 and 48 too slow; 200 read as too much moving metal. Rotational motion blur (`withSpinBlur`, a 25 ms exposure) keeps the print from
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
  A touch held still on the front case for `flipHoldTime` (0.45 s) turns it over, or back, since
  on touch a horizontal drag browses the row (1 November 2026); a long touch opens no selection or
  menu (nothing on the page is selectable but the about page's text). Touch devices render with
  MSAA, which their tile-based GPUs resolve cheaply, at a pixel ratio capped at 1.5
  (`pixelRatioNarrow`): without MSAA the cases' edges stepped, and 2 ran a phone hot for little
  gain; the adaptive resolution still steps down.

### The booklet

The implementation, the tuning table and the full list of rejected approaches are in
[BOOKLET_ANIMATION.md](BOOKLET_ANIMATION.md) (section 13 for the rejections). The motion was
signed off as final on 1 November 2026: the way out, the landing, the lighting crossfade, the
paper's show-through and the phone's single layout stay as they are. The decisions in short:

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
  open, a closed cover only once its turn has landed. Closing, the booklet centres on its cover
  while the pages turn back, and the way back starts as the turn lands (centred only after it,
  the flight waited most of a second after turned pages). Outside clicks close nothing; Close and
  Escape do. On phones the single layout loops: the back cover turns and the booklet shuts back
  onto the cover, and Next stays enabled there. A glitch in that turn (an inside page showing
  under the back cover, then the cover rising through it) was the library's; LeafThrough 0.1.7
  settles the read pages in closed order, cover first, and the gallery uses it since 31 October.
- The inside pages go in at the landing in a task of their own, never inside a frame: the sheets
  come new with LeafThrough's rebuild and take their textures a microtask later, so a render in
  the same task drew the landed booklet white for one frame (seen on desktop and phones, fixed
  1 November 2026). On desktop the pages' textures go to the GPU one per frame during the flight,
  so the landing has nothing left to upload; on touch devices they upload at the landing, while
  the paper is still, since an upload there could cost a frame of the flight.
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
  round the well, like the jack's collar, dulled (roughness 0.32, half a clearcoat, 60% of the
  room's light: at 0.18 with a full clearcoat it glared on a phone, and matte rubber, tried on
  1 November 2026, looked worse), worn like the cases. Modelled, not painted: no textures but the screen and the
  contact shadow, no logo or text. The front has a dot-matrix-style screen (DM Sans and DM Mono
  seen through a fine dot grid; a 5 × 7 pixel font read badly) and four buttons; the left side a
  headphone jack and speaker holes. A title too long for the screen rests 1.5 s, scrolls past once
  and rests again (phased on the clock alone it came in mid-pass). Fixed pose, turned 45° so a
  corner faces the camera, seen from 26° above through a lens shift (`setLens`, FOV 18°), verticals
  kept vertical. Rejected: tilting
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
  do nothing, the transport row is hidden. Leaving the tab (or the app, on a phone) pauses the
  music and brakes the disc; it stays paused until Play. Only Play starts the music, as on a CD player: stopped,
  next and previous cue a track at 0:00. Pausing brakes the spin to a stop in 1 s, ejecting in
  0.25 s, at a steady deceleration (an exponential coast crawled to a halt); the print's motion
  blur covers the frame's real interval where that is longer than its 25 ms exposure, so a phone
  under 60 fps shows a spinning disc, not a strobing one. A click on the landed disc ejects. The player leans toward the cursor at 0.35 of the open
  case's tilt (0.5 felt too strong). A track change keeps the disc spinning: the pause of the old
  preview before the new one loads no longer stops it (the disc coasted down and up at every next
  or previous). Two audio elements take turns: the next track's preview is fetched while one
  plays (Apple's files allow the cross-origin fetch) and primed on the idle element as an object
  URL, so a change only starts an element that already holds its file; changing the one element's
  source stalled Safari on iPhones while it set its native player up again. The first press plays
  a moment of silence on the idle element, since iPhones let an element play on its own only
  after a gesture has played it.
- The contact shadow under the player is a canvas blurred as the canvas's own shadow of the shape,
  drawn off the canvas with the shadow shifted back on: the 2D context's blur filter, used before,
  is missing in Safari, where the shadow drew as a hard-edged dark border (1 November 2026).
- The page: no tracklist (removed 29 October). A transport row under the player repeats its four
  buttons as SVG symbols (a row with arrows, a Play word and the track and time was rejected: the
  screen shows those), one 40% see-through layer, 20 px under the player's measured bottom, a
  bubble group so the dot shows the whole row. On phones a line under the row names the track.
  The bottom row keeps the caption (inactive, it only names the album) with Apple and Spotify on
  the left (Apple first: the previews are theirs) and Buy the CD on the right, shown with the
  transport row. Buy the CD is an Amazon search for the artist, title and CD; hand-picked shop
  links were considered and not wanted (an album's `buy` in collection.json would override the
  search). "Apple", not "Apple Music": next to Spotify the service is clear and the pair
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
  fading only once it shows 100; a `progressbar` for screen readers. Reduced motion, on desktop
  screens only (phones play the motion whatever the setting says: the page is the motion, and the
  setting is often on for other reasons; 1 November 2026): transitions jump, the page reveals at
  once. The favicon is a rounded beige square with a dark disc (reflective and outlined versions
  were less legible at tab size).
- On iPhones the page runs under Safari's bars (`viewport-fit=cover`), so they take the page's
  beige rather than white; the bars, corner buttons and about page keep clear of the screen's safe
  areas (`--safe-top` and the rest, style.css). Safari 26 paints its bars in the root background
  colour, so on touch devices the page's vignette fades to that flat colour before the edges
  (it met the darker corner otherwise).

### Loading and performance

- Artwork is AVIF at the drawn size (covers and booklet backs 1024 px, discs 1200 px since the
  scan is cropped to the disc before scaling, back inserts 1320 px, booklet spreads 2048 px) with a
  WebP twin beside each file; `collection.ts` decodes a 2 × 2 AVIF once and swaps every path to
  `.webp` where that fails. WebP alone is about a third larger at like quality.
- The reveal waits for the front case and its neighbours (`revealRadius` 1): each one's disc and
  cover. The rest of the row's arrive as the intro plays, and the back inserts and booklet backs
  once it is done (`afterIntro`), since they show only once a case is turned over or opened. A
  12 s timeout reveals with generated art in place of what hasn't come. On phones (650 px and
  narrower) the discs and covers come first as small copies (`discSmall`, `coverSmall`: 512 and
  640 px, a third of the bytes), the full size replacing them after the intro, one upload per
  frame. `index.html` preloads the fonts and `collection.json`; a Vite plugin writes a preload
  for every disc and cover, with a `media` query so phones get only the first album's small
  copies (the scene asks for the others as soon as it runs, the front's neighbours first: sharing
  a slow connection with twenty images, the script itself arrived late), all after the script tag,
  and a `modulepreload` for the strip light's lookup tables, which are their own chunk.
  `fetchpriority="high"` on the images was rejected (the script arrived at 13.9 s instead of
  6.9 s on 3G); no preloads at all was 300 ms worse at 10 Mbps. Until 1 November 2026 the reveal
  waited for the whole row (1.5 MB) with the inserts preloaded at low priority: on a slow 4G phone
  with its CPU slowed 4× the row took 12 s to appear; it takes 5 s now.
- The type is served from `public/fonts/` (woff2, OFL, `font-display: swap`); no Google Fonts
  `@import`.
- The start: the disc print's and tray's procedural maps and LeafThrough's paper grain are
  generated in a worker, one grain for all ten booklets; the scene is built after the loading
  screen's first paint; the player is built after the intro in idle time, or on the first Listen
  (its extruded body and buttons were a quarter of the start); the disc is found in each scan on
  a small copy made off the main thread (`locateDisc`); the stand-in art is the album's colour,
  the generated art drawn only when nothing comes; every texture upload and each case's inside
  goes through a queue, one job per frame in a task of its own (`inFrame`), since ten arrivals
  handled as they came held a phone's main thread for a long moment; the booklet shares the case's
  cover and back-page textures (handed over as `Texture`s with their colour space set; LeafThrough
  0.1.7 takes them as they are, without a second upload); shaders compile with `compileAsync`;
  images decode off the main thread. Booklet scans that arrive during the flight wait for the
  landing (`pendingPages`); that and the grain from the worker stay.
  Measured on 1 November 2026 (Lighthouse 12.8, five runs each, median): 76 mobile and 98 desktop,
  from 68 and 98; blocking time 250 ms, from 380. Lighthouse's mobile LCP is a model built from a
  local trace, the bytes fetched before the first big paint, so it moves with what the page
  preloads and not with when the row is up: naming the album on the loading screen moved its LCP
  element without moving the estimate, and was reverted. Loading changes go by the real throttled
  time to the reveal (README, Checks), with Lighthouse beside it; its run-to-run noise is about
  five points.
- Frame budget: adaptive resolution (the pixel ratio steps down when frames run long), an 8 MP
  canvas cap, MSAA only on screens of one pixel ratio and on touch devices (see The cases), no `transmission` anywhere (two renders a frame and a
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

## Known gaps and ideas not planned

- "Lose It" (Feel It Break, track 2) has no preview: Apple's album listing omits it in every
  storefront checked (it was a free single of the week), so there is no track ID to fetch. Nothing
  to do unless Apple adds it; `check-album.mjs` skips tracks without an Apple ID.
- Not planned: clicking the spinning disc to pause; clear trays (needs `Tray` scans or a generated
  inside of the insert); glossier paper (LeafThrough `paper.roughness` 0.3 gave the curl a faint
  highlight and changed nothing else; a one-line option); official shop links in place of the
  Amazon search.
