# Discography: roadmap and project state

A visual experiment for browsing ten favorite albums from different artists in 3D, built with Solid
and three.js. Each album is a CD jewel case that turns over and opens to show the disc and a leafable
booklet. A CD player offers short track previews.

This file is the hand-off document between sessions. It records what exists, why it is built that
way, what was tried and rejected, and what comes next. Keep it up to date when a phase lands or a
decision changes.

Album data, including each edition's image sources and Apple IDs, lives in
`public/bands/favorites/band.json`.

## Status at a glance

| Phase | Scope | Status |
| --- | --- | --- |
| 0 | CD gallery: motion, CD look, real disc scans, loading screen, performance | Done (initial commit `bb3b070`) |
| 1 | Jewel cases instead of discs, opening the front case | Done |
| Pre-2 | Title screen, artist selection and menu, four more artists | Done |
| 2a | Booklet as a flip book with LeafThrough | In the scene since 29 October 2026 (prototype, in review); was an overlay |
| 2b | Disc to CD player animation, tracklist, 30-second previews | First version (28 October 2026), in review |
| Collection | One gallery with ten albums by ten artists | First version (29 October 2026) |
| Single page | Gallery as the only page: title screen, artist list, band label and Albums menu removed | Done (29 October 2026) |
| Player view | Tracklist removed; centred, larger player with a transport row and the store links in the bottom row | First version (29 October 2026) |
| Mobile | Partly open case on phones | In progress (29 October 2026) |
| Routes | Hash routes with `@solidjs/router`, a history entry per view, jumps instead of replayed steps | First version (29 October 2026) |

## Shadows in the booklet flow (30 October 2026, in review)

Review of the booklet animation: the flying booklet cast no shadow and the landed one lay on the
background like a pasted rectangle. Captured frame by frame in headless Chrome at 1440 × 900 and
on both phone layouts, before and after, with pixel diffs to tell what each light contributes.

- **The booklet shadows its case as it comes out**: the tray, insert and disc take the booklet
  sun's shadow (`receiveShadow`; only the booklet's sheets cast), and the sun comes in from the
  start of the extraction (`bookletSunIn` 0 to 0.35, at `bookletTravelSun` 1.6) instead of from
  0.3, so the lifting edge and the curl over the disc have a shadow at once. The sun adds no
  measurable brightness to the case (the disc's lit patches are within 1 of 255 before and after).
  The shadow is soft and faint, as a shadow from a soft light is.
- **The floor shadow is back, fading in after the landing**: LeafThrough's default `floorShadow`
  (`bookletFloorShadow` 0.15, for a spread only, as in the library; a phone's single page has none).
  It fades in over `bookletShadowIn` (0.6 s) once the booklet has landed and the pages answer, and
  out over `bookletShadowOut` (0.25 s) as the way back starts, through `floorShade` and a tween,
  instead of following the flight's progress: switched on with the landing it read as a step, and
  in flight the shadow was large and heavy. With the gentle resting curve the shadow is a hairline
  along the cover's right and lower edges; `bookletFloorGap` (0.24 mm) is the floor's distance
  under the pages for tuning it.
- **Softer shadow edges**: the demo's `radius` 3, bias -0.0007 and normal bias 0.002
  (`shadowSoft`, `shadowBias`) for page-on-page and floor shadows alike.
- **The pages shown, in the caption**: while the booklet is read, the caption's upper line shows
  the pages instead of the artist and year ("2–3 / 8", "1 / 8" on a cover or a phone's page), as
  LeafThrough's demo counts them; the hidden live region still announces them, and the visible
  line is aria-hidden so they are not read twice.
- Tried and rejected: **the key light as a second shadow caster** for the case. Below and to the
  right, its shadow fell where the paper hid it, hazed the resting cover with self-shadowing, every
  lit material sampled a second map, and the floor (a `ShadowMaterial` takes every light's shadow,
  lit or not) showed a large shadow up and left of the back cover. **Glossier paper** (LeafThrough
  `paper.roughness` 0.3 instead of 0.5) gave the curl a faint highlight band (mean difference
  about 5 of 255 along the curl) and otherwise changed nothing visible; not applied, since it would
  also change the settled spreads reviewed against the demo. It remains a one-line option.
- The gallery's stale shadow map: after the booklet returns, the map is drawn once more, empty
  (`shadowMap.needsUpdate`), so the booklet's last pose cannot stay on the tray or disc.

Second round, same day:
- **The lighting no longer changes after the landing.** The crossfade from the gallery's lights
  and environment to the reader's sun and fill ran over 0.74 to 1 of the way out, with a cubic
  ease, while from 0.9 the roll moves under a pixel a step: the last sixth of the change played on
  an all but still booklet, so the settled booklet was lit differently from the landing one, and
  the way back started with the same change. Frame-by-frame diffs found no step in the handoff
  itself (the frozen frame at 1 before and after the reader takes over matches to the pixel). The
  crossfade is now `bookletLightIn`, 0.6 to 0.86, finished while the paper still moves; the case
  is off the screen by 0.65 on desktop and phones, so the gallery's lights going does not dim it.
- **The stack has thickness.** At LeafThrough's 0.007 mm a sheet the booklet flew like one sheet.
  In the lid the sheets stay at that gap: the formed cover already lies against the lid plate's
  inside face, and a thicker pressed stack (0.16 to 0.4 mm was tried) came through the plate, as
  spots on the closed case in the gallery and as the roll check's plate assertion. Out from under
  the lid the stack springs open to `bookletStackOut` (1.2 mm, the pick bound's thickness) and is
  pressed back on the way in, over the same way the fit to the screen comes in (`framed`). The library's
  sheet gap is not a live option, so each sheet's stand-off uniform (`uStackGap`, the one object
  in its colour and shadow programs, caught as they compile) is widened per draw by the case's
  `stackLoft`; a value other than the one written last is the library's own. In the curl both the
  thin Nevermind stack and the 17-sheet Kid A one show their edges; landed, the cover lies 1.2 mm
  over the floor and the floor shadow shows along its edges.
- **The pages shown: nowhere visible.** The caption keeps the artist and year (the first round
  had put the count there; reverted at the user's request). A second attempt put a label under the
  landed booklet ("2–3 / 8"), at the pages' lower edge reported by the scene, fading in after the
  landing and out as the booklet started back; the user found it a distraction and it is gone
  with its scene plumbing (`onBookletEdge`). Only the hidden live region still announces the pages.
- **The case passes behind the disc on the way to the player and back.** The user saw the tray
  draw over the hanging disc as the case slid up (and down, on the eject). The open case is tipped
  back 24° (`openTilt`), so while it slides straight up past the disc, which stays where it rose
  to, its lower part comes forward: where the bottom edge passed over the disc the tray surface was
  about 25 mm nearer the camera than where the disc had left it, more than the 27 mm lift
  (`insertLift` 0.45) once the walls are counted, so the tray won the depth test for a few frames
  around 0.4 of the way, both ways (measured with a probe of the disc's height over the tray plane).
  Two things fix it: the disc is kept out of its case as it is kept out of the player (every point
  of it `insertClearance` in front of the walls' tops within the case's outline, with the same 45°
  slope off its edges, pushed straight toward the camera so it swells rather than drifts), and the
  lift is 0.6 (36 mm), at which the pass needs at most a 3 mm push on desktop and none on a portrait
  phone (a landscape phone, where the case is bigger, gets a few millimetres). With the lift alone
  at 0.45 the push was 12 mm in a tenth of a second, a visible flick; at 0.68 no push was needed but
  the disc hung over the tray's top edge. The pan itself is unchanged, so the booklet view and the
  case-transition check are unaffected.

Third round, same day, three UI points from review:
- **The two bars match.** The masthead sat 36 px from the top with the 34 px wordmark, while the
  caption (artist and year over the title, 63 px) sat 39 px from the bottom: the wordmark's centre
  was 51 px from the top, the caption's 71 px from the bottom, and the top looked tight. Now the
  masthead is a band of the caption's height at the caption's inset, with the wordmark (and Back,
  About and GitHub, with their measured offsets) centred in it; the caption's height is derived
  from its type sizes in CSS variables (`--bar-inset`, `--caption-height`, `--masthead-top`), per
  breakpoint, so a change to the caption moves the masthead too. Measured after: 70.6 px and 70.6
  px on desktop, 51.4 and 51.4 on a portrait phone. Not on short landscape screens: there the
  header would take 14 more px of a 390 px screen, and the scene already evens the gaps round the
  picture by raising it (`rowRaiseShort`, `openRaiseShort`). The about page's top padding follows
  the masthead.
- **The booklet tooltip no longer comes up after a click on the spot.** The bubble's label opens
  after 3 s of rest and restarted only on movement or a change of label; a page turned by a click
  keeps the label "Next", so a still hand saw the tip 3 s after each click. A click now restarts
  the wait like a move (checked: shown at 3.6 s, hidden 0.15 s after a click, back 3.45 s after).
- **A lighter film over the page.** The fractal-noise grain fixed over the whole document
  (`body::before`) read as a matte, old-plastic haze on everything, the cases and the type
  included, and was removed at the user's request; then kept at 15% instead of 24%, since the
  user liked the effect itself. The gradient background stays on `html`.
- **No scratches on the discs.** The printed side's scratches and dust (`texScratches`, 0.36 → 0)
  and the data side's glinting scratch map (`scratchAmount`, 0.5 → 0) are off at the user's
  request; the code and the other wear (track lines, the silver band, the mould rings) stay. The
  jewel cases and the player keep their wear, which was not in question.

`npm run build`, the lifecycle, roll (Nevermind) and case-transition checks pass at all three sizes.

## Consistent paper curvature (30 October 2026, in review)

The perfectly flat experiment was rejected in review. The booklet now uses a gentle resting
curve from the beginning: `bookletWrinkles` is 0.055 and `bookletBulge` is 0.22, with
`bookletCompression` fixed at one in the case, flight and reader. These settings fit under the
lid without compressing the paper and then inflating its depth after extraction. They replace
the full demo-style resting bulge described in the 29 October review below. The floor shadow
was disabled then (it is back, fading in after the landing, see above). Extraction curl, page-turn bending, grain, page-to-page shading, lighting,
camera and timing are retained. The same paper settings apply to phone single-page layout.

Follow-up: the flatter curve exposed depth fighting at the left edge/spine, where LeafThrough's
sheets meet at exactly the same depth. `bookletLayerDepth` adds 0.12 mm across the stack, ordered
by each sheet's current pile depth. The shader applies it before the extraction bend and shares
it with normal and shadow calculations in both layouts. Before/after cover and spread captures
of the 17-sheet Kid A booklet showed an improvement, but review still found artifacts in the
reader and closed case. The completed fix also disables LeafThrough's camera-facing polygon
depth bias before each sheet draw, increases the camera near plane from 0.1 to 1 for better
depth precision, and counts all pages (not pairs) for single-layout layer spacing. The user
confirmed the artifacts are gone after this update. The curvature and 0.12 mm spacing stay.
The GPU clearance check passes at all three sizes; a new assertion checks distinct sheet
depths at the spine. Retina captures cover the closed case, open case, cover and reading pages.

LeafThrough 0.1.6 (same day) took in the integration feedback, and the workarounds above are
gone: the sheet gap is the library's `paper.sheetGap` (`bookletSheetGap`, 0.007 mm a sheet), its
depth bias is off in a scene, the extraction bend is its `deform` hook (`bookletDeform`), and
sheet shadows switch through `lighting.shadows` without a rebuild. `bookletCompression` was
removed (it was fixed at one). The near plane stays at 1.

Follow-up: a broken white line along the closed booklet's lower and right edges in the gallery
(reported on Nevermind) was the blank sheets under the cover. The cover bulges most, so in a
tilted view the flatter sheets showed past its edge by about a pixel. It was there with the old
spacing and bias too. In the case, the sheets under the one facing the camera now draw in
`bookletTuck` (1.5 mm) from their outer edges; the tuck goes in the first part of extraction.
Retina captures of Nevermind and Kid A (gallery, open lid, cover, spread, phone) show no line
and no artwork through the pages. Build, roll (Nevermind and Kid A), lifecycle and case-transition
checks pass.

Review, same day (details in BOOKLET_ANIMATION.md):
- **Phones take the booklet out the other way**: the mirrored roll feeds it fore-edge first over
  the lid's open edge and stops, with a 40° entry bend (92° over the hinge read as a kink; 22°
  caught the stops) round a 720 mm travel cylinder, off the screen's side on the way.
- **The paper lands flat**: its bend relaxes as it is carried (`bookletFlatten`, an exact,
  length-keeping relaxation), so it lands flat. The motion itself is the reviewed one; ending the
  roll sooner was tried and read as two mini pauses and a sudden stop, and a longer carry dragged
  the booklet up with the panning case. The roll check now prints the paper's speed profile.
- **The reader is head-on**, as LeafThrough shows a magazine: the camera no longer rises for the
  booklet (only for Listen's player), and the page lies parallel to the image plane
  (`bookletTilt` 0). Facing the risen camera it drew about 10% taller than wide (measured from
  its projected corners), and laid upright under it, its pages turned through the bottom. Not a
  LeafThrough issue: the reader and the returning booklet matched exactly at the handoff. The
  case still leaves with Listen's pan and lens, only seen level; the case transition check
  compares it with Listen less its rise. The flight's camera-facing pitch correction went, and
  the zoom ceiling uses the paper's own height.
- **The phone's back cover turns**: the single layout loops, so its last page turns, shutting the
  booklet onto its cover; Next stays enabled there.
- The roll check's landing assertions test for reversal (no dip and rise, no tilt back) instead
  of a stop by 0.72. All checks pass: roll (Nevermind, Kid A), lifecycle, case transition.
- **Out by hand, then round one cylinder** (in review): the edge lifts on a steep arc over the
  hinge strip, eases on a second, gentle arc, and the booklet goes round one 100 mm cylinder,
  its axis along the spine, instead of turning about its own centre. It turns only once out from
  under the lid (34 mm after the holders), and from there its pose changes once, smoothly, to the
  reader's: tilt, size, straightening and a shift to the reader's centre, landing at once in place.
  The case's pan, the fit to the screen and the clearance margins wait for that too, and clearance
  moves along the case's own normals: each, from the release, jumped the booklet as its edge came
  free (this also fixes the landscape-phone jump noted below). Its height on screen is one curve,
  carrying on from the pull into the reader's height by 0.7 (the sum of several eased parts went
  up and down twice, worst going back). All checks pass; the paper's speed on screen has no step.
- **Landscape phones, a smaller open case**: `openFitShortMargin` 72 → 100 px. The open case nearly
  filled the screen, its booklet (213 px tall at 667 × 375) about as large as the reader's (240 px),
  so the booklet swelled to 329 px coming toward the camera and shrank to land. Now 161 px in the
  case, it grows to the reader's size, and turns on screen.
- **Dev slow motion** (dev server only): Shift+D shows a panel to slow the scene's animations
  (1×, 0.5×, 0.25×, 0.1×, pause) with the booklet's progress (t and the time at normal speed).
  A scrub slider was tried and removed.
- Fixed: on landscape phones (844 × 390) the paper jumped about 50 px in one frame as its
  trailing edge cleared the holders, in the committed version too (the screen fit and clearance
  switching on at once; see above).

`npm run build` passes. The 201-pose GPU roll check passes at 1440 × 900, 390 × 844 and 844 × 390:
no holder/lid/tray collisions, no landing size jump, constant paper depth, and the return retraces
extraction. The zoom check detects geometric release independently of depth compression.
The booklet lifecycle check also passes across those layouts and reduced motion, including
page turns, reopening, Close/Escape, lazy interior loading and restoration of gallery lighting.

## Booklet in the scene (29 October 2026, prototype in review)

Detailed implementation and tuning reference: [BOOKLET_ANIMATION.md](BOOKLET_ANIMATION.md).
It covers the roll geometry, object lifecycle, shared camera, landing corrections, current
parameters, rejected approaches and regression checks.

The booklet is no longer an overlay with its own LeafThrough canvas. LeafThrough's (0.1.6 now)
`LeafThroughObject` draws it in the gallery's own scene, with our renderer, camera, lights and
environment, so it is a third view beside the open case and the player, built the same way.

- **Out of the case** (`openBooklet()`, `updateBooklet` in `scene.ts`, `read` 0 to 1):
  the booklet feeds over an imaginary cylinder beside the case spine, like paper drawn over a
  roll. The cylinder diameter is 284 mm, two closed jewel-case widths (broadened again after visual
  review to soften the bend). Each vertex follows a
  straight entry, a circular surface, and a straight exit: curvature travels through the same
  page stack, with its front and back attached. It straightens with the **front cover facing us**.
  A rigid object moving on a circular trajectory was explicitly rejected in review; so was the
  earlier extract → level → carry → separate flip sequence.
- **Edge lift, carry and return** (same review): gently lift the exposed edge into a short
  14 mm / 22° entry bend just beyond the holders; on phones the entry angle also clears the
  partly raised disc half. The remaining paper stays flat and compressed under the holders.
  A single continuous ease feeds the paper over the cylinder, while carrying and turning overlap after the
  trailing edge is free. The shader expresses each sheet about the centre's tangent, becoming
  the original formed page geometry again at the end, without swapping objects. Closing plays
  the same roll backwards. After matching the case transition to Listen, `readDuration` is 2.4 s and `unreadDuration`
  1.9 s. It reaches reading size during the roll, with no zoom after it has turned over. Flight bounds
  keep the curved stack within the viewport. The case only pans upward, at constant depth,
  as it does for the player/list view. Per-frame tray-overlap corrections made the case shake;
  both those corrections and the subsequent depth retreat were rejected and removed. The
  latest increase to a 355 mm cylinder was also reverted in review; the radius is back to
  the previous 142 mm (284 mm diameter). Flight bounds use the roll path, with room for the
  formed stack's bulge. The immediate `seatInBooklet` on closing
  from commit `df861ee` is preserved.
- **Motion tuning** (same review): the Listen-style two-wave experiment was reverted at the
  user's request. The booklet uses a continuous roll and carry,
  with case-transition durations subsequently aligned to Listen (2.4 s / 1.9 s). The requested **75° curl of the paper itself** is
  controlled separately (`bookletBendAngle`) from the 284 mm travel diameter; changing one
  does not tighten or widen the other. The case keeps its constant-depth upward-only exit.
  The experimental Booklet motion dashboard, playback/scrubbing controls, browser-persisted
  overrides and associated dev-only API were removed at the user's request. Further tuning
  proceeds through prompts; all defaults remain in C at the top of `scene.ts`.
- **Placement/clearance regression fixed** (same review): restoring the continuous timing had
  retained an incompatible placement change. Paper still under the holders now follows its
  own bend centre; the wider travel blends in only during carry. Screen fitting no longer
  pushes the booklet backwards through the case. It fits the paper's scale/vertical position,
  alternates that with clearance above the tray and below the lid/lips using a continuous
  apron beside their edges, and leaves the box at constant depth. The apron includes a margin
  for solid edges between bound samples. On phones, the box's upward pan is gated by actual
  extraction clearance, so its tilted lid cannot sweep through the still-retained paper. Bounds include the formed stack's bulge, sampled
  across the width and height; all scratch storage is reused. No two-wave timing, box retreat,
  or delayed post-turn zoom was reintroduced.
- **Case appearance and exit match Listen** (same review): both use `viewPan`, the same
  power3InOut curve and full 0.5-duration pan interval, with the same 2.4 s open / 1.9 s return
  duration. The booklet starts its case pan once the paper clears the holders; multiplying a
  shorter pan by extraction progress had made the case abrupt. The case also shares Listen's
  lens throughout the booklet view: the former fixed camera made the case appear larger.
  An extra return to the gallery lens during landing caused a perspective change and was
  removed in review. Listen and Booklet retain the same camera viewpoint; return follows
  the same path. Case depth and scale stay fixed. `scripts/check-case-transition.mjs`
  compares projected case geometry at matching pan positions, verifies the shared lens
  throughout, and checks both durations against Listen.
- **Landing ease, angle and size** (same review): the continuous roll and carry use a
  quintic smootherstep ease, with zero velocity and acceleration at both ends. The reading
  pose accounts for the raised Listen camera, preserving the intended projected page height
  and viewing angle. Framing caps the projected stack height at its final reading height,
  preventing the desktop zoom overshoot and subsequent shrink. It compensates vertical
  projection at the paper's actual flight depth, including landscape lens shift, so landing
  no longer dips below its final screen position then rises back. The same padded bounds
  define the ceiling and final pose, preserving the reader handoff. GPU checks include
  projected zoom after extraction, landing centre and angle, handoff scale, clearance, and
  exact reverse playback at all three sizes. The case keeps its Listen-matched pan.
- **A booklet from the beginning** (same review): each case contains a `LeafThroughObject`,
  with the actual number of printed sides (`bookletPageCount` in the collection metadata),
  cover and back artwork, and blank interior sheets. The paper has the same grain, wrinkles
  (`bookletWrinkles`, 0.25), bulge (`bookletBulge`, 1), and nested page structure as the reader.
  Its resting shape is compressed to `bookletCompression` (0.14) under the holders and relaxes
  after extraction. The 1.2 mm invisible box is only a picking bound. `withBend` bends the
  already-formed sheets and their shadow passes together, preserving the paper's own shape.
  Interior images are requested only when opening, then replace the blank sides; page counts
  come from the existing local scan dimensions, with spreads counted as separate printed sides.
- **Reading**: the very same page object moves out of the lid and into the reader, without
  swapping a thin box for a thick stack. It stays on its first cover until a page is turned;
  the automatic opening at the first spread was removed in review. The reader keeps
  the spread centred (`bookletShift`, `bookletCentreFollow`): an open spread as soon as it opens,
  a closed one (on its cover or back page) only once the last turn has landed. Centring while the
  page still turned read badly in review (the first version did, and closing forced it at once). Pages: the
  cover and back page the case already shows (the print canvases), the inside pages from
  `bookletPages()` in `main.tsx` (scans split into square pages in memory, cached per album, a scan
  that fails left out), and a blank page when needed so the back page closes the spread as a back
  cover.
- **Paper and shadows** (after review, same day): the paper has LeafThrough's grain and its
  show-through (the other side's ink mixed in, 4% for a spread; it only shows on high-contrast
  pages), as in the library's demo; the overlay had turned grain off for no recorded reason. The
  booklet view has its own directional light (`bookletSun`), lit as LeafThrough lights its own
  scene: from `bookletSunAt` in the magazine's frame (its default for a spread, also passed as
  `lighting.sun.position`), on a rig posed with the magazine, with a shadow-catching floor under
  the pages (`bookletFloorShadow`, its default 0.15). Pages shadow each other and the floor as they
  turn; the flying booklet casts on the floor too, so its shadow is there before the hand-over.
  The light fades in as the booklet arrives, the floor's shadow only as it lands (in flight, high
  over the floor, its shadow there was large and heavy). The light always casts shadows, dark outside the
  booklet view, since switching that (or hiding the light) would recompile every material, and the
  shadow map is only redrawn while a booklet is out (`shadowMap.autoUpdate`); it is drawn once in the
  first frame, since every lit material samples it and, before it existed, each draw was a WebGL
  error (`Mismatch between texture format and sampler type`). Only the booklet casts and takes
  shadows.
  Spine review against the live library demo: the shadow/contact pass was already present, but
  half-strength bulge and the gallery's extra fill lights flattened the fold. Reading now uses
  the demo's full page bulge, directional intensity 2, and hemisphere fill (white sky, `#a1aeaf`
  ground, intensity 1.5 for spreads / 1.7 for single pages). Gallery key, fill, rim, strip, ambient,
  and environment lighting fade away as the booklet arrives and restore on return. Single-page
  shadow intensity is 0.4, matching the demo. Compression is 0.14 inside the case, preserving
  clearance with the fuller resting shape. The library supplies the spine shading; no painted
  shadow was added. Visually compared settled spreads in the live demo and the local viewer.
- **Back** (`closeBooklet()`): the pages turn back to the cover, the booklet takes the magazine's
  place again and the path plays backwards. The page object remains in its case for reopening;
  its resources are disposed when the collection or scene is destroyed.
- **Phones** (`narrowWidth` or less): LeafThrough's `single` layout, one page `bookletFitNarrow` of
  the width; a spread was about 160 px tall at 390 × 844.
- **Page**: Booklet calls the scene; `PointerState` reports `reading`, `bookletOut` and
  `overPage`. Close and Escape close it; outside clicks do nothing for both the booklet and the
  open case. The arrows (in their usual places, "Previous/Next booklet pages") and the arrow keys turn pages, Home and End go to the
  covers. Booklet and Listen come back once the booklet is back in the lid. Keyboard focus goes from
  Booklet to the next-page arrow and back. A visually hidden live region announces the pages shown,
  since the object has no DOM. Over the pages the bubble says what a click does: "Next" right of the
  spine, "Prev" left of it (the scene reports the side, `overPage`, from the pointer's ray in the
  magazine's frame), nothing when there are no pages that way or beside the booklet. The system
  cursor is a pointer there.
- **Routes**: `#/<id>/booklet` opens the case and the booklet at once (`readOnReveal`,
  `show(index, open, listen, read)`); Back and Forward between `/open` and `/booklet` play the step;
  the wordmark jumps, the booklet dropping out of view like the player.
- Removed: `BookletViewer`, the `.booklet-*` styles, the masthead's z-index over the overlay.

To review: the timing and the path (`readDuration`, the phases in `updateBooklet`), the size and
tilt, the light's strength (`bookletSun`) and the show-through amount, and the
single layout on phones (the next page shows at the right edge under the current one).

Verified in headless Chrome at 1440 × 900, 390 × 844 and 844 × 390: open and close from the case,
the arrow keys, the live region, the centring sampled per frame against `turning` (End and Home),
the bubble's label over each side of an open spread and of each closed cover, a `/booklet` link, the wordmark from the booklet and the browser's
Back to it, frames of the rolling path frozen at fixed `read` values; no console errors or warnings. The
`willReadFrequently` warning is gone too: the former cover-edge sampling was removed with the
box model. GPU sampling of the actual formed page shaders at 1440 × 900, 390 × 844 and 844 × 390
found no intersections with the holders or tray; the resting stack stays between 2.4 and 3.13 mm
inside the lid (its inside face is at 3.7 mm). `scripts/check-booklet.mjs` checks the initial sheet
count, zero early interior-image requests, the shared model, manual first page turn, outside
clicks, Escape, Close, reopening, and restoration of the case lighting, including reduced motion. `scripts/check-booklet-roll.mjs`
uses WebGL transform feedback on the actual page shader to check the travelling bend, holder/tray
clearance, a steady and reversible paper/case trajectory, and a flat handoff to the reader at all three sizes.
After the placement fix, the full 201-pose GPU clearance check passes again at all three sizes,
including the lid plate, flanges, stops, holders and tray. The reverse
pass compares the paper's position, orientation, scale, bend and compression as well as the box
path. The box stays at constant depth. Real-time Chrome playback measured 16.7 ms median and
95th-percentile frame intervals at 1440 × 900 and 390 × 844; placement cost was 0.1 ms median,
0.5 ms at the 95th percentile (0.4 ms on portrait mobile). The dashboard was subsequently removed without changing these placement calculations. `npm run build` passes.

## Hash routes and jumps (29 October 2026)

Solid stays (dropping it for plain TypeScript was considered: it is about 7 KB of the 315 KB
gzipped bundle, nearly all of which is three.js, and `main.tsx` leans on its signals, effects and
cleanup throughout), and its router now holds the page's state.

- **Routes in the hash** (`HashRouter` from `@solidjs/router`): `#/<id>`, plus `/open`, `/listen`
  or `/booklet`. A hash needs nothing from the server but the page, so links work on GitHub Pages,
  which has no single-page fallback; `vite.config.ts` sets `base: './'` so the build runs from a
  project subfolder. `.github/workflows/deploy.yml` builds every push to `main` and publishes
  `dist/` to Pages (Settings > Pages > Source must be "GitHub Actions"). One route,
  `/:album?/:mode?`, with `matchFilters` for the album ids and the modes: moving between its views
  keeps the same component, so the scene is never rebuilt. Any
  other hash (an unknown album, a typo) goes to `#/`. Old `?album=<id>&open` and `&listen` links
  are moved into the hash as the page loads (`moveQueryToHash()` in `band.ts`); `?band=` and
  `?home` are dropped.
- **The booklet has a route**: `#/<id>/booklet`. A link opens the case at once and the booklet
  with the reveal.
- **History** (`Gallery` in `main.tsx`): browsing the row replaces the entry; each view adds one
  (the open case, then the player or the booklet), recording the path it came from in
  `history.state.parent`. Leaving a view in the page (Back, Escape, Close) goes back to that
  entry rather than adding another, so the browser's Back never has to step
  through the same view twice. A change written while that back step is on its way waits for it.
- **The wordmark** is a link to `#/`. From the player or the booklet it jumps there (below); on an
  open case it only closes it, as Back does. Neither resets the gallery. On the row, where a click
  would do nothing, it is plain text instead of a link: no bubble over it, not in the tab order,
  and the pointer passes through to the row.
- **Jumps**: any change of the hash the gallery didn't write (the wordmark from the player or the
  booklet; the
  browser's Back and Forward; a link pasted into the tab or the hash edited) no longer plays the
  steps in between (eject, close, slide along the row). The view leaves in one move and the gallery
  starts again on the link's view with the intro, as if the page had opened there
  (`GalleryScene.show(index, open, listen, onShown)`). The player drops `leaveDrop` out of view
  and the booklet slides down, over `leaveDuration` (0.6 s); the gallery fades out meanwhile (at
  once behind the booklet, after the player has gone in the player view), and the bottom bar, Back
  and the transport row fade with it. Then the scene resets unseen and the gallery fades in with
  the intro (0.7 s, as on the first reveal). With reduced motion the new view appears at once.
  Input is off while the view leaves, and a jump during a jump only changes where it lands. The
  controls in the page keep their step animations.
- **Rejected for jumps**: shrinking the cases away (the intro backwards) before the new intro. It
  read as the gallery resetting itself in view. A first version also left each case where it was
  (cases ease toward their place), so the old open case visibly shrank into the new intro;
  `restart()` now marks every case unplaced so it starts where the intro starts.
- **Back is now Close or Eject**: the top-left button says what it does, in the words the bubble
  already uses over the scene: "Close" on an open case (back to the row), "Eject" in the player
  (the disc back to its case), without the arrow "Back" had, since the word says it. The word changes as the disc goes in or out, fading
  out and in over 0.2 s like the caption. "Back" didn't say where it went. Elsewhere in this file
  "Back" still names this button. It and GitHub now only fade in and out; they used to slide 8 px
  in from the left as well, the only slide among the page's controls.
- **About page** (`#/about`): what the project is, four short paragraphs (no album count, so the
  text holds whatever the collection has; a link to LeafThrough, which turns the booklets), and
  "Made by Dmytro Barylo" at the bottom in the old title screen's credit style. "About" sits in the top-left corner
  on the row only; Close or Eject take that place in the other views, and Close (or Escape, or the
  wordmark) leaves the page. It is the gallery's own route (`path={[aboutPath, ...]}`), so nothing
  is rebuilt: the row fades out (the stage's `is-hidden`) and the text fades in, and the row comes
  back exactly as it was. It counts as a view one deep, so Close returns through the history. A
  jump to `#/about` from another view restarts the gallery on the row of the album in front,
  hidden, behind the page. On landscape phones the text is smaller and scrolls under a fade below
  the top bar if it must.
- **One step through the history plays as a step**: when a change of the hash the gallery didn't
  write lands one step from the view shown (mostly the browser's Back or Forward), it plays as the
  page's own controls would: the case opens or closes, the disc goes in or out, the row slides to
  another album. Only further moves (the wordmark from the player or the booklet, several entries
  at once, a distant link) and moves that arrive while the view is still changing jump. The first
  version jumped on every Back and Forward too (a decision from the first review, revised).
- **Jumps to the view already shown**: the browser's Back from the about page or the booklet lands
  on the view still under it, so only the page or the booklet goes; no intro replays.
- **The caption opens the album on the row only**: in the other views it was a button too (on an
  open case it put the disc in the player), which Booklet and Listen made redundant. There it is
  disabled now: it only names the album, and still takes clicks, doing nothing, so a click on the
  title of an open case doesn't count as a click beside it. Keyboard focus moves to what takes the
  place of a control going away. As a case opens: About to Close, the arrows to Booklet or Listen
  on their side, the caption (disabled then) to Listen. As it closes, and after an eject: Close to
  About in the same corner, Booklet or Listen to the arrow on their side, the transport row or a
  store link to Booklet or Listen on their side after an eject. Focus is read before Booklet and
  Listen go inert as the case closes (inert dropped it, so that hand-over never worked before).
- **The plain dot over disabled buttons**: over the disabled caption, and the first album's Prev or
  the last one's Next, the bubble is the plain dot, as over the plain wordmark, with no label (a
  click does nothing there). Before, the caption showed the system cursor, and the disabled arrows
  showed no cursor at all: Solid's delegated handlers skip disabled buttons, so the bubble's move
  handler never ran over them. It is a native listener on buttons now.
- **No input during a view change**: while the intro or a jump plays, a case opens or closes, or
  the disc goes into the player or back (`viewBusy()`, reported as `busy` with the pointer state),
  Back, Escape, Enter, Space, the wordmark, the caption, Booklet, Listen, clicks and drags on the
  scene, and the wheel while a case opens or closes do nothing; before, they reversed or cut into
  the animation. Moving along the row still works (arrows, keys, clicks on another case once
  nothing is opening or closing). The browser's Back is a jump and still interrupts.
- **The wordmark over the booklet**: the masthead sits above the booklet overlay while it is open,
  level with its heading row (on phones the heading moves below it), with the plain cursor, since
  the bubble is drawn under the overlay.

Verified in headless Chrome at 1440 × 900 (390 × 844 with reduced motion): the hash and
`history.length` after each step (reveal, open, player, wordmark, browser Back to the player,
Escape, booklet, a hash edited from the booklet, open and Escape on another album, an old query
link, an unknown album, a booklet link); screenshots of the player and the booklet half way out
and of each landing view; the jumps from the player and the booklet recorded frame by frame with
the DevTools screencast (no old view between the exit and the intro); the booklet with the
wordmark at 390 × 844 and 844 × 390; no console errors. `scripts/check-insert-path.mjs` passes,
`npm run build` passes.

## Mobile view (29 October 2026)

- **Phones, the open case's disc half lit like the booklet's**: opened like a book, the disc's half
  turns away from the bright part of the environment map, and the disc went dull and dark next to
  the booklet (lying flat it reads silver). Measured on a patch of the disc, nearly all of its light
  is the environment's (38 of 38 with the direct lights, 11 without the environment); moving the key
  and fill lights to the middle changed it by 1 and was dropped. Instead each disc has its own
  reference to the environment (`envMap`, at the scene's strength, so nothing changes elsewhere) and
  its reflections turn back by the half's turn (`envTurn`, in `layout`), so it reads as it does flat:
  the patch went from 38 to 63. Reset for a disc out in the player. The tray's material is shared
  by all cases, so it stays as it was (satin black either way).
- **Phones, links at 16 px**: Back, GitHub, Booklet, Listen, Apple Music and Buy the CD (18 px on
  desktop, 15 px on landscape phones). Back and GitHub moved 1.1 px down to stay level with the
  wordmark.
- **Landscape phones, balanced gaps**: the wordmark is much shorter than the caption, so a case
  centred on the screen had about 40 px above it and 20 px below (45 and 11 px open). The picture
  is now raised by a view offset in `setLens` (no change of perspective, and nothing moves in the
  scene, so the insert path is untouched): `rowRaiseShort` (10 px) for the row, blending into
  `openRaiseShort` (17 px) as the case opens, gone in the player view. Measured at 844 × 390,
  667 × 375, 932 × 430 and 740 × 360: the gaps above and below are within 3 px of each other.
- **Landscape phones, player**: it had 17 px above it and 32 px down to the transport symbols. It
  now sits lower (`playerRaiseShort` 0.24, was 0.28) and the transport row closer under it (its
  margin, 12 px instead of 20 px, in `style.css`), the row at the same height as before (within
  1 px): about 24 px above and below.
- **Open case on phones, opened like a book**: on screens `narrowWidth` (650 px) wide or less the
  lid opens to `lidOpenAngleNarrow` (110°) instead of lying flat at 180°, and both halves rise
  equally from the hinge into a V toward the camera, the spine in the middle of the screen: the body
  turns back about the hinge by (180° − angle) / 2 and slides so the hinge sits at the centre (flat,
  this is the desktop's slide, unchanged). The pick plane covers the V's width. Flat, the open case
  ran into both edges of a 390 px screen; a first try opened only the lid to 120° from a flat body,
  which left the case off-centre.
- **Scaled to fit**: there the open case is scaled (`openFit`, from `openCaseWidth()`, which
  projects the V's outer corners through the gallery camera when the screen changes) to the
  screen's width less `openFitPadding` (32 px) each side; measured gaps 33 to 36 px at 390 and 320 px
  wide. So a smaller angle draws the case bigger. Compared: 100° (deeper V, disc darker as it
  turns from the light), 110° (chosen), 120°. The insert path check still passes at every size.

- **Row spacing on phones**: `hGapNarrow` (0.9) of `hGap`, so the neighbours show beside the front
  case instead of at the screen's edges. Measured gaps between case edges at 390 px wide (left /
  right, uneven from the row's perspective): 0.8 gave 4 / 17 px, too tight; 0.9 gives 28 / 47 px;
  1.0 (the desktop's) 52 / 77 px. 0.6 and 0.7 overlapped the front case.
- **Player controls on phones**: 17 px symbols, buttons about 51 × 45 px for a fingertip.
- **Track under the controls on phones**: number and title of the current track (the player's
  screen is too small to read there), one line with an ellipsis; the line keeps its height while
  stopped so nothing moves when a track starts. A change fades the old track out and the new one in
  (0.2 s each, like the caption). Hidden on wider screens.
- **Top bar centred**: Back and GitHub now line up with the wordmark by the middle of their capitals
  (cap top to baseline), on phones and desktop (`top` 18.25 and 36.75 px). The first alignment
  matched whole ink centres, which counted the wordmark's descenders and left them 3 to 4 px low;
  measured now within 0.75 px.
- **No player on a double click**: a case counted as open from the start of its opening, so the
  second click of a double click on a closed case (or a caption clicked twice, or Enter pressed
  twice) put the disc in the player. The disc, the booklet and `insert()` now wait until the case
  has finished opening (`fullyOpen`); opening from a link is still immediate.

- **Smaller caption everywhere**: the album title 40 → 34 px on desktop and 32 → 28 px on phones,
  the artist line 18 → 16 and 15 → 14 px.
- **Phones turned sideways** (`max-height: 500px` and landscape, `shortHeight` in the scene): the
  type round the graphics is smaller and closer to the edges (wordmark 22 px, Back and GitHub 15 px,
  caption 13 / 24 px, side links 15 px), and the graphics take the height: the open case lies flat
  and is fitted between `openFitShortMargin` (72 px) top and bottom (as well as the width), and the
  player is `playerScaleShort` (1.25) bigger and `playerRaiseShort` (0.28) up, so its controls end
  9 to 14 px above the caption (they overlapped it before). Checked at 844 × 390, 667 × 375 and
  932 × 430; the insert path check now covers 844 × 390 and 667 × 375.
- **Bottom bar centred**: the side controls (arrows, Booklet and Listen, Apple Music and Buy the
  CD) were pinned near the title's baseline, 6 to 11 px below the middle of the caption. They are
  now centred on it (artist line's cap top to the title's baseline), the arrows 2 px higher for
  their low glyph except at the landscape size: measured within 0.3 px on desktop, landscape and
  phones. On phones upright the side links still sit a row above the caption.
- **Top bar in landscape** aligned the same way as on desktop and phones (`top` 10 px, within 0.5 px).

## Player view without the tracklist (29 October 2026)

The tracklist panel is gone. The player is centred (`playerRest` x = 0, `playerRaise` 0.1 of the
half-height up) and larger (`playerScale` 0.5 to 0.7, about the open case's height on screen:
660 × 385 px at 1440 × 900); narrow screens shrink it by `halfWidth / 1.4`. `playerShift` is gone.

- **Transport row** (`.transport`) centred under the player, above the caption: the player's four
  buttons again (`PLAYER_BUTTONS`), with the same symbols as SVG (`playerIcon`, matching the
  scene's `playerMark`) in ink. A first version with arrows, a "Play"/"Pause" word and the
  track and time in mono under it was rejected: the player's screen already shows the track and
  time, and the row should repeat the player's own controls. The buttons call `scene.pressButton`,
  so the player's own buttons move too; keyboard focus on one lights its symbol (`focusButton`). They replace the
  invisible stand-ins laid over the 3D buttons (`PlayerControls`, `playerButtonRect`, removed).
  It fades in once the disc has landed (1.7 s), as the tracklist did. Tuned after review: 13 px
  symbols, 12 px apart, the row one 40% see-through layer (full while a button has a keyboard
  focus ring; per-button fades left half-faded symbols round the dot on a quick sweep), and 20 px under the
  player's lowest edge, which the scene measures (`playerBottom()`, the player at rest in the
  player-view camera) when the view starts and after a resize; a fixed CSS offset could not follow
  the player, which scales with the height on wide screens and with the width on narrow ones.
  A press dips the symbol to 70% and lets it spring back (`.is-pressed`, 90 ms), set from the
  scene's `onPlayerButton`, so a click here, a key, or a click on the 3D button all show it.
- **Cursor ring** over the 3D player's buttons is half see-through (`--bg-center` at 50%).
- **Nothing works until the disc has landed.** The scene's `seated` (in `PointerState`) is true
  from the end of the insert until `eject()` starts. Until then the player's screen stays dark (it
  used to show the album while the disc was still flying in), its buttons ignore the pointer and
  `pressButton`, Space does nothing, and the transport row stays hidden; it fades in (0.5 s) when
  the disc lands rather than after a fixed 1.7 s, and keyboard focus moves to Play then.
- **Only Play starts the music, as on a CD player**: unless a track is playing, next and previous
  change the track and show it at 0:00, paused; Play starts it. While playing they play straight
  away. Stopped counts as sitting at the first track, so Next from a stop cues track 2 and Previous
  cues track 1. Changing track drops the old preview at once, so Play pressed while
  the new one loads can't resume the old one.
- **The player leans toward the cursor** once the disc has landed, like the open case, at
  `playerHoverTilt` (0.35, first 0.5, which felt too strong) of the open case's tilt: up to about
  1.7° (the open case about 4.8°). It
  eases in and out like a case's hover, back to rest as the disc leaves or the pointer leaves the
  stage; the landed disc moves with it. `playerBottom()` measures the player level, so the
  transport row stays put.
- **Ejecting brakes the spin**: a disc taken out while it turns slows with `spinDownEject` (0.25 s)
  instead of the pause's `spinDown` (1 s): from 200 rpm it is at 49 after 0.4 s and nearly still by
  1 s, against 134 and 73 after a pause.
- **The landed disc ejects on a click**, as Back does: the cursor bubble says "Eject" over it
  (the scene reports `overDisc` for the seated disc too, not where a button is), and the system
  cursor is a pointer there.
- **No gaps in the transport row**: the 12 px between the buttons belonged to the row, which was
  not a bubble surface, so moving across one showed the system cursor and dropped the dot. The
  buttons now touch (padding 8 px 15 px, same symbol spacing) and the row is a bubble surface.
  Checked by sweeping the pointer across the row a pixel at a time: no system cursor, the dot
  always shown and the right size.
- **The dot shows the whole transport row**: moving slowly right to left across the row still
  left a neighbouring symbol half under the dot in its own colour, since each button had its own
  clone and the symbols sit closer together than the dot is wide. The row is now a bubble group
  (`data-bubble-group`): hovering any of its buttons clones the whole row once, and moving along
  it keeps that clone, so every symbol under the dot shows in beige, whichever way the pointer
  goes. Per-button changes (the press dip) are still mirrored into the clone.
- **Hovered text and icons are the page beige** (`--bg`), not white: the clone inside the dot, the
  bubble's label and the tag.
- **Bubble clone in step with the dot.** Moving fast between the small transport buttons showed a
  symbol half white: the clone's clipping circle grew on its own easing while the dot grew on its
  CSS transition. The circle's radius is now read from the dot's rendered size every frame while
  its transition runs (`follow` in `createBubble`).
- **The disc never goes into the player.** The insert path (lift, carry, hover, drop) cut through
  the player's side while it was still rising: 8.5 mm deep at 1440 × 900, 1.8 mm at 1024 × 1366,
  clear on phones. `updatePlayer` now finishes every frame by checking 108 points of the disc in
  the player's millimetres and pushing it straight up the player's axis until every point is
  `insertClearance` (3 mm) above the top, or above a 45° slope down from the top edges near the
  sides (so the push starts gently instead of jumping), or above the well's floor over the well (so
  it still lands on the spindle). This holds whatever the path or the screen's shape does; the eject
  is the same path backwards. `scripts/check-insert-path.mjs` checks it (see Verifying changes):
  clear at eight sizes from 320 × 640 to 2560 × 1080 for three albums, and the largest step between
  samples is 2.2× the 90th percentile (1.6× without the push), so it speeds up over the edge but
  never jumps.
- **Bottom row stays in the player**: the caption (inactive there, it only names the album) with
  **Apple Music** left and **Buy the CD** right, the third pair in the arrows' places, handing over
  from Booklet and Listen the same way. They appear once the disc has landed, with the transport
  row (`seated`), not as it leaves the case, and fade in and out exactly as it does (`.store-link`:
  no wait for the pair before, which is long gone by then). Booklet and Listen come back only once
  an ejected disc is back in its case (`discOut`), not as the eject starts (both changed 29 October,
  later; checked by sampling the opacities every frame).
- **Playback** moved from the `Tracklist` component into `createPreviews` (no DOM): same buttons
  logic, tracks without a preview are skipped.
- **Focus**: Enter on the caption or Listen by keyboard moves focus to Play; leaving the player
  from the transport row or a store link by keyboard returns it to the caption.

Verified in headless Chrome at 1440 × 900 and 390 × 844: layout, keyboard insert to Play, play,
next, pause, Escape back to the open case, no console errors.

## Open case controls (29 October 2026)

The "Open booklet" link above the caption is gone. While a case is open, the cursor bubble says
"Booklet" over the booklet (the scene reports `overBooklet` beside `overDisc`), as it says "Listen"
over the disc. For touch and keyboard, the bottom row shows **Booklet** on the left and **Listen**
on the right (`.case-action`, the corner buttons' italic) in the arrows' places. The two pairs hand
over in turn: the outgoing pair fades out in 0.3 s, then the other fades in (shown at once for
focus, only the fade delayed), measured in Chrome both ways. On phones (650 px and narrower) the
pair sits a row above the caption, since at 320 px Booklet overlapped "Californication". Focus on
either goes to the caption when the case closes by keyboard; Listen by keyboard moves focus to the
tracklist, as the caption does.

## Single page (29 October 2026)

The gallery is the only page; the project description lives in `README.md` on GitHub instead of an
introduction screen. Removed: the title screen (`Home`), the artist list (`ArtistList`), the band
logo or name in the masthead (`BandMark`, which read "× TEN FAVORITE ALBUMS"), `loadBands()` with
`public/bands/index.json`, the curtain that faded between views, and the Albums menu (the list of
the ten albums; the row, its arrows and the keys already reach every album). The masthead is the
plain "Discography" wordmark, no longer a link. Top right, where the menu button was, a "GitHub"
link (`.github-link`, styled as a corner button) opens the repository in a new tab; the credit
that was on the title screen is at the bottom of the about page.

The README only says what the experiment is about, for visitors to the repository (the user's
decision): no album list or count, since the collection can change, no credit line, and nothing
for developers (running it, scripts, deploys, controls key by key); those live in this file.

URLs drop the band: `?album=<id>`, plus `&open` or `&listen`. Older `?band=favorites&album=<id>`
links still open that album; `?home` opens the gallery. `tidyUrl()` (in `band.ts`) rewrites any
such address as the page loads, without a history entry: unused parameters go at once, an unknown
album once the collection has loaded. Tabs opened before the change still hold `?home` entries in
their history, and the browser's Back button can land on one; the address is clean again within a
moment instead of after the intro. On
phones Back and GitHub now sit level with the wordmark (`top: 21.5px`, scaled from the desktop
measurement), since no wide logo shares the top row any more.

Verified in headless Chrome at 1440 × 900 and 390 × 844: gallery and open case, no console errors,
old links rewritten, `npm run typecheck` and `npm run build` pass.

## Mixed-artist collection (29 October 2026)

The root URL now opens one mixed-artist gallery. `public/bands/favorites/band.json` holds the ten
selected albums; the former artist folders remain as source data. The album caption names its artist.
Each album's `sources` entry records the exact edition and image used for its cover, disc, back insert
and booklet.

Every front is official digital artwork at 1200 px from Apple Music; each disc is a roughly 1200 px
physical scan. `makeArtTexture` trims 1.2% inside the detected disc circle to keep the scanner
background off the visible rotating disc. This is a render crop; the scan files remain unchanged. All
ten have booklet-back art and locally archived interior booklet scans. When an archived image is a
spread, the viewer separates its pages in memory; `bookletFit: contain` keeps each complete half-spread
at its proportions, extending only the outermost pixels into the narrow square padding. A back insert
scanned without its spines gets generated spines (`makeInsertCanvas`).

Clicking the booklet in the open case or **Booklet** in the bottom row opens a LeafThrough viewer. It supports
turning, previous/next controls, keyboard input and Escape to return to the case. The page sequence
uses the archive's order where clear. Some archives do not label every page, and special folded
inserts are not fully reconstructed yet. This viewer is a working visual demo; the more ambitious
lift-and-handoff animation described under Phase 2a below is still a possible refinement.

`scripts/fetch-tracks.mjs` caches Apple album lists per artist, so it can populate mixed-artist
collections. `appleMusicCountry` selects the storefront for both the preview lookup and the store
link, and the preview cache includes it; a track without an Apple ID is listed but skipped by the
player. Each album has a regression check, `scripts/check-<album-id>.mjs` (after
`check-moon-safari.mjs`): it opens the booklet and asserts the page count and that every interior panel
is drawn whole, then plays each available preview on desktop and mobile. Run one against a dev server:
`PLAYWRIGHT_CORE=../leafthrough/node_modules/playwright-core/index.mjs node scripts/check-<id>.mjs http://127.0.0.1:5174/`.

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
# #/ opens the gallery; #/<id> brings an album to the front, #/<id>/open opens it, /listen puts its
# disc in the player and /booklet opens its booklet (the page keeps these up to date).
```

## Phase 0: what is implemented

### Files

| File | Role |
| --- | --- |
| `src/scene.ts` | Everything 3D: the `GalleryScene` class (called `DiscScene` in phase 0), materials, shaders, input, motion, loading. All tuning lives in the `C` object at the top. |
| `src/main.tsx` | Solid app: loading screen, masthead, GitHub link, caption and album arrows, bubble cursor, keyboard shortcuts, routing. Talks to the scene through its public methods. |
| `public/bands/<band>/band.json` | Everything band-specific (since phase 1; was `src/data.js`): `name`, optional `logo`, optional `theme` (`background`, `backgroundCenter`, `backgroundEdge`, `ink`; no band sets one since the pre-phase) and `albums`. Each album: `id`, `title`, `year`, `kind`, `cover`, optional `disc`, `back`, `bookletBack` and `tracks`, `color`, `accent`, `motif` for generated art, and `musicbrainz` (`releaseGroup`, optional `bookletBack` pick) for the download script (see the pre-phase for its pinning options). Paths are relative to the JSON file. The page loads `favorites`; the other folders hold source artwork it points to. |
| `src/band.ts` | Types for the band and album JSON (`BandConfig`, `AlbumConfig`) and what the page gets (`Band`, `Album`). Loads a band, resolves its paths and adds the band name to each album. Documents the JSON shape. |
| `src/style.css` | Page shell (warm beige background with a light grain overlay, bottom bar, loading screen). |
| `scripts/fetch-tracks.mjs` | `node scripts/fetch-tracks.mjs <band> [album id ...]`: writes each album's CD tracklist (MusicBrainz) and its Apple Music match (album and track IDs, for previews) into `band.json`. See phase 2b. |
| `scripts/download-covers.sh` | `download-covers.sh <band> [album id ...]`: fetches covers, disc scans, back inserts and booklet back pages for the albums in the band's `band.json` from MusicBrainz and the Cover Art Archive, and writes the paths it found back into the JSON. A failed image keeps the existing file. |
| `public/bands/<band>/` | The band's `band.json`, `logo.svg`, and local artwork in `covers/`, `discs/`, `backs/`, `booklets/`, so the demo runs without network access. |

### Scene API used by the UI

`new GalleryScene(element, albums, onIndexChange, { onProgress, onReady, onPointer })`, then `reveal()` once
`onReady` has fired and the page is ready to show it, `step(delta)`,
`goTo(index, source)`, `toggle(index?)`, `open(index?)`, `close()`, `show(index, open, listen,
onShown)` (a jump, see Hash routes and jumps), `setAlbums(albums)` and `destroy()`. The scene owns the position and reports the front case through `onIndexChange`.
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
| Rim | 0.978 to 1 | No clear rim: the hairline rim (a faint thin-film shimmer) read as a white line round the disc and was removed (29 October 2026). The print stops at `discPrintEdge` (0.978) and the band outside it is the near-black `discFallback`, the colour wherever art is missing: a scan's last pixels can hold scanner background, which the spinning disc smeared into a white ring. |

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
- **Seams:** the hub tucks under the artwork rings (`seamOverlap`) so no background shows
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

### Design decisions from review (do not reintroduce)

These came from rounds of feedback on the look. Each was tried and rejected:

- Changing the player's spin speed (29 October 2026). A real CD's speed, about 500 rpm on the
  first track slowing track by track toward 200 as a constant-linear-speed disc does, looked weird;
  fixed 400 and 260 rpm looked too fast. `spinRpm` stayed at 200, until the disc's moving metal
  read as too much (same day, later): now 150, between that and the 100 rpm found too slow before.
- Refraction through the hub (blurred artwork, double render cost).
- Three stepped hub rings with ripples (looked like shadows and steps).
- A wide, chrome-like rim (looked like a grinding disc). Later even the hairline clear rim read as a
  white line round the disc, in the case and in the player, so the disc has no rim now.
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
- `scripts/check-insert-path.mjs` (with `npm run dev` running) samples the disc's insert and eject
  path at ten screen sizes (phones turned sideways included) and exits with 1 if any point of the disc goes into the player. It
  needs `playwright-core`, for example
  `PLAYWRIGHT_CORE=../leafthrough/node_modules/playwright-core/index.mjs`. The dev server exposes the
  scene as `window.scene` for it (`import.meta.env.DEV` only).

The lifecycle, roll, case-transition and insert-path checks run on the current gallery: *Surrender* as the
thin eight-page booklet, *Mutter* as the thick sixteen-page one and *Citizen of Glass* for the lazy
interior requests (three spreads). Earlier notes name the albums they were first run on (*Nevermind*,
*Kid A*, *X&Y*), which have since left the gallery.

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
- **Same lighting open and closed:** the disc print and its clear hub reflect the same
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

Goal: a front page for the project, and more artists than Nirvana: The Prodigy, The Knife,
Rammstein and Crystal Castles were added (their folders remain as source data). Booklet interiors
were still phase 2a work.

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
- **Album state in the URL** (since replaced by hash routes, see Hash routes and jumps): `?band=<folder>&album=<id>`, plus `&open` while it is open
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
`leafthrough`, MIT, 0.1.3 at the time of writing; 0.1.5 since the booklet moved into the scene,
0.1.6 since its sheet gap and deform hook, see Booklet in the scene).

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
  Glossy graphite with a matte black edge round the top and a thin ring of polished dark metal round
  the well, darker than the body, with fine scratches and wipe marks from use (the user's final
  call, after white and black versions, and after a glossy light silver edge and ring), posed after a white product photo the user gave. Fixed pose, no hover tilt, in the same perspective scene and camera, so the disc's
  flight into it matches. Shot like that product photo: the player stands level, turned 45° on its
  stand so a corner faces the camera, and the camera is raised to see its top from 26°, still aimed
  straight ahead, so verticals stay vertical (`setLens`; see below). It stands on the page with a soft
  contact shadow; a floor reflection was tried and dropped by the user. Rejected on the way: tilting the player itself (30° and 56°) or turning it 45° like the
  top-loader photos (isometric), which made it read as tipped or warped; and plain perspective from
  the centre, which saw it from the right side since it sits left of centre.
  Slim (18 mm) and only a little larger than the disc (146 mm square round the 120 mm disc). The
  front has a screen that shows the album, then the track playing, and beside it four buttons
  (previous, play, pause, next); the left side a 3.5 mm headphone jack and a band of speaker holes.
  The jack and buttons were added on review (29 October 2026) to make it read as a real player, and
  the buttons work. They were first on the left side by the corner, with a headphones mark printed
  by the jack; the user moved the buttons to the screen's face and dropped the mark. Modelled, not painted (the
  user's call): no textures on the player except its screen and contact shadow. Minimal but
  realistic: no full set of controls, no maker's logo or text.
  Rejected on the way: a brushed aluminium front panel with a "Discography" wordmark (Instrument
  Serif); a speaker grille, side ports and engraved panel lines on the top; a 140 × 40 mm plain box
  with six square buttons and a blue display, not elegant enough; a black anodised version with a
  smoked glass top, a finger notch, round buttons and a knurled knob, after a second reference;
  a glossy white version with the photo's eight buttons, a seven-segment display, a slide switch,
  ports and printed labels (drawn in a small stroke font as shapes), which the user simplified to
  the screen and the grille. Darker, thicker trim and ring were too heavy; later the user asked for
  a thin dark ring and a matte black edge, which read well. The screen was amber, then beige; a 5×7
  dot-matrix font (DM Mono thresholded to the dots) read badly, so the screen keeps DM Sans and DM
  Mono, seen through a fine dot grid.
- **Flow:** a click on the disc in the open case (or the caption, or Enter) switches to the player
  view. The disc does not flip, since a top-loader takes it label up: it lifts out of the tray, the
  row with the case slides up out of view while the player rises into its place, and the disc drops
  onto the spindle. The view then shows only the player, with the disc, and the tracklist. Nothing
  plays until a track is clicked. Back or Escape ejects: the same path backwards.
- **Spin:** only while a track plays; pausing pauses it. 200 rpm (`spinRpm`; 150 since 29 October,
  see the rejected list), the slow end of a real disc, spinning up and coasting down (`spinUp`, `spinDown`). 48 and then 100 rpm were too slow in
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
  in millimetres, y up, the screen face +z and the grille face -x, turned `playerYaw` (45°) so the
  corner between them faces the camera. Body: an extruded rounded square in glossy graphite with
  softened edges, the well cut through it. Top: a glossy graphite pane just proud of the body
  (`makePlayerTopGeometry`), with square edges in matte black (`playerTrim`), the fine line round the top (a
  rounded edge showed at the back, seen almost edge on, as a dotted sub-pixel line); it is shaded
  lighter toward the back in its vertex colours (`playerTopBack`, `playerTop`), as a glossy pane
  mirrors the room. Body and top carry wear (`withPlayerWear`, `playerWear`): the case's wear map,
  mapped onto each face from the model's millimetres, adds fine scratches and wipe marks where the
  surface reflects the room. A thin ring of polished dark metal (`playerMetal`; `makeWellRingGeometry`, a lathe,
  `playerRing`) lies on the pane and slopes down into the well, ending just inside the well's wall
  (where it met the body's cut edge it flickered as a dotted line). The well follows the common
  top-loader layout (the C.E.C. TL53Z manual's turntable and pickup, portable players such as the
  FiiO DM13): a matte black floor (`playerWell`) with one rounded opening toward the back, over a
  cavity drawn from inside (a back-faced box), where the lens (a glossy dome with an iridescent
  coating, in a dark ring) shows on its black sled; the guide rails stay out of sight. Two chrome
  rails and a chrome lens ring read as stray white lines and were removed. The wall is its own
  lathe, so it shades round; the body's extruded cut edge is flat-shaded and showed facets. The
  turntable (`makeSpindleGeometry`) has three steel clamp balls round the pin and turns with the
  disc; it is matte graphite without wear, since it shows through the disc's clear centre (the
  body's clearcoat glared there, and the top pane's gloss was worse). Its surface has a fine grain
  in its colour (speckle, soft mottling and faint turning rings, `makeTurntableGrainCanvas`,
  `playerTurntableSpeckle`) and the case tray's stipple as bumps (`playerTurntableBump`); no
  roughness map, which would make it glossy. Bumps alone barely showed in the well's soft light. Front,
  from the corner, all centred on one line: the screen (`playerScreenMargin` in from the face's
  edges, up to `playerScreenGap` before the buttons), a glossy black pane with its content drawn
  into a canvas (`drawPlayerScreen`; track names need a real font, the one texture besides the
  shadow), lit through an unlit material in `playerScreenColor`, the page's beige, and cut into a
  fine grid of round dots (`playerScreenDot`, 0.3 mm) over faint unlit ones; then the buttons, extruded
  rounded caps in `playerButtonColor` standing proud of a dark seam, their transport symbols
  printed on in the same beige (`playerMark`, flat shapes in `playerPrint`, glowing a little so they
  read beige rather than grey, and half see-through, `playerPrintOpacity`). Left side, built in its own plane (x
  toward the front) and laid out along it by `playerJackAt` and `playerGrilleFrom`/`To`: the jack
  (a collar of the ring's dark metal 0.4 mm proud round a dark socket, near the back end) and a band of speaker holes (an
  instanced mesh, `playerGrille*`). Holes, seams and printing lie a hair off their face with a
  polygon offset so none loses the depth test. Under it, the contact shadow (`playerShadow`): a blurred
  canvas with a tight dark band at the base inside a wide soft falloff.
  The player takes a little more of the room's light (`playerEnvLift`), and the ambient light rises
  by `playerAmbient` in the player view (setLens), which also brightens the disc in the player.
  Black specks on glossy surfaces came from `softReflection`: taking out the direct highlight went
  below zero at grazing angles; it is now clamped at zero (found by hiding the player's parts in
  turn and counting dark pixels).
  Earlier versions painted most of the detail (top plate lines, grille, ports, floor, icons, a
  canvas display in DM Mono); review asked for real shapes.
- **The disc in the player:** its clear outer rim showed as a white line against the dark well,
  and in the open case too, so the disc has no rim (see the disc's zones). Its clear centre
  (`makePlastic` with `side`) draws only the faces toward the viewer: drawn from both sides in one
  pass, the top and bottom faces, 1.2 mm apart, blended in triangle order into a radial pattern
  that read as scratches turning with the disc. The moulded rings on it take their radius per pixel.
- **Buttons** (`pickButton`, `pressButton`, `onPlayerButton`): in the player view, once it is in
  place, the caps are raycast under the pointer. The button under it lights its half see-through
  symbol in full; it does not move (rising on hover looked odd). The cursor becomes a thin beige ring
  round the button (the bubble's quiet mode, 26 px; 22 and 30 px were too small and too big), since a
  grown dot covered the small buttons, and after the usual rest the label (Prev, Play, Pause or Next,
  in DM Sans, not capitals) opens as a tag above the ring. Hiding the cursor there was tried and
  dropped: with no pointer the buttons felt lost.
- **Buttons for the keyboard and screen readers** (`PlayerControls` in `src/main.tsx`): four real
  buttons (Previous track, Play, Pause, Next track) in a group named Player, before the tracklist in
  Tab order, invisible and out of the pointer's way. A focused one is laid over its button
  (`playerButtonRect` projects the cap), so its focus ring, in beige, goes round it, and the scene
  lights its symbol (`focusButton`); Enter or Space presses it (`pressButton`). The cursor's tag is
  only visual (the bubble is `aria-hidden`); these carry the names. A click presses the cap in `playerButtonPress` and lets
  it spring back, and the page's tracklist acts on it as a CD player would: play resumes, or starts
  the first track; pause holds the track; next skips ahead; previous restarts the track after its
  first three seconds, and otherwise goes back one.
- **Screen** (`setDisplay`, `setPlaying`, `drawPlayerScreen`): stopped, the album and artist and
  the number of tracks (dropped when the name would not fit beside it); playing or paused, the play or pause mark, the track number, its title and
  the elapsed time. A title too long for the screen scrolls, faded at both ends, redrawn every frame
  while it does; the screen is redrawn once DM Mono and DM Sans have loaded.
- **Pose and layout** (`resize`): on wide screens (aspect 1.1 and up) the player sits `playerShift`
  of the half-width left of centre with the tracklist on the right; on narrow ones it sits above the
  list (`playerRaise`) and shrinks to fit. It is never rotated.
- **Camera** (`setLens`, driven by the same pan as the transfer): the field of view narrows from the
  gallery's 40° to `playerFOV` (18°) while the camera backs off to keep the z = 0 plane framed (at 40°
  the box was visibly distorted); the camera moves in front of the player and up until it sees it
  from `playerView` (25°) above, still aimed straight ahead; and a lens shift (`setViewOffset`)
  moves the image back by as much as the camera moved, so everything stays framed where it was and
  only the viewpoint changes. `setViewOffset` also sets the aspect to full width over full height,
  so the full size passed is the aspect by 1 (1 by 1 squeezed the image). The fog moves back with
  the camera, and the blue rim light, which tinted the surfaces the raised camera looks down on,
  fades out in the first 40% of the move, before the player is well in view, while the ambient light
  rises (see the model above). Ejecting returns the camera exactly (checked against the open case before and after).
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
The jack and buttons were checked at 4x close-ups (each face's parts on one line, the pressed cap
sinking into its seam), and the buttons by clicking them in the browser, in both places, and from the keyboard (Tab to
them, Enter on Play, Next and Pause). Ejecting with Escape now returns keyboard focus to the caption
from the tracklist and from the buttons; before, it fell to the page, since the list went inert
before focus was checked and the caption was still hidden. Clicking: play started track 1, pause held
it, next went to track 2, previous went back to 1, and a second previous restarted it.

### Possible follow-ups

- Hand-pick official `buy` links per album (Nirvana, Rammstein, maybe The Prodigy).
- Clicking the spinning disc to pause.
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
