# Booklet animation: behavior, implementation and tuning

Implementation reference for the booklet extraction, reading and return animation, as of
30 October 2026. The current motion is still under visual review. This document describes the
implemented behavior and the decisions made during that review.

The project overview and review history are in [ROADMAP.md](ROADMAP.md). The implementation
lives primarily in [src/scene.ts](src/scene.ts); page loading and interface controls are in
[src/main.tsx](src/main.tsx).

## 1. Intended movement

The booklet should feel like a small stack of flexible printed paper being handled:

1. It already has its pages, grain and gentle resting curvature while stored in the lid.
2. The exposed edge lifts slightly, and the paper feeds out from beneath the plastic holders.
3. A bend travels through the paper, as if it were being drawn over a cylinder near the spine.
   The carrying movement and turn overlap this extraction.
4. The front cover comes toward the viewer and the booklet settles at reading size.
5. It stays on its front cover until the user turns a page.
6. Closing first returns the pages to the cover, then feeds the booklet back into its holders
   along the same extraction path in reverse.

The cylinder is an invisible geometric guide. There is no cylinder mesh, rigid-body physics,
cloth solver, or separate moving front/back artwork. The same formed paper sheets supply
both printed faces throughout the movement.

The case leaves upward with the same appearance, camera transition and pan easing as Listen.
Its world depth and scale stay fixed during that exit. The booklet keeps the Listen camera
viewpoint after landing; there is no additional return to the gallery camera while reading.

## 2. Implementation map

All visual and motion defaults belong in the top-level `C` object in `scene.ts`.

| Code | Responsibility |
| --- | --- |
| `makeCase`, `seatInBooklet` | Create the formed page stack and place it inside the lid/picking bounds. |
| `openBooklet`, `animateRead` | Start extraction, request artwork and animate normalized progress. |
| `bookletEase` | Continuous easing for paper feed and carrying. |
| `setBookletRoll`, `bookletRoll` | Configure and sample the length-preserving roll path on the CPU. |
| `bookletDeform` | The equivalent roll as LeafThrough's `deform` hook, applied to formed sheets in colour and shadow passes. |
| `bookletPanStart`, `viewPan`, `updatePlayer` | Gate the case exit on extraction and share the Listen pan/camera. |
| `updateBooklet` | Combine roll, carry, orientation, size, compression, lighting and the reading rig. |
| `bookletReadingSize` | Solve the page size needed for the intended projected height under the shared camera. |
| `frameFlyingBooklet` | Fit the formed stack on screen, constrain projected size, correct landing projection and maintain case clearance. |
| `showPages`, `updateShift` | Hand the same page object to reading controls and centre covers/spreads. |
| `closeBooklet`, `putBookletBack`, `returnBooklet` | Close pages, restore the flight parent and reverse extraction. |
| `bookletPages` in `main.tsx` | Lazily decode scans, split spreads and cache page sources per album. |

## 3. Objects, coordinates and artwork

### One physical page stack

Each case owns a `LeafThroughObject`, `item.bookletModel`, from the beginning. `magazine` is a
reference to that same object while it is being read. The invisible `item.booklet` mesh is a
120 × 120 × 1.2 mm picking/flight bound, rather than a visible replacement for the paper.

The initial stack uses `album.bookletPageCount`, with a fallback when metadata is absent and a
minimum of four printed sides. Front and back cover sources are present; interior sources are
blank canvases. `preload` covers those existing sources, without fetching interior scans early.
Grain and the library's formed sheet structure are already present inside the case.

On opening, `loadBooklet` requests interior pages. `bookletPages` splits sufficiently wide scans
into two or four square panels in memory and caches the result per album. Failed scans are
omitted. `loadBooklet` adds a blank side when needed to place the back cover on the back.
LeafThrough can rebuild individual sheet meshes when sources change; the enclosing
`LeafThroughObject` remains the same, and the `change` hook reapplies bending to new materials.

The flight keeps spread geometry. Single-page layout is applied after landing on phones. It
loops (`bookletLayout`): LeafThrough turns a single layout's last page only when looping, so the
back cover was a dead end; now it turns and the booklet shuts back onto its cover. The page's
Next arrow stays enabled there (`onPage` reports `loops`).
Interaction is enabled only when extraction has finished and the magazine is ready. If artwork
is slower than the flight, `showPages` waits for readiness; it is also called from the ready
event when `read >= 1`.

### Units and frames

- Case dimensions and most physical tuning values use millimetres. `MM = 1 / 60` converts them
  to scene units; a 120 mm page is two scene units before inherited case scaling.
- The page width runs along local X. The roll bends the local X/Z cross-section; local Y runs
  up the page and is unchanged by the cylindrical deformation.
- `bookletRoll` returns `(path X, path depth, tangent angle)`. Its vector's second component is
  a depth coordinate, not a vertical screen coordinate.
- `bookletRest` stores the picking bound's local pose in the lid. `seatInBooklet` gives the page
  object its fixed offset and scale inside that bound.
- During extraction the bound is a direct child of the scene. `updateBooklet` reconstructs its
  source pose from `lid.matrixWorld * bookletRest`, subtracting the gallery's exit translation
  so the extracted paper does not follow the box upward.
- During reading the magazine is a direct child of the scene and follows `bookletRig`.
  The rig also positions its lighting and shadow floor.

## 4. Progress and timing

`read` is normalized progress: zero is stored in the case, one is the reading pose.
`animateRead` tweens it **linearly**. The visible easing is applied inside the geometry and
placement calculations, so changing the tween itself would ease the same movement twice.

A complete extraction takes 2.4 seconds and a complete return takes 1.9 seconds, matching
Listen's insert/eject durations. For an interrupted movement the duration is multiplied by
`max(0.2, abs(target - read))`. Reduced motion and explicit `atOnce` restoration assign the
target directly. Returning pages to the cover can add time before the 1.9-second return flight.

| Progress or event | Behavior |
| --- | --- |
| `read = 0` | Gently formed stack fits under the holders at its normal depth. |
| Roll interval `0..1` | Eased material feed travels through entry bend, main arc and exit. |
| Carry interval `0.36..0.7` | Carrying, target orientation and reading scale blend in, multiplied by actual extraction freedom. These are nominal progress bounds, not independent timed steps. |
| Trailing-edge release | Case pan becomes eligible; resting curvature stays unchanged. |
| Case pan | Starts at the later of `0.4` and computed holder-release progress; lasts a full `0.5` normalized interval. |
| `0.3..0.9` | Travel sun fades in. |
| `0.74..1` | Reading lighting replaces gallery lighting and ambient fill comes in. |
| `0.75..1` | Floor shadow appears. |
| `read = 1` and artwork ready | Same page object becomes the interactive reader, still on its cover. |

These intervals overlap. Extraction, carrying and turning form one continuous movement.

### Paper easing

The easing function is quintic smootherstep:

```text
S(t) = 6t⁵ - 15t⁴ + 10t³
bookletEase(t) = t + (S(t) - t) × C.bookletEase
```

At the default strength of one, velocity and acceleration are zero at both endpoints.
The same function drives material feed and the normalized carry interval. The case uses
the separate cubic `power3InOut` curve shared with Listen.

## 5. Two independent radii

The travel path and the curl of the paper are intentionally separate controls.

| Quantity | Current setting | Meaning |
| --- | --- | --- |
| `bookletRollDiameter` | 284 mm | Diameter of the broad carrying trajectory: two 142 mm closed case widths; radius 142 mm. |
| `bookletBendAngle` | 75° | Nominal curl across a 120 mm page on the main paper arc. It gives a paper radius of `120 / radians(75)`, approximately 91.7 mm. |
| `bookletEntrySpan`, `bookletEntryAngle` | 14 mm, 22° | Short exposed-edge lift before the main arc, adjusted for lid orientation. |

Increasing the travel diameter changes where the booklet travels. Increasing the paper bend
angle tightens the sheet itself. A request about the paper's curl must not silently change its
trajectory diameter. The short entry bend has its own radius and is separate from the nominal
75° main-arc curl.

### Material feed and the path

`setBookletRoll` fills a `Vector4` with entry X, fed distance, radius and entry angle. With angles
in radians and physical lengths converted to scene units:

```text
entryAngle = radians(bookletEntryAngle + 180 - lidAngle)
arcLength = entrySpan + (π - entryAngle) × radius
fedDistance = (arcLength + pageWidth) × bookletEase(clamp(read / rollUntil))
```

**Landing flat.** The paper used to straighten in place after landing: the carry ends at 0.7,
and the trailing half was still on the cylinder until 1. Now its bend relaxes as it is carried
(`bookletFlatten` = carry): `bookletBent` scales every angle along the paper from its centre by
`1 - flatten`, integrating the piecewise path exactly (straight, two arcs, straight), so the
paper keeps its length and lies flat at 1 wherever it is on the roll. The centre, and with it the
booklet's whole path, rotation and speed, are unchanged; the centre itself finishes its turn at
about 0.69. Retiming was tried first and rejected: ending the roll at 0.75 gave the paper its own
peak of speed before the carry's, which read as two mini pauses and a sudden stop, and a carry
to 1 dragged the booklet up with the panning case. The roll check prints the paper's speed
profile; compare it with the committed version after any timing change.

The desktop lid opens to 180°, leaving the configured 22° entry angle.

**Phones go the other way** (30 October 2026). On a narrow screen the case opens into a V (lid
at 110°), and over the hinge the paper had to bend 92° to clear the raised disc half, then curled
up inside the V. There the whole path is mirrored across the booklet's centre: the paper feeds
out fore-edge first over the lid's open edge and its stops. A negative radius in the roll uniform
marks the mirror, so `bookletRoll` and the shader's `bookletRollPoint` flip together and every
caller follows. The entry bend is `bookletEntryAngleNarrow` (40°): 22° caught the stops 2 mm past
the fore-edge, and 92° read as a sharp kink at the holders. The travel cylinder is wider,
`bookletRollDiameterNarrow` (720 mm); the booklet may leave the screen at the side on the way.

The entry point shifts over the inset beyond the holders using `power3Out`. The released
length is `max(0, fedDistance + entryX - pageWidth / 2)`. `bookletRoll` then samples a continuous
path consisting of unextracted straight paper, the short entry arc, the main circular arc and
a straight exit. The tangent is continuous at the joins. Material distance determines each
point's place on the path; the centre is not simply orbiting a cylinder as a rigid rectangle.

### Shader deformation

LeafThrough (0.1.6) first creates the sheet's own wrinkles, bulge and page structure, and
stands the sheets `paper.sheetGap` apart (`bookletSheetGap`, 0.007 mm a sheet, the 0.12 mm the
17-sheet Kid A stack had before) so they sort by real depth at the spine, from the front and
from behind. Its polygon depth bias is off by default in a scene. The camera near plane is one
scene unit; 0.1 wasted the depth precision the gap needs. `bookletDeform`, passed as
LeafThrough's `deform` option, then wraps the already-formed surface:

1. Tuck the sheet in from its outer edges if it is under the outer one (see below).
2. Convert its page coordinates to the booklet's millimetre-based frame.
3. Evaluate the roll at the vertex's width coordinate relative to the booklet centre and its
   tangent, with the bend relaxed by `bookletFlatten` (`bookletBent`).
4. (The centre itself, from `bookletRoll`, places and turns the booklet on the CPU.)
5. Offset the sheet thickness along the local bent normal and convert back to page coordinates.

LeafThrough applies the hook to the colour, depth and distance passes, takes normals from the
deformed shape and keeps it through rebuilds, so shadows follow the paper. The CPU and GLSL path
definitions must stay equivalent.

**Tucked sheets in the case.** The top sheet bulges most, so in a tilted view the flatter sheets
under it showed past its edges as a broken white line (the white edge the user rejected for the
old box booklet). In the case, every sheet but the one facing the camera (the cover from the
front, the back page inside the open lid) draws in `bookletTuck` (1.5 mm) from its outer edges,
under the outer one. Which sheet is outer is set per draw in each sheet's `onBeforeRender`, from
the camera's side and LeafThrough's `renderOrder` (the pile depth; 0.1.6 has no public per-sheet
data). The tuck goes over the first `bookletTuckUntil` (0.12) of extraction, under the holders,
and comes back at the end of the return.

Expressing deformation about the centre/tangent is essential: when the page has fully passed
the cylinder, the deformation becomes its original formed geometry again. No object swap or
extra flattening animation is needed at either endpoint.

## 6. Release, carrying and front/back orientation

`free` is cubic-eased released length over the 14 mm entry span. Paper depth stays unchanged
at compression one; only the extraction roll changes its shape. Carrying is:

```text
carry = free × bookletEase(clamp((read - 0.36) / (0.7 - 0.36)))
```

The shader always uses the paper's own radius. A second roll sample uses the 142 mm travel
radius for the carried centre. The trajectory blends from the actual paper centre toward
that broader travel sample only as carry increases. This prevents retained paper from being
offset away from its holders before it has escaped.

The reconstructed lid pose plus trajectory supplies the source position; the reading centre
supplies the destination. Position and scale interpolate by carry. Orientation slerps toward
the reading pose with a half-turn around Y, then applies the paper centre's tangent rotation.
The terminal tangent is `-π`, cancelling that half-turn and leaving the **front cover facing
the viewer**. Reversing either half in isolation can expose the wrong face or reverse the turn.

## 7. Case exit and shared camera

There is one scene, renderer and camera shared by the gallery, Listen and Booklet.
`setLens` changes that camera's position, field of view and view offset. The camera remains
aimed straight ahead; lens shift reframes the view while preserving verticals.

Listen's pan is:

```text
viewPan(t) = power3InOut(clamp((t - 0.2) / (0.7 - 0.2)))
```

`bookletPanStart` calculates when the trailing edge clears its holders by inverting the eased
feed with 20 binary-search iterations. It takes the maximum of that result and `bookletPanFrom`.
`updatePlayer` then shifts the same pan function:

```text
bookletAway = viewPan(read - bookletPanStart(lidAngle) + 0.2)
away = max(viewPan(listen), bookletAway)
gallery.position = (0, away × 4.4, 0)
setLens(away, viewPan(listen))   // only Listen raises the camera
```

The gallery is hidden once `away >= 0.999`. The box is not scaled down or moved backward to
make room. Matching the shared camera matters too: a fixed gallery camera made an otherwise
similar booklet case exit appear larger than Listen's.

The gallery FOV is 40°; the settled Listen/Booklet FOV is 18°, with `playerView = 26°` controlling
Listen's elevated viewpoint (the booklet's camera stays level, see Reading angle). `lensDistance(fov)` backs the camera away as the FOV narrows, maintaining
the reference plane's framing. Booklet keeps lens amount one while reading. Closing reverses
the same transition; there is no separate camera reset during landing.

## 8. Landing: angle, position and size

Three related corrections prevent a page that has finished turning from dipping, changing
its apparent tilt, or growing beyond reading size and shrinking back.

### Reading angle

The booklet is read head-on, as LeafThrough shows a magazine: the camera looks straight at the
page, which lies parallel to the image plane (`bookletTilt` 0). The shared camera used to rise
26° (`playerView`) for the booklet as for the player, framing it with a lens shift from above.
Tilted to face the camera there, the square page drew about 10% taller than wide (the return then
showed that stretch unwinding into the square booklet in the case); parallel to the image plane,
pages turned seen from above, through the bottom. Now `setLens` takes the rise separately and
only Listen raises the camera; the booklet keeps the narrower lens and the shared pan. The
pitch no longer depends on where the booklet is, so the flight's per-frame pitch correction
toward the camera was removed.

### Screen position

The intended reading centre is `bookletRaise = 0.03` in normalized device Y: 3% of the screen's
half-height above centre. Its world Y includes the camera's projection-matrix lens shift,
including the extra case raise on short landscape screens.

Under an elevated camera, moving the paper forward to clear the box projects it downward.
Keeping world Y unchanged therefore produced a dip and a rise, even with a stable viewing
angle. The framing pass compensates using:

```text
verticalCorrection = carry × (cameraY - readingY) × bookletZ / cameraZ
```

It applies correction differences within the fitting loop, so clearance and screen placement
are solved together rather than adding an independent landing bob.

### Reading size and the zoom ceiling

`resize` chooses a base page size from available width and height. The shared camera's elevated
viewpoint changes the projection of a tilted page, so using that base value directly as world
size is insufficient. `bookletReadingSize` solves the perspective projection of the page's top
and bottom endpoints for the world size that preserves the intended reference projected height.

The flight's uniform scale approaches that reading size during carry. `frameFlyingBooklet`
also limits the projected height of its padded bounds to the padded final reading height.
Forward depth must not magnify the stack beyond the target and then force it to shrink at
landing. The ceiling and the final pose use the same padding, keeping the scale constraint
neutral at the reader handoff.

This is a projected-height constraint. It does not freeze the shape of a curved, rotating
booklet into a constant screen rectangle; its silhouette naturally changes as it unrolls.

## 9. Framing and solid clearance

`frameFlyingBooklet` runs after release begins. It samples 17 width positions, nine height
positions and both sides of a ±6 mm depth envelope: 306 points held in reusable scratch storage.
The envelope covers the formed stack's bulge and wrinkles; 6 mm is padding, not paper thickness.

Up to eight passes alternate:

1. Correct screen Y for the current flight depth.
2. Project formed bounds using the actual camera and its lens shift.
3. Reduce uniform scale to fit vertical screen margins and the final reading-height ceiling. The
   ceiling compares the paper's own projected height, not the padded envelope's: the padding
   projects differently as the paper turns and let it arrive 3% oversized.
4. Shift vertically if needed to stay within those margins.
5. Transform bounds into body and lid coordinates and raise the booklet forward to maintain
   clearance above the tray/disc and below the lid plate/flanges.

Clearance uses a 1 mm margin and a 10 mm apron around solid edges. Its 45° falloff starts
correction beside an edge rather than switching abruptly when a sample crosses it. The apron
also provides room for solid edges between sampled bound points. The initial retained-paper
path and delayed case pan handle the holders and stops; the flight solver does not individually
resolve every holder mesh. The GPU regression check tests those solids separately.

Only the paper is corrected. Moving the case to fix overlap previously made it shake.
Fitting must not push the paper backward through the tray. The loop exits early when fitting,
vertical shift, clearance and projection corrections have converged. Each pose is reconstructed
from progress without retaining the previous frame's collision corrections, making reverse
playback deterministic. Clearance against the case stops when the gallery is hidden.

This is an analytic animation with conservative sampled bounds, not continuous mesh collision
detection. Changes to geometry, compression, lid angles or radii require renewed GPU checks.

## 10. Reading and return lifecycle

`showPages` reparents the same page object into the scene, hides its flight bound and enables
LeafThrough input. Page zero remains visible; there is no automatic first-page turn.

`bookletShift` is measured in page widths: 0.5 centres a closed front cover, zero centres a
spread, and -0.5 centres a closed back cover. Spreads centre as they open. A closing cover
centres only after its page turn completes. `bookletCentreFollow` controls this following.

Close and Escape disable page input. If needed, `closeBooklet` asks LeafThrough to return to
page zero. Once the turn is complete and the cover is centred, `putBookletBack` reparents the
page object under the flight bound and immediately calls `seatInBooklet`, before the next
render. Delaying this call caused a one-frame size/position jump and must not be reintroduced.
The layout returns to spread for the reverse flight.

`animateRead(0)` reconstructs the same paper poses in reverse. At zero, `returnBooklet` restores
the bound under the lid, applies `bookletRest`, resets bend/compression and disables reading
shadows/input. Clearing the magazine reference does not dispose the case's reusable page object.
Actual resources are disposed when the collection or scene is destroyed.

Outside clicks leave both the open case and the booklet open. Page arrows, arrow keys, Home
and End provide reading navigation. The interface handles keyboard input, focus restoration
and live page announcements; LeafThrough's own keyboard handling is disabled.

## 11. Lighting and responsive behavior

LeafThrough supplies the page geometry and spine shading. Resting bulge is 0.22 and wrinkles
are 0.055 in both the case and reader. This gentle shape fits under the lid with compression
fixed at one, so the paper does not inflate during extraction. Extraction and page turns still
bend the sheets. The reading view retains directional light and hemisphere fill.
The gallery's key, fill, strip, rim, ambient and environment lighting fade away as the reading
lighting arrives, then restore on return.

The directional sun ramps from travel intensity one to reading intensity two. Hemisphere
intensity is 1.5 for spreads and 1.7 for single-page reading. Floor-shadow opacity is zero and
the floor stays hidden, removing the drop shadow beneath the booklet. Single-page sun
shadow intensity is 0.4. Sheets cast and receive shadows while out of the case.

The sun remains shadow-capable even when dark, avoiding material recompilation when entering
the view. The shadow map is redrawn while a booklet is out and initialized during scene setup.

At widths of 650 px or less, the case opens to 110° and reading uses LeafThrough's single-page
layout. A page targets 82% of viewport width, subject to the height limit. Desktop spreads use
the width and height limits below. Short landscape screens use a smaller flight margin and
their case-specific lens shift is included in landing corrections. Reduced motion skips
the flight tween and animated cover return, while retaining readiness and lifecycle handling.

## 12. Tuning reference

Values below are the current `C` defaults. Progress values are normalized `read` fractions;
durations are seconds, angles degrees, physical dimensions millimetres, margins CSS pixels.

| Parameter | Default | Effect |
| --- | --- | --- |
| `readDuration` / `unreadDuration` | 2.4 / 1.9 | Full extraction/return flight duration. |
| `bookletRollDiameter` / `bookletRollDiameterNarrow` | 284 / 720 | Broad carrying trajectory diameter; phones. |
| `bookletBendAngle` | 75 | Main-arc curl across a full page; larger means tighter paper curvature. |
| `bookletEntrySpan` / `bookletEntryAngle` | 14 / 22 | Exposed-edge lift before the main roll, adjusted by lid angle. |
| `bookletEntryAngleNarrow` | 40 | Phones' entry bend over the lid's open edge and stops. |
| `bookletRollUntil` | 1 | Progress at which material feed completes (the carried paper is already flat). |
| `bookletEase` | 1 | Blend from linear feed/carry at zero to full smootherstep at one. |
| `bookletCarryFrom` / `bookletCarryUntil` | 0.36 / 0.7 | Nominal carry, orientation and reading-scale blend interval; gated by release. |
| `bookletPanFrom` | 0.4 | Earliest case exit; holder release can delay it. |
| `viewPanFrom` / `viewPanUntil` | 0.2 / 0.7 | Shared pan curve; its full interval is shifted for Booklet. |
| `insertPan` | 4.4 scene units | Shared upward case travel, not millimetres. |
| `bookletFlightMargin` / `bookletFlightMarginShort` | 64 / 44 | Vertical viewport margins during flight. |
| `bookletFlightDepth` | 6 | Half-depth of the conservative formed-paper envelope. |
| `bookletClearance` / `bookletClearanceApron` | 1 / 10 | Solid clearance and edge apron. |
| `bookletTilt` | 0 | Reading tilt from the image plane of the level camera; read head-on. |
| `bookletRaise` | 0.03 | Reading centre in normalized device Y above screen centre. |
| `bookletFitWidth` | 0.84 | Desktop page-size limit as a fraction of viewport half-width. |
| `bookletFitHeight` | 0.64 | Page-size limit as a fraction of viewport height. |
| `bookletFitNarrow` | 0.82 | Single-page size limit as a fraction of viewport width. |
| `bookletCentreFollow` | 7 | Reading cover/spread centring follow rate. |
| `bookletWrinkles` / `bookletBulge` | 0.055 / 0.22 | The same gentle resting curve in the case and reader. |
| `bookletSheetGap` | 0.007 mm | LeafThrough's gap between stacked sheets, per sheet. |
| `bookletTuck` / `bookletTuckUntil` | 1.5 mm / 0.12 | Inset of the sheets under the outer one in the case, gone by this much extraction. |
| `bookletSun` / `bookletTravelSun` | 2 / 1 | Reading/travel directional light intensity. |
| `bookletSunAt` | `[-3.5, 1.3, 4.1]` | Sun position in the reading rig's frame. |
| `bookletAmbient` / `bookletAmbientSingle` | 1.5 / 1.7 | Hemisphere fill for spreads/single pages. |
| `bookletAmbientSky` / `bookletAmbientGround` | `#ffffff` / `#a1aeaf` | Hemisphere colors. |
| `bookletSingleShadow` | 0.4 | Directional shadow intensity for settled single-page reading. |
| `bookletFloorShadow` | 0 | Floor shadow disabled; the floor stays hidden. |
| `bookletShadowReach` / `bookletShadowMap` | `[1.3, 0.9]` / 2048 | Shadow-camera horizontal/vertical reach in page widths and map resolution. |
| `cameraFOV` / `playerFOV` | 40 / 18 | Gallery/shared Listen-Booklet FOV. |
| `cameraNear` | 1 | Near clipping plane; improves precision for closely spaced paper layers. |
| `playerView` | 26 | Shared camera elevation relative to the player reference. |

Case dimensions, holder geometry and lid angles also affect extraction. The light fade intervals
currently live directly in `updateBooklet`; they are not separate `C` parameters. If exposing
additional visual tuning, keep new defaults in `C` rather than adding scattered overrides.

## 13. Rejected approaches and regressions to avoid

| Approach or regression | Review decision / reason |
| --- | --- |
| A thin visible cover replaced by a full stack after landing | Formed paper volume must exist from the stored state onward. |
| A rigid rectangle orbiting a cylinder | The bend must travel through the actual paper. |
| Extract, level, carry, then perform an isolated flip | The movement should roll and turn continuously. |
| Listen-style two-wave paper motion | Tried and explicitly reverted; retain shared case timing without splitting the paper into two waves. |
| Interpreting a curl request as a travel-radius request | Keep paper bend angle and trajectory diameter separate. |
| Increasing travel diameter to 355 mm | Reverted in review; the current diameter is 284 mm. |
| Moving the case in response to paper overlap | Produced shaking; correct paper placement and clearance. |
| Shrinking or retreating the box before removal | The case leaves upward at fixed world depth and scale. |
| Pushing the paper backward to fit the screen | Caused case penetration; fit scale/Y and maintain forward clearance. |
| Starting case pan while paper is still trapped | A tilted phone lid could sweep through retained sheets. |
| Multiplying case pan by extraction freedom | Compressed its timing and made its exit abrupt. Gate the start, then use the full shared curve. |
| Returning to the gallery lens during landing | Created an unnecessary perspective change; keep the Listen viewpoint for reading. |
| Compensating tilt but ignoring projected Y | Still allowed a forward-lifted booklet to dip and rise. |
| Oversized flight scale followed by a final shrink | Limit projected height to the final reading bounds during flight. |
| Delaying `seatInBooklet` after closing reparent | Introduced a one-frame handoff jump. |
| Automatically turning the first page | Stay on the front cover until manual input. |
| Closing on outside clicks | Close and Escape handle dismissal. |
| Booklet motion dashboard and persistent debug overrides | Removed at the user's request; current tuning proceeds through source defaults and review. |

## 14. Verification and reproduction

Start a development server, then supply its URL to the checks. The examples use port 5175;
replace it with the actual Vite port. These scripts use `playwright-core` and a Chrome channel.
If the module is not installed in this project's module resolution path, `PLAYWRIGHT_CORE`
can point to an existing module entry. The sibling LeafThrough checkout used during review
provides the example path below.

```sh
npm run dev -- --port 5175
```

In another terminal:

```sh
npm run build
PLAYWRIGHT_CORE=../leafthrough/node_modules/playwright-core/index.mjs node scripts/check-booklet.mjs http://127.0.0.1:5175/
PLAYWRIGHT_CORE=../leafthrough/node_modules/playwright-core/index.mjs node scripts/check-booklet-roll.mjs http://127.0.0.1:5175/
PLAYWRIGHT_CORE=../leafthrough/node_modules/playwright-core/index.mjs node scripts/check-booklet-roll.mjs http://127.0.0.1:5175/ kid-a
PLAYWRIGHT_CORE=../leafthrough/node_modules/playwright-core/index.mjs node scripts/check-case-transition.mjs http://127.0.0.1:5175/
```

Keep source files unchanged during a browser run: a Vite reload can invalidate the scene
references and interrupt a lifecycle check.

### What the scripts check

| Script | Coverage |
| --- | --- |
| [check-booklet.mjs](scripts/check-booklet.mjs) | Initial sheet count, lazy interior scans, shared object identity, no automatic first turn, outside clicks, page navigation, Escape/Close, reopening, restored lighting, browser/WebGL errors and reduced motion. Uses Nevermind desktop/portrait, Kid A landscape and Crystal Castles reduced motion. |
| [check-booklet-roll.mjs](scripts/check-booklet-roll.mjs) | Actual formed-and-rolled shader vertices through WebGL2 transform feedback, 201 forward poses and reverse wrapper/bend/compression poses at 1440 × 900, 390 × 844 and 844 × 390. Album is an optional second argument. |
| [check-case-transition.mjs](scripts/check-case-transition.mjs) | Projected case geometry at matching Listen/Booklet pan values, exact return values, shared camera amount throughout, final lens amount one and matching 2.4/1.9-second durations. |

The roll check explicitly tests lid plate, flanges, stops, holders, tray, disc and hinge-strip
clearance. It checks resting stack depth, a measurable travelling paper bend and equivalence
between fully rolled-out and unbent formed geometry. It also checks fixed case depth, monotonic
upward case motion and reverse pose agreement.

Landing assertions allow less than 1% projected-height overshoot after extraction, and from
`read >= 0.72` no reversal: less than 0.5° of viewing pitch and 0.001 normalized device Y moving
back against the approach (the booklet may still move then, but only toward its landing),
and handoff-scale error below `1e-6`. Zoom is checked after geometric release: a stored
booklet can legitimately be larger than its reading size on a short viewport. These checks
measure height, centre and viewing pitch; they do not assert an identical curved-page silhouette
or a full perspective homography throughout the turn.

The final shared-camera version passed these checks for the ordinary and thicker Kid A stacks
(four and 17 sheets in the reviewed examples), with no sampled solid intersections. Measured
maximum projected-height ratios were about 1.0011–1.0012 relative to landing height, with
viewing-pitch variation rounding to 0.000°. These are sampled regression results, not a proof
of continuous collision freedom at every possible viewport, album or parameter combination.

For visual review, inspect the stored shape, holder release, bent midpoint, case exit, late
landing and the first frame after each reparent. Play opening and closing at normal speed,
including a thick booklet and both phone orientations. Check for a direction reversal in
screen Y, a late tilt or size correction, any paper/plastic overlap, and a one-frame reader
handoff jump. Numeric checks supplement this review; they do not decide whether the motion
feels natural.
