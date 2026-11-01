import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { LeafThroughObject } from 'leafthrough';
import type { LightingOptions, PageDescriptor, PageSource, PaperDeform } from 'leafthrough';

// A page given as a descriptor (the image with what is on it) rather than the image itself.
const isPageDescriptor = (page: PageSource): page is PageDescriptor => typeof page === 'object' && page !== null && 'src' in page;
import type { Album } from './collection';
import { GRAIN_SIZE, generateProcedural, valueNoise } from './procedural';
import type { ProceduralMaps, ProceduralParams } from './procedural';

// The strip light's shading needs lookup tables (RectAreaLightUniformsLib), a quarter of the
// script: they come as a chunk of their own, fetched while the artwork loads, and the shaders wait
// for them (the constructor's load gate). Started as soon as the script runs.
const ltcTables = import('three/examples/jsm/lights/RectAreaLightUniformsLib.js')
  .then(({ RectAreaLightUniformsLib }) => RectAreaLightUniformsLib.init())
  .catch((error: unknown) => console.warn('The strip light\'s lookup tables failed to load', error));

// All visual and motion tuning. The disc radius is 1 unit.
const C = {
  discThickness: 0.01, edgeBleed: 0.005, seamOverlap: 0.008,
  // The disc's print ends at discPrintEdge of its radius; outside it, and where art is missing, the
  // disc shows discFallback.
  discPrintEdge: 0.978, discFallback: '#0c0c0e',
  // Radii as a fraction of the disc: centre hole, clear clamping zone, then the mirror band up to the print.
  holeSize: 0.127, hubSize: 0.31, labelInner: 0.345, mirrorBandShade: 0.2, discScanInset: 0.012,
  plasticTint: '#b9bcc0', plasticOpacity: 0.08, plasticEdge: 0.45, plasticRings: [[0.2, 0.0035, 0.1], [0.14, 0.004, 0.12]],
  frontRough: 0.42, frontMetal: 0.48, frontClearcoat: 0.8, texGrain: 0.59, texPrint: 0.35, texScratches: 0, texGloss: 1,
  backColor: '#83888f', backRough: 0.2, backMetal: 1, backClearcoat: 0.5, backBand: 0.035, backBandOpacity: 0.88,
  // Data side look: reflection kept from the environment, plus a flat silver lift so it reads as a
  // bright mirror in a light room, and a soft white streak along the light.
  backReflect: 0.75, backSilver: 0.3, backSheen: 0.45,
  trackLines: 0.025, scratchAmount: 0, scratchCount: 22, scratchArcs: 5,
  // Rainbow: two light directions in world space (x, y, z, weight), how tightly the wedges line up
  // through the centre, and how much the colours wash out toward silver.
  diffractionStrength: 1.1, diffractionSaturation: 0.8, diffractionFocus: 1.5, diffractionSpacing: 1600,
  diffractionLights: [[-0.3, 0.75, 0.6, 1], [0.7, -0.2, 0.7, 0.6]],
  // Jewel case in millimetres; a disc radius (60 mm) is one unit. A standard case is 142 × 125 ×
  // 10.4 mm, hinged on the left. Back to front: base plate, back insert, black tray, disc, booklet,
  // lid plate. The insert's ends fold forward into the two spines.
  caseWidth: 142, caseHeight: 125, caseDepth: 10.4, lidPlate: 1.5, lidFlange: 8, basePlate: 1, caseWall: 1, hingeInset: 1,
  bookletSize: 120, bookletThickness: 1.2, bookletInset: 5, insertWidth: 138, insertHeight: 118, spineWidth: 6.5,
  trayWidth: 136, trayHeight: 121, trayDepth: 5, discOffsetX: 6, discTurn: 25, hingeStrip: 14, hingeRibs: 18,
  // Moulded details, from photos of open and empty cases (mm). Lid: half-round tabs on the top and
  // bottom flanges hold the booklet's edges, lidTabInset in from each side of the booklet, and two
  // short ribs inside the free edge stop it (lidStopY, from the centre). Tray: half-ring clips on its
  // top and bottom edges, trayClipSpread either side of the disc's centre. Both sit symmetrically.
  lidTabInset: 16, lidTabRadius: 5, lidStopY: [16, 40], trayClipSpread: 37, trayClipRadius: 4.5,
  // The case plastic (makeCasePlastic). Its reflection: a long, soft strip light running left to
  // right, above and in front (caseSheenDir, world space), seen as a soft band with no ends.
  // Strength and angular half-width in radians. The disc print reflects the same light
  // (discSheen) instead of the direct lights, so the open case is lit like the closed one. Cut edges get a little extra opacity, so they read
  // as thicker plastic; wear adds scratches and smudges.
  caseSheen: 0.12, caseSheenWidth: 0.1, caseSheenDir: [0, 0.75, 0.66], discSheen: 0.18,
  // How much light reaches a disc inside the closed case (it brightens to 1 as the lid opens).
  discClosedShade: 0.1, caseEdgeAlpha: 0.15, caseScratches: 0.32, caseSmudges: 0.8,
  // Black tray: satin, finely stippled polystyrene, with a raised ring around the disc well.
  casePlasticOpacity: 0.04, trayColor: '#151518', trayRough: 0.5, trayStipple: 0.35, printRough: 0.5, caseScale: 0.78,
  // Opening: the case turns square to the camera and tips back by openTilt degrees, like a book
  // lying open on a table seen from the front (no sideways angle). It comes forward and settles at
  // openScale, the neighbours move aside and back (on screen), then the lid swings open: flat, to
  // lidOpenAngle degrees, or on screens narrowWidth px wide or less only to lidOpenAngleNarrow,
  // with both halves rising from the hinge like a book opened from both sides, since the flat case
  // is very wide for a phone. There the open case is scaled to the screen's width less
  // openFitPadding px each side (openFit). On short landscape screens (shortHeight px tall or less,
  // a phone turned sideways) it lies flat and is scaled to fit between openFitShortMargin px top
  // and bottom, where the top bar and the caption are. There the wordmark is much shorter than the
  // caption, so the picture is raised rowRaiseShort px (the row) or openRaiseShort px (an open case)
  // to leave the same gap above the front case as below it (setLens).
  openDuration: 1.3, lidOpenAngle: 180, lidOpenAngleNarrow: 110, narrowWidth: 650, openFitPadding: 32,
  shortHeight: 500, openFitShortMargin: 100, openTilt: 24, openScale: 0.62, openForward: 0.3, openSpread: 5, openRecede: 1.6,
  rowRaiseShort: 10, openRaiseShort: 17,
  // hGap spaces the row; on screens narrowWidth px wide or less, hGapNarrow of it, so the
  // neighbours show beside the front case rather than at the screen's edges.
  galleryScale: 1.08, hGap: 2.8, hGapNarrow: 0.9, depthGap: 1, activeDiscY: 0.06, galleryRotX: -22, galleryRotY: -22, inactiveScale: 0.8,
  // Keep the near plane outside the scene but close enough to its objects to resolve paper
  // layers reliably. A 0.1 near plane wasted most depth precision in empty space by the camera.
  cameraDistance: 4.4, cameraFOV: 40, cameraNear: 1, exposure: 0.86, environmentIntensity: 1, fogColor: '#ebe3d4',
  ambientIntensity: 0.25, keyIntensity: 0.75, keyColor: '#fff9e8', keyX: 3.5, keyY: -8, fillIntensity: 0.3, rimIntensity: 0.75, rimColor: '#499ff5', topStripIntensity: 1.9,
  // The booklet's shadow (its sun's, see bookletSun) has its edges softened over shadowSoft texels,
  // with LeafThrough's demo's depth and normal biases (shadowBias) against acne. The key light was
  // tried as the caster too: from below and to the right, its shadow fell where the paper hid it
  // and only hazed the cover with self-shadowing, and every lit material sampled a second map.
  shadowSoft: 3, shadowBias: [-0.0007, 0.002],
  hoverTiltStrength: 0.21, dragSensitivity: 0.95, dragVelocitySmoothing: 0.32, dragMaxVelocity: 0.5, friction: 0.89,
  maxSpinAngle: 180, resetDuration: 1.2, dragStartDistance: 5, snapDuration: 0.46,
  // A drag on the front case turns it over to its back when released past halfway, or when faster
  // than flipFlickVelocity (radians per frame); a touch held still on it for flipHoldTime s turns
  // it over too, or back (on touch a drag browses the row). It stays there until the gallery
  // moves. An open case doesn't turn; it only
  // tilts toward the cursor at openHoverTilt of the usual hover tilt. Once a disc has landed, the
  // player leans toward the cursor too, at playerHoverTilt of the open case's tilt.
  flipFlickVelocity: 0.07, flipDuration: 0.9, flipHoldTime: 0.45, openHoverTilt: 0.4, playerHoverTilt: 0.35,
  flowLean: 0.055, flowLeanMax: 0.3, flowBank: 0.32, flowDip: 0.014, flowDipMax: 0.09,
  followTight: 15, followBase: 11, followFalloff: 1.15, followMin: 6.5, snapFreq: 9.5, snapDamping: 12,
  wipePush: 0.012, wipePushMax: 0.5, wipeSpin: 0.009, wipeSpinMax: 0.4, wipeMinSpeed: 9, pushDamping: 4.5, pushReturn: 3.4, pressDepth: 0.55, pressTilt: 1.5,
  flightRecede: 2.2, flightStaggerIn: 0.28, flightStaggerMax: 4, flightPopScaleIn: 0.02, introDuration: 1.15,
  touchDragSpan: 1.8, touchFlickVelocity: 0.035,
  wheelNoiseFloor: 0.3, wheelStepThreshold: 6, wheelEventCap: 24, wheelEnvelopeTau: 550, wheelRiseFactor: 1.2, wheelTickGap: 34, wheelTickRatio: 1,
  wheelPauseGap: 130, wheelIdleReset: 150, wheelMinStepTick: 90, wheelMinStepFlick: 190, wheelSustainDelay: 480, wheelSustainRatio: 0.8,
  renderRadius: 5, revealRadius: 1, loadTimeout: 12000, artResolution: 1024, mapResolution: 1024, maxPixels: 8e6, pixelRatioNarrow: 1.5, pixelRatioWide: 2, slowFrame: 0.022, verySlowFrame: 0.04,
  // CD player, in millimetres: a slim, lidless top-loader in glossy graphite, only a little larger
  // than the disc. A glossy top pane with a matte black edge sits playerFrame inside the body's edge,
  // cut round a metal ring (playerRing wide) that slopes down into the well; the disc drops onto the
  // turntable and rests playerDiscDrop below the top. The front has a screen showing the track and
  // four buttons; the left side a 3.5 mm headphone jack and a band of speaker holes
  // (playerGrilleRows rows, playerGrillePitch apart).
  playerSize: 146, playerHeight: 18, playerCorner: 7, playerBevel: 1, playerFrame: 1.4, playerRing: 2.2, wellRadius: 62, wellDepth: 10, wellZ: 0, playerDiscDrop: 4,
  playerEnvLift: 1.4, playerAmbient: 0.9, playerColor: '#3a3c41', playerRough: 0.38, playerTop: '#2c2e32', playerTopBack: '#5a5d64', playerTopSheen: 0.12,
  playerChrome: '#e2e4e8', playerTrim: '#141517', playerWell: '#18191c', playerHoles: '#101113',
  // The ring round the well and the jack's collar: polished dark metal, darker than the body,
  // dulled (playerRingRough, its clearcoat playerRingCoat, playerRingEnv of the room's light): at
  // roughness 0.18 with a full clearcoat it glared on a phone, and matte rubber looked worse.
  playerMetal: '#1c1d20', playerRingRough: 0.32, playerRingCoat: 0.5, playerRingEnv: 0.6,
  // Wear on the body and top: fine scratches and wipe marks that catch the light (playerWear), the
  // wear map repeating every playerWearScale millimetres.
  playerWear: 2.5, playerWearScale: 90, playerTurntableGrain: 14, playerTurntableBump: 1.5, playerTurntableSpeckle: 0.22, playerTurntableTone: 1.15,
  // The screen: text in playerScreenColor (the page's background), shown through a fine matrix of
  // dots playerScreenDot millimetres apart, the unlit dots faintly showing (playerScreenUnlit);
  // margin (mm), canvas pixels a millimetre, how fast a long title scrolls (mm/s) and how long it
  // rests before it starts and after each pass (s).
  playerScreenColor: '#ebe3d4', playerScreenDot: 0.3, playerScreenUnlit: 0.06,
  playerScreenMargin: 3, playerScreenResolution: 14, playerScreenScroll: 9, playerScreenHold: 1.5,
  playerGrilleRows: 4, playerGrillePitch: 2.4, playerGrilleHole: 0.7,
  // Along the left side, in millimetres from its middle toward the front (the corners begin at
  // ±playerSize / 2 - playerCorner): the jack's centre and the speaker band's ends. On the front,
  // from the corner, the screen (playerScreenMargin in from the face's edges) and, playerScreenGap
  // after it, the buttons (previous, play, pause, next) up to playerScreenMargin from the right end,
  // each playerButtonWidth by playerButtonHeight, playerButtonGap apart, which a click presses
  // playerButtonPress in. Their symbols are printed in playerPrint, half see-through
  // (playerPrintOpacity). Under the pointer a button's symbol shows in full, easing over
  // playerButtonHover seconds (a time constant).
  playerJackAt: -61, playerGrilleFrom: -50, playerGrilleTo: 62, playerScreenGap: 5,
  playerButtonWidth: 9, playerButtonHeight: 7, playerButtonGap: 2.6, playerButtonPress: 0.4, playerPrintOpacity: 0.5, playerButtonHover: 0.08,
  playerButtonColor: '#45474d', playerPrint: '#ebe3d4',
  // The player stands level, turned playerYaw degrees on its stand so a corner faces the camera (as
  // in the product photo), at playerScale of the scene's size (about the open case's height on
  // screen), centred and playerRaise of the half-height up, clear of the transport row and caption
  // below; narrow screens shrink it to fit their width. It is shot like a product photo
  // with a shift lens (setLens): the camera moves in front of it and rises until it sees the top from
  // playerView degrees above, still aimed straight ahead, so verticals stay vertical and the front
  // is a true rectangle; the lens shift keeps everything framed where it was. The lens is longer
  // than the gallery's (playerFOV degrees; the camera backs off to keep the framing). A soft shadow
  // (playerShadow opacity) grounds it.
  // On short landscape screens it is playerScaleShort bigger and playerRaiseShort up instead, so it
  // and the transport row under it fit above the caption, with as much room above it as between it
  // and the row's symbols (the row sits closer to it there, see .transport in style.css).
  playerYaw: 45, playerView: 26, playerScale: 0.7, playerFOV: 18, playerShadow: 0.3, playerRaise: 0.1,
  playerScaleShort: 1.25, playerRaiseShort: 0.24,
  // Inserting: the disc lifts insertLift out of the tray toward the camera, the row slides up out of
  // view by insertPan while the player rises into its place, then the disc glides over the well,
  // insertHover above the spindle, and drops onto it. Ejecting plays it backwards. Whatever that path
  // does, the disc never goes into the player: it is pushed up to insertClearance mm over the top
  // (see updatePlayer); nor back into its case, which is tipped back (openTilt) so its lower part
  // sweeps forward as it slides up past the hanging disc: the disc stays insertClearance in front of
  // the case's walls the same way. insertLift is set so the case passes behind the disc with at most
  // a few millimetres of that push (0.45 let the tray draw over the disc as its bottom edge passed).
  // The row's pan runs from viewPanFrom to viewPanUntil of the way, the same for the booklet view
  // (viewPan).
  insertDuration: 2.4, ejectDuration: 1.9, viewPanFrom: 0.2, viewPanUntil: 0.7, insertLift: 0.6, insertPan: 4.4, insertHover: 0.3, insertClearance: 3,
  // A jump to another view (the wordmark, the browser's Back, a pasted link) doesn't play the steps
  // in between: the player drops leaveDrop down out of view over leaveDuration seconds (the page
  // fades the gallery out meanwhile, and in again with the intro), then the intro plays into the new
  // view (show()). The cases don't shrink back first: seen, that read as the gallery resetting.
  leaveDuration: 0.6, leaveDrop: 4.4,
  // Take the page stack out as by hand: from the holders it rises on an arc that eases, first
  // bookletEntrySpan mm to bookletEntryAngle degrees, steep enough to clear the hinge strip beside
  // it, then bookletLiftRun mm on a bookletLiftRadius mm arc (one gentle arc reached the strip,
  // and a straight line after the bend read as one angle), then goes round a big cylinder, its axis
  // along the spine, bookletCylinder mm in radius (more than the booklet is wide). Each point
  // follows that path, so the paper bends round the cylinder and the whole booklet goes round its
  // axis, not its own centre. Its centre starts round the cylinder some 30 mm after the paper
  // leaves the holders (bookletTurnFrom), past the hinge pins, and from there its pose changes
  // once, smoothly, to the reader's: from lying tilted in the open case to flat, growing to reading
  // size, and shifting so the way round ends at the reader's centre (the case leaves upward on
  // its own). On phones the
  // paper leaves the other way, fore-edge first over the open edge of the partly open lid (over
  // the hinge it ran into the raised disc half), bent bookletEntryAngleNarrow degrees over
  // bookletEntrySpanNarrow mm to rise over the lid's stops at once, then on for
  // bookletLiftRunNarrow mm on a gentle bookletLiftRadiusNarrow mm arc (straight, it read as one
  // angle), and round a wider, bookletCylinderNarrow mm cylinder, off the screen's side on the way.
  // The roll takes bookletRollUntil of the way, eased by a smootherstep
  // (bookletEase: 0 linear, 1 full); free, it eases to a stop on the cylinder's line nearest the
  // camera as it lands, and
  // the row pans away as for the player, no earlier than bookletPanFrom. Carrying and settling
  // overlap the roll; there is no rigid flip. In flight it is kept bookletFlightMargin px
  // (bookletFlightMarginShort on short screens) inside the screen's top and bottom, counting
  // bookletFlightDepth mm for the stack's bulge, and bookletClearance mm clear of the tray and
  // lid, easing in over a bookletClearanceApron mm apron beside the case.
  // It lands tipped back bookletTilt degrees from the camera's image plane (any tilt draws the
  // square page taller than wide under the camera's lens shift; 8 read 6% too tall, and tilted to
  // face the camera itself, 10%) and bookletRaise of the half-height up, as large as
  // its open spread fits: bookletFitWidth of the screen's width and bookletFitHeight of its
  // height (one page at a time on screens narrowWidth px wide or less, bookletFitNarrow of the
  // width). It stays on the cover until a page is turned; the spread then glides to stay
  // centred as it opens and closes (bookletCentreFollow, a rate a second).
  readDuration: 2.4, unreadDuration: 1.9, bookletCylinder: 100, bookletCylinderNarrow: 150,
  bookletEntrySpan: 25, bookletEntryAngle: 28, bookletLiftRun: 69, bookletLiftRadius: 400,
  bookletEntrySpanNarrow: 14, bookletEntryAngleNarrow: 40, bookletLiftRunNarrow: 110, bookletLiftRadiusNarrow: 200,
  bookletFrameSpan: 140, bookletLipSteep: 10, bookletLevelUntil: 0.7,
  bookletRollUntil: 1, bookletEase: 1,
  bookletPanFrom: 0.4,
  bookletFlightMargin: 64, bookletFlightMarginShort: 44, bookletFlightDepth: 6, bookletClearance: 1, bookletClearanceApron: 10,
  bookletTilt: 0, bookletRaise: 0.03,
  bookletFitWidth: 0.84, bookletFitHeight: 0.64, bookletFitNarrow: 0.82, bookletCentreFollow: 7,
  // Use the same gently formed paper in the lid and reader. Its resting curve fits under
  // the lid without depth compression, so extraction never inflates it into a new shape.
  bookletWrinkles: 0.055, bookletBulge: 0.22,
  // LeafThrough's gap between stacked sheets in the lid, in mm a sheet, so they sort by real depth
  // (also from behind, in the lid) instead of meeting at the spine. The 0.12 mm the 17-sheet Kid A
  // stack had in review; the 1 unit camera near plane resolves far finer (see specs/DECISIONS.md). The
  // formed cover already lies against the lid plate's inside face: a thicker stack in the lid
  // (0.16 to 0.4 mm) came through the plate, as spots on the closed case. Out from under the lid
  // the stack opens up to bookletStackOut mm, as a pressed booklet springs open when it is let go
  // (the gap scaled per sheet, in over the same way the fit to the screen comes in, and back
  // under the holders on the way back): pressed, the booklet flew like a single sheet, with no
  // edges to see in the curl.
  bookletSheetGap: 0.007, bookletStackOut: 1.2,
  // In the case, the sheets under the one facing the camera (the cover, or the back page inside
  // the open lid) draw in bookletTuck mm from their outer edges. The cover bulges most, so in a
  // tilted view the flatter sheets under it showed past its edges as a broken white line. The
  // tuck goes in the first bookletTuckUntil of extraction, still under the holders.
  bookletTuck: 1.5, bookletTuckUntil: 0.12,
  // The booklet view's own light, as LeafThrough lights its own scene: a directional light from
  // bookletSunAt in the magazine's frame (LeafThrough's default for a spread), bookletSun strong,
  // coming in to bookletTravelSun over the bookletSunIn part of the way out (from the start, so
  // the lifting paper's shadow is on the disc and tray at once; from 0.3 it had none until it was
  // clear of the case) and to bookletSun over bookletLightIn, when the reader's fill comes in and
  // the gallery's lights and environment go. That part of the way ends while the paper still
  // moves: over the last 0.26 it went on after the paper had all but stopped (from 0.9 the roll
  // moves under a pixel a step), so the settled booklet was lit differently from the landing one. It casts the pages' shadows, on each other and on a floor
  // under them (bookletFloorShadow opacity, LeafThrough's default, for a spread as in the library),
  // within bookletShadowReach page widths of the spine (across, up and down) on a bookletShadowMap
  // px map. The floor's shadow fades in over bookletShadowIn s once the booklet has landed and the
  // pages answer, and out over bookletShadowOut s as the way back starts: in flight, high over the
  // floor, it was large and heavy, and switched on at the landing it read as a step. The floor lies
  // bookletFloorGap mm under the pages: with the gentle resting curve the shadow is a hairline along
  // the cover's right and lower edges (a booklet flat on a table casts no more); a wider gap would
  // move it out from under the paper.
  // Keep directional/hemisphere lighting for page turns. The gallery's fill lights and
  // environment fade out as the row leaves.
  bookletSun: 2, bookletTravelSun: 1.6, bookletSunIn: [0, 0.35], bookletLightIn: [0.6, 0.86], bookletSunAt: [-3.5, 1.3, 4.1], bookletAmbient: 1.5, bookletAmbientSingle: 1.7,
  bookletAmbientSky: '#ffffff', bookletAmbientGround: '#a1aeaf', bookletSingleShadow: 0.4,
  bookletFloorShadow: 0.15, bookletShadowIn: 0.6, bookletShadowOut: 0.25, bookletFloorGap: 0.24, bookletShadowReach: [1.3, 0.9], bookletShadowMap: 2048,
  // Spin while playing, in turns a minute (a real disc turns 200 to 500; faster speeds and the real
  // one, 500 falling to about 200 across the disc, were tried and rejected, and 200 later read as too
  // busy, see specs/DECISIONS.md), and how long it takes to
  // spin up (a time constant in seconds) and brake to a stop at a steady deceleration, from full
  // speed in spinDown seconds (spinDownEject, much quicker, when the disc is
  // taken out while it turns, so it brakes as it leaves). At this speed the print is blurred over the
  // arc it turns in spinBlur seconds, like a camera's exposure, or in the frame's real interval
  // when that is longer (a phone under 60 fps), so it reads as a spinning disc rather than
  // strobing; spinBlurSamples samples along that arc.
  spinRpm: 120, spinUp: 0.4, spinDown: 1, spinDownEject: 0.25, spinBlur: 0.025, spinBlurSamples: 24,
} as const;

// overDisc, overBooklet: the pointer is over the open case's disc or booklet (overDisc also over the
// disc once it has landed on the player, where a click ejects it). listening: the player view is wanted (from
// insert() until eject()); seated: the disc has landed on the spindle (from the end of the insert
// until eject() starts), the only time the player's screen shows anything and its buttons work;
// discOut: the disc is out of its case (until the eject has finished); overButton: the player's
// button under the pointer, if any; busy: the view is changing (see viewBusy), when nothing that
// would change it again works. reading: the booklet view is wanted (from openBooklet() until closeBooklet());
// bookletOut: the booklet is out of its case (until it is back in the lid); overPage: the side of the
// booklet's spine the pointer is over, on its pages ('prev' left, where a click turns back, 'next'
// right), or null.
export type PageSide = 'prev' | 'next';
export interface PointerState { hovered: number; active: number; opened: number; dragging: boolean; overDisc: boolean; overBooklet: boolean; listening: boolean; seated: boolean; discOut: boolean; overButton: PlayerButton | null; busy: boolean; reading: boolean; bookletOut: boolean; overPage: PageSide | null }

export interface SceneOptions {
  onProgress?: (loaded: number, total: number) => void;
  onReady?: () => void;
  onPointer?: (state: PointerState) => void;
  // A click on one of the player's buttons.
  onPlayerButton?: (button: PlayerButton) => void;
  // The inside pages of case `index`'s booklet (the scene adds its cover and back page), and which
  // of them show once it is out: the first and last visible page and how many there are.
  bookletPages?: (index: number) => Promise<PageSource[]>;
  // loops: whether the last page turns too, back onto the cover (see bookletLayout).
  onPage?: (first: number, last: number, count: number, loops: boolean) => void;
  fogColor?: string;
  // The case in front when the gallery first appears, and whether it is already open then (both from
  // the page's URL).
  startIndex?: number;
  openOnReveal?: boolean;
  // Also from the URL: the open case's disc is already in the player, or its booklet out.
  listenOnReveal?: boolean;
  readOnReveal?: boolean;
}

type Easing = (t: number) => number;

// A running tween: eases each property in `to` on `target` from its value when the tween starts.
interface Tween<K extends string = string> {
  target: Record<K, number>;
  to: Record<K, number>;
  from: Record<K, number> | null;
  duration: number;
  easing: Easing;
  onComplete?: (() => void) | null;
  time: number;
}

// A point in a lathe profile or a 2D layout: [x, y].
type Point = [number, number];

// A loaded image, or a generated canvas, which has no natural size (its width and height are used).
type Picture = HTMLImageElement | (HTMLCanvasElement & { naturalWidth?: undefined; naturalHeight?: undefined });

// Spring offsets and velocities from a swipe or a press (see swipe, pressCase and layout).
interface Push {
  pushX: number; pushY: number; pushZ: number; pushVX: number; pushVY: number; pushVZ: number;
  pushRotX: number; pushRotY: number; pushRotVX: number; pushRotVY: number;
}

interface Disc {
  group: THREE.Group;
  spin: THREE.Group;
  pick: THREE.Mesh;
  // A { value } uniform shared by the disc's materials (see withShade).
  shade: THREE.IUniform<number>;
  // The print's motion blur in radians while it spins (see withSpinBlur).
  blur: THREE.IUniform<number>;
  materials: THREE.MeshPhysicalMaterial[];
  frontMaterial: THREE.MeshPhysicalMaterial;
  art: THREE.CanvasTexture | null;
  disposed: boolean;
}

type PrintPart = 'cover' | 'bookletBack' | 'insert';

interface JewelCase extends Push {
  group: THREE.Group;
  spin: THREE.Group;
  body: THREE.Group;
  lid: THREE.Group;
  booklet: THREE.Mesh;
  pick: THREE.Mesh;
  disc: Disc;
  prints: Record<PrintPart, THREE.MeshStandardMaterial>;
  bookletModel: LeafThroughObject;
  bookletSources: PageSource[];
  // The inside pages' textures, made and uploaded by the gallery (loadBooklet), freed with the case.
  bookletTextures: THREE.Texture[];
  bookletReady: boolean;
  bookletLoaded: boolean;
  // Whether the disc's print and the cover are the album's artwork rather than the stand-in, and
  // whether they are its small first copies, with the full size still to come (sharpenArt).
  artLoaded: boolean;
  artSmall: boolean;
  // Whether the back insert and the booklet's back page have been asked for (loadInsert).
  insertLoaded: boolean;
  // How the whole page stack bends, including its shadow passes.
  bend: THREE.IUniform<THREE.Vector4>;
  // How far the sheets under the outer one are tucked in, 0 to 1 (see bookletTuck).
  bookletTuck: { value: number };
  // How far the bend has relaxed, 0 to 1 (see bookletBent): the carried paper lands flat.
  bookletFlatten: { value: number };
  // LeafThrough's gap between the sheets in the lid, in mm, and how many times wider it draws now
  // (1 under the holders, up to bookletStackOut's thickness out of the case; see C.bookletSheetGap).
  sheetGap: number;
  stackLoft: { value: number };
  plastic: THREE.MeshPhysicalMaterial;
  disposed: boolean;
  open: number;
  openTween: Tween | null;
  hover: number;
  spinX: number;
  spinY: number;
  spinRest: number;
  resetTween: Tween | null;
  placed: boolean;
  // How far the disc's reflections are turned back with the body (radians; see layout).
  envTurn: number;
  // Where the disc sits in the body, to put it back after the player, and the booklet in the lid.
  discRest: THREE.Matrix4;
  bookletRest: THREE.Matrix4;
}

interface SharedTextures {
  frontNormal: THREE.DataTexture;
  frontRough: THREE.DataTexture;
  scratches: THREE.CanvasTexture;
  caseWear: THREE.CanvasTexture;
  trayNormal: THREE.DataTexture;
  trayRough: THREE.DataTexture;
}

type SharedResources = ReturnType<typeof makeSharedResources>;

// A pointer held down on the stage, from pointerdown until it is released or cancelled.
interface Press {
  id: number;
  touch: boolean;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  lastTime: number;
  locked: boolean;
  spinVelocity: number;
  grabbed: number;
  // The timer for a touch held still on the front case (holdFlip), and whether it turned the case.
  hold: number;
  held: boolean;
}

interface WheelState {
  timer: number;
  armed: boolean;
  rising: boolean;
  total: number;
  direction: number;
  envelope: number;
  peak: number;
  count: number;
  stepTime: number;
  lastTime: number;
  hasLast: boolean;
}

interface FrameStats { awake: number; total: number; count: number; area: number; dpr: number }

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

// Millimetres to scene units.
const MM = 1 / 60;

// Depths through the closed case in millimetres, measured from its centre, plus the hinge line and
// the booklet's centre across.
const CASE = (() => {
  const back = -C.caseDepth / 2;
  const insert = back + C.basePlate + 0.05;
  const trayFront = insert + 0.05 + C.trayDepth;
  const lidInner = C.caseDepth / 2 - C.lidPlate;
  return {
    back, insert, trayFront, lidInner,
    // The disc rests on the 0.8 mm platform around the rosette.
    disc: trayFront + 0.8 + (C.discThickness / MM) / 2,
    // A hair behind the lid plate so the two faces never fight over depth.
    booklet: lidInner - C.bookletThickness / 2 - 0.1,
    hingeX: -C.caseWidth / 2 + C.hingeInset,
    bookletX: C.caseWidth / 2 - C.bookletInset - C.bookletSize / 2,
  };
})();

// How far the camera sits for a field of view of `fov` degrees, framing the z = 0 plane as the
// gallery's camera does.
const lensDistance = (fov: number) => (C.cameraDistance * Math.tan(THREE.MathUtils.degToRad(C.cameraFOV / 2))) / Math.tan(THREE.MathUtils.degToRad(fov / 2));

// Preserve the intended projected page height under the shared, raised Listen camera.
// Solve the perspective projection of the tilted page's two vertical endpoints for its size.
function bookletReadingSize(page: number, cameraY: number, distance: number, pitch: number, readY?: number) {
  const baseTan = Math.tan(THREE.MathUtils.degToRad(C.cameraFOV / 2));
  const y = baseTan * C.cameraDistance * C.bookletRaise;
  const basePitch = THREE.MathUtils.degToRad(C.bookletTilt);
  const h = page / 2, z = h * Math.sin(basePitch);
  const height = 2 * h * (C.cameraDistance * Math.cos(basePitch) - y * Math.sin(basePitch))
    / ((C.cameraDistance ** 2 - z ** 2) * baseTan);
  const focal = distance / (C.cameraDistance * baseTan);
  const a = focal * (distance * Math.cos(pitch) + (cameraY - (readY ?? y)) * Math.sin(pitch));
  const b = height * Math.sin(pitch) * distance;
  return 2 * height * distance ** 2 / (a + Math.sqrt(a * a + b * b));
}

// Reused by updatePlayer every frame.
const PLAYER_SCRATCH = {
  trayPosition: new THREE.Vector3(), trayQuaternion: new THREE.Quaternion(), trayScale: new THREE.Vector3(),
  seatPosition: new THREE.Vector3(), seatQuaternion: new THREE.Quaternion(), seatScale: new THREE.Vector3(),
  matrix: new THREE.Matrix4(), inverse: new THREE.Matrix4(), axis: new THREE.Vector3(), forward: new THREE.Vector3(), point: new THREE.Vector3(),
};

// Reused by layout for the disc's turned reflections (see envTurn).
const TURN_SCRATCH = { group: new THREE.Quaternion(), turn: new THREE.Quaternion(), axis: new THREE.Vector3(0, 1, 0) };

// Reused by updateBooklet every frame.
const TUCK_SCRATCH = { point: new THREE.Vector3(), matrix: new THREE.Matrix4() };
const BOOKLET_SCRATCH = {
  paper: new THREE.Vector3(),
  restPosition: new THREE.Vector3(), restQuaternion: new THREE.Quaternion(), restScale: new THREE.Vector3(),
  readPosition: new THREE.Vector3(), readQuaternion: new THREE.Quaternion(), backUp: new THREE.Quaternion(), turn: new THREE.Quaternion(),
  matrix: new THREE.Matrix4(), axis: new THREE.Vector3(), tilt: new THREE.Vector3(1, 0, 0),
  centre: new THREE.Vector3(), normal: new THREE.Vector3(), heading: new THREE.Vector3(), shift: new THREE.Vector3(), untilt: new THREE.Quaternion(), still: new THREE.Quaternion(), point: new THREE.Vector3(), caseMatrix: new THREE.Matrix4(), lidMatrix: new THREE.Matrix4(), bounds: new Float64Array(17 * 9 * 2 * 3), roll: new THREE.Vector4(), ray: new THREE.Ray(),
};

// Points over a disc of radius 1 in its plane (rings out to the rim), for keeping it out of the player.
const DISC_SAMPLES = [0.35, 0.7, 1].flatMap((radius) => Array.from({ length: 36 }, (_, n) =>
  new THREE.Vector3(Math.cos((n / 36) * Math.PI * 2) * radius, Math.sin((n / 36) * Math.PI * 2) * radius, 0)));

// Pixel ratio multipliers, stepped down while frames keep running long.
const QUALITY = [1, 0.85, 0.7, 0.55];

function cubicBezier(x1: number, y1: number, x2: number, y2: number): Easing {
  const ax = 3 * x1 - 3 * x2 + 1, bx = 3 * x2 - 6 * x1, cx = 3 * x1;
  const ay = 3 * y1 - 3 * y2 + 1, by = 3 * y2 - 6 * y1, cy = 3 * y1;
  return (x: number) => {
    if (x <= 0 || x >= 1) return x <= 0 ? 0 : 1;
    let t = x;
    for (let n = 0; n < 8; n++) {
      const error = ((ax * t + bx) * t + cx) * t - x;
      const slope = (3 * ax * t + 2 * bx) * t + cx;
      if (Math.abs(error) < 1e-6 || Math.abs(slope) < 1e-6) break;
      t = clamp(t - error / slope, 0, 1);
    }
    return ((ay * t + by) * t + cy) * t;
  };
}

const ease: Record<'glide' | 'linear' | 'power3In' | 'power3Out' | 'power3InOut', Easing> = {
  glide: cubicBezier(0.32, 0.72, 0, 1),
  linear: (t) => t,
  power3In: (t) => t ** 3,
  power3Out: (t) => 1 - (1 - t) ** 3,
  power3InOut: (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2),
};

function motionFor(source: string, distance: number): { duration: number; ease: Easing; kick: number } {
  const duration = C.snapDuration;
  if (source === 'wheel') return { duration: duration + 0.05, ease: ease.glide, kick: 2.5 };
  if (source === 'key') return { duration: Math.min(0.6, duration - 0.04 + distance * 0.05), ease: ease.glide, kick: 4 };
  if (source === 'click') return { duration: clamp(0.45 + distance * 0.11, duration, 1.05), ease: ease.glide, kick: Math.min(5, distance * 1.4) };
  if (source === 'flick') return { duration: duration + 0.1, ease: ease.glide, kick: 0 };
  return { duration, ease: ease.power3Out, kick: 0 };
}

// Keeps a dragged disc from spinning freely past roughly half a turn in the same direction.
function softSpin(angle: number, delta: number) {
  const limit = THREE.MathUtils.degToRad(C.maxSpinAngle);
  const over = Math.max(0, Math.abs(angle) - limit * 0.8) / limit;
  const resistance = 1 / (1 + over * over * 14);
  return angle + delta * (Math.sign(delta) === Math.sign(angle) || angle === 0 ? resistance : 1);
}

function makeDataTexture(data: Uint8Array, size: number, anisotropy: number) {
  const texture = new THREE.DataTexture(data, size, size);
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = anisotropy;
  texture.needsUpdate = true;
  return texture;
}

// Dark studio environment with soft horizontal light strips for the reflections.
function makeEnvironmentCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  // A new canvas has no other context, so a 2D one is always available (here and below).
  const ctx = canvas.getContext('2d')!;
  const background = ctx.createLinearGradient(0, 0, 0, 512);
  background.addColorStop(0, '#25282f');
  background.addColorStop(0.5, '#0e0f13');
  background.addColorStop(1, '#020203');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, 1024, 512);
  [[0.14, 0.07, 1], [0.4, 0.049, 0.6], [0.26, 0.077, 0.85], [0.62, 0.035, 0.35]].forEach(([center, height, strength]) => {
    const strip = ctx.createLinearGradient(0, 512 * (center - height), 0, 512 * (center + height));
    strip.addColorStop(0, 'rgba(255,255,255,0)');
    strip.addColorStop(0.5, `rgba(255,255,255,${Math.max(0.1, 0.85 * strength)})`);
    strip.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = strip;
    ctx.fillRect(0, 512 * (center - height), 1024, 512 * height * 2);
  });
  return canvas;
}

// Planar UVs so square artwork maps straight onto the ring.
function planarRing(inner: number, outer: number) {
  const geometry = new THREE.RingGeometry(inner, outer, 220, 1);
  const position = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  for (let n = 0; n < position.count; n++) uv.setXY(n, position.getX(n) * 0.5 + 0.5, position.getY(n) * 0.5 + 0.5);
  uv.needsUpdate = true;
  return geometry;
}

// Lathes each profile part on its own so the corners between parts stay crisp. Three's lathe
// normals match across the wrap-around seam; computeVertexNormals() would split them there and
// leave a visible line. Parts run counterclockwise in (radius, height) so normals face out.
function latheParts(parts: Point[][], segments: number) {
  const pieces = parts.map((points) => new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), segments));
  const geometry = mergeGeometries(pieces);
  pieces.forEach((piece) => piece.dispose());
  return geometry;
}

// The clear centre: one flat ring of plastic, as thick as the disc, from the hole to the artwork.
function makeHubGeometry() {
  const half = C.discThickness * 0.51;
  const inner = C.holeSize;
  const outer = C.hubSize + C.seamOverlap;
  return latheParts([[[inner, -half], [outer, -half]], [[outer, -half], [outer, half]], [[outer, half], [inner, half]], [[inner, half], [inner, -half]]], 160);
}

function mergeParts(parts: THREE.BufferGeometry[]) {
  const geometry = mergeGeometries(parts);
  parts.forEach((part) => part.dispose());
  return geometry.scale(MM, MM, MM);
}

const box = (width: number, height: number, depth: number, x: number, y: number, z: number) => new THREE.BoxGeometry(width, height, depth).translate(x, y, z);

// Marks a part of the clear case for makeCasePlastic: faces that cut through the sheet (normal
// across its thin axis: 0, 1 or 2 for x, y, z) get plasticEdge 1. Without an axis (the hinge pins)
// nothing is marked.
function sheet(geometry: THREE.BufferGeometry, thinAxis = -1) {
  const normal = geometry.attributes.normal;
  const edge = new Float32Array(normal.count);
  if (thinAxis >= 0) for (let n = 0; n < normal.count; n++) edge[n] = Math.abs(normal.getComponent(n, thinAxis)) < 0.5 ? 1 : 0;
  geometry.setAttribute('plasticEdge', new THREE.BufferAttribute(edge, 1));
  return geometry;
}

// A flat quad from four corners, counterclockwise as seen from its printed side, with their UVs.
function quad(corners: [number, number, number][], uvs: Point[]) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(corners.flat(), 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs.flat(), 2));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  geometry.computeVertexNormals();
  return geometry;
}

// The back insert folded as in the case: the back panel faces out through the base, and each end
// folds forward into a spine. The texture holds the insert flat (spine, panel, spine), so text
// reads the right way from outside.
function makeInsertGeometry() {
  const x = C.insertWidth / 2;
  const y = C.insertHeight / 2;
  const z = CASE.insert;
  const fold = z + C.spineWidth;
  const s = C.spineWidth / (C.insertWidth + C.spineWidth * 2);
  return mergeParts([
    quad([[x, -y, z], [-x, -y, z], [-x, y, z], [x, y, z]], [[s, 0], [1 - s, 0], [1 - s, 1], [s, 1]]),
    quad([[x, -y, fold], [x, -y, z], [x, y, z], [x, y, fold]], [[0, 0], [s, 0], [s, 1], [0, 1]]),
    quad([[-x, -y, z], [-x, -y, fold], [-x, y, fold], [-x, y, z]], [[1 - s, 0], [1, 0], [1, 1], [1 - s, 1]]),
  ]);
}

// The clear base: back plate, side walls over the spines (as tall as the tray), and at the hinge's
// top and bottom corners a knuckle with its pin, which the lid's flanges turn on. The knuckles
// close the gap between the tray's ends and the lid, so the hinge side reads as one piece.
function makeBaseShellGeometry() {
  const wallDepth = CASE.trayFront + 1.5 - CASE.back;
  const wallX = C.caseWidth / 2 - 1;
  const knuckleHeight = C.caseHeight / 2 - C.trayHeight / 2 - C.caseWall;
  const knuckleY = C.trayHeight / 2 + knuckleHeight / 2;
  const knuckles = [-1, 1].flatMap((side) => [
    sheet(box(4, knuckleHeight, wallDepth, CASE.hingeX + 2, side * knuckleY, CASE.back + wallDepth / 2), 1),
    sheet(new THREE.CylinderGeometry(1.6, 1.6, knuckleHeight + C.caseWall, 16).translate(CASE.hingeX, side * (knuckleY + C.caseWall / 2), 0)),
  ]);
  return mergeParts([
    sheet(box(C.caseWidth - 2, C.caseHeight - 2, C.basePlate, 0, 0, CASE.back + C.basePlate / 2), 2),
    sheet(box(C.caseWall, C.trayHeight, wallDepth, -wallX, 0, CASE.back + wallDepth / 2), 0),
    sheet(box(C.caseWall, C.trayHeight, wallDepth, wallX, 0, CASE.back + wallDepth / 2), 0),
    ...knuckles,
  ]);
}

// A flat half-disc with its straight edge on y = 0, bulging toward -y (side -1) or +y (side 1).
// Turned rather than mirrored for +y: a negative scale would turn its faces inside out, and the
// flipped normals then caught the light band as if facing it.
function halfDisc(radius: number, thickness: number, side: number) {
  const geometry = new THREE.CylinderGeometry(radius, radius, thickness, 24, 1, false, -Math.PI / 2, Math.PI).rotateX(Math.PI / 2);
  return side > 0 ? geometry.rotateZ(Math.PI) : geometry;
}

// The clear lid: front plate, the flanges along the top and bottom, the half-round tabs that hold
// the booklet's top and bottom edges just behind it, and the ribs that stop it at the free edge.
// Built around the hinge line so the lid group can rotate about its origin.
function makeLidShellGeometry() {
  const front = C.caseDepth / 2;
  const flangeY = C.caseHeight / 2 - C.caseWall / 2;
  const flangeInner = C.caseHeight / 2 - C.caseWall;
  const bookletBack = CASE.booklet - C.bookletThickness / 2;
  // The tabs sit just clear of the booklet's back (a shared face would z-fight).
  const tabX = [-1, 1].map((side) => CASE.bookletX + side * (C.bookletSize / 2 - C.lidTabInset));
  const tabs = tabX.flatMap((x) => [-1, 1].map((side) => sheet(halfDisc(C.lidTabRadius, 0.6, -side)
    .translate(x, side * flangeInner, bookletBack - 0.35), 2)));
  const [stopNear, stopFar] = C.lidStopY;
  const stopX = (CASE.bookletX + C.bookletSize / 2 + C.caseWidth / 2) / 2;
  const stops = [-1, 1].map((side) => sheet(box(0.8, stopFar - stopNear, 1.6, stopX, side * (stopNear + stopFar) / 2, CASE.lidInner - 0.8), 0));
  return mergeParts([
    sheet(box(C.caseWidth, C.caseHeight, C.lidPlate, 0, 0, front - C.lidPlate / 2), 2),
    sheet(box(C.caseWidth, C.caseWall, C.lidFlange, 0, flangeY, front - C.lidFlange / 2), 1),
    sheet(box(C.caseWidth, C.caseWall, C.lidFlange, 0, -flangeY, front - C.lidFlange / 2), 1),
    ...tabs,
    ...stops,
  ].map((part) => part.translate(-CASE.hingeX, 0, 0)));
}

// The black tray and its rosette: a raised platform the disc rests on and a ring of teeth that
// grips the centre hole. Along the hinge the tray rises into a finely ribbed strip, full height and
// just under the lid, which is what shows on the left of a closed case. A low ring outlines the
// disc well; the tray's top and bottom edges cut through it, as on real trays. Half-ring clips stand
// on the top and bottom edges.
function makeTrayGeometry() {
  const top = CASE.trayFront;
  const turnUp = (geometry: THREE.BufferGeometry) => geometry.rotateX(Math.PI / 2);
  const teeth = Array.from({ length: 12 }, (_, n) => new THREE.BoxGeometry(4.2, 1.1, 1)
    .translate(5.2, 0, 0).rotateZ((n / 12) * Math.PI * 2).translate(C.discOffsetX, 0, top + 1.3));
  const stripLeft = -C.caseWidth / 2 + 1.5;
  const stripHeight = C.trayHeight;
  const stripBack = CASE.insert + 0.05;
  const stripFront = CASE.lidInner - 0.4;
  const ribGap = (C.hingeStrip - 2) / C.hingeRibs;
  const ribs = Array.from({ length: C.hingeRibs }, (_, n) => box(ribGap * 0.45, stripHeight - 2, 0.2, stripLeft + 1 + ribGap * (n + 0.5), 0, stripFront + 0.1));
  // Lathed about y, then turned up, so angle 0 points down the tray; keep the arcs inside its height.
  const wellOuter = 62.4;
  const gap = Math.acos((C.trayHeight / 2 - 1) / wellOuter);
  const wellProfile = [[60.8, 0], [wellOuter, 0], [wellOuter, 0.5], [60.8, 0.5], [60.8, 0]].map(([x, y]) => new THREE.Vector2(x, y));
  const well = [gap, Math.PI + gap].map((start) => turnUp(new THREE.LatheGeometry(wellProfile, 48, start, Math.PI - gap * 2)).translate(C.discOffsetX, 0, top));
  const clipProfile = [[C.trayClipRadius - 0.7, 0], [C.trayClipRadius, 0], [C.trayClipRadius, 1.2], [C.trayClipRadius - 0.7, 1.2], [C.trayClipRadius - 0.7, 0]]
    .map(([x, y]) => new THREE.Vector2(x, y));
  // Each clip's arc opens toward the tray's edge and bulges in toward the disc.
  const clipX = [-1, 1].map((side) => C.discOffsetX + side * C.trayClipSpread);
  const clips = clipX.flatMap((x) => [-1, 1].map((side) => turnUp(new THREE.LatheGeometry(clipProfile, 24, side > 0 ? -Math.PI / 2 : Math.PI / 2, Math.PI))
    .translate(x, side * C.trayHeight / 2, top)));
  return mergeParts([
    box(C.trayWidth, C.trayHeight, C.trayDepth, 0, 0, top - C.trayDepth / 2),
    box(C.hingeStrip, stripHeight, stripFront - stripBack, stripLeft + C.hingeStrip / 2, 0, (stripFront + stripBack) / 2),
    ...ribs,
    ...well,
    ...clips,
    turnUp(new THREE.CylinderGeometry(17, 17, 0.8, 64)).translate(C.discOffsetX, 0, top + 0.4),
    turnUp(new THREE.CylinderGeometry(2.6, 2.6, 1, 24)).translate(C.discOffsetX, 0, top + 1.3),
    ...teeth,
  ]);
}

// GLSL for the end of a physical material's fragment shader that swaps the direct lights'
// reflections for one soft light: a long strip running left to right, above and in front
// (caseSheenDir). Flat, glossy parts (the case lid, the disc in the open case) otherwise mirror the
// strip light's exact rectangle. Leaves softBand, 0 to 1, for the caller to add as it needs.
function softReflection() {
  const glsl = (value: number) => value.toFixed(4);
  // The strip's plane holds its left-to-right axis and the direction to it; the band is how far the
  // reflected view ray points off that plane.
  const plane = new THREE.Vector3(1, 0, 0).cross(new THREE.Vector3(...C.caseSheenDir)).normalize();
  return `#ifdef USE_CLEARCOAT
outgoingLight -= reflectedLight.directSpecular * (1.0 - material.clearcoat * Fcc) + clearcoatSpecularDirect * material.clearcoat;
#else
outgoingLight -= reflectedLight.directSpecular;
#endif
vec3 softPlane = normalize((viewMatrix * vec4(${plane.toArray().map(glsl).join(', ')}, 0.0)).xyz);
float softBand = exp(-pow(asin(clamp(dot(reflect(-geometryViewDir, normal), softPlane), -1.0, 1.0)) / ${glsl(C.caseSheenWidth)}, 2.0));
// Taking the direct highlight out can go below zero at grazing angles, which showed as black specks.
outgoingLight = max(outgoingLight, vec3(0.0));`;
}

// Adds the soft reflection (softReflection) to an otherwise plain physical material at the given
// strength. A metal's reflection takes its own colour, so the part-metallic disc print tints it.
function withSoftReflection(material: THREE.MeshPhysicalMaterial, key: string, strength: number) {
  material.customProgramCacheKey = () => key;
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `${softReflection()}
outgoingLight += mix(vec3(1.0), diffuseColor.rgb, metalnessFactor) * softBand * ${strength.toFixed(4)};
#include <opaque_fragment>`);
  };
  return material;
}

// The player's glossy plastic with wear: the case's wear map (fine scratches and wipe marks, red)
// catches the light where the surface reflects the room. It is mapped onto each face from the
// model's own millimetres, repeating every playerWearScale. With `sheen`, the soft reflection
// (softReflection) is added at that strength, and the marks also show where it falls.
function withPlayerWear(material: THREE.MeshPhysicalMaterial, key: string, wear: THREE.Texture, sheen = 0) {
  const glsl = (value: number) => value.toFixed(4);
  material.customProgramCacheKey = () => key;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.playerWearMap = { value: wear };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWearPosition;\nvarying vec3 vWearNormal;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWearPosition = position;\nvWearNormal = normal;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D playerWearMap;\nvarying vec3 vWearPosition;\nvarying vec3 vWearNormal;')
      .replace('#include <opaque_fragment>', `${sheen ? softReflection() : 'float softBand = 0.0;'}
outgoingLight += vec3(softBand * ${glsl(sheen)});
vec3 wearFacing = abs(vWearNormal);
vec2 wearUv = wearFacing.y > 0.5 ? vWearPosition.xz : wearFacing.x > wearFacing.z ? vWearPosition.zy : vWearPosition.xy;
float wearMark = texture2D(playerWearMap, wearUv / ${glsl(C.playerWearScale)}).r;
float wearLight = dot(reflectedLight.indirectSpecular, vec3(0.3333)) + softBand;
outgoingLight += vec3(wearMark * ${glsl(C.playerWear)} * (0.04 + wearLight));
#include <opaque_fragment>`);
  };
  return material;
}

// Clear polycarbonate for the centre: plain see-through plastic with a slight tint. Real
// refraction (transmission) would show a blurred copy of the artwork and render the scene twice.
// Plain opacity would also fade the reflections, so edges seen side-on (Fresnel) and specular
// highlights stay opaque. That outlines the hole and rim and keeps the glints, like real plastic.
// Like the case, it reflects the soft strip light rather than the direct lights.
// `side` is DoubleSide for open sheets; a closed solid takes FrontSide (see makeDisc).
function makePlastic({ roughness, opacity, rings: ringList = [], side = THREE.DoubleSide }: { roughness: number; opacity: number; rings?: readonly (readonly [number, number, number])[]; side?: THREE.Side }) {
  const material = new THREE.MeshPhysicalMaterial({
    color: C.plasticTint, roughness, metalness: 0, transparent: true, opacity, depthWrite: false,
    clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1, side, forceSinglePass: true,
  });
  // Faint moulded rings (stacking ring, hole lip) as soft bands of extra opacity.
  const rings = ringList.map(([radius, width, amount]) => `plasticAlpha += ${amount.toFixed(3)} * exp(-pow((plasticRadius - ${radius.toFixed(4)}) / ${width.toFixed(4)}, 2.0));`).join('\n');
  material.customProgramCacheKey = () => 'plastic';
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 plasticPlane;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nplasticPlane = position.xz;');
    // The radius is taken per pixel: interpolated from the corners of the hub's long thin triangles,
    // it bent the fine rings into ticks and dashes that read as scratches.
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 plasticPlane;')
      .replace('#include <opaque_fragment>', `${softReflection()}
float plasticRadius = length(plasticPlane);
outgoingLight += vec3(softBand * ${C.caseSheen.toFixed(4)});
float plasticFresnel = pow(1.0 - abs(dot(normal, geometryViewDir)), 3.0);
float plasticGlint = dot(reflectedLight.indirectSpecular, vec3(0.3333)) + softBand * ${C.caseSheen.toFixed(4)};
float plasticAlpha = diffuseColor.a + plasticFresnel * ${C.plasticEdge.toFixed(3)} + plasticGlint;
${rings}
diffuseColor.a = clamp(plasticAlpha, 0.0, 1.0);
#include <opaque_fragment>`);
  };
  return material;
}

// The jewel case's clear polystyrene, one material per case so each has its own wear. Built on
// the hub's plastic, with three changes from reference photos:
// - No mirror images of the direct lights: the flat lid showed the strip light's exact rectangle.
//   Instead it reflects a long, soft strip light running left to right (caseSheenDir): a soft band
//   with no ends that slides across the lid as the case tilts.
// - Faces that cut through a sheet (marked by the plasticEdge attribute) get a little extra
//   opacity, so they read as thicker plastic. A bright, tinted version of these edges looked like
//   white outlines.
// - Wear from a shared map, shifted per case: fine scratches and cloth swirls (red) that show
//   mostly where the band reflects, and smudges (green) that make the band patchy.
function makeCasePlastic(shared: SharedResources, seed: number) {
  const material = new THREE.MeshPhysicalMaterial({
    color: C.plasticTint, roughness: 0.04, metalness: 0, transparent: true, opacity: C.casePlasticOpacity, depthWrite: false,
    clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1, side: THREE.DoubleSide, forceSinglePass: true,
  });
  const glsl = (value: number) => value.toFixed(4);
  material.customProgramCacheKey = () => 'case-plastic';
  material.onBeforeCompile = (shader) => {
    shader.uniforms.caseWearMap = { value: shared.textures.caseWear };
    shader.uniforms.caseSeed = { value: new THREE.Vector2(seed, (seed * 7.13) % 1) };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
attribute float plasticEdge;
varying float vCaseEdge;
varying vec2 vCaseUv;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vCaseEdge = plasticEdge;
vCaseUv = uv;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
uniform sampler2D caseWearMap;
uniform vec2 caseSeed;
varying float vCaseEdge;
varying vec2 vCaseUv;`)
      .replace('#include <opaque_fragment>', `${softReflection()}
vec2 caseWear = texture2D(caseWearMap, vCaseUv + caseSeed).rg;
float caseBand = softBand;
float caseSheen = caseBand * ${glsl(C.caseSheen)} * (1.0 + (caseWear.g - 0.5) * ${glsl(C.caseSmudges)});
float caseScratch = caseWear.r * ${glsl(C.caseScratches)} * (0.01 + caseBand) * (1.0 - vCaseEdge);
outgoingLight += vec3(caseSheen + caseScratch);
float caseFresnel = pow(1.0 - abs(dot(normal, geometryViewDir)), 3.0);
float caseGlint = dot(reflectedLight.indirectSpecular, vec3(0.3333));
diffuseColor.a = clamp(diffuseColor.a + caseFresnel * ${glsl(C.plasticEdge)} + caseGlint + caseSheen + caseScratch + vCaseEdge * ${glsl(C.caseEdgeAlpha)}, 0.0, 1.0);
#include <opaque_fragment>`);
  };
  return material;
}

// The data side. Its tracks are concentric, so they act as a diffraction grating. Light splits
// into soft pastel wedges on either side of the centre, lined up with the light, and the rest reads
// as bright silver. Grating maths after Alan Zucconi's CD-ROM shader, with his spectrum fit. Also
// adds faint track lines, light-catching scratches and a silver, slightly see-through band around
// the hub. `seed` varies the scratches per disc.
function makeBackMaterial(shared: SharedResources, seed: number) {
  const material = new THREE.MeshPhysicalMaterial({
    color: C.backColor, roughness: C.backRough, metalness: C.backMetal, clearcoat: C.backClearcoat, clearcoatRoughness: 0.05, envMapIntensity: 1.2,
    transparent: true,
  });
  const [lightA, lightB] = C.diffractionLights;
  const glsl = (value: number) => value.toFixed(4);
  material.customProgramCacheKey = () => 'cd-back';
  material.onBeforeCompile = (shader) => {
    // slice() returns a plain array; the first three entries are the direction.
    shader.uniforms.cdLightA = { value: new THREE.Vector3(...(lightA.slice(0, 3) as [number, number, number])).normalize() };
    shader.uniforms.cdLightB = { value: new THREE.Vector3(...(lightB.slice(0, 3) as [number, number, number])).normalize() };
    shader.uniforms.cdSeed = { value: seed };
    shader.uniforms.cdScratches = { value: shared.textures.scratches };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
varying vec3 vDiscLocal;
varying vec3 vDiscWorld;
varying vec3 vDiscTangent;
varying vec3 vDiscRadial;
varying vec3 vDiscAxisX;
varying vec3 vDiscAxisY;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vDiscLocal = position;
vDiscWorld = (modelMatrix * vec4(position, 1.0)).xyz;
vDiscTangent = (modelMatrix * vec4(-position.y, position.x, 0.0, 0.0)).xyz;
vDiscRadial = (modelMatrix * vec4(position.x, position.y, 0.0, 0.0)).xyz;
vDiscAxisX = (modelMatrix * vec4(1.0, 0.0, 0.0, 0.0)).xyz;
vDiscAxisY = (modelMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
uniform vec3 cdLightA;
uniform vec3 cdLightB;
uniform float cdSeed;
uniform sampler2D cdScratches;
varying vec3 vDiscLocal;
varying vec3 vDiscWorld;
varying vec3 vDiscTangent;
varying vec3 vDiscRadial;
varying vec3 vDiscAxisX;
varying vec3 vDiscAxisY;
vec3 cdBump(vec3 x, vec3 offset) {
  return clamp(vec3(1.0) - x * x - offset, 0.0, 1.0);
}
vec3 cdSpectrum(float wavelength) {
  if (wavelength < 400.0 || wavelength > 700.0) return vec3(0.0);
  float x = (wavelength - 400.0) / 300.0;
  return cdBump(vec3(3.54585104, 2.93225262, 2.41593945) * (x - vec3(0.69549072, 0.49228336, 0.27699880)), vec3(0.02312639, 0.15225084, 0.52607955))
    + cdBump(vec3(3.90307140, 3.21182957, 3.96587128) * (x - vec3(0.11748627, 0.86755042, 0.66077860)), vec3(0.84897130, 0.88445281, 0.73949448));
}
// Grating equation: order n shows wavelength |(light + view) . tangent| * spacing / n. Only the
// first two orders, each blurred over a small range as a soft light would. The radial term keeps
// colour where the reflection also works across the tracks, which lines the wedges up through
// the centre. sheen is the white zero-order streak.
vec3 cdDiffract(vec3 light, vec3 view, vec3 tangent, vec3 radial, out float sheen) {
  vec3 h = light + view;
  float u = abs(dot(h, tangent));
  float across = dot(h, radial);
  float focus = exp(-across * across * ${glsl(C.diffractionFocus)});
  vec3 colour = vec3(0.0);
  for (int n = 1; n <= 2; n++) {
    for (int k = -1; k <= 1; k++) {
      colour += cdSpectrum((u + float(k) * 0.03) * ${glsl(C.diffractionSpacing)} / float(n)) / (3.0 * float(n));
    }
  }
  sheen = exp(-u * u * 14.0) * focus;
  return colour * focus;
}`)
      .replace('#include <opaque_fragment>', `vec3 cdTangent = normalize(vDiscTangent);
vec3 cdRadialDir = normalize(vDiscRadial);
vec3 cdView = normalize(cameraPosition - vDiscWorld);
float cdSheenA;
float cdSheenB;
vec3 cdRainbow = cdDiffract(cdLightA, cdView, cdTangent, cdRadialDir, cdSheenA) * ${glsl(lightA[3])}
  + cdDiffract(cdLightB, cdView, cdTangent, cdRadialDir, cdSheenB) * ${glsl(lightB[3])};
float cdSheen = cdSheenA * ${glsl(lightA[3])} + cdSheenB * ${glsl(lightB[3])};
// Real discs wash the colours out with the silver around them.
cdRainbow = mix(vec3(dot(cdRainbow, vec3(0.3333))), cdRainbow, ${glsl(C.diffractionSaturation)});
float cdRadius = length(vDiscLocal.xy);
float cdInBand = smoothstep(${glsl(C.hubSize)}, ${glsl(C.hubSize + 0.004)}, cdRadius) * (1.0 - smoothstep(${glsl(C.hubSize + C.backBand - 0.004)}, ${glsl(C.hubSize + C.backBand)}, cdRadius));
// Fine rings fade out where they would be smaller than a pixel and shimmer.
float cdTrackPhase = cdRadius * 520.0;
float cdTrack = sin(cdTrackPhase) * clamp(1.0 - fwidth(cdTrackPhase) * 1.5, 0.0, 1.0);
float cdMouldPhase = cdRadius * 1100.0;
float cdMould = sin(cdMouldPhase) * clamp(1.0 - fwidth(cdMouldPhase) * 1.5, 0.0, 1.0);
// Bright silver base with faint tonal bands and track lines.
float cdTone = 1.0 + ${glsl(C.trackLines)} * (0.6 * sin(cdRadius * 91.0 + cdSeed * 11.0) + cdTrack);
vec3 cdSilver = (outgoingLight * ${glsl(C.backReflect)} + vec3(${glsl(C.backSilver)})) * cdTone;
vec3 cdData = cdSilver + cdSheen * ${glsl(C.backSheen)} + cdRainbow * ${glsl(C.diffractionStrength)};
// The band around the hub is bare mirror under clear plastic: silver, no rainbow, finely ringed.
vec3 cdBandLight = (cdSilver * 0.92 + cdSheen * 0.15) * (1.0 + 0.06 * cdMould);
outgoingLight = mix(cdData, cdBandLight, cdInBand);
// Scratches: the map stores each scratch's strength and direction. A scratch is a tiny groove, so
// it only glints where its angle reflects the light toward the viewer; elsewhere it is barely
// there and the disc shows through. Each disc turns the shared map by its seed.
float cdAngle = cdSeed * 6.2832;
vec2 cdTurn = vec2(cos(cdAngle), sin(cdAngle));
vec2 cdScratchUV = mat2(cdTurn.x, cdTurn.y, -cdTurn.y, cdTurn.x) * vDiscLocal.xy * 0.5 + 0.5;
vec3 cdScratchMap = texture2D(cdScratches, cdScratchUV).rgb;
float cdScratch = cdScratchMap.r;
vec2 cdDouble = cdScratchMap.gb / max(cdScratch, 0.004) * 2.0 - 1.0;
float cdTheta = 0.5 * atan(cdDouble.y, cdDouble.x);
vec2 cdMapDir = vec2(cos(cdTheta), sin(cdTheta));
vec2 cdLocalDir = vec2(dot(cdMapDir, cdTurn), dot(cdMapDir, vec2(-cdTurn.y, cdTurn.x)));
vec3 cdScratchDir = normalize(vDiscAxisX * cdLocalDir.x + vDiscAxisY * cdLocalDir.y);
float cdScratchU = dot(cdLightA + cdView, cdScratchDir);
float cdGlint = exp(-cdScratchU * cdScratchU * 30.0);
outgoingLight += vec3(0.9) * cdScratch * (0.06 + 0.6 * cdGlint) * ${glsl(C.scratchAmount)} * (1.0 - cdInBand);
diffuseColor.a = mix(1.0, ${glsl(C.backBandOpacity)}, cdInBand);
#include <opaque_fragment>`);
  };
  return material;
}

// Wear on the data side: a few short, fine marks and some small curved wipe marks, no long lines.
// Red holds the strength; green and blue hold the direction as (cos 2θ, sin 2θ), scaled by the
// strength so antialiased edges keep the right angle. Strokes add up rather than overwrite.
function makeScratchCanvas(size: number) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, size, size);
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  const stroke = (x: number, y: number, angle: number, length: number, strength: number, width: number) => {
    // Canvas y points down while texture v points up, so the angle flips.
    const encoded = -2 * angle;
    const level = Math.round(255 * strength);
    ctx.strokeStyle = `rgb(${level}, ${Math.round(level * (0.5 + 0.5 * Math.cos(encoded)))}, ${Math.round(level * (0.5 + 0.5 * Math.sin(encoded)))})`;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
    ctx.stroke();
  };
  for (let n = 0; n < C.scratchCount; n++) {
    stroke(Math.random() * size, Math.random() * size, Math.random() * Math.PI, size * (0.015 + Math.random() * 0.06), 0.35 + Math.random() * 0.5, 0.5 + Math.random() * 0.5);
  }
  // Wipe marks follow small arcs, drawn as short segments so each keeps its own direction.
  for (let n = 0; n < C.scratchArcs; n++) {
    const radius = size * (0.25 + Math.random() * 0.2);
    let angle = Math.random() * Math.PI * 2;
    const end = angle + 0.08 + Math.random() * 0.15;
    const strength = 0.2 + Math.random() * 0.25;
    for (; angle < end; angle += 0.01) {
      const x = size / 2 + Math.cos(angle) * radius;
      const y = size / 2 + Math.sin(angle) * radius;
      stroke(x, y, angle + Math.PI / 2, radius * 0.0105, strength, 0.5);
    }
  }
  return canvas;
}

// Wear on the case plastic. Red: many fine, short scratches, a few longer faint ones, and swirls
// of short arcs where a cloth wiped the lid. Green: smudges as soft blotches around mid grey.
// Tiles, so each case can sample it at its own offset.
function makeCaseWearCanvas(size: number) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = 'rgb(0, 110, 0)';
  ctx.fillRect(0, 0, size, size);
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  const line = (x: number, y: number, angle: number, length: number, alpha: number, width: number) => {
    ctx.strokeStyle = `rgba(255, 0, 0, ${alpha})`;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
    ctx.stroke();
  };
  for (let n = 0; n < 70; n++) line(Math.random() * size, Math.random() * size, Math.random() * Math.PI, size * (0.008 + Math.random() * 0.035), 0.2 + Math.random() * 0.4, 0.5 + Math.random() * 0.4);
  for (let n = 0; n < 4; n++) line(Math.random() * size, Math.random() * size, Math.random() * Math.PI, size * (0.15 + Math.random() * 0.25), 0.15 + Math.random() * 0.2, 0.7);
  for (let n = 0; n < 4; n++) {
    const cx = Math.random() * size;
    const cy = Math.random() * size;
    for (let k = 0; k < 14; k++) {
      const radius = size * (0.05 + Math.random() * 0.12);
      const start = Math.random() * Math.PI * 2;
      ctx.strokeStyle = `rgba(255, 0, 0, ${0.1 + Math.random() * 0.15})`;
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, start, start + 0.3 + Math.random() * 0.6);
      ctx.stroke();
    }
  }
  for (let n = 0; n < 26; n++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const radius = size * (0.03 + Math.random() * 0.08);
    const blot = ctx.createRadialGradient(x, y, 0, x, y, radius);
    blot.addColorStop(0, `rgba(0, 255, 0, ${0.15 + Math.random() * 0.2})`);
    blot.addColorStop(1, 'rgba(0, 255, 0, 0)');
    ctx.fillStyle = blot;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  return canvas;
}

// Satin black tray: a fine stipple as bumps (normal map) and as roughness variation.
// A stable 0 to 1 value per album, so each disc keeps its own wear.
function seedFrom(text: string | number) {
  let hash = 2166136261;
  for (const char of String(text)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return (hash >>> 0) / 4294967295;
}

// The side of the tray's stipple maps, in pixels.
const TRAY_MAP_SIZE = 512;

// The disc print's normal and roughness maps, the tray's, and the booklets' paper grain start
// empty: a worker generates them (procedural.ts) and fillProcedural puts them in.
function makeSharedResources(renderer: THREE.WebGLRenderer) {
  const anisotropy = renderer.capabilities.getMaxAnisotropy();
  const size = C.mapResolution;
  const empty = (side: number) => new Uint8Array(side * side * 4);
  // trayNormal and trayRough are added just below.
  const textures = {
    frontNormal: makeDataTexture(empty(size), size, anisotropy),
    frontRough: makeDataTexture(empty(size), size, anisotropy),
    scratches: new THREE.CanvasTexture(makeScratchCanvas(size)),
    caseWear: new THREE.CanvasTexture(makeCaseWearCanvas(size)),
  } as SharedTextures;
  textures.caseWear.wrapS = textures.caseWear.wrapT = THREE.RepeatWrapping;
  textures.caseWear.anisotropy = anisotropy;
  textures.trayNormal = makeDataTexture(empty(TRAY_MAP_SIZE), TRAY_MAP_SIZE, anisotropy);
  textures.trayRough = makeDataTexture(empty(TRAY_MAP_SIZE), TRAY_MAP_SIZE, anisotropy);
  for (const texture of [textures.trayNormal, textures.trayRough]) {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(3, 3);
  }
  const geometries = {
    front: planarRing(C.hubSize, 1 - C.edgeBleed),
    back: planarRing(C.hubSize, 1 - C.edgeBleed),
    hub: makeHubGeometry(),
    pick: new THREE.CircleGeometry(1, 24),
    baseShell: makeBaseShellGeometry(),
    lidShell: makeLidShellGeometry(),
    tray: makeTrayGeometry(),
    insert: makeInsertGeometry(),
    // Picking bounds; the visible booklet is LeafThrough's formed page stack.
    booklet: new THREE.BoxGeometry(C.bookletSize * MM, C.bookletSize * MM, C.bookletThickness * MM),
    casePick: new THREE.PlaneGeometry(C.caseWidth * MM, C.caseHeight * MM),
  };
  const materials = {
    // Satin black polystyrene with a fine stipple.
    tray: new THREE.MeshPhysicalMaterial({
      color: C.trayColor, roughness: 1, roughnessMap: textures.trayRough, normalMap: textures.trayNormal, normalScale: new THREE.Vector2(1, 1), metalness: 0, envMapIntensity: 1.8,
      clearcoat: 0.15, clearcoatRoughness: 0.35,
    }),
    pick: new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide, depthWrite: false }),
  };
  // The paper grain every booklet shares (makeCase); LeafThrough wraps it in a texture of its own.
  const grain = document.createElement('canvas');
  grain.width = grain.height = GRAIN_SIZE;
  return { textures, geometries, materials, anisotropy, grain };
}

// The parameters the procedural maps depend on, for the worker.
function proceduralParams(): ProceduralParams {
  return { mapResolution: C.mapResolution, traySize: TRAY_MAP_SIZE, frontRough: C.frontRough, texGrain: C.texGrain, texPrint: C.texPrint, texScratches: C.texScratches, texGloss: C.texGloss, trayStipple: C.trayStipple, trayRough: C.trayRough };
}

// Generates the maps in a worker (procedural.worker.ts), or on this thread where that fails.
function generateInWorker(params: ProceduralParams) {
  return new Promise<ProceduralMaps>((resolve) => {
    let worker: Worker | null = null;
    try {
      worker = new Worker(new URL('./procedural.worker.ts', import.meta.url), { type: 'module' });
    } catch {
      worker = null;
    }
    if (!worker) return resolve(generateProcedural(params));
    const fallback = () => {
      worker.terminate();
      resolve(generateProcedural(params));
    };
    worker.onmessage = (event: MessageEvent<ProceduralMaps>) => {
      worker.terminate();
      resolve(event.data);
    };
    worker.onerror = fallback;
    worker.onmessageerror = fallback;
    worker.postMessage(params);
  });
}

// Puts the generated maps into the shared textures and the paper grain into its canvas, and
// uploads the textures now (a first upload mid-scroll stalls the frame).
function fillProcedural(shared: SharedResources, maps: ProceduralMaps, renderer: THREE.WebGLRenderer) {
  const fill = (texture: THREE.DataTexture, data: Uint8Array) => {
    texture.image.data = data;
    texture.needsUpdate = true;
    renderer.initTexture(texture);
  };
  fill(shared.textures.frontNormal, maps.frontNormal);
  fill(shared.textures.frontRough, maps.frontRough);
  fill(shared.textures.trayNormal, maps.trayNormal);
  fill(shared.textures.trayRough, maps.trayRough);
  shared.grain.getContext('2d')!.putImageData(new ImageData(maps.grain, GRAIN_SIZE, GRAIN_SIZE), 0, 0);
}

// A square region of an image: its top left corner and its side, in the image's pixels.
interface Crop { x: number; y: number; size: number }

// The side of the small copy findDiscInScan reads.
const SCAN_SAMPLE = 256;

// Where the disc is in a scan, found on a small copy made off the main thread where the browser
// can (createImageBitmap with a size; Chrome and Safari scale on another thread). Scaling each
// 1200 px scan on a 2D canvas held the main thread for 5 ms per disc at the start.
async function locateDisc(scan: HTMLImageElement): Promise<Crop> {
  let sample: ImageBitmap | null = null;
  try {
    sample = await createImageBitmap(scan, { resizeWidth: SCAN_SAMPLE, resizeHeight: SCAN_SAMPLE });
  } catch {}
  const crop = findDiscInScan(scan, sample ?? scan);
  sample?.close();
  return crop;
}

// Finds the disc in a scan: rows and columns where enough pixels differ from the background,
// sampled at the corners. Scans come tightly cropped or with a margin, on white or on black, and
// sometimes cut off at the sides, so the larger extent is taken as the diameter. Reads `sample`,
// the scan at SCAN_SAMPLE px (or the scan itself, scaled here), and answers in the scan's pixels.
function findDiscInScan(image: Picture, sample: Picture | ImageBitmap = image): Crop {
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  const full = { x: (width - Math.max(width, height)) / 2, y: (height - Math.max(width, height)) / 2, size: Math.max(width, height) };
  const size = SCAN_SAMPLE;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(sample, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);
  const corners = [[2, 2], [size - 3, 2], [2, size - 3], [size - 3, size - 3]].map(([x, y]) => (y * size + x) * 4);
  const background = [0, 1, 2].map((channel) => corners.reduce((sum, index) => sum + data[index + channel], 0) / corners.length);
  const spread = Math.max(...corners.map((index) => Math.abs(data[index] - background[0]) + Math.abs(data[index + 1] - background[1]) + Math.abs(data[index + 2] - background[2])));
  if (spread > 60) return full;
  const rows = new Uint16Array(size);
  const columns = new Uint16Array(size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const index = (y * size + x) * 4;
      const difference = Math.abs(data[index] - background[0]) + Math.abs(data[index + 1] - background[1]) + Math.abs(data[index + 2] - background[2]);
      if (difference > 40) {
        rows[y] += 1;
        columns[x] += 1;
      }
    }
  }
  const extent = (counts: Uint16Array) => {
    const first = counts.findIndex((count) => count >= 6);
    const last = size - 1 - [...counts].reverse().findIndex((count) => count >= 6);
    return first < 0 ? [0, size - 1] : [first, last + 1];
  };
  const [left, right] = extent(columns);
  const [top, bottom] = extent(rows);
  const scaleX = width / size;
  const scaleY = height / size;
  const diameter = Math.max((right - left) * scaleX, (bottom - top) * scaleY);
  return {
    x: ((left + right) / 2) * scaleX - diameter / 2,
    y: ((top + bottom) / 2) * scaleY - diameter / 2,
    size: diameter,
  };
}

// A 2 × 2 canvas of one colour: the stand-in for artwork that hasn't come.
function makeColourCanvas(colour: string) {
  const canvas = Object.assign(document.createElement('canvas'), { width: 2, height: 2 });
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = colour;
  ctx.fillRect(0, 0, 2, 2);
  return canvas;
}

// Draws the label into the ring around the clear hub. A disc scan is fitted to the disc (`crop`,
// where locateDisc found it) and already shows its own mirror band; square cover art is
// cover-fitted and gets a drawn one.
function makeArtTexture(image: Picture, anisotropy: number, crop: Crop | null = null) {
  const size = C.artResolution;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.arc(size / 2, size / 2, (size / 2) * Math.max(C.holeSize, C.hubSize), 0, Math.PI * 2, true);
  ctx.clip('evenodd');
  ctx.fillStyle = C.discFallback;
  ctx.fillRect(0, 0, size, size);
  if (crop) {
    // A small inset removes the scanner background and uneven cut edge. Keep the crop centred on
    // the detected disc, so no white crescent appears as it rotates on the player.
    const inset = crop.size * C.discScanInset;
    ctx.drawImage(image, crop.x + inset, crop.y + inset, crop.size - inset * 2, crop.size - inset * 2, 0, 0, size, size);
  } else {
    const ratio = (image.naturalWidth || image.width) / (image.naturalHeight || image.height);
    const width = ratio > 1 ? size * ratio : size;
    const height = ratio > 1 ? size : size / ratio;
    ctx.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
    // Mirror band: between the clear hub and the print you see the reflective layer through bare
    // plastic, so the colours read a little darker there.
    const centre = size / 2;
    ctx.beginPath();
    ctx.arc(centre, centre, centre * C.labelInner, 0, Math.PI * 2);
    ctx.arc(centre, centre, centre * C.hubSize, 0, Math.PI * 2, true);
    ctx.fillStyle = `rgba(6, 6, 10, ${C.mirrorBandShade})`;
    ctx.fill('evenodd');
  }
  // The print stops short of the edge (discPrintEdge), which is the fallback colour all round: a
  // scan's last pixels can hold scanner background, which a spinning disc smears into a white ring.
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.arc(size / 2, size / 2, (size / 2) * C.discPrintEdge, 0, Math.PI * 2, true);
  ctx.fillStyle = C.discFallback;
  ctx.fill('evenodd');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = anisotropy;
  return texture;
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, startSize: number, minSize = 42) {
  let size = startSize;
  do {
    ctx.font = `500 ${size}px Georgia, serif`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 4;
  } while (size > minSize);
  return size;
}

function makeFallbackArt(album: Album, index: number) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;
  const background = ctx.createLinearGradient(0, 0, 1024, 1024);
  background.addColorStop(0, album.accent || '#dcc5a2');
  background.addColorStop(1, album.color || '#3b3a36');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, 1024, 1024);

  const motif = album.motif || 'rings';
  ctx.save();
  if (motif === 'sun') {
    const glow = ctx.createRadialGradient(575, 420, 0, 575, 420, 490);
    glow.addColorStop(0, 'rgba(255,247,209,.9)');
    glow.addColorStop(0.38, 'rgba(255,217,154,.46)');
    glow.addColorStop(1, 'rgba(255,217,154,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 1024, 1024);
    ctx.fillStyle = 'rgba(255,242,208,.72)';
    ctx.beginPath(); ctx.arc(580, 405, 235, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = album.color || '#3b3a36';
    ctx.beginPath(); ctx.moveTo(0, 755); ctx.bezierCurveTo(280, 550, 550, 920, 1024, 645); ctx.lineTo(1024, 1024); ctx.lineTo(0, 1024); ctx.fill();
  } else if (motif === 'waves') {
    for (let n = 0; n < 14; n++) {
      ctx.beginPath();
      ctx.moveTo(-100, 235 + n * 58);
      ctx.bezierCurveTo(240, 35 + n * 55, 655, 530 + n * 25, 1125, 170 + n * 61);
      ctx.lineWidth = n % 3 === 0 ? 8 : 3;
      ctx.strokeStyle = `rgba(227,239,235,${0.08 + n * 0.02})`;
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(1,16,29,.34)';
    ctx.fillRect(0, 645, 1024, 379);
  } else if (motif === 'arches') {
    for (let n = 0; n < 7; n++) {
      ctx.beginPath();
      ctx.arc(520, 905, 115 + n * 108, Math.PI, 0);
      ctx.lineWidth = 68;
      ctx.strokeStyle = n % 2 ? 'rgba(255,225,184,.28)' : 'rgba(74,37,32,.26)';
      ctx.stroke();
    }
  } else if (motif === 'rings') {
    for (let n = 0; n < 18; n++) {
      ctx.beginPath();
      ctx.ellipse(525, 445, 90 + n * 43, 28 + n * 32, -0.36, 0, Math.PI * 2);
      ctx.lineWidth = n % 4 === 0 ? 10 : 3;
      ctx.strokeStyle = `rgba(238,229,193,${0.2 + n * 0.019})`;
      ctx.stroke();
    }
  } else if (motif === 'lines') {
    for (let n = -8; n < 24; n++) {
      ctx.beginPath();
      ctx.moveTo(n * 86 - 220, -100);
      ctx.lineTo(n * 86 + 270, 1124);
      ctx.lineWidth = n % 4 === 0 ? 28 : 7;
      ctx.strokeStyle = n % 4 === 0 ? 'rgba(55,48,42,.38)' : 'rgba(55,48,42,.13)';
      ctx.stroke();
    }
  } else {
    for (let n = 0; n < 72; n++) {
      const x = (n * 319) % 1024;
      const y = (n * 557) % 1024;
      const radius = n % 9 === 0 ? 5 : 2;
      ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,234,187,${0.22 + (n % 5) * 0.11})`;
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(239,206,151,.42)';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.ellipse(500, 440, 380, 195, -0.55, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();

  const veil = ctx.createLinearGradient(0, 580, 0, 1024);
  veil.addColorStop(0, 'rgba(0,0,0,0)');
  veil.addColorStop(1, 'rgba(0,0,0,.42)');
  ctx.fillStyle = veil;
  ctx.fillRect(0, 570, 1024, 454);
  ctx.fillStyle = 'rgba(255,255,255,.88)';
  ctx.font = '500 22px Arial, sans-serif';
  ctx.letterSpacing = '8px';
  ctx.fillText((album.artist || '').toUpperCase(), 105, 120);
  ctx.letterSpacing = '0px';
  fitText(ctx, album.title.toUpperCase(), 720, 88);
  const words = album.title.toUpperCase().split(' ');
  let lines = [''];
  for (const word of words) {
    const candidate = `${lines.at(-1)} ${word}`.trim();
    if (ctx.measureText(candidate).width > 715 && lines.at(-1)) lines.push(word);
    else lines[lines.length - 1] = candidate;
  }
  lines = lines.slice(0, 3);
  lines.forEach((line, lineIndex) => ctx.fillText(line, 105, 795 + lineIndex * 93));
  ctx.font = '500 22px Arial, sans-serif';
  ctx.fillText(`${album.year || ''}     /     ${String(index + 1).padStart(2, '0')}`, 108, 968);

  // A little print texture keeps the generated sample artwork from feeling flat.
  for (let n = 0; n < 2300; n++) {
    const x = (n * 73.71) % 1024;
    const y = (n * 129.43) % 1024;
    ctx.fillStyle = n % 2 ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.045)';
    ctx.fillRect(x, y, 1.5, 1.5);
  }

  return canvas;
}

// A booklet page from an image, cropped to fill the square.
function makeSquareCanvas(image: HTMLImageElement, side?: 'left' | 'right') {
  const size = C.artResolution;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  const crop = Math.min(width, height);
  const x = side === 'left' ? 0 : side === 'right' ? width - crop : (width - crop) / 2;
  canvas.getContext('2d')!.drawImage(image, x, (height - crop) / 2, crop, crop, 0, 0, size, size);
  return canvas;
}

// A plain back page for booklets without a scan: the album colour, the artist name small at the foot.
function makeBookletBackCanvas(album: Album) {
  const size = C.artResolution;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = album.color || '#3b3a36';
  ctx.fillRect(0, 0, size, size);
  const shade = ctx.createLinearGradient(0, 0, size, size);
  shade.addColorStop(0, 'rgba(255,255,255,.08)');
  shade.addColorStop(1, 'rgba(0,0,0,.3)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = album.accent || '#dcc5a2';
  ctx.font = '500 20px Arial, sans-serif';
  ctx.letterSpacing = '8px';
  ctx.textAlign = 'center';
  ctx.fillText((album.artist || '').toUpperCase(), size / 2, size - 90);
  return canvas;
}

// The back insert as printed, laid flat: spine, back panel, spine. A scan that includes the spines
// fills it. A scan of the panel alone gets generated spines, and without a scan the panel is
// generated too, with the tracklist when the album has one.
function makeInsertCanvas(album: Album, image: HTMLImageElement | null) {
  const total = C.insertWidth + C.spineWidth * 2;
  const height = C.artResolution;
  const width = Math.round((height * total) / C.insertHeight);
  const spine = Math.round((width * C.spineWidth) / total);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const ratio = image ? (image.naturalWidth || image.width) / (image.naturalHeight || image.height) : 0;
  // Between the panel's proportions (138 × 118) and the whole insert's (151 × 118).
  if (image && ratio > (C.insertWidth + total) / 2 / C.insertHeight) {
    ctx.drawImage(image, 0, 0, width, height);
    return canvas;
  }
  const artist = (album.artist || '').toUpperCase();
  const accent = album.accent || '#dcc5a2';
  ctx.fillStyle = album.color || '#3b3a36';
  ctx.fillRect(0, 0, width, height);
  const shade = ctx.createLinearGradient(0, 0, width, height);
  shade.addColorStop(0, 'rgba(255,255,255,.06)');
  shade.addColorStop(1, 'rgba(0,0,0,.32)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, width, height);
  if (image) {
    ctx.drawImage(image, spine, 0, width - spine * 2, height);
  } else {
    const left = spine + 72;
    ctx.fillStyle = accent;
    ctx.font = '500 18px Arial, sans-serif';
    ctx.letterSpacing = '6px';
    ctx.fillText(artist, left, 104);
    ctx.letterSpacing = '0px';
    fitText(ctx, album.title, width - spine * 2 - 144, 60, 30);
    ctx.fillText(album.title, left, 178);
    const lines = album.tracks?.length ? album.tracks.map((track, n) => `${n + 1}   ${track.title}`) : [album.kind, album.year].filter(Boolean);
    ctx.font = '400 24px Georgia, serif';
    lines.slice(0, 18).forEach((line, n) => ctx.fillText(line, left, 270 + n * 36));
    // Barcode sticker and the small print beside it.
    ctx.fillStyle = '#f2efe8';
    ctx.fillRect(left, height - 196, 236, 118);
    ctx.fillStyle = '#16161a';
    for (let x = 0, n = 0; x < 200; n++) {
      const bar = 2 + (Math.floor(seedFrom(`${album.id}${n}`) * 4) % 3);
      if (n % 2 === 0) ctx.fillRect(left + 18 + x, height - 180, bar, 70);
      x += bar + 1;
    }
    ctx.fillStyle = accent;
    ctx.font = '400 15px Arial, sans-serif';
    ctx.fillText(`℗ © ${album.year || ''} ${artist}`, left + 270, height - 94);
  }
  // Spines: artist and title along the length, reading top to bottom.
  ctx.fillStyle = accent;
  ctx.font = '500 22px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.letterSpacing = '3px';
  for (const x of [spine / 2, width - spine / 2]) {
    ctx.save();
    ctx.translate(x, height / 2);
    ctx.rotate(Math.PI / 2);
    ctx.fillText(`${artist}   ${album.title.toUpperCase()}`, 0, 0);
    ctx.restore();
  }
  return canvas;
}

// The scene has no shadows, so a disc inside a closed case would be lit as if it lay in the open,
// and its edge would glow through the gaps around the booklet. shade (a { value } uniform, 0 to 1)
// scales the light a disc's materials give off: dark while the lid covers it, brightening as the
// lid opens. Chains onto any onBeforeCompile the material already has.
function withShade<T extends THREE.Material>(material: T, shade: THREE.IUniform<number>): T {
  const compile = material.onBeforeCompile;
  const key = material.customProgramCacheKey;
  material.customProgramCacheKey = () => `${key.call(material)}-shaded`;
  material.onBeforeCompile = (shader, renderer) => {
    compile.call(material, shader, renderer);
    shader.uniforms.discShade = shade;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float discShade;')
      .replace('#include <opaque_fragment>', 'outgoingLight *= discShade;\n#include <opaque_fragment>');
  };
  return material;
}

// Both secondary views use the same case pan, lens and easing while the case is visible.
function viewPan(t: number) {
  return ease.power3InOut(clamp((t - C.viewPanFrom) / (C.viewPanUntil - C.viewPanFrom), 0, 1));
}

// The point of the way at which `fed` of the roll's whole length has been fed through.
function bookletFedAt(lidAngle: number, side: number, fed: number) {
  const total = bookletFrontArc(lidAngle, side) + C.bookletSize * MM;
  let low = 0, high = 1;
  for (let n = 0; n < 20; n++) {
    const middle = (low + high) / 2;
    if (bookletEase(middle) < fed / total) low = middle;
    else high = middle;
  }
  return high * C.bookletRollUntil;
}

// Wait until the booklet starts round the cylinder, out from under the lid, then give the case the
// complete Listen pan interval. Multiplying by the extraction amount used to compress/accelerate
// that pan; started as the paper left the holders, the lid's flange rose into its trailing corner.
function bookletPanStart(lidAngle: number, side: number) {
  return Math.max(C.bookletPanFrom, bookletFedAt(lidAngle, side, bookletTurnFrom(side)));
}

// The way out of the holders, in mm: the bend up to the entry angle, and the run after it, on a
// gentle arc (its turn, radians a scene unit).
function bookletEntrySpan(side: number) {
  return side > 0 ? C.bookletEntrySpan : C.bookletEntrySpanNarrow;
}
function bookletLiftRun(side: number) {
  return side > 0 ? C.bookletLiftRun : C.bookletLiftRunNarrow;
}
// The cylinder's radius, scene units: wider on phones, where the booklet may leave the screen.
function bookletCylinder(side: number) {
  return (side > 0 ? C.bookletCylinder : C.bookletCylinderNarrow) * MM;
}
function bookletLiftTurn(side: number) {
  return 1 / ((side > 0 ? C.bookletLiftRadius : C.bookletLiftRadiusNarrow) * MM);
}

// The length of the path up to the cylinder's line nearest the camera.
function bookletFrontArc(lidAngle: number, side: number, radius = bookletCylinder(side)) {
  const lifted = bookletEntryAngle(lidAngle, side) + bookletLiftRun(side) * MM * bookletLiftTurn(side);
  return (bookletEntrySpan(side) + bookletLiftRun(side)) * MM + (Math.PI - lifted) * radius;
}

// How far the paper has been pulled when its centre starts round the cylinder: out of the holders
// (110 mm) and some 30 mm on, past the hinge pins. The pose change starts there too: started as the
// paper left the holders, the booklet turned and dropped the moment its edge came free.
function bookletTurnFrom(side: number) {
  return (bookletEntrySpan(side) + bookletLiftRun(side) + C.bookletSize / 2 - (C.lidTabInset - C.lidTabRadius - 1)) * MM;
}

// How far the roll has gone, from the eased feed: exactly that while the paper is held, then
// easing to a stop (a Hermite curve, monotone) with its centre on the cylinder's line nearest the
// camera as it lands, the turn done with everything else. Followed on, the centre went off the
// cylinder along the exit; stopped there sooner, the paper went on unrolling about it after the
// booklet had stopped, a pause and then more.
function bookletPlaced(rolled: number, lidAngle: number, side: number) {
  const inset = (C.lidTabInset - C.lidTabRadius - 1) * MM;
  const total = bookletFrontArc(lidAngle, side) + C.bookletSize * MM;
  const held = (C.bookletSize * MM - inset) / total;
  const front = (bookletFrontArc(lidAngle, side) + C.bookletSize * MM / 2 - inset) / total;
  if (rolled <= held) return rolled;
  const u = (rolled - held) / (1 - held);
  return held + (1 - held) * u * (1 - u) * (1 - u) + (front - held) * u * u * (3 - 2 * u);
}

function bookletEase(t: number) {
  // Zero velocity and acceleration at both ends; one continuous move, with a more
  // deliberate ease into extraction and out of the landing than the former sine curve.
  const eased = t * t * t * (t * (t * 6 - 15) + 10);
  return t + (eased - t) * C.bookletEase;
}

// The entry bend beside the holders, in radians. Over the hinge of a partly open case it adds
// the lid's tilt, to clear the raised disc half; over the open edge it only rises over the stops.
function bookletEntryAngle(lidAngle: number, side: number) {
  return THREE.MathUtils.degToRad(side > 0 ? C.bookletEntryAngle + 180 - lidAngle : C.bookletEntryAngleNarrow);
}

// Configure the continuous travelling bend; the paper's curl is independent of its travel.
// side 1 feeds the paper out spine first, over the hinge; -1, the mirror image, fore-edge first
// over the lid's open edge and its stops.
// progress: how much of it has been fed through, 0 to 1, already eased.
function setBookletRoll(progress: number, lidAngle: number, side: number, roll: THREE.Vector4, radius = bookletCylinder(side)) {
  const angle = bookletEntryAngle(lidAngle, side);
  const arc = bookletFrontArc(lidAngle, side, radius);
  const feed = (arc + C.bookletSize * MM) * progress;
  const inset = (C.lidTabInset - C.lidTabRadius - 1) * MM;
  const entry = -C.bookletSize * MM / 2 + inset * ease.power3Out(clamp(feed / inset, 0, 1));
  roll.set(entry, feed, side * radius, angle);
  return Math.max(0, feed + entry - C.bookletSize * MM / 2);
}

// The roll's path, as how far the paper has turned `feed` along it: flat in the case, its edge
// lifted the entry angle over bookletEntrySpan, slid out straight for bookletLiftRun with that
// lift (clear of the tray beside it), then round the cylinder to its line nearest the camera
// (pi), and straight on. The shader's bookletAngleAt is the same.
function bookletPathAngle(feed: number, roll: THREE.Vector4) {
  const side = Math.sign(roll.z), entrySpan = roll.w > 1e-4 ? bookletEntrySpan(side) * MM : 0;
  const run = entrySpan + bookletLiftRun(side) * MM, turn = bookletLiftTurn(side);
  if (feed <= 0) return 0;
  if (feed < entrySpan) return roll.w * feed / entrySpan;
  if (feed < run) return roll.w + (feed - entrySpan) * turn;
  return Math.min(Math.PI, roll.w + (run - entrySpan) * turn + (feed - run) / Math.abs(roll.z));
}

// The paper's direction integrated along the path from 0 to `feed`, its angle less `centre` and
// scaled by k (see bookletBent): exact, as the paper turns evenly on the arcs and runs straight
// between them. The shader's bookletAlong is the same.
function bookletAlong(feed: number, roll: THREE.Vector4, k: number, centre: number, out: THREE.Vector2) {
  if (feed <= 0) return out.set(Math.cos(-k * centre), Math.sin(-k * centre)).multiplyScalar(feed);
  const radius = Math.abs(roll.z), side = Math.sign(roll.z), entrySpan = roll.w > 1e-4 ? bookletEntrySpan(side) * MM : 0;
  const run = entrySpan + bookletLiftRun(side) * MM, turn = bookletLiftTurn(side), lifted = roll.w + (run - entrySpan) * turn;
  const rounded = run + (Math.PI - lifted) * radius;
  out.set(0, 0);
  const piece = (start: number, end: number, angle: number, rate: number) => {
    if (end <= start) return;
    const a = k * (angle - centre), b = k * (angle + rate * (end - start) - centre);
    if (Math.abs(b - a) < 1e-4) out.x += (end - start) * Math.cos((a + b) / 2), out.y += (end - start) * Math.sin((a + b) / 2);
    else out.x += (end - start) / (b - a) * (Math.sin(b) - Math.sin(a)), out.y += (end - start) / (b - a) * (Math.cos(a) - Math.cos(b));
  };
  if (entrySpan > 0) piece(0, Math.min(feed, entrySpan), 0, roll.w / entrySpan);
  piece(entrySpan, Math.min(feed, run), roll.w, turn);
  piece(run, Math.min(feed, rounded), lifted, 1 / radius);
  piece(rounded, feed, Math.PI, 0);
  return out;
}

// Where the point of the booklet at x is on the roll's path, in its rest frame: across, out
// (negative, toward the open case), and its angle. Roll uniform: entry x, distance fed, radius,
// and the entry angle. A negative radius mirrors the whole path across the booklet's centre (see
// setBookletRoll). Both CPU placement and the sheet shader sample this same length-preserving
// path, the shader relative to the booklet's centre (bookletBent).
function bookletRoll(x: number, roll: THREE.Vector4, result: THREE.Vector3) {
  if (roll.z === 0) return result.set(x, 0, 0);
  const side = Math.sign(roll.z), feed = roll.x + roll.y - side * x;
  const along = bookletAlong(feed, roll, 1, 0, BENT_SCRATCH.along);
  return result.set(side * (roll.x - along.x), -along.y, -side * bookletPathAngle(feed, roll));
}

// LeafThrough's deform hook: it forms each sheet (and its pile gap), then hands us the point to
// bend in the closed booklet's frame. It applies to the colour and shadow passes alike in both
// reading layouts, and the library takes normals from the bent shape.
function bookletDeform(bend: THREE.IUniform<THREE.Vector4>, flatten: THREE.IUniform<number>, tuck: THREE.IUniform<number>): PaperDeform {
  return {
    uniforms: { bookletBend: bend, bookletFlatten: flatten, bookletTuck: tuck },
    glsl: `
uniform vec4 bookletBend;
uniform float bookletFlatten;
uniform float bookletTuck;
float bookletAngleAt(float feed, float entrySpan, float run, float turn, float radius) {
  if (feed <= 0.0) return 0.0;
  if (feed < entrySpan) return bookletBend.w * feed / entrySpan;
  if (feed < run) return bookletBend.w + (feed - entrySpan) * turn;
  return min(PI, bookletBend.w + (run - entrySpan) * turn + (feed - run) / radius);
}
vec2 bookletPiece(float start, float end, float angle, float rate, float k, float centre) {
  if (end <= start) return vec2(0.0);
  float a = k * (angle - centre), b = k * (angle + rate * (end - start) - centre);
  if (abs(b - a) < 1e-4) return (end - start) * vec2(cos((a + b) / 2.0), sin((a + b) / 2.0));
  return (end - start) / (b - a) * vec2(sin(b) - sin(a), cos(a) - cos(b));
}
vec2 bookletAlong(float feed, float entrySpan, float run, float turn, float radius, float k, float centre) {
  if (feed <= 0.0) return feed * vec2(cos(-k * centre), sin(-k * centre));
  float lifted = bookletBend.w + (run - entrySpan) * turn, rounded = run + (PI - lifted) * radius;
  vec2 sum = vec2(0.0);
  if (entrySpan > 0.0) sum += bookletPiece(0.0, min(feed, entrySpan), 0.0, bookletBend.w / entrySpan, k, centre);
  sum += bookletPiece(entrySpan, min(feed, run), bookletBend.w, turn, k, centre);
  sum += bookletPiece(run, min(feed, rounded), lifted, 1.0 / radius, k, centre);
  return sum + bookletPiece(rounded, feed, PI, 0.0, k, centre);
}
// As bookletBent on the CPU.
vec3 bookletBent(float x) {
  if (bookletBend.z == 0.0) return vec3(x, 0.0, 0.0);
  float side = sign(bookletBend.z), radius = abs(bookletBend.z), k = 1.0 - bookletFlatten;
  float entrySpan = bookletBend.w > 1e-4 ? (side > 0.0 ? ${C.bookletEntrySpan * MM} : ${C.bookletEntrySpanNarrow * MM}) : 0.0;
  float run = entrySpan + (side > 0.0 ? ${C.bookletLiftRun * MM} : ${C.bookletLiftRunNarrow * MM});
  float turn = side > 0.0 ? ${1 / (C.bookletLiftRadius * MM)} : ${1 / (C.bookletLiftRadiusNarrow * MM)};
  float centreFeed = bookletBend.x + bookletBend.y, feed = centreFeed - side * x;
  float centre = bookletAngleAt(centreFeed, entrySpan, run, turn, radius);
  vec2 delta = bookletAlong(feed, entrySpan, run, turn, radius, k, centre) - bookletAlong(centreFeed, entrySpan, run, turn, radius, k, centre);
  return vec3(-side * delta.x, -delta.y, -side * k * (bookletAngleAt(feed, entrySpan, run, turn, radius) - centre));
}
// From page units to the closed booklet's millimetre frame, bent, and back.
vec3 deformSheet(vec3 p, vec2 uv) {
  // A tucked sheet draws in from its outer edges; the spine stays where it is.
  p.xy *= 1.0 - bookletTuck * vec2(${C.bookletTuck / C.bookletSize}, ${2 * C.bookletTuck / C.bookletSize});
  float size = ${(C.bookletSize * MM).toFixed(6)};
  float halfDepth = ${C.bookletThickness * MM / 2};
  vec3 paper = vec3((p.x - 0.5) * size, p.y * size, p.z * size - halfDepth);
  vec3 bent = bookletBent(paper.x);
  paper = vec3(bent.x + sin(bent.z) * paper.z, paper.y, bent.y + cos(bent.z) * paper.z);
  return vec3(paper.x / size + 0.5, paper.y / size, (paper.z + halfDepth) / size);
}`,
  };
}

// The paper at x as the roll bends it, relative to its centre and the centre's tangent: along
// that tangent, out from it, and its angle (the shader's bookletBent is the same). flatten (0 to 1)
// relaxes the bend: every angle along the paper from its centre is scaled by 1 - flatten, which
// keeps its length, so at 1 it lies flat wherever it is on the roll.
function bookletBent(x: number, roll: THREE.Vector4, flatten: number, result: THREE.Vector3) {
  if (roll.z === 0) return result.set(x, 0, 0);
  const side = Math.sign(roll.z), k = 1 - flatten;
  const centreFeed = roll.x + roll.y, feed = centreFeed - side * x, centre = bookletPathAngle(centreFeed, roll);
  const { along: at, alongCentre } = BENT_SCRATCH;
  bookletAlong(feed, roll, k, centre, at).sub(bookletAlong(centreFeed, roll, k, centre, alongCentre));
  return result.set(-side * at.x, -at.y, -side * k * (bookletPathAngle(feed, roll) - centre));
}
const BENT_SCRATCH = { along: new THREE.Vector2(), alongCentre: new THREE.Vector2() };

// Motion blur for a spinning disc's print: the colour map is averaged over an arc of `blur`
// radians around the centre (UVs are centred on the disc), with a per-pixel jitter so the samples
// don't show as copies. At rest (blur 0) it takes the usual single sample.
function withSpinBlur<T extends THREE.Material>(material: T, blur: THREE.IUniform<number>): T {
  const compile = material.onBeforeCompile;
  const key = material.customProgramCacheKey;
  material.customProgramCacheKey = () => `${key.call(material)}-spin-blur`;
  material.onBeforeCompile = (shader, renderer) => {
    compile.call(material, shader, renderer);
    shader.uniforms.discBlur = blur;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float discBlur;')
      .replace('#include <map_fragment>', `#ifdef USE_MAP
vec4 sampledDiffuseColor;
if (discBlur < 0.002) {
  sampledDiffuseColor = texture2D(map, vMapUv);
} else {
  vec2 spinUv = vMapUv - 0.5;
  float jitter = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  sampledDiffuseColor = vec4(0.0);
  for (int n = 0; n < ${C.spinBlurSamples}; n++) {
    float angle = discBlur * ((float(n) + jitter) / ${C.spinBlurSamples}.0 - 0.5);
    float c = cos(angle), s = sin(angle);
    sampledDiffuseColor += texture2D(map, 0.5 + mat2(c, s, -s, c) * spinUv);
  }
  sampledDiffuseColor /= ${C.spinBlurSamples}.0;
}
diffuseColor *= sampledDiffuseColor;
#endif`);
  };
  return material;
}

function makeDisc(shared: SharedResources, seed: number): Disc {
  const { geometries, materials } = shared;
  // Each disc has its own materials so its shade can differ from the others'.
  const shade = { value: 1 };
  const blur = { value: 0 };
  const group = new THREE.Group();
  const spin = new THREE.Group();
  group.add(spin);
  const frontMaterial = withSpinBlur(withShade(withSoftReflection(new THREE.MeshPhysicalMaterial({
    roughness: C.frontRough, metalness: C.frontMetal, roughnessMap: shared.textures.frontRough,
    clearcoat: C.frontClearcoat, clearcoatRoughness: 0.18 * (1 - C.texGloss),
    normalMap: shared.textures.frontNormal, normalScale: new THREE.Vector2(0.3, 0.3), envMapIntensity: 0.85,
  }), 'cd-front', C.discSheen), shade), blur);
  const front = new THREE.Mesh(geometries.front, frontMaterial);
  const backMaterial = withShade(makeBackMaterial(shared, seed), shade);
  // The hub is a closed ring, so only its faces toward the viewer are drawn: drawn from both sides in
  // one pass, its top and bottom, a hair apart, blended in triangle order into a radial pattern that
  // read as scratches and turned with the disc.
  const hubMaterial = withShade(makePlastic({ roughness: 0.05, opacity: C.plasticOpacity, rings: C.plasticRings, side: THREE.FrontSide }), shade);
  const back = new THREE.Mesh(geometries.back, backMaterial);
  const hub = new THREE.Mesh(geometries.hub, hubMaterial);
  front.position.z = C.discThickness / 2 + 6e-4;
  back.position.z = -C.discThickness / 2 - 6e-4;
  // The booklet's sun's shadow falls on the disc as the booklet comes out of its case (see addLights).
  front.receiveShadow = back.receiveShadow = true;
  back.rotation.y = Math.PI;
  hub.rotation.x = Math.PI / 2;
  spin.add(front, back, hub);
  // The flat, invisible pick disc stays outside the spin group so hit tests ignore spin and flip.
  const pick = new THREE.Mesh(geometries.pick, materials.pick);
  group.add(pick);
  return { group, spin, pick, shade, blur, materials: [frontMaterial, backMaterial, hubMaterial], frontMaterial, art: null, disposed: false };
}

// The page object's place inside the booklet's bounds: a page (120 mm) to its unit, the cover's
// spine edge at the bounds' left and its pages at their back face.
function seatInBooklet(model: LeafThroughObject) {
  model.position.set(-C.bookletSize * MM / 2, 0, -C.bookletThickness * MM / 2);
  model.quaternion.identity();
  model.scale.setScalar(C.bookletSize * MM);
}

// The page object's layout options. One page at a time (phones) it loops: LeafThrough turns the
// last page, the back cover, only then, and turning it shuts the booklet back onto its cover. The
// open spread stops on its back page.
function bookletLayout(layout: 'spread' | 'single') {
  return { layout, loop: layout === 'single' };
}

// The page object's lighting options: the sun as the booklet view's, and whether its sheets cast
// and take shadows, which only the booklet out of its case does. Shadows switch without a rebuild
// as long as the rest stays the same, so every call passes the whole thing.
function bookletLighting(shadows: boolean): LightingOptions {
  return { sun: { position: [...C.bookletSunAt] }, shadows };
}

// A jewel case holding the disc. The layout moves `group`, a drag turns `spin`, and `body` slides
// right as the lid opens so the open case stays centred on the spin pivot. The lid rotates about
// the hinge line. Prints start in the album colour until their artwork is set.
function makeCase(shared: SharedResources, album: Album, seed: number, renderer: THREE.WebGLRenderer, camera: THREE.Camera, onChange: () => void): JewelCase {
  const { geometries, materials } = shared;
  const print = (side: THREE.Side) => new THREE.MeshStandardMaterial({ color: album.color || '#3b3a36', roughness: C.printRough, side });
  const bend = { value: new THREE.Vector4() };
  const bookletTuck = { value: 1 }, sheetTuck = { value: 0 }, bookletFlatten = { value: 0 };
  const prints = { cover: print(THREE.FrontSide), bookletBack: print(THREE.FrontSide), insert: print(THREE.DoubleSide) };
  const blank = Object.assign(document.createElement('canvas'), { width: 2, height: 2 });
  const pageCount = Math.max(4, album.bookletPageCount ?? ((album.bookletScans?.length ?? 1) + 1) * 2);
  const sheetGap = C.bookletSheetGap;
  const stackLoft = { value: 1 };
  const bookletSources: PageSource[] = Array.from({ length: pageCount }, () => blank);
  // Until the artwork comes, the album's colour stands in for the cover and the disc's print
  // (setAlbums); the generated art (makeFallbackArt) is drawn only if none comes.
  bookletSources[0] = makeColourCanvas(album.color || '#3b3a36');
  bookletSources[pageCount - 1] = makeBookletBackCanvas(album);
  const bookletModel = new LeafThroughObject({ renderer, camera }, {
    pages: bookletSources, preload: pageCount, layout: 'spread', pageAspect: 1, loop: false,
    paper: { grain: shared.grain, wrinkles: C.bookletWrinkles, bulge: C.bookletBulge, sheetGap: sheetGap / C.bookletSize },
    lighting: bookletLighting(false), deform: bookletDeform(bend, bookletFlatten, sheetTuck),
    interaction: { keyboard: false },
  });
  bookletModel.enabled = false;
  // Which sheet is outer is decided per draw: the deform's uniforms are uploaded with each
  // sheet's own material, just after its onBeforeRender. At page 0, LeafThrough's renderOrder is
  // each sheet's place in the pile, the cover's 0. Sheets come new with each rebuild.
  const tuckSheets = () => bookletModel.traverse((node) => {
    if (!(node instanceof THREE.Mesh) || node.userData.bookletTuck) return;
    node.userData.bookletTuck = true;
    // The sheet's stand-off from the spine (LeafThrough's uStackGap, its sheet gap times the sheets
    // under it, written as the pages move) is the same uniform object in its colour and shadow
    // programs: caught as they compile, so each draw can widen it by stackLoft. A value other
    // than the one written last is the library's own, the base to widen.
    const material = node.material as THREE.Material;
    const compile = material.onBeforeCompile;
    material.onBeforeCompile = (shader, renderer) => {
      compile.call(material, shader, renderer);
      node.userData.stackGap = shader.uniforms.uStackGap;
    };
    const loft = { base: 0, lofted: NaN };
    node.onBeforeRender = (renderer, _scene, camera) => {
      const gap = (node.userData.stackGap ?? (renderer.properties.get(material) as { uniforms?: { uStackGap?: THREE.IUniform<number> } }).uniforms?.uStackGap) as THREE.IUniform<number> | undefined;
      if (gap) {
        if (gap.value !== loft.lofted) loft.base = gap.value;
        gap.value = loft.lofted = loft.base * stackLoft.value;
      }
      if (bookletTuck.value === 0) {
        sheetTuck.value = 0;
        return;
      }
      const { point, matrix } = TUCK_SCRATCH;
      const front = point.setFromMatrixPosition(camera.matrixWorld).applyMatrix4(matrix.copy(node.matrixWorld).invert()).z > 0;
      const outer = front ? 0 : Math.ceil(bookletModel.pageCount / 2) - 1;
      sheetTuck.value = node.renderOrder === outer ? 0 : bookletTuck.value;
    };
  });
  tuckSheets();
  bookletModel.addEventListener('change', () => { tuckSheets(); onChange(); });
  const plastic = makeCasePlastic(shared, seed);
  const group = new THREE.Group();
  const spin = new THREE.Group();
  const body = new THREE.Group();
  const lid = new THREE.Group();
  group.add(spin);
  spin.add(body);
  const disc = makeDisc(shared, seed);
  disc.group.position.set(C.discOffsetX * MM, 0, CASE.disc * MM);
  // Discs sit in the tray at a slight turn, each its own, shaded until the lid opens.
  disc.group.rotation.z = THREE.MathUtils.degToRad((seed * 2 - 1) * C.discTurn);
  disc.shade.value = C.discClosedShade;
  disc.group.updateMatrix();
  const discRest = disc.group.matrix.clone();
  const insert = new THREE.Mesh(geometries.insert, prints.insert);
  const tray = new THREE.Mesh(geometries.tray, materials.tray);
  // The booklet's sun's shadow falls on them as the booklet comes out (see addLights).
  insert.receiveShadow = tray.receiveShadow = true;
  body.add(new THREE.Mesh(geometries.baseShell, plastic), insert, tray, disc.group, lid);
  lid.position.x = CASE.hingeX * MM;
  // Invisible bounds for picking; the actual object is already a stack of formed paper sheets.
  const booklet = new THREE.Mesh(geometries.booklet, materials.pick);
  booklet.add(bookletModel);
  seatInBooklet(bookletModel);
  booklet.position.set((CASE.bookletX - CASE.hingeX) * MM, 0, CASE.booklet * MM);
  booklet.updateMatrix();
  const bookletRest = booklet.matrix.clone();
  lid.add(booklet, new THREE.Mesh(geometries.lidShell, plastic));
  // The flat, invisible pick plane stays outside the spin group so hit tests ignore spin.
  const pick = new THREE.Mesh(geometries.casePick, materials.pick);
  group.add(pick);
  return {
    group, spin, body, lid, booklet, bookletModel, bookletSources, bookletTextures: [], bookletTuck, bookletFlatten, sheetGap, stackLoft, bookletReady: false, bookletLoaded: false, artLoaded: false, artSmall: false, insertLoaded: false, pick, disc, prints, bend, plastic, disposed: false,
    open: 0, openTween: null, hover: 0, spinX: 0, spinY: 0, spinRest: 0, resetTween: null, placed: false, envTurn: 0, discRest, bookletRest,
    pushX: 0, pushY: 0, pushZ: 0, pushVX: 0, pushVY: 0, pushVZ: 0, pushRotX: 0, pushRotY: 0, pushRotVX: 0, pushRotVY: 0,
  };
}

// The CD player (makePlayer). Built in millimetres like the case: y up, centred on the body, the
// screen face +z and the speaker side -x; turned on its stand so the corner between them faces the
// camera. Modelled rather than painted: a graphite body with a glossy top pane edged in silver, a
// silver ring down into the well, the pickup slot and sled, a turntable with clamp balls, the
// screen, a headphone jack, a speaker grille and four buttons, and its shadow on the surface it
// stands on.
const PLAYER = (() => {
  const half = C.playerSize / 2;
  const top = C.playerHeight / 2;
  // The disc's centre plane, and the floor of the well.
  const seat = top - C.playerDiscDrop;
  return { half, top, seat, floor: top - C.wellDepth, flat: half - C.playerCorner };
})();

// A rounded rectangle centred on (cx, cy), drawn into `shape` (a Path for a hole).
function roundedRect(width: number, height: number, radius: number, cx = 0, cy = 0, shape: THREE.Path = new THREE.Shape()) {
  const [left, right, bottom, top] = [cx - width / 2, cx + width / 2, cy - height / 2, cy + height / 2];
  shape.moveTo(left + radius, bottom);
  shape.lineTo(right - radius, bottom);
  shape.quadraticCurveTo(right, bottom, right, bottom + radius);
  shape.lineTo(right, top - radius);
  shape.quadraticCurveTo(right, top, right - radius, top);
  shape.lineTo(left + radius, top);
  shape.quadraticCurveTo(left, top, left, top - radius);
  shape.lineTo(left, bottom + radius);
  shape.quadraticCurveTo(left, bottom, left + radius, bottom);
  return shape;
}

const roundedShape = (width: number, height: number, radius: number, cx = 0, cy = 0) => roundedRect(width, height, radius, cx, cy) as THREE.Shape;

// Whether to play without motion: the system's reduced-motion setting, except on phones (screens
// narrowWidth px wide or less), which play the motion regardless. The page is the motion; on a
// phone, where the setting is often on for other reasons, it would leave only still pictures.
export const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches && window.innerWidth > C.narrowWidth;

export type PlayerButton = 'previous' | 'play' | 'pause' | 'next';
export const PLAYER_BUTTONS: PlayerButton[] = ['previous', 'play', 'pause', 'next'];

// The buttons' printed transport symbols, about 3 mm across, centred, x to the right.
function playerMark(kind: PlayerButton): THREE.Shape[] {
  const polygon = (...points: Point[]) => new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  const bar = (x: number, width = 0.55) => roundedShape(width, 2.3, 0.12, x, 0);
  switch (kind) {
    case 'play':
      return [polygon([-0.85, -1.2], [1.2, 0], [-0.85, 1.2])];
    case 'pause':
      return [bar(-0.6, 0.65), bar(0.6, 0.65)];
    case 'next':
      return [polygon([-1.2, -1.1], [0.55, 0], [-1.2, 1.1]), bar(0.95)];
    case 'previous':
      return [polygon([1.2, -1.1], [-0.55, 0], [1.2, 1.1]), bar(-0.95)];
  }
}

// The well as a hole in the top's plane (x right, y to the back), grown by `grow` millimetres.
function wellHole(grow = 0) {
  const path = new THREE.Path();
  path.absarc(0, -C.wellZ, C.wellRadius + grow, 0, Math.PI * 2, true);
  return path;
}

// The body: a slim rounded square slab with softened edges, the well cut through it. Extruded
// upward, so the shape's y runs to the back (-z).
function makePlayerBodyGeometry() {
  const bevel = C.playerBevel;
  const shape = roundedShape(C.playerSize - bevel * 2, C.playerSize - bevel * 2, C.playerCorner - bevel);
  shape.holes.push(wellHole(bevel));
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: C.playerHeight - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 96,
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, -PLAYER.top + bevel, 0);
  return geometry;
}

// The top pane: a glossy graphite sheet just proud of the body, a hair inside its edge, cut round
// the metal ring. Its edges (material 1) are matte black, the fine line round the top. Seen from the front and above, a glossy pane mirrors the bright room toward its back and
// the floor toward its front, so its vertex colours shade it from back to front.
function makePlayerTopGeometry() {
  const inset = C.playerFrame;
  const shape = roundedShape(C.playerSize - inset * 2, C.playerSize - inset * 2, Math.max(1, C.playerCorner - inset));
  shape.holes.push(wellHole(C.playerRing));
  // Square edges: a rounded edge showed at the back, seen almost edge on, as a dotted sub-pixel line.
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 1.15, bevelEnabled: false, curveSegments: 96 });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, PLAYER.top - 0.4, 0);
  const position = geometry.attributes.position;
  const colors = new Float32Array(position.count * 3);
  const back = new THREE.Color(C.playerTopBack), near = new THREE.Color(C.playerTop), color = new THREE.Color();
  for (let n = 0; n < position.count; n++) {
    const t = clamp((position.getZ(n) + PLAYER.half) / C.playerSize, 0, 1);
    color.copy(back).lerp(near, t * t * (3 - 2 * t)).toArray(colors, n * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

// The metal ring round the well: from the top pane's edge it rounds over and slopes down into
// the well, as a lathe (top outside to bottom inside, so its normals face up and in).
function makeWellRingGeometry() {
  const r = C.wellRadius, top = PLAYER.top, w = C.playerRing;
  // The lip lies on the pane (whose surface is 0.75 mm above the body's top) and covers its cut edge.
  // It ends just inside the well's wall (makePlayer), which it would otherwise flicker against.
  const profile: Point[] = [[r + w + 0.8, top + 0.76], [r + w, top + 1.05], [r + w - 1, top + 0.95], [r + 0.9, top - 0.4], [r - 0.1, top - 2.2], [r - 0.5, top - 3.4]];
  return new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x, y)), 128);
}

// The turntable: a platform the disc rests on, its rim stepped down, and the centring pin through
// the disc's hole, as a lathe.
function makeSpindleGeometry() {
  const seat = PLAYER.seat - (C.discThickness / MM) / 2;
  const pin = C.holeSize * 60 - 0.2;
  // From the floor up, so the lathe's normals face outward.
  const profile: Point[] = [
    [8, PLAYER.floor], [8, seat - 2.4], [16, seat - 2.2], [16.4, seat - 1.6], [16.4, seat - 0.4], [16, seat],
    [pin + 1.2, seat], [pin, seat + 0.2], [pin, seat + 1.4], [pin * 0.8, seat + 2.4], [pin * 0.4, seat + 2.9], [0, seat + 3],
  ];
  return new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x, y)), 64);
}

// The turntable's matte surface as a colour map around white, for the lathe's UVs (u round it, v
// along its profile, so rows are rings): a fine speckle, soft mottling, and faint turning rings.
// The colour is multiplied by it, so it darkens a little on average (playerTurntableTone makes up).
function makeTurntableGrainCanvas(size: number) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const image = ctx.createImageData(size, size);
  const ring = new Float32Array(size).map((_, y) => (valueNoise(0, y * 3.7) - 0.5) * 0.08);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const mottle = (valueNoise(Math.floor(x / 16), Math.floor(y / 16)) + valueNoise(Math.floor(x / 16) + 1, Math.floor(y / 16) + 7)) / 2;
      const value = 0.86 + (valueNoise(x, y) - 0.5) * C.playerTurntableSpeckle + (mottle - 0.5) * 0.06 + ring[y];
      const n = (y * size + x) * 4;
      image.data[n] = image.data[n + 1] = image.data[n + 2] = clamp(value, 0, 1) * 255;
      image.data[n + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

// Canvas helper for the contact shadow: a canvas `width` × `height` millimetres at `scale` pixels a
// millimetre, origin in the middle, y up.
function mmCanvas(width: number, height: number, scale: number) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(scale, 0, 0, -scale, canvas.width / 2, canvas.height / 2);
  return { canvas, ctx };
}

interface Player {
  group: THREE.Group;
  // The disc's place on the spindle, label up, in the player's space.
  seat: THREE.Matrix4;
  // The turntable and its clamp balls, which turn with the disc.
  spindle: THREE.Group;
  // The screen (drawPlayerScreen): its canvas and texture, the patterns that cut what it shows into
  // dots and show the unlit ones, whether its title is scrolling, and the title shown and since when
  // (a long title rests before it scrolls).
  screen: { ctx: CanvasRenderingContext2D; dots: CanvasPattern; unlit: CanvasPattern; texture: THREE.CanvasTexture; scrolls: boolean; title: string; since: number };
  // The buttons: each one's cap for picking, its symbol's material, which lights under the pointer
  // (hover, 0 to 1), and the group that moves into the face (position.z, millimetres) as it is
  // pressed (press, 0 to 1, run by `tween`).
  buttons: { kind: PlayerButton; cap: THREE.Mesh; mark: THREE.MeshStandardMaterial; group: THREE.Group; hover: number; press: number; tween: Tween | null }[];
  resources: { dispose(): void }[];
}

// `grain` is the case tray's stipple (a normal map), for the turntable.
function makePlayer(anisotropy: number, grain: THREE.Texture): Player {
  const resources: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(resource: T) => {
    resources.push(resource);
    return resource;
  };
  const group = new THREE.Group();
  // Glossy graphite plastic, a matte black edge round the top. The scene's lights are tuned for discs and cases; the
  // player takes a little more of the room's light (playerEnvLift) so its finish reads.
  const wearMap = keep(new THREE.CanvasTexture(makeCaseWearCanvas(512)));
  wearMap.wrapS = wearMap.wrapT = THREE.RepeatWrapping;
  wearMap.anisotropy = anisotropy;
  const body = keep(withPlayerWear(new THREE.MeshPhysicalMaterial({ color: C.playerColor, roughness: C.playerRough, metalness: 0, clearcoat: 0.5, clearcoatRoughness: 0.3, envMapIntensity: C.playerEnvLift }), 'player-body', wearMap));
  const chrome = keep(new THREE.MeshPhysicalMaterial({ color: C.playerChrome, roughness: 0.12, metalness: 1, side: THREE.DoubleSide }));
  group.add(new THREE.Mesh(keep(makePlayerBodyGeometry()), body));
  const top = keep(withPlayerWear(new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.08, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: C.playerEnvLift }), 'player-top', wearMap, C.playerTopSheen));
  // The pane's edge: matte black, the fine line round the top.
  const trim = keep(new THREE.MeshStandardMaterial({ color: C.playerTrim, roughness: 0.8, metalness: 0, envMapIntensity: C.playerEnvLift }));
  group.add(new THREE.Mesh(keep(makePlayerTopGeometry()), [top, trim]));
  // The ring round the well, and the jack's collar: thin polished dark metal, dulled so it
  // doesn't glare.
  const darkMetal = keep(new THREE.MeshPhysicalMaterial({ color: C.playerMetal, roughness: C.playerRingRough, metalness: 1, clearcoat: C.playerRingCoat, clearcoatRoughness: 0.25, envMapIntensity: C.playerEnvLift * C.playerRingEnv, side: THREE.DoubleSide }));
  group.add(new THREE.Mesh(keep(makeWellRingGeometry()), darkMetal));

  // The well, as on most top-loaders: a matte black floor with one opening toward the back, where
  // the pickup's lens shows on its black sled; the rails it runs on stay out of sight below.
  const [slotWidth, slotFrom, slotTo] = [13, 21, 50];
  const floorShape = new THREE.Shape();
  floorShape.absarc(0, -C.wellZ, C.wellRadius + C.playerBevel, 0, Math.PI * 2, false);
  floorShape.holes.push(roundedRect(slotWidth, slotTo - slotFrom, 2, 0, (slotFrom + slotTo) / 2 - C.wellZ, new THREE.Path()));
  const matte = keep(new THREE.MeshStandardMaterial({ color: C.playerWell, roughness: 0.85, envMapIntensity: C.playerEnvLift }));
  const floor = new THREE.Mesh(keep(new THREE.ShapeGeometry(floorShape, 96)), matte);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = PLAYER.floor;
  // The well's wall, in the floor's black, as a lathe so it shades round (the body's cut edge, flat
  // faceted, stays just behind it), from the floor up under the ring.
  const wellWall = keep(new THREE.LatheGeometry([new THREE.Vector2(C.wellRadius - 0.4, PLAYER.top - 3.2), new THREE.Vector2(C.wellRadius - 0.4, PLAYER.floor)], 192));
  const wall = new THREE.Mesh(wellWall, keep(new THREE.MeshStandardMaterial({ color: C.playerWell, roughness: 0.85, envMapIntensity: C.playerEnvLift, side: THREE.DoubleSide })));
  wall.position.z = C.wellZ;
  // The opening's depth is a box seen from inside (back faces), so its walls and bottom show through.
  const slotLength = slotTo - slotFrom;
  const slotZ = C.wellZ - (slotFrom + slotTo) / 2;
  const cavity = new THREE.Mesh(keep(new THREE.BoxGeometry(slotWidth, 4, slotLength)), keep(new THREE.MeshStandardMaterial({ color: C.playerHoles, roughness: 0.9, side: THREE.BackSide })));
  cavity.position.set(0, PLAYER.floor - 2, slotZ);
  const sledZ = C.wellZ - 33;
  const sled = new THREE.Mesh(keep(new THREE.BoxGeometry(10, 1.6, 8)), keep(new THREE.MeshStandardMaterial({ color: C.playerWell, roughness: 0.7 })));
  sled.position.set(0, PLAYER.floor - 1.4, sledZ);
  // The objective lens: a small glossy dome with the violet sheen of its coating, in a dark ring.
  const lensRing = new THREE.Mesh(keep(new THREE.TorusGeometry(2, 0.35, 8, 32).rotateX(Math.PI / 2)), darkMetal);
  lensRing.position.set(0, PLAYER.floor - 0.5, sledZ);
  const lens = new THREE.Mesh(keep(new THREE.SphereGeometry(1.6, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.5, 1)),
    keep(new THREE.MeshPhysicalMaterial({ color: '#191530', roughness: 0.05, clearcoat: 1, iridescence: 1, iridescenceIOR: 1.8, iridescenceThicknessRange: [250, 500] })));
  lens.position.set(0, PLAYER.floor - 0.6, sledZ);
  // The turntable, in matte graphite without wear, since it shows through the disc's clear centre
  // (glossy, it glared there). Its surface has a fine grain in its colour (makeTurntableGrainCanvas)
  // and the tray's moulded stipple as bumps only (the tray's roughness map would make it glossy),
  // repeating playerTurntableGrain times round it. Three steel spring balls round the pin hold the
  // disc, turning with it.
  const spindle = new THREE.Group();
  spindle.position.z = C.wellZ;
  const turntableGrain = keep(grain.clone());
  turntableGrain.wrapS = turntableGrain.wrapT = THREE.RepeatWrapping;
  turntableGrain.repeat.set(C.playerTurntableGrain, C.playerTurntableGrain / 3);
  const turntableMap = keep(new THREE.CanvasTexture(makeTurntableGrainCanvas(256)));
  turntableMap.colorSpace = THREE.SRGBColorSpace;
  turntableMap.wrapS = turntableMap.wrapT = THREE.RepeatWrapping;
  turntableMap.repeat.set(4, 1);
  turntableMap.anisotropy = anisotropy;
  const turntable = keep(new THREE.MeshStandardMaterial({
    color: new THREE.Color(C.playerColor).multiplyScalar(C.playerTurntableTone), map: turntableMap, roughness: 0.8, metalness: 0, envMapIntensity: C.playerEnvLift, normalMap: turntableGrain, normalScale: new THREE.Vector2(C.playerTurntableBump, C.playerTurntableBump),
  }));
  spindle.add(new THREE.Mesh(keep(makeSpindleGeometry()), turntable));
  const ballGeometry = keep(new THREE.SphereGeometry(0.8, 16, 8));
  const pin = C.holeSize * 60 - 0.2;
  for (let n = 0; n < 3; n++) {
    const ball = new THREE.Mesh(ballGeometry, chrome);
    const angle = (n / 3) * Math.PI * 2;
    ball.position.set(Math.cos(angle) * (pin - 0.3), PLAYER.seat + 1.1, Math.sin(angle) * (pin - 0.3));
    spindle.add(ball);
  }
  group.add(floor, wall, cavity, sled, lensRing, lens, spindle);

  // Under it, its shadow on the surface it stands on (a blurred canvas, the one texture; it is light,
  // not shape): a dark, tight band where the base meets the surface, inside a wide soft falloff.
  // Blurred as the canvas's own shadow of the shape, drawn off the canvas with the shadow shifted
  // back onto it: the 2D context's blur filter, used before, is missing in Safari, where the
  // shape drew as a hard-edged dark border.
  const shadowSize = C.playerSize * 1.8;
  const shadowScale = 3;
  const { canvas: shadowCanvas, ctx: shadowCtx } = mmCanvas(shadowSize, shadowSize, shadowScale);
  const footprint = (grow: number, blur: number, alpha: number) => {
    const away = shadowSize * 2;
    // The shadow's blur is twice the Gaussian's deviation and, like its offset, in the canvas's
    // pixels, outside the millimetre transform.
    shadowCtx.shadowColor = '#000';
    shadowCtx.shadowBlur = blur * shadowScale * 2;
    shadowCtx.shadowOffsetX = -away * shadowScale;
    shadowCtx.shadowOffsetY = 0;
    shadowCtx.globalAlpha = alpha;
    shadowCtx.fillStyle = '#000';
    shadowCtx.beginPath();
    shadowCtx.roundRect(away - C.playerSize / 2 - grow, -C.playerSize / 2 - grow, C.playerSize + grow * 2, C.playerSize + grow * 2, C.playerCorner + grow);
    shadowCtx.fill();
  };
  footprint(C.playerSize * 0.06, C.playerSize * 0.09, 0.55);
  footprint(0, C.playerSize * 0.015, 1);
  const shadowMap = keep(new THREE.CanvasTexture(shadowCanvas));
  shadowMap.anisotropy = anisotropy;
  const shadow = new THREE.Mesh(keep(new THREE.PlaneGeometry(shadowSize, shadowSize)),
    keep(new THREE.MeshBasicMaterial({ map: shadowMap, transparent: true, opacity: C.playerShadow, depthWrite: false, fog: false })));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -C.playerHeight / 2 - 0.3;
  shadow.renderOrder = -1;
  group.add(shadow);

  // Holes, seams and printing lie a hair off their face with a polygon offset, so none loses the
  // depth test against it.
  const decal = { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 };
  const holes = keep(new THREE.MeshStandardMaterial({ color: C.playerHoles, roughness: 0.8, ...decal }));
  // The printing glows a little, so it reads as the page's beige rather than grey in the room's light.
  const print = keep(new THREE.MeshStandardMaterial({
    color: C.playerPrint, emissive: C.playerPrint, emissiveIntensity: 0.45, roughness: 0.55, transparent: true, opacity: C.playerPrintOpacity, depthWrite: false, ...decal,
  }));

  // The front (+z), x to the right, y up, z out of the face. From the corner: the screen, a glossy
  // black pane with a fine bevel, just proud of the face, and the buttons. What the screen shows is
  // drawn into a canvas (drawPlayerScreen), since track names need a real font, on an unlit plane:
  // a grid of whole dots inside the pane's bevel.
  const front = new THREE.Group();
  front.position.z = PLAYER.half;
  group.add(front);
  const [screenWidth, screenHeight, screenX] = playerScreenSize();
  const dot = C.playerScreenDot;
  const [dotColumns, dotRows] = [Math.floor((screenWidth - 1.6) / dot), Math.floor((screenHeight - 1.6) / dot)];
  const cell = Math.max(2, Math.round(dot * C.playerScreenResolution));
  const screenCanvas = document.createElement('canvas');
  [screenCanvas.width, screenCanvas.height] = [dotColumns * cell, dotRows * cell];
  const ctx = screenCanvas.getContext('2d')!;
  // One dot, as a tile, nearly filling it so the text keeps its brightness: opaque to cut the text
  // into dots, and faint for the unlit ones.
  const dotPattern = (style: string) => {
    const tile = document.createElement('canvas');
    tile.width = tile.height = cell;
    const tileCtx = tile.getContext('2d')!;
    tileCtx.fillStyle = style;
    tileCtx.beginPath();
    tileCtx.arc(cell / 2, cell / 2, cell * 0.48, 0, Math.PI * 2);
    tileCtx.fill();
    return ctx.createPattern(tile, 'repeat')!;
  };
  const unlit = new THREE.Color(C.playerScreenColor);
  const screenMap = keep(new THREE.CanvasTexture(screenCanvas));
  screenMap.colorSpace = THREE.SRGBColorSpace;
  screenMap.anisotropy = anisotropy;
  const pane = new THREE.Mesh(keep(new THREE.ExtrudeGeometry(roundedShape(screenWidth, screenHeight, 1.2), { depth: 0.2, bevelEnabled: true, bevelThickness: 0.15, bevelSize: 0.15, bevelSegments: 2, curveSegments: 6 })),
    keep(new THREE.MeshPhysicalMaterial({ color: '#050506', roughness: 0.05, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02 })));
  pane.position.x = screenX;
  const screen = new THREE.Mesh(keep(new THREE.PlaneGeometry(dotColumns * dot, dotRows * dot)), keep(new THREE.MeshBasicMaterial({ map: screenMap, transparent: true, toneMapped: false, depthWrite: false })));
  screen.position.set(screenX, 0, 0.4);
  front.add(pane, screen);

  // The buttons: rounded graphite caps standing proud of a dark seam, their symbols printed on.
  const [buttonWidth, buttonHeight, buttonGap] = [C.playerButtonWidth, C.playerButtonHeight, C.playerButtonGap];
  const seamShape = roundedShape(buttonWidth + 1.2, buttonHeight + 1.2, 2);
  seamShape.holes.push(roundedRect(buttonWidth, buttonHeight, 1.5, 0, 0, new THREE.Path()));
  const seamGeometry = keep(new THREE.ShapeGeometry(seamShape, 6));
  const capGeometry = keep(new THREE.ExtrudeGeometry(roundedShape(buttonWidth - 0.6, buttonHeight - 0.6, 1.3), {
    depth: 0.5, bevelEnabled: true, bevelThickness: 0.3, bevelSize: 0.3, bevelSegments: 3, curveSegments: 8,
  }));
  const capMaterial = keep(new THREE.MeshPhysicalMaterial({ color: C.playerButtonColor, roughness: 0.42, metalness: 0, clearcoat: 0.4, clearcoatRoughness: 0.35, envMapIntensity: C.playerEnvLift }));
  const buttonsTo = PLAYER.flat - C.playerScreenMargin;
  const buttons = PLAYER_BUTTONS.map((kind, n) => {
    const x = buttonsTo - buttonWidth / 2 - (PLAYER_BUTTONS.length - 1 - n) * (buttonWidth + buttonGap);
    const seam = new THREE.Mesh(seamGeometry, holes);
    seam.position.set(x, 0, 0.02);
    const button = new THREE.Group();
    button.position.x = x;
    const cap = new THREE.Mesh(capGeometry, capMaterial);
    // Each symbol has its own copy of the printing, so it can light up alone.
    const markMaterial = keep(print.clone());
    const mark = new THREE.Mesh(keep(new THREE.ShapeGeometry(playerMark(kind), 4)), markMaterial);
    mark.position.z = 0.82;
    button.add(cap, mark);
    front.add(seam, button);
    return { kind, cap, mark: markMaterial, group: button, hover: 0, press: 0, tween: null };
  });

  // The left side (-x), built in its own plane: x toward the front, y up, z out of the side. From
  // the back: the headphone jack and a band of speaker holes.
  const side = new THREE.Group();
  side.position.x = -PLAYER.half;
  side.rotation.y = -Math.PI / 2;
  group.add(side);
  const columns = Math.floor((C.playerGrilleTo - C.playerGrilleFrom) / C.playerGrillePitch) + 1;
  const rows = C.playerGrilleRows;
  const grille = new THREE.InstancedMesh(keep(new THREE.CircleGeometry(C.playerGrilleHole, 16)), holes, columns * rows);
  const spot = new THREE.Matrix4();
  for (let n = 0; n < columns * rows; n++) {
    const along = (C.playerGrilleFrom + C.playerGrilleTo) / 2 + ((n % columns) - (columns - 1) / 2) * C.playerGrillePitch;
    const up = (Math.floor(n / columns) - (rows - 1) / 2) * C.playerGrillePitch;
    grille.setMatrixAt(n, spot.makeTranslation(along, up, 0.2));
  }
  side.add(grille);

  // The jack: a dulled polished dark collar standing 0.4 mm proud round the dark 3.5 mm socket.
  const collar = new THREE.Mesh(keep(new THREE.LatheGeometry(
    ([[3.1, 0], [3, 0.25], [2.7, 0.4], [2.15, 0.4], [1.9, 0.2], [1.75, 0]] as Point[]).map(([x, y]) => new THREE.Vector2(x, y)), 48).rotateX(Math.PI / 2)), darkMetal);
  const socket = new THREE.Mesh(keep(new THREE.CircleGeometry(1.75, 32)), holes);
  socket.position.z = 0.02;
  collar.position.x = socket.position.x = C.playerJackAt;
  side.add(collar, socket);

  // The player's space is millimetres, so the disc on the seat is scaled up to its 60 mm radius.
  const seat = new THREE.Matrix4().compose(
    new THREE.Vector3(0, PLAYER.seat, C.wellZ),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2),
    new THREE.Vector3(1, 1, 1).multiplyScalar(1 / MM),
  );
  group.rotation.y = THREE.MathUtils.degToRad(C.playerYaw);
  const screenState = {
    ctx,
    dots: dotPattern('#fff'), unlit: dotPattern(`rgba(${unlit.toArray().map((value) => Math.round(value * 255)).join(', ')}, ${C.playerScreenUnlit})`),
    texture: screenMap, scrolls: false, title: '', since: 0,
  };
  return { group, seat, spindle, screen: screenState, buttons, resources };
}

// The screen's width and height in millimetres, and its centre's x on the front: from the corner
// end of the face (less a margin) to playerScreenGap before the buttons, and most of its height.
function playerScreenSize(): [number, number, number] {
  const buttons = PLAYER_BUTTONS.length * C.playerButtonWidth + (PLAYER_BUTTONS.length - 1) * C.playerButtonGap;
  const [from, to] = [-PLAYER.flat + C.playerScreenMargin, PLAYER.flat - C.playerScreenMargin - buttons - C.playerScreenGap];
  return [to - from, C.playerHeight - C.playerBevel * 2 - C.playerScreenMargin * 2, (from + to) / 2];
}

// What the screen shows. Stopped: the album and the number of tracks. Playing or paused: the play
// or pause mark, the track number, its title and the elapsed time. A title too long to fit rests
// playerScreenHold, scrolls past once and rests again, driven by `now` (seconds) from the moment the
// title appeared; `scrolls` tells the scene to keep redrawing it.
interface ScreenState { album?: Album; track: number | null; seconds: number; playing: boolean }

function drawPlayerScreen(player: Player, state: ScreenState, now = 0) {
  const { ctx, dots, unlit, texture } = player.screen;
  const { width, height } = ctx.canvas;
  const unit = height / 10;
  ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = C.playerScreenColor;
  ctx.textBaseline = 'middle';
  const middle = height * 0.52;
  const mono = `500 ${unit * 4.2}px "DM Mono", monospace`;
  const sans = `500 ${unit * 4.6}px "DM Sans", sans-serif`;
  const pad = unit * 4;
  const tracks = state.album?.tracks ?? [];
  let left: string, title: string, right: string;
  if (state.track === null) {
    left = '';
    title = state.album ? `${state.album.title}  ·  ${state.album.artist}` : '';
    right = tracks.length ? `${tracks.length} TRACKS` : '';
  } else {
    left = String(state.track).padStart(2, '0');
    title = tracks[state.track - 1]?.title ?? '';
    right = `${Math.floor(state.seconds / 60)}:${String(Math.floor(state.seconds % 60)).padStart(2, '0')}`;
  }
  // A new title starts at rest. (Phased on the clock alone, it came in part way through a pass.)
  if (title !== player.screen.title) {
    player.screen.title = title;
    player.screen.since = now;
  }
  let x = pad;
  if (state.track !== null) {
    // The play mark (a triangle) or the pause mark (two bars).
    const size = unit * 3.2;
    ctx.beginPath();
    if (state.playing) {
      ctx.moveTo(x, middle - size / 2);
      ctx.lineTo(x + size * 0.85, middle);
      ctx.lineTo(x, middle + size / 2);
      ctx.closePath();
    } else {
      ctx.rect(x, middle - size / 2, size * 0.28, size);
      ctx.rect(x + size * 0.55, middle - size / 2, size * 0.28, size);
    }
    ctx.fill();
    x += size + unit * 2.4;
    ctx.font = mono;
    ctx.fillText(left, x, middle);
    x += ctx.measureText('00').width + unit * 4;
  }
  ctx.font = sans;
  const titleWidth = ctx.measureText(title).width;
  ctx.font = mono;
  // Stopped, the number of tracks gives way to an album name that would not fit beside it.
  const spacing = unit * 5;
  if (state.track === null && titleWidth > width - pad * 2 - x - ctx.measureText(right).width - spacing) right = '';
  const rightWidth = right ? ctx.measureText(right).width + spacing : 0;
  ctx.textAlign = 'right';
  ctx.fillText(right, width - pad, middle);
  ctx.textAlign = 'left';
  // The title fits between, or scrolls there, faded at its ends.
  const room = width - pad - rightWidth - x;
  ctx.font = sans;
  player.screen.scrolls = titleWidth > room;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, 0, room, height);
  ctx.clip();
  if (player.screen.scrolls) {
    const gap = unit * 14;
    const speed = C.playerScreenScroll * unit;
    const cycle = C.playerScreenHold + (titleWidth + gap) / speed;
    const phase = (now - player.screen.since) % cycle;
    const offset = Math.max(0, phase - C.playerScreenHold) * speed;
    ctx.fillText(title, x - offset, middle);
    ctx.fillText(title, x - offset + titleWidth + gap, middle);
    const fade = (from: number, to: number, strength: number) => {
      if (strength <= 0) return;
      const gradient = ctx.createLinearGradient(from, 0, to, 0);
      gradient.addColorStop(0, `rgba(0,0,0,${strength})`);
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = gradient;
      ctx.fillRect(Math.min(from, to), 0, Math.abs(to - from), height);
      ctx.globalCompositeOperation = 'source-over';
    };
    // The right edge always cuts the title, so it always fades. The left edge fades only while the
    // title is passing under it: in as it starts to move, out as the next pass arrives, so the
    // title at rest reads whole from its first letter.
    const edge = unit * 3;
    fade(x, x + edge, Math.min(1, offset / edge, (titleWidth + gap - offset) / edge));
    fade(x + room, x + room - edge, 1);
  } else {
    ctx.fillText(title, x, middle);
  }
  ctx.restore();
  // Seen through the dots, over the faint unlit ones.
  ctx.globalCompositeOperation = 'destination-in';
  ctx.fillStyle = dots;
  ctx.fillRect(0, 0, width, height);
  ctx.globalCompositeOperation = 'destination-over';
  ctx.fillStyle = unlit;
  ctx.fillRect(0, 0, width, height);
  ctx.globalCompositeOperation = 'source-over';
  texture.needsUpdate = true;
}

export class GalleryScene {
  private element: HTMLElement;
  private onIndexChange: (index: number) => void;
  private onProgress: SceneOptions['onProgress'];
  private onReady: SceneOptions['onReady'];
  private onPointer: SceneOptions['onPointer'];
  private onPlayerButton: SceneOptions['onPlayerButton'];
  private bookletPages: SceneOptions['bookletPages'];
  private onPage: SceneOptions['onPage'];
  private pointerState: string;
  private ready: boolean;
  // Not private: nothing reads it, which noUnusedLocals rejects for a private field.
  albums: Album[];
  private cases: JewelCase[];
  private tweens: Set<Tween>;
  private raf: number;
  private lastTime: number;
  private forceFrames: number;
  private quality: number;
  private frameStats: FrameStats;
  private reducedMotion: boolean;
  private canHover: boolean;
  // Not private: the index tween animates it through tween(), which takes a plain object.
  position: number;
  private lastPosition: number;
  private inertia: number;
  private settle: number;
  private flow: number;
  private target: number;
  private indexTween: Tween | null;
  private active: number;
  private intro: { active: number; others: number };
  private pointer: THREE.Vector2;
  private hitUV: { x: number; y: number };
  private hovered: number;
  private pointerMoved: boolean;
  private pointerInside: boolean;
  private press: Press | null;
  private dragging: boolean;
  private spinning: number;
  private suppressClickUntil: number;
  private move: { x: number; y: number; time: number; speedX: number; speedY: number };
  // Set by resetWheel, addLights, the load timeout and setAlbums, all run from the constructor.
  private wheel!: WheelState;
  private environment!: THREE.WebGLRenderTarget;
  private loadTimer!: number;
  private loaded!: Promise<void[]>;
  private raycaster: THREE.Raycaster;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private gallery: THREE.Group;
  private facing: THREE.Euler;
  private screenRight: THREE.Vector3;
  private toCamera: THREE.Vector3;
  private opened: number;
  private shared: SharedResources;
  private resizeObserver: ResizeObserver;
  private prepared?: boolean;
  private destroyed?: boolean;
  private startIndex: number;
  private openOnReveal: boolean;
  private listenOnReveal: boolean;
  private readOnReveal: boolean;
  // During a jump (show()): the player's drop out of view, 0 to 1, and what to call once the new
  // view has started.
  private leaveTween: Tween | null = null;
  // The intro growing the cases in (playIntro).
  private introTween: Tween | null = null;
  leave = 0;
  private onShown: (() => void) | null = null;
  // The player, once built (buildPlayer): on a Listen, or in idle time after the intro.
  private playerBuilt: Player | null = null;
  private playerScale = 1;
  // A touch device (a coarse pointer): phones and tablets.
  private touch = false;
  // The frames' real interval, smoothed (trackFrameTime): the disc's blur covers at least that.
  private frameInterval = 1 / 60;
  private playerRest: THREE.Vector3;
  // How far an open case's lid swings, in degrees (lidOpenAngle, or lidOpenAngleNarrow on phones).
  private lidAngle: number = C.lidOpenAngle;
  // Which way the booklet leaves its lid (see setBookletRoll): over the hinge, or on phones,
  // where the partly open case's disc half rises there, over the lid's open edge.
  private bookletSide = 1;
  // On phones, how much the open case is scaled from openScale to fill the screen's width.
  private openFit = 1;
  // The row's spacing (hGap, or hGapNarrow of it on phones).
  private rowGap: number = C.hGap;
  // How far the player leans toward the cursor, 0 to 1 (eased like a case's hover).
  private playerLean = 0;
  // Not private: its tween animates it through tween(), which takes a plain object. 0 is the disc
  // in the case, 1 the disc on the spindle with the player in view.
  listen: number;
  private listenTween: Tween | null;
  // The case whose disc is out of it (from insert() until the eject finishes), and whether the
  // player view is wanted (from insert() until eject()).
  private listening: number;
  private inPlayer: boolean;
  private seated: boolean;
  private playing: boolean;
  private spinRate: number;
  private overDisc: boolean;
  private overBooklet: boolean;
  private overButton: PlayerButton | null;
  // The button whose twin in the page's transport row has keyboard focus (focusButton).
  private focusedButton: PlayerButton | null;
  // What the player's screen shows (drawPlayerScreen).
  private screenState: ScreenState;
  // How far the camera has gone from the gallery's to the player view's (see setLens).
  private lens: number;
  private lensRise = 0;
  // Short landscape screens only: whether the picture is raised (see rowRaiseShort), and how far the
  // front case is open, 0 to 1 (eased as the others make room), to blend the row's raise into the
  // open case's.
  private short = false;
  private openRoom = 0;
  // The blue rim light behind the gallery; it fades in the player view, where the camera looks down
  // on surfaces it would tint.
  private rimLight!: THREE.DirectionalLight;
  // The ambient light, raised in the player view so the player and the disc in it read bright.
  private ambientLight!: THREE.AmbientLight;
  private keyLight!: THREE.DirectionalLight;
  private fillLight!: THREE.DirectionalLight;
  private stripLight!: THREE.RectAreaLight;
  private bookletAmbient!: THREE.HemisphereLight;
  // The booklet view. Not private: its tween animates it through tween(), which takes a plain
  // object. 0 is the booklet in its lid, 1 out in the middle of the screen.
  read = 0;
  // How fast the scene's time runs, 1 normal: the dev server's slow motion control sets it.
  timeScale = 1;
  // For that control's readout: how long the booklet takes to come out and to go back, at 1×.
  readonly bookletDurations = { open: C.readDuration, close: C.unreadDuration };
  private readTween: Tween | null = null;
  // The case whose booklet is out of it (from openBooklet() until it is back in the lid), and whether the
  // booklet view is wanted (from openBooklet() until closeBooklet()).
  private reading = -1;
  private inBooklet = false;
  // The same LeafThrough object that sits in the lid, reparented from the moving booklet bounds
  // to the scene once it lands (bookletShown). bookletShift:
  // the point of it held in the middle, across, in page widths (0.5 the cover's middle while closed,
  // 0 the spine while open, -0.5 the back page's middle), and where it is going. closingBooklet: turning back to the cover
  // before the path back. bookletRequest drops pages that arrive for an earlier booklet.
  private magazine: LeafThroughObject | null = null;
  private magazineReady = false;
  private bookletShown = false;
  // How much of the floor's shadow shows under the landed booklet, 0 to 1 (see C.bookletShadowIn).
  floorShade = 0;
  private floorShadeTween: Tween | null = null;
  private bookletShift = 0.5;
  private bookletTarget = 0.5;
  private closingBooklet = false;
  // The page the booklet was on when Close was pressed (closeBooklet): the centring on the way
  // back is paced by the pages left to turn.
  private closingFrom = 0;
  private bookletRequest = 0;
  // Interior pages that arrived while the booklet was still flying, to go in once it has landed
  // (see loadBooklet).
  private pendingPages: (() => void) | null = null;
  // Work waiting for a frame, one job per frame (inFrame): texture uploads and the cases' insides,
  // so a burst of arrivals never holds one frame long. Each runs in a task of its own right after
  // the frame (jobTimer), so neither the frame nor the job runs long on a slow phone.
  private frameJobs: { run: () => void; done: () => void }[] = [];
  private jobTimer = 0;
  // The booklet's page size in the booklet view (scene units), and whether it shows one page at a
  // time (narrow screens), set by resize.
  private bookletPage = 1;
  private bookletSingle = false;
  private overPage: PageSide | null = null;
  // The press on the stage began on the booklet's pages, so its click is LeafThrough's.
  // The booklet view's light and the floor its shadows fall on, posed with the magazine.
  private bookletRig!: THREE.Group;
  private bookletSun!: THREE.DirectionalLight;
  private bookletFloor!: THREE.Mesh<THREE.PlaneGeometry, THREE.ShadowMaterial>;

  // onProgress(loaded, total) reports artwork loading; onReady fires once everything is loaded and
  // compiled. The gallery then stays hidden until reveal(), so the page can clear its loading screen first.
  // onPointer({ hovered, active, opened, dragging }) reports what the pointer is over, for a custom cursor.
  // fogColor should match the page background, so distant cases fade into it. startIndex and
  // openOnReveal restore a gallery from a link: that case in front, already open as it appears.
  constructor(element: HTMLElement, albums: Album[], onIndexChange: (index: number) => void, { onProgress, onReady, onPointer, onPlayerButton, bookletPages, onPage, fogColor = C.fogColor, startIndex = 0, openOnReveal = false, listenOnReveal = false, readOnReveal = false }: SceneOptions = {}) {
    this.element = element;
    this.startIndex = startIndex;
    this.openOnReveal = openOnReveal;
    this.listenOnReveal = listenOnReveal;
    this.readOnReveal = readOnReveal;
    this.listen = 0;
    this.listenTween = null;
    this.listening = -1;
    this.inPlayer = false;
    this.seated = false;
    this.playing = false;
    this.spinRate = 0;
    this.overDisc = false;
    this.overBooklet = false;
    this.overButton = null;
    this.focusedButton = null;
    this.screenState = { track: null, seconds: 0, playing: false };
    this.lens = 0;
    this.onIndexChange = onIndexChange;
    this.onProgress = onProgress;
    this.onReady = onReady;
    this.onPointer = onPointer;
    this.onPlayerButton = onPlayerButton;
    this.bookletPages = bookletPages;
    this.onPage = onPage;
    this.pointerState = '';
    this.ready = false;
    this.albums = [];
    this.cases = [];
    this.tweens = new Set();
    this.raf = 0;
    this.lastTime = 0;
    this.forceFrames = 0;
    this.quality = 0;
    this.frameStats = { awake: 0, total: 0, count: 0, area: 0, dpr: 0 };
    this.reducedMotion = prefersReducedMotion();
    this.canHover = window.matchMedia('(hover: hover)').matches;

    // Gallery motion state: position is a fractional case index.
    this.position = 0;
    this.lastPosition = 0;
    this.inertia = 0;
    this.settle = 0;
    this.flow = 0;
    this.target = -1;
    this.indexTween = null;
    this.active = -1;
    // Cases start shrunk away; the intro grows them in once the gallery is revealed.
    this.intro = { active: 0, others: 0 };

    // Pointer state.
    this.pointer = new THREE.Vector2();
    this.hitUV = { x: 0, y: 0 };
    this.hovered = -1;
    this.pointerMoved = false;
    // A mouse over the stage: the case under it is checked every frame, since cases glide under a
    // still pointer too.
    this.pointerInside = false;
    this.press = null;
    this.dragging = false;
    this.spinning = -1;
    this.suppressClickUntil = 0;
    this.move = { x: 0, y: 0, time: 0, speedX: 0, speedY: 0 };
    this.resetWheel();

    this.raycaster = new THREE.Raycaster();
    // MSAA on screens of one pixel ratio, where edges step, and on touch devices: their tile-based
    // GPUs resolve it cheaply, and their pixel ratio is capped (applyPixelRatio), so without it the
    // cases' edges stepped on phones. Desktop high-DPI screens barely need it, and pay for it.
    const coarse = (this.touch = window.matchMedia('(pointer: coarse)').matches);
    this.renderer = new THREE.WebGLRenderer({ antialias: (window.devicePixelRatio || 1) < 2 || coarse, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = C.exposure;
    // Only the booklet's pages cast and take shadows (see addLights). Every lit material samples the
    // shadow map, so it is drawn once in the first frame: before it exists, the sampler has no depth
    // texture to read and every draw is a WebGL error.
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = true;
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    element.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(fogColor, 7, 14);
    this.camera = new THREE.PerspectiveCamera(C.cameraFOV, 1, C.cameraNear, 100);
    this.camera.position.set(0, 0, C.cameraDistance);
    this.camera.lookAt(0, 0, 0);
    this.gallery = new THREE.Group();
    this.gallery.rotation.set(THREE.MathUtils.degToRad(C.galleryRotX), THREE.MathUtils.degToRad(C.galleryRotY), 0);
    // The open case's rotation in gallery space (square to the camera, top tipped away), and the
    // screen's right and toward-camera directions in gallery space.
    const unturn = this.gallery.quaternion.clone().invert();
    const tipBack = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -THREE.MathUtils.degToRad(C.openTilt));
    this.facing = new THREE.Euler().setFromQuaternion(unturn.clone().multiply(tipBack));
    this.screenRight = new THREE.Vector3(1, 0, 0).applyQuaternion(unturn);
    this.toCamera = new THREE.Vector3(0, 0, 1).applyQuaternion(unturn);
    // Index of the case that is open or opening, or -1.
    this.opened = -1;
    // Hidden until the reveal (prepare, reveal).
    this.gallery.visible = false;
    this.scene.add(this.gallery);
    this.addLights();
    this.shared = makeSharedResources(this.renderer);
    this.renderer.initTexture(this.shared.textures.scratches);
    this.renderer.initTexture(this.shared.textures.caseWear);
    // The player is built once the row is up (buildPlayer) and stays hidden until a disc goes in.
    // Its pose is fixed; resize places, turns and sizes it.
    this.playerRest = new THREE.Vector3();

    this.frame = this.frame.bind(this);
    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerDrag = this.onPointerDrag.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);
    this.onPointerCancel = this.onPointerCancel.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerLeave = this.onPointerLeave.bind(this);
    this.onClick = this.onClick.bind(this);
    this.onContextMenu = this.onContextMenu.bind(this);
    this.onWheel = this.onWheel.bind(this);
    element.addEventListener('pointerdown', this.onPointerDown);
    element.addEventListener('pointermove', this.onPointerMove);
    element.addEventListener('pointerleave', this.onPointerLeave);
    element.addEventListener('click', this.onClick);
    // A long touch on the canvas opens no menu: held on the front case, it turns the case (holdFlip).
    element.addEventListener('contextmenu', this.onContextMenu);
    element.addEventListener('wheel', this.onWheel, { passive: false });
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(element);

    this.albums = albums;
    this.resize();
    // The procedural maps come from a worker, so making them doesn't hold the page (the loading
    // screen's count would stand still); the cases are built once they're in, since the booklets
    // take the paper grain as they're made. Then the artwork loads.
    const artwork = generateInWorker(proceduralParams()).then((maps) => {
      if (this.destroyed) return;
      fillProcedural(this.shared, maps, this.renderer);
      this.setAlbums(albums);
      return this.loaded;
    });
    // Reveal once the cases round the front have their artwork (setAlbums, revealRadius), the page
    // fonts are in and the strip light has its tables. The timeout reveals anyway (with generated
    // art) so a hung request never blocks the page.
    const timeout = new Promise<boolean>((resolve) => {
      this.loadTimer = window.setTimeout(() => resolve(true), C.loadTimeout);
    });
    Promise.race([Promise.all([artwork, document.fonts?.ready, ltcTables]).then(() => false), timeout]).then((timedOut) => this.prepare(timedOut));
  }

  private prepare(timedOut = false) {
    if (this.prepared || this.destroyed) return;
    clearTimeout(this.loadTimer);
    this.prepared = true;
    // On a touch device the player is built now, under the loading screen: Safari compiles its
    // shaders on the main thread whatever the extension says, and built after the intro it froze
    // the page for a second or two (seen in the iOS simulator) just as the row came to hand.
    if (this.touch) this.buildPlayer();
    // Revealed by the timeout, a case still waiting for its artwork shows the generated art
    // instead of its colour; the artwork replaces it if it comes.
    if (timedOut) this.cases.forEach((item, index) => {
      if (item.artLoaded) return;
      const art = makeFallbackArt(this.albums[index], seedFrom(this.albums[index].id ?? index));
      void this.upload(this.setArt(item.disc, art));
      this.setPrint(item, 'cover', art);
      this.syncBooklet(item);
    });
    // Compile every shader now rather than when a case first scrolls into view or opens. Compiling
    // skips hidden objects, so the gallery is shown just for the call. compileAsync compiles at
    // once and resolves when the programs have linked: with KHR_parallel_shader_compile the
    // linking no longer holds the main thread, and the first frame doesn't wait for it.
    this.gallery.visible = true;
    const compiled = this.renderer.compileAsync(this.scene, this.camera);
    this.gallery.visible = false;
    // The screen's fonts come from the page, which may not have loaded them when it was first drawn.
    Promise.all([document.fonts?.load('500 10px "DM Mono"'), document.fonts?.load('500 10px "DM Sans"')]).then(() => {
      if (!this.destroyed) this.drawScreen();
    }).catch(() => {});
    compiled.then(() => {
      if (!this.destroyed) this.onReady?.();
    });
  }

  // Shows the gallery and plays the intro; input works from here on.
  reveal() {
    if (!this.prepared || this.ready || this.destroyed) return;
    this.ready = true;
    this.gallery.visible = true;
    this.playIntro();
    this.updateCursor();
    this.request(3);
  }

  // Jumps to a view, as a link to it would open the page: case `index` in front, open, or with its
  // disc in the player or its booklet out too. The current view leaves first (the player or the
  // booklet drops out of view), then the
  // gallery starts again there with the intro, and onShown is called, so the page can fade it in
  // as on the first reveal. Before the gallery is revealed it only changes where the intro will start.
  show(index: number, open = false, listen = false, read = false, onShown?: () => void) {
    this.startIndex = clamp(Math.round(index), 0, Math.max(0, this.cases.length, this.albums.length) - 1);
    this.openOnReveal = open || listen || read;
    this.listenOnReveal = listen;
    this.readOnReveal = read && !listen;
    if (this.destroyed) return;
    if (!this.ready && !this.leaveTween) {
      this.position = this.lastPosition = this.startIndex;
      return;
    }
    this.onShown = onShown ?? null;
    // A jump during a jump only changes where it lands.
    if (this.leaveTween) return;
    // No input while the view leaves; the player's buttons and the transport row stop at once.
    this.ready = false;
    this.press = null;
    this.dragging = false;
    this.spinning = -1;
    this.inPlayer = this.seated = this.playing = false;
    this.inBooklet = this.closingBooklet = false;
    this.overPage = null;
    if (this.magazine) this.magazine.enabled = false;
    this.hovered = -1;
    this.overDisc = this.overBooklet = false;
    this.overButton = null;
    this.tweens.clear();
    this.indexTween = this.listenTween = this.introTween = this.readTween = null;
    this.cases.forEach((item) => { item.openTween = item.resetTween = null; });
    this.inertia = this.flow = 0;
    this.target = -1;
    this.updateCursor();
    const restart = () => {
      this.leaveTween = null;
      this.restart();
    };
    if (this.reducedMotion) return restart();
    this.leaveTween = this.tween(this, { leave: 1 }, C.leaveDuration, ease.linear, restart);
  }

  // Puts everything back as it was before the first intro, at the jump's start, and plays the intro.
  private restart() {
    if (this.listening >= 0) this.returnDisc();
    if (this.reading >= 0) this.returnBooklet();
    this.listen = this.spinRate = this.leave = this.read = 0;
    this.gallery.position.y = 0;
    if (this.playerBuilt) this.playerBuilt.group.visible = false;
    // Cases ease toward where they should be; unplaced, they go straight there, so the old view
    // doesn't shrink back into the new intro.
    this.cases.forEach((item) => {
      item.open = item.hover = 0;
      item.spinX = item.spinY = item.spinRest = 0;
      Object.assign(item, { pushX: 0, pushY: 0, pushZ: 0, pushVX: 0, pushVY: 0, pushVZ: 0, pushRotX: 0, pushRotY: 0, pushRotVX: 0, pushRotVY: 0 });
      item.placed = false;
    });
    this.position = this.lastPosition = this.startIndex;
    this.inertia = this.settle = this.flow = 0;
    this.active = -1;
    this.opened = -1;
    this.resetWheel();
    this.intro.active = this.intro.others = 0;
    this.ready = true;
    this.gallery.visible = true;
    this.playIntro();
    this.updateCursor();
    this.request(3);
    const shown = this.onShown;
    this.onShown = null;
    shown?.();
  }

  private addLights() {
    this.ambientLight = new THREE.AmbientLight('#ffffff', C.ambientIntensity);
    this.scene.add(this.ambientLight);
    const key = new THREE.DirectionalLight(C.keyColor, C.keyIntensity);
    this.keyLight = key;
    key.position.set(C.keyX, C.keyY, 6);
    const fill = new THREE.DirectionalLight('#ffffff', C.fillIntensity);
    this.fillLight = fill;
    fill.position.set(-5, -2, 4);
    const rim = new THREE.DirectionalLight(C.rimColor, C.rimIntensity);
    this.rimLight = rim;
    rim.position.set(0, 3, -6);
    const strip = new THREE.RectAreaLight('#ffffff', C.topStripIntensity, 6, 0.4);
    this.stripLight = strip;
    strip.position.set(0, 3.2, 3);
    strip.lookAt(0, 0, 0);
    this.scene.add(key, fill, rim, strip);

    // The booklet view's light and floor (C.bookletSun), in the magazine's units (updateBooklet
    // poses the rig like the magazine). The light always casts shadows, even while dark: turning
    // that on and off, or hiding it, would recompile every material. The shadow map is only drawn
    // while a booklet is out. Out of the case, the booklet's sheets cast it on each other, on the
    // tray, insert and disc as it comes out (makeCase, makeDisc), and on the floor once landed.
    const sun = new THREE.DirectionalLight('#ffffff', 0);
    sun.position.set(...C.bookletSunAt);
    sun.castShadow = true;
    sun.shadow.mapSize.set(C.bookletShadowMap, C.bookletShadowMap);
    [sun.shadow.bias, sun.shadow.normalBias] = C.shadowBias;
    sun.shadow.radius = C.shadowSoft;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.ShadowMaterial({ opacity: 0 }));
    floor.position.z = -C.bookletFloorGap / C.bookletSize;
    floor.receiveShadow = true;
    floor.visible = false;
    this.bookletRig = new THREE.Group();
    this.bookletAmbient = new THREE.HemisphereLight(C.bookletAmbientSky, C.bookletAmbientGround, 0);
    this.bookletRig.add(sun, sun.target, floor, this.bookletAmbient);
    this.bookletSun = sun;
    this.bookletFloor = floor;
    this.scene.add(this.bookletRig);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const source = new THREE.CanvasTexture(makeEnvironmentCanvas());
    source.mapping = THREE.EquirectangularReflectionMapping;
    this.environment = pmrem.fromEquirectangular(source);
    source.dispose();
    pmrem.dispose();
    this.scene.environment = this.environment.texture;
    this.scene.environmentIntensity = C.environmentIntensity;
  }

  setAlbums(albums: Album[]) {
    this.cases[this.listening]?.disc.group.removeFromParent();
    this.cases[this.reading]?.booklet.removeFromParent();
    this.disposeMagazine();
    this.reading = -1;
    this.inBooklet = false;
    this.read = 0;
    this.readTween = null;
    this.listening = -1;
    this.inPlayer = this.seated = this.playing = false;
    this.listen = this.spinRate = 0;
    this.listenTween = null;
    this.gallery.position.y = 0;
    if (this.playerBuilt) this.playerBuilt.group.visible = false;
    this.dropFrameJobs();
    this.cases.forEach((item) => {
      item.disposed = true;
      item.disc.materials.forEach((material) => material.dispose());
      item.disc.art?.dispose();
      item.plastic.dispose();
      Object.values(item.prints).forEach((material) => {
        material.map?.dispose();
        material.dispose();
      });
      item.bookletModel.dispose();
      item.bookletTextures.forEach((texture) => texture.dispose());
      this.gallery.remove(item.group);
    });
    this.albums = albums;
    this.tweens.clear();
    this.indexTween = null;
    this.position = this.lastPosition = clamp(Math.round(this.startIndex), 0, Math.max(0, albums.length - 1));
    this.inertia = this.settle = this.flow = 0;
    this.target = -1;
    this.active = -1;
    this.hovered = -1;
    this.opened = -1;
    let loaded = 0;
    this.onProgress?.(0, albums.length);
    const pending: Promise<void>[] = [];
    // Phones get the small copies of the discs and covers first, so the row shows sooner on a slow
    // connection; the full size replaces them once the row is up (sharpenArt).
    const narrow = this.element.clientWidth <= C.narrowWidth;
    this.cases = albums.map((album, index) => {
      const seed = seedFrom(album.id ?? index);
      const item = makeCase(this.shared, album, seed, this.renderer, this.camera, () => this.request());
      item.bookletModel.addEventListener('pagechange', () => {
        if (this.magazine === item.bookletModel) this.reportPage();
      });
      item.bookletModel.addEventListener('ready', () => {
        item.bookletReady = true;
        if (this.magazine !== item.bookletModel) return;
        this.renderer.compile(item.bookletModel, this.camera, this.scene);
        this.magazineReady = true;
        if (this.read >= 1) this.showPages();
      });
      item.pick.userData.index = index;
      // The disc's own reference to the environment, so its reflections can turn with its half of
      // the case (layout), at the strength the scene gives the others.
      for (const material of item.disc.materials) {
        material.envMap = this.environment.texture;
        material.envMapIntensity = C.environmentIntensity;
      }
      // Until the artwork arrives, the booklet's cover from makeCase, the album's colour, stands
      // in for the disc's print and the case's. Not uploaded: the artwork follows within moments,
      // and this is drawn only if the load times out (prepare).
      const placeholder = item.bookletSources[0] as HTMLCanvasElement;
      this.setArt(item.disc, placeholder);
      this.setPrint(item, 'cover', placeholder);
      // The disc prefers a scan of the printed disc, then the cover. The reveal waits for these
      // two, which show on the row; the back insert and the booklet's back page come once the row
      // is up and the intro done (afterIntro), since they show only once a case is turned over or
      // opened: loaded alongside, they took bandwidth from the row on a slow connection, and the
      // browser counted them against its first big paint. Both are generated when there is no scan.
      const small = narrow && Boolean(album.discSmall || album.coverSmall);
      const first = small ? [album.discSmall ?? album.disc, album.coverSmall ?? album.cover] : [album.disc, album.cover];
      // The front case and its neighbours, which the reveal waits for, ahead of the rest.
      const priority = Math.abs(index - this.position) <= C.revealRadius ? 'high' : 'auto';
      pending.push(Promise.all([this.loadImage(first[0], priority), this.loadImage(first[1], priority)]).then(async ([scan, cover]) => {
        if (item.disposed) return;
        const fallback = scan && cover ? null : makeFallbackArt(album, seed);
        if (!(await this.applyArt(item, scan, cover, fallback))) return;
        item.artLoaded = true;
        item.artSmall = small;
        this.onProgress?.((loaded += 1), albums.length);
        // A link to this case open shows its inside at the reveal, so that comes with the row.
        if (this.openOnReveal && index === this.position) this.loadInsert(item, album);
      }));
      this.gallery.add(item.group);
      return item;
    });
    // The reveal waits for the front case's artwork and its neighbours' within revealRadius (the
    // whole row at Infinity); the rest arrives as the intro plays, one upload per frame.
    this.loaded = Promise.all(pending.filter((_, index) => Math.abs(index - this.position) <= C.revealRadius));
    this.request(3);
  }

  // Resolves with the image, decoded, or null when there is no URL or it fails to load. Decoded
  // here, off the main thread, rather than when it is first drawn, which would decode it on the
  // main thread then (an AVIF of this size takes it 20 ms or more).
  private loadImage(url: string | undefined, priority: 'high' | 'auto' = 'auto') {
    return new Promise<HTMLImageElement | null>((resolve) => {
      if (!url) return resolve(null);
      const image = new Image();
      image.decoding = 'async';
      image.fetchPriority = priority;
      image.onload = () => image.decode().then(() => resolve(image), () => resolve(image));
      image.onerror = () => resolve(null);
      image.src = url;
    });
  }

  // Puts a disc scan and a cover on a case, or the generated art where one is missing: the disc's
  // print (the disc found in the scan off the main thread) uploaded in a frame of its own, then
  // the cover, which the booklet takes as its outer page. False if the case went meanwhile.
  private async applyArt(item: JewelCase, scan: HTMLImageElement | null, cover: HTMLImageElement | null, fallback: HTMLCanvasElement | null) {
    const crop = scan ? await locateDisc(scan) : null;
    if (item.disposed) return false;
    await this.upload(this.setArt(item.disc, scan || cover || fallback!, crop));
    if (item.disposed) return false;
    this.setPrint(item, 'cover', cover ? makeSquareCanvas(cover) : fallback!);
    this.syncBooklet(item);
    return true;
  }

  // Phones got the row's artwork small first (setAlbums); once the row is up and the intro done
  // (afterIntro), the full-size files come in, ahead of the inserts, and replace it one upload
  // per frame. Resolves once they are all in (at once where none were small).
  private sharpenArt() {
    return Promise.all(this.cases.map(async (item, index) => {
      if (!item.artSmall) return;
      const album = this.albums[index];
      const [scan, cover] = await Promise.all([this.loadImage(album.disc, 'high'), this.loadImage(album.cover, 'high')]);
      if (item.disposed || !item.artSmall || !(scan || cover)) return;
      if (await this.applyArt(item, scan, cover, null)) item.artSmall = false;
    }));
  }

  // Loads a case's back insert and the booklet's back page, seen once it is turned over or opened,
  // and puts them in as they arrive. Both are generated when there is no scan.
  private loadInsert(item: JewelCase, album: Album) {
    if (item.insertLoaded) return;
    item.insertLoaded = true;
    void Promise.all([this.loadImage(album.back), this.loadImage(album.bookletBack)]).then(([back, bookletBack]) => this.inFrame(() => {
      if (item.disposed) return;
      this.setPrint(item, 'insert', makeInsertCanvas(album, back));
      this.setPrint(item, 'bookletBack', bookletBack ? makeSquareCanvas(bookletBack, album.bookletBackCrop) : makeBookletBackCanvas(album));
      this.syncBooklet(item);
    }));
  }

  // Returns the texture, not yet on the GPU: the caller queues that (upload) when the disc will
  // be drawn soon.
  private setArt(disc: Disc, image: Picture, crop: Crop | null = null) {
    const art = makeArtTexture(image, this.shared.anisotropy, crop);
    disc.art?.dispose();
    disc.art = art;
    disc.frontMaterial.map = art;
    disc.frontMaterial.needsUpdate = true;
    this.request();
    return art;
  }

  // Sets one of a case's printed parts: the cover, the back insert or the booklet's back page. The
  // cover and the back page are drawn as the booklet's outer pages: it gets the same textures (one
  // copy of each in memory) once syncBooklet is called, and uploads them itself; only the insert's
  // is uploaded from here, through the frame loop's queue (upload).
  private setPrint(item: JewelCase, part: PrintPart, canvas: HTMLCanvasElement) {
    const material = item.prints[part];
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = this.shared.anisotropy;
    material.map?.dispose();
    material.map = texture;
    material.color.set('#ffffff');
    if (part === 'insert') void this.upload(texture);
    material.needsUpdate = true;
    if (part === 'cover' || part === 'bookletBack') item.bookletSources[part === 'cover' ? 0 : item.bookletSources.length - 1] = texture;
    this.request();
  }

  // Gives the booklet its current outer pages: one rebuild for both.
  private syncBooklet(item: JewelCase) {
    item.bookletReady = false;
    item.bookletModel.update({ pages: item.bookletSources });
  }

  private playIntro() {
    // A link to an open album starts with that case already open, so the intro grows it in open
    // rather than opening it afterwards.
    if (this.openOnReveal) this.openAtOnce();
    if (this.listenOnReveal && this.openOnReveal) this.insert(true);
    if (this.readOnReveal && this.openOnReveal) this.openBooklet(true);
    if (this.reducedMotion) {
      this.intro.active = this.intro.others = 1;
      this.afterIntro();
      return;
    }
    // The neighbours' tween ends first (at 0.95 of the duration), so this one marks the intro's end.
    this.introTween = this.tween(this.intro, { active: 1 }, C.introDuration, ease.glide, () => {
      this.introTween = null;
      this.updateCursor();
      this.afterIntro();
    });
    this.tween(this.intro, { others: 1 }, C.introDuration * 0.85, ease.linear, null, C.introDuration * 0.1);
  }

  // Minimal tween runner, advanced from the render loop.
  private tween<K extends string>(target: NoInfer<Record<K, number>>, to: Record<K, number>, duration: number, easing: Easing, onComplete?: (() => void) | null, delay = 0) {
    const tween: Tween<K> = { target, to, from: null, duration: Math.max(0.001, duration), easing, onComplete, time: -delay };
    this.tweens.add(tween);
    this.request();
    return tween;
  }

  private killTween(tween: Tween | null) {
    if (tween) this.tweens.delete(tween);
  }

  private updateTweens(dt: number) {
    for (const tween of this.tweens) {
      tween.time += dt;
      if (tween.time < 0) continue;
      if (!tween.from) {
        tween.from = {};
        for (const key in tween.to) tween.from[key] = tween.target[key];
      }
      const progress = Math.min(1, tween.time / tween.duration);
      const eased = tween.easing(progress);
      for (const key in tween.to) tween.target[key] = tween.from[key] + (tween.to[key] - tween.from[key]) * eased;
      if (progress >= 1) {
        this.tweens.delete(tween);
        tween.onComplete?.();
      }
    }
  }

  private get lastIndex() {
    return Math.max(0, this.cases.length - 1);
  }

  private activeIndex() {
    return Math.round(clamp(this.position, 0, this.lastIndex));
  }

  // The index a new step should start from, so quick repeated presses queue up.
  private targetIndex() {
    return this.target >= 0 ? this.target : this.activeIndex();
  }

  goTo(index: number, source = 'snap') {
    if (!this.ready || !this.cases.length || this.listening >= 0 || this.reading >= 0) return;
    const target = clamp(Math.round(index), 0, this.lastIndex);
    const motion = motionFor(source, Math.abs(target - this.position));
    // Moving to another case closes the open one on the way, and turns the front case back to its front.
    if (target !== this.opened) this.close();
    if (target !== this.activeIndex()) this.resetSpin(this.activeIndex());
    this.target = target;
    this.inertia = 0;
    this.settle = 0;
    this.killTween(this.indexTween);
    this.indexTween = null;
    if (this.reducedMotion) {
      this.position = this.lastPosition = target;
      this.flow = 0;
      this.target = -1;
      this.request(3);
      return;
    }
    const direction = Math.sign(target - this.position);
    if (motion.kick && direction) this.flow = clamp(this.flow + direction * motion.kick, -12, 12);
    this.indexTween = this.tween(this, { position: target }, motion.duration, motion.ease, () => {
      this.indexTween = null;
      this.target = -1;
    });
  }

  step(delta: number) {
    this.resetWheel();
    this.goTo(this.targetIndex() + delta, 'key');
  }

  // Opens the front case, or closes it if it is open.
  toggle(index = this.activeIndex()) {
    if (index === this.opened) this.close();
    else this.open(index);
  }

  // Only the case in front opens; opening it also turns it back from any drag.
  open(index = this.activeIndex()) {
    if (!this.ready || !this.cases[index] || index !== this.activeIndex() || this.listening >= 0 || this.reading >= 0) return;
    this.close();
    this.opened = index;
    this.resetSpin(index);
    this.animateOpen(index, 1);
    this.updateCursor();
  }

  private openAtOnce(index = this.activeIndex()) {
    const item = this.cases[index];
    if (!item) return;
    this.opened = index;
    item.open = 1;
    this.updateCursor();
  }

  // An open case whose disc is in the player, or whose booklet is out, stays open until it is back.
  close() {
    if (this.opened < 0 || this.listening >= 0 || this.reading >= 0) return;
    this.animateOpen(this.opened, 0);
    this.opened = -1;
    this.updateCursor();
  }

  // Tweens a case's open amount; a reversal part way through takes only the remaining time.
  private animateOpen(index: number, to: number) {
    const item = this.cases[index];
    this.killTween(item.openTween);
    const duration = this.reducedMotion ? 0.15 : C.openDuration * (to ? 1 : 0.85) * Math.max(0.2, Math.abs(to - item.open));
    item.openTween = this.tween(item, { open: to }, duration, ease.linear, () => {
      item.openTween = null;
      this.updateCursor();
    });
  }

  // Takes the open case's disc out and puts it in the player; at once restores that state from a link.
  // Not while the case is still opening (a double click, a caption clicked twice, Enter pressed twice).
  insert(atOnce = false) {
    const item = this.cases[this.opened];
    if (!this.ready || !item || this.inPlayer || this.reading >= 0 || (this.listening >= 0 && this.listening !== this.opened)) return;
    if (!atOnce && !this.fullyOpen(item)) return;
    this.buildPlayer();
    this.inPlayer = true;
    if (this.listening < 0) {
      this.listening = this.opened;
      // Out of the case the disc hangs off the scene; updatePlayer moves it from the tray to the spindle.
      this.scene.add(item.disc.group);
      item.disc.group.renderOrder = 1000;
    }
    this.screenState = { album: this.albums[this.listening], track: null, seconds: 0, playing: false };
    this.drawScreen();
    this.hovered = -1;
    this.overDisc = false;
    this.overBooklet = false;
    this.animateListen(1, atOnce);
    this.updateCursor();
  }

  // Stops the disc and puts it back in its case.
  eject() {
    if (!this.inPlayer) return;
    this.inPlayer = this.seated = false;
    this.playing = false;
    this.overButton = null;
    this.overDisc = false;
    this.drawScreen();
    this.animateListen(0);
    this.updateCursor();
  }

  // The disc spins while a track plays and coasts to a stop when it pauses.
  setPlaying(playing: boolean) {
    this.playing = playing && this.seated;
    this.screenState.playing = this.playing;
    this.drawScreen();
  }

  // What the player's screen shows: the track number (from 1) and elapsed seconds, or null for
  // the album and its number of tracks.
  setDisplay(track: number | null, seconds = 0) {
    Object.assign(this.screenState, { track, seconds });
    this.drawScreen();
  }

  // The screen stays dark until the disc has landed, and goes dark as it leaves.
  private drawScreen() {
    if (!this.playerBuilt) return;
    drawPlayerScreen(this.playerBuilt, this.seated ? this.screenState : { track: null, seconds: 0, playing: false }, performance.now() / 1000);
    this.request();
  }

  // The player, built if it isn't yet. Its extruded body, buttons and screen are a slice of the
  // start the row doesn't need, so on desktop it is made in idle time after the intro (playIntro),
  // or at once for a Listen before that; on touch devices under the loading screen (prepare). Its
  // shaders compile from here, in parallel where the browser does that, rather than in the first
  // frame it shows.
  private buildPlayer() {
    if (this.playerBuilt) return this.playerBuilt;
    const player = (this.playerBuilt = makePlayer(this.shared.anisotropy, this.shared.textures.trayNormal));
    player.group.scale.setScalar(this.playerScale);
    this.scene.add(player.group);
    this.drawScreen();
    // Its textures (the screen, the turntable's grain, the shadow) go to the GPU now too, not in
    // the first frame of the disc's way in.
    for (const resource of player.resources) if (resource instanceof THREE.Texture) this.renderer.initTexture(resource);
    player.group.visible = true;
    void this.renderer.compileAsync(player.group, this.camera, this.scene).catch(() => {});
    player.group.visible = false;
    return player;
  }

  private get player() {
    return this.buildPlayer();
  }

  // Once the row is up and still: the full-size artwork for phones, then the cases' insides, and
  // the player in idle time. None of it during the intro, which it would hitch, nor with the
  // reveal, whose paint it would delay on a slow connection.
  private afterIntro() {
    void this.sharpenArt().then(() => {
      if (this.destroyed) return;
      this.cases.forEach((item, index) => this.loadInsert(item, this.albums[index]));
    });
    this.buildPlayerWhenIdle();
  }

  private buildPlayerWhenIdle() {
    if (this.playerBuilt) return;
    const build = () => { if (!this.destroyed) this.buildPlayer(); };
    if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(build, { timeout: 2000 });
    else window.setTimeout(build, 300);
  }

  // Runs `job` in a coming frame, one job per frame, and resolves once it has run (or, should the
  // collection go first, without running it). Ten arrivals handled as they came held a phone's
  // main thread for a long moment.
  private inFrame(job: () => void) {
    return new Promise<void>((done) => {
      this.frameJobs.push({ run: job, done });
      this.request();
    });
  }

  // Sends a texture to the GPU in a coming frame; otherwise it is uploaded in the first frame that
  // draws it, which stalls that frame.
  private upload(texture: THREE.Texture) {
    return this.inFrame(() => this.renderer.initTexture(texture));
  }

  private dropFrameJobs() {
    const jobs = this.frameJobs;
    this.frameJobs = [];
    jobs.forEach((job) => job.done());
  }

  private animateListen(to: number, atOnce = false) {
    this.killTween(this.listenTween);
    this.listenTween = null;
    const done = () => {
      this.listenTween = null;
      if (to === 0) this.returnDisc();
      else if (this.inPlayer) {
        // Landed: the screen lights up with the album and the buttons start to work.
        this.seated = true;
        this.drawScreen();
        this.updateCursor();
      }
    };
    if (atOnce || this.reducedMotion) {
      this.listen = to;
      done();
      this.request(3);
      return;
    }
    const duration = (to ? C.insertDuration : C.ejectDuration) * Math.max(0.2, Math.abs(to - this.listen));
    this.listenTween = this.tween(this, { listen: to }, duration, ease.linear, done);
  }

  private returnDisc() {
    const item = this.cases[this.listening];
    this.listening = -1;
    if (!item) {
      this.updateCursor();
      return;
    }
    const disc = item.disc.group;
    item.body.add(disc);
    item.discRest.decompose(disc.position, disc.quaternion, disc.scale);
    disc.renderOrder = 0;
    item.disc.blur.value = 0;
    this.updateCursor();
  }

  // Takes the open case's booklet out to the middle of the screen, where LeafThrough turns its
  // pages; at once restores that view from a link. Not while the case is still opening, nor with its
  // disc out.
  openBooklet(atOnce = false) {
    const item = this.cases[this.opened];
    if (!this.ready || !item || this.inBooklet || this.listening >= 0 || (this.reading >= 0 && this.reading !== this.opened)) return;
    if (!atOnce && !this.fullyOpen(item)) return;
    this.inBooklet = true;
    this.closingBooklet = false;
    if (this.reading < 0) {
      this.reading = this.opened;
      this.magazine = item.bookletModel;
      this.magazineReady = item.bookletLoaded && item.bookletReady;
      item.bookletModel.update({ lighting: bookletLighting(true) });
      // Out of the case the booklet hangs off the scene; updateBooklet moves it from the lid to the middle.
      this.scene.add(item.booklet);
      item.booklet.renderOrder = 1000;
      item.booklet.castShadow = true;
      this.loadBooklet(this.reading);
    }
    this.hovered = -1;
    this.overDisc = this.overBooklet = false;
    // Still out (closed again while it turned back to the cover): it only takes input again.
    if (this.bookletShown && this.magazine) this.magazine.enabled = true;
    else this.animateRead(1, atOnce);
    this.updateCursor();
  }

  // Turns the booklet back to its cover, then puts it back in the lid.
  closeBooklet() {
    if (!this.inBooklet) return;
    this.inBooklet = false;
    this.overPage = null;
    const magazine = this.magazine;
    if (magazine) magazine.enabled = false;
    if (this.bookletShown && magazine && magazine.page !== 0) {
      this.closingBooklet = true;
      this.closingFrom = magazine.page;
      magazine.goTo(0, { animate: !this.reducedMotion });
      this.request();
    } else this.putBookletBack();
    this.updateCursor();
  }

  // The side of the booklet's spine the pointer is over, on pages LeafThrough would take a press on:
  // the pointer's ray met with the pages' plane (the magazine's z = 0) in the magazine's own units,
  // where the spine is x = 0.
  private pageSide(): PageSide | null {
    const magazine = this.magazine;
    if (!magazine?.covers(this.move.x, this.move.y)) return null;
    const { ray, matrix } = BOOKLET_SCRATCH;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    ray.copy(this.raycaster.ray).applyMatrix4(matrix.copy(magazine.matrixWorld).invert());
    const along = -ray.origin.z / ray.direction.z;
    return ray.origin.x + ray.direction.x * along < 0 ? 'prev' : 'next';
  }

  // From the page's controls: a page either way, or straight to one.
  turnPage(delta: number) {
    if (!this.inBooklet || !this.bookletShown || !this.magazine) return;
    if (delta > 0) this.magazine.next();
    else this.magazine.prev();
  }

  turnTo(page: number) {
    if (!this.inBooklet || !this.bookletShown || !this.magazine) return;
    this.magazine.goTo(page, { animate: !this.reducedMotion });
  }

  private animateRead(to: number, atOnce = false) {
    this.killTween(this.readTween);
    this.readTween = null;
    const done = () => {
      this.readTween = null;
      if (to === 0) this.returnBooklet();
      else {
        const pending = this.pendingPages;
        this.pendingPages = null;
        // In a task of its own, after this frame (loadBooklet); showPages follows the booklet's
        // ready event.
        if (pending) void this.inFrame(pending);
        this.showPages();
      }
      this.updateCursor();
    };
    if (atOnce || this.reducedMotion) {
      this.read = to;
      done();
      this.request(3);
      return;
    }
    const duration = (to ? C.readDuration : C.unreadDuration) * Math.max(0.2, Math.abs(to - this.read));
    this.readTween = this.tween(this, { read: to }, duration, ease.linear, done);
  }

  // Fill the existing booklet's blank sheets with its interior scans, with an extra blank side
  // when needed to put the back cover on the back. No interior images are fetched before opening.
  private loadBooklet(index: number) {
    const item = this.cases[index];
    const album = this.albums[index];
    if (item.bookletLoaded) return;
    const request = ++this.bookletRequest;
    (this.bookletPages?.(index) ?? Promise.resolve([])).catch(() => []).then(async (inside) => {
      if (request !== this.bookletRequest || this.destroyed || this.reading !== index) return;
      // The inside pages as textures, kept on the case to free with it; LeafThrough takes a
      // texture as it is. On desktop they go to the GPU one per frame during the flight (upload),
      // so nothing is left to upload at the landing; on a touch device an upload can cost a frame
      // of the flight, so there they go at the landing, within apply, while the paper is still.
      const gone = () => request !== this.bookletRequest || this.destroyed || this.reading !== index;
      const made = inside.map((page) => {
        const source = isPageDescriptor(page) ? page.src : page;
        if (source instanceof THREE.Texture || typeof source === 'string') return { page, texture: null };
        const texture = new THREE.CanvasTexture(source);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = this.shared.anisotropy;
        return { page, texture };
      });
      for (const { texture } of made) {
        if (!texture || this.touch) continue;
        await this.upload(texture);
        if (gone()) {
          made.forEach((entry) => entry.texture?.dispose());
          return;
        }
      }
      item.bookletTextures.forEach((texture) => texture.dispose());
      item.bookletTextures = made.flatMap(({ texture }) => (texture ? [texture] : []));
      const insidePages: PageSource[] = made.map(({ page, texture }) => (texture ? (isPageDescriptor(page) ? { ...page, src: texture } : texture) : page));
      // The covers are the case's own print textures (setPrint).
      const cover = item.prints.cover.map;
      const back = item.prints.bookletBack.map ?? makeBookletBackCanvas(album);
      const pages: PageSource[] = [...(cover ? [cover] : []), ...insidePages];
      // A transparent page is unprinted paper.
      if (pages.length % 2 === 0) pages.push(Object.assign(document.createElement('canvas'), { width: 2, height: 2 }));
      pages.push(back);
      // Keep the physical stack; only replace the blank interior artwork. The spread geometry
      // remains the same during extraction. Single-page layout is applied once it lands on phones.
      const apply = () => {
        if (request !== this.bookletRequest || this.destroyed || this.reading !== index) return;
        item.bookletLoaded = true;
        item.bookletReady = false;
        item.bookletModel.update({ pages, preload: pages.length });
        this.request();
      };
      // Applied in a task of its own (inFrame), never inside a frame: the sheets come new with
      // the rebuild and take their textures a microtask later, so a render in the same task drew
      // them white for one frame at the landing. During the flight they wait for the landing
      // (animateRead); nothing reads them before that.
      if (this.read >= 1) void this.inFrame(apply);
      else this.pendingPages = apply;
    });
  }

  // The booklet has landed and its pages are in: release the same page object from its flight
  // bounds and enable reading. It stays on its cover until the reader turns a page.
  private showPages() {
    const item = this.cases[this.reading];
    const magazine = this.magazine;
    if (!item || !magazine || !this.magazineReady || !this.inBooklet || this.bookletShown) return;
    this.bookletShown = true;
    this.bookletShift = this.bookletTarget = 0.5;
    this.scene.add(magazine);
    if (this.bookletSingle) magazine.update(bookletLayout('single'));
    this.fadeFloorShadow(1, C.bookletShadowIn);
    item.booklet.visible = false;
    magazine.visible = true;
    magazine.enabled = true;
    this.reportPage();
    this.updateCursor();
    this.request(3);
  }

  // The floor's shadow under the landed booklet fades in or out over `duration` seconds (at once
  // with reduced motion). Only a spread lies on a floor, as in LeafThrough; a phone's single page
  // has none.
  private fadeFloorShadow(to: number, duration: number) {
    this.killTween(this.floorShadeTween);
    this.floorShadeTween = null;
    if (this.bookletSingle && to > 0) to = 0;
    if (this.reducedMotion || this.floorShade === to) {
      this.floorShade = to;
      this.request();
      return;
    }
    this.floorShadeTween = this.tween(this, { floorShade: to }, duration, ease.power3InOut, () => { this.floorShadeTween = null; });
  }

  // Put the page object back under its flight bounds, on its cover, for the path back to the lid.
  private putBookletBack() {
    this.closingBooklet = false;
    this.fadeFloorShadow(0, C.bookletShadowOut);
    const item = this.cases[this.reading];
    if (item) {
      item.booklet.visible = true;
      item.booklet.add(item.bookletModel);
      // At once: this can run within updateBooklet, after it has placed the booklet for this frame,
      // and the object still held its pose in the scene, so the frame drew it 2.5% large and off.
      seatInBooklet(item.bookletModel);
      item.bookletModel.update(bookletLayout('spread'));
    }
    this.bookletShown = false;
    this.animateRead(0);
  }

  private returnBooklet() {
    const item = this.cases[this.reading];
    this.reading = -1;
    this.disposeMagazine();
    if (item) {
      const { booklet } = item;
      item.lid.add(booklet);
      item.bookletRest.decompose(booklet.position, booklet.quaternion, booklet.scale);
      booklet.renderOrder = 0;
      booklet.castShadow = false;
      booklet.visible = true;
      item.bend.value.set(0, 0, 0, 0);
      item.bookletFlatten.value = 0;
      item.bookletTuck.value = 1;
      item.stackLoft.value = 1;
      booklet.add(item.bookletModel);
      item.bookletModel.goTo(0);
      if (item.bookletModel.layout !== 'spread') item.bookletModel.update(bookletLayout('spread'));
      seatInBooklet(item.bookletModel);
      item.bookletModel.update({ lighting: bookletLighting(false) });
    }
    this.fadeFloorShadow(0, 0);
    // Nothing casts a shadow any more: draw the map once more, empty, so the booklet's last pose
    // doesn't stay in it.
    this.renderer.shadowMap.needsUpdate = true;
    this.onPage?.(0, 0, 0, false);
    this.updateCursor();
  }

  private disposeMagazine() {
    this.bookletRequest += 1;
    if (this.magazine) this.magazine.enabled = false;
    this.magazine = null;
    this.pendingPages = null;
    this.magazineReady = this.bookletShown = this.closingBooklet = false;
  }

  private reportPage() {
    const magazine = this.magazine;
    if (!magazine) return;
    const pages = magazine.visiblePages;
    this.onPage?.(pages[0] ?? 0, pages[pages.length - 1] ?? 0, magazine.pageCount, magazine.layout === 'single');
  }

  // Whether the open case has finished opening: until then its disc and booklet don't answer, so
  // the second click of a double click that opened it doesn't land on the disc.
  private fullyOpen(item: JewelCase | undefined) {
    return Boolean(item && item.open >= 0.999);
  }

  // Raycasts the open case's disc, with the ray pick() last set.
  private pickDisc() {
    const item = this.cases[this.opened];
    return Boolean(item && this.fullyOpen(item) && this.listening < 0 && this.raycaster.intersectObject(item.disc.pick, false).length);
  }

  // The disc on the player under the pointer, once it has landed (not where a button is).
  private pickSeatedDisc() {
    const item = this.cases[this.listening];
    if (!this.seated || !item) return false;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    return this.raycaster.intersectObject(item.disc.pick, false).length > 0;
  }

  private pickBooklet() {
    const item = this.cases[this.opened];
    return Boolean(item && this.fullyOpen(item) && this.listening < 0 && this.raycaster.intersectObject(item.booklet, false).length);
  }

  // The player's button under the pointer, once the disc has landed.
  private pickButton(): PlayerButton | null {
    if (!this.seated) return null;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObjects(this.player.buttons.map((button) => button.cap), false)[0];
    return this.player.buttons.find((button) => button.cap === hit?.object)?.kind ?? null;
  }

  // A button's twin in the page's transport row has keyboard focus (or none does): its symbol lights
  // as under the pointer.
  focusButton(kind: PlayerButton | null) {
    this.focusedButton = kind;
    this.request();
  }

  // Where the player's lowest edge is on the page (client y), as it sits once in place, whatever it
  // is doing now: the page hangs the transport row under it. Puts the camera and player in their
  // player-view places for the measurement and back.
  playerBottom() {
    const { group } = this.player;
    const lens = this.lens, lensRise = this.lensRise;
    const position = group.position.clone();
    const rotation = group.rotation.clone();
    this.setLens(1);
    this.camera.updateMatrixWorld();
    group.position.copy(this.playerRest);
    group.rotation.set(0, THREE.MathUtils.degToRad(C.playerYaw), 0);
    group.updateWorldMatrix(true, true);
    const body = group.children[0] as THREE.Mesh;
    if (!body.geometry.boundingBox) body.geometry.computeBoundingBox();
    const box = body.geometry.boundingBox!;
    const point = new THREE.Vector3();
    let bottom = -1;
    for (let corner = 0; corner < 8; corner++) {
      point.set(corner & 1 ? box.max.x : box.min.x, corner & 2 ? box.max.y : box.min.y, corner & 4 ? box.max.z : box.min.z)
        .applyMatrix4(body.matrixWorld).project(this.camera);
      bottom = Math.max(bottom, (1 - point.y) / 2);
    }
    group.position.copy(position);
    group.rotation.copy(rotation);
    group.updateWorldMatrix(true, true);
    this.setLens(lens, lensRise);
    const canvas = this.renderer.domElement.getBoundingClientRect();
    return canvas.top + bottom * canvas.height;
  }

  // How wide and tall the open case is on the page (client px) at openScale, with the lid at
  // lidAngle: its V's outer corners, projected through the gallery's camera (the gallery at rest),
  // for openFit.
  private openCaseSize(): [number, number] {
    const lens = this.lens, lensRise = this.lensRise;
    const pan = this.gallery.position.y;
    this.setLens(0);
    this.camera.updateMatrixWorld();
    this.gallery.position.y = 0;
    this.gallery.updateMatrixWorld(true);
    const place = new THREE.Vector3(0, C.activeDiscY, 0).addScaledVector(this.toCamera, C.openForward);
    const pose = new THREE.Matrix4().compose(place, new THREE.Quaternion().setFromEuler(this.facing), new THREE.Vector3().setScalar(C.openScale));
    pose.premultiply(this.gallery.matrixWorld);
    // Each half is a case wide, rising from the hinge toward the camera by half of what the lid
    // stops short of flat; its outer edge's corners, top and bottom, front and back face.
    const rise = (Math.PI - THREE.MathUtils.degToRad(this.lidAngle)) / 2;
    const half = (C.caseWidth - C.hingeInset) * MM;
    const [height, depth] = [C.caseHeight * MM / 2, C.caseDepth * MM / 2];
    let [left, right, top, bottom] = [Infinity, -Infinity, Infinity, -Infinity];
    const corner = new THREE.Vector3();
    for (const side of [-1, 1]) {
      for (const face of [-1, 1]) {
        for (const y of [-height, height]) {
          corner.set(side * half * Math.cos(rise) - side * face * depth * Math.sin(rise), y, half * Math.sin(rise) + face * depth * Math.cos(rise));
          const { x, y: up } = corner.applyMatrix4(pose).project(this.camera);
          [left, right, top, bottom] = [Math.min(left, x), Math.max(right, x), Math.min(top, -up), Math.max(bottom, -up)];
        }
      }
    }
    this.gallery.position.y = pan;
    this.gallery.updateMatrixWorld(true);
    this.setLens(lens, lensRise);
    return [Math.max(1, ((right - left) / 2) * Math.max(1, this.element.clientWidth)), Math.max(1, ((bottom - top) / 2) * Math.max(1, this.element.clientHeight))];
  }

  // A click presses the button in and lets it spring back, and tells the page.
  pressButton(kind: PlayerButton) {
    const button = this.player.buttons.find((item) => item.kind === kind);
    if (!button || !this.seated) return;
    this.killTween(button.tween);
    if (!this.reducedMotion) {
      button.tween = this.tween(button, { press: 1 }, 0.07, ease.power3Out, () => {
        button.tween = this.tween(button, { press: 0 }, 0.22, ease.power3Out, () => {
          button.tween = null;
        });
      });
    }
    this.onPlayerButton?.(kind);
  }

  // Turns a case back to its front.
  private resetSpin(index: number) {
    this.settleSpin(index, 0);
  }

  // Eases a case to rest at a turn of `rest` (0 is the front, ±π the back), then wraps the angle
  // into one turn so later flips start from there.
  // A touch held still on the front case for flipHoldTime turns it over, or back: on touch a
  // horizontal drag browses the row, so the mouse's drag to turn the case isn't there.
  private holdFlip() {
    const press = this.press;
    if (!press || this.dragging || press.grabbed < 0 || this.opened >= 0) return;
    const item = this.cases[press.grabbed];
    if (!item) return;
    press.held = true;
    this.settleSpin(press.grabbed, item.spinRest + Math.PI, C.flipDuration);
  }

  private settleSpin(index: number, rest: number, duration: number = C.resetDuration) {
    const item = this.cases[index];
    if (!item) return;
    const settled = () => {
      item.resetTween = null;
      item.spinRest = rest - Math.PI * 2 * Math.round(rest / (Math.PI * 2));
      item.spinY += item.spinRest - rest;
    };
    this.killTween(item.resetTween);
    item.resetTween = null;
    if (Math.abs(item.spinX) < 0.001 && Math.abs(item.spinY - rest) < 0.001) {
      settled();
      return;
    }
    item.resetTween = this.tween(item, { spinX: 0, spinY: rest }, this.reducedMotion ? 0.15 : duration, ease.power3Out, settled);
  }

  // A fast mouse pass over a case nudges and twists it.
  private swipe(index: number) {
    const item = this.cases[index];
    if (!item || this.reducedMotion || Math.hypot(this.move.speedX, this.move.speedY) < C.wipeMinSpeed) return;
    const push = C.wipePushMax;
    const twist = C.wipeSpinMax;
    item.pushVX += clamp(this.move.speedX * C.wipePush, -push, push);
    item.pushVY -= clamp(this.move.speedY * C.wipePush, -push, push);
    item.pushRotVY += clamp(this.move.speedX * C.wipeSpin, -twist, twist);
    item.pushRotVX += clamp(this.move.speedY * C.wipeSpin, -twist, twist);
    this.request();
  }

  // A click presses the case in, tilting around the point that was hit.
  private pressCase(index: number) {
    const item = this.cases[index];
    if (!item || this.reducedMotion) return;
    item.pushVZ -= C.pressDepth;
    item.pushRotVY += this.hitUV.x * C.pressTilt;
    item.pushRotVX -= this.hitUV.y * C.pressTilt;
    this.request();
  }

  private updatePointer(event: MouseEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    this.pointer.x = (x / rect.width) * 2 - 1;
    this.pointer.y = -(y / rect.height) * 2 + 1;
    return { x, y, rect };
  }

  private pick(): number {
    const targets = this.cases.filter((item) => item.group.visible).map((item) => item.pick);
    if (!targets.length) return -1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObjects(targets, false)[0];
    if (!hit) return -1;
    this.hitUV.x = hit.uv ? hit.uv.x * 2 - 1 : 0;
    this.hitUV.y = hit.uv ? hit.uv.y * 2 - 1 : 0;
    // userData is untyped; setAlbums stores each pick mesh's case index there.
    return hit.object.userData.index as number;
  }

  // The view is changing: the intro or a jump plays, a case opens or closes, the disc goes into
  // the player or back, or the booklet comes out or goes back. Clicks and drags that would change it again wait until it has finished
  // (moving along the row doesn't count).
  private viewBusy() {
    return Boolean(this.introTween || this.leaveTween || this.listenTween || this.readTween || this.closingBooklet || this.cases.some((item) => item.openTween));
  }

  private updateCursor() {
    if (!this.press) {
      this.element.style.cursor = this.inPlayer ? (this.overButton || this.overDisc ? 'pointer' : 'default')
        : this.reading >= 0 ? (this.overPage ? 'pointer' : 'default') : this.hovered >= 0 ? 'pointer' : 'grab';
    }
    const state: PointerState = {
      hovered: this.hovered, active: this.activeIndex(), opened: this.opened, dragging: this.dragging, overDisc: this.overDisc, overBooklet: this.overBooklet,
      listening: this.inPlayer, seated: this.seated, discOut: this.listening >= 0, overButton: this.overButton, busy: this.viewBusy(),
      reading: this.inBooklet, bookletOut: this.reading >= 0, overPage: this.overPage,
    };
    const key = Object.values(state).join();
    if (key === this.pointerState) return;
    this.pointerState = key;
    this.onPointer?.(state);
  }

  private onPointerMove(event: PointerEvent) {
    if (!this.ready || this.press || !this.canHover || event.pointerType !== 'mouse') return;
    this.updatePointer(event);
    const now = performance.now();
    const elapsed = now - this.move.time;
    this.move.time = now;
    if (elapsed < 120) {
      const scale = 16.7 / Math.max(8, elapsed);
      this.move.speedX = (event.clientX - this.move.x) * scale;
      this.move.speedY = (event.clientY - this.move.y) * scale;
    } else {
      this.move.speedX = this.move.speedY = 0;
    }
    this.move.x = event.clientX;
    this.move.y = event.clientY;
    this.pointerMoved = true;
    this.pointerInside = true;
    this.request();
  }

  private onPointerLeave() {
    this.pointerInside = false;
    if (this.press) return;
    this.pointerMoved = false;
    this.hovered = -1;
    this.overButton = null;
    this.overPage = null;
    this.updateCursor();
    this.request();
  }

  private onPointerDown(event: PointerEvent) {
    // In the booklet view a press on the pages is LeafThrough's.
    if (this.reading >= 0) {
      return;
    }
    if (!this.ready || event.button !== 0 || !event.isPrimary || !this.cases.length || this.listening >= 0 || this.viewBusy()) return;
    const point = this.updatePointer(event);
    const hit = this.pick();
    // While a case is open a drag does nothing, on the case or beside it: it neither turns a case
    // nor scrubs the row.
    const locked = this.opened >= 0;
    this.press = {
      id: event.pointerId,
      touch: event.pointerType !== 'mouse',
      startX: point.x, startY: point.y,
      lastX: point.x, lastY: point.y, lastTime: performance.now(),
      locked, spinVelocity: 0,
      // Only the case in front can be grabbed and turned.
      grabbed: !locked && hit >= 0 && Math.abs(hit - this.position) < 0.6 ? hit : -1,
      hold: 0, held: false,
    };
    // A touch held still on the front case turns it over (holdFlip).
    if (this.press.touch && this.press.grabbed >= 0) this.press.hold = window.setTimeout(() => this.holdFlip(), C.flipHoldTime * 1000);
    this.hovered = hit;
    window.addEventListener('pointermove', this.onPointerDrag, { passive: false });
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerCancel);
    this.request();
  }

  private startDrag(event: PointerEvent) {
    // Only called from onPointerDrag, which has checked the press.
    if (!this.press) return;
    this.dragging = true;
    this.killTween(this.indexTween);
    this.indexTween = null;
    this.target = -1;
    this.resetWheel();
    this.inertia = 0;
    this.settle = 0;
    this.spinning = this.press.grabbed;
    // Scrubbing the row closes an open case and turns the front case back to its front.
    if (this.spinning < 0 && !this.press.locked) {
      this.close();
      this.resetSpin(this.activeIndex());
    }
    this.element.style.cursor = 'grabbing';
    this.element.style.userSelect = 'none';
    this.updateCursor();
    const item = this.cases[this.spinning];
    if (item) {
      this.killTween(item.resetTween);
      item.resetTween = null;
    }
    try { this.element.setPointerCapture(event.pointerId); } catch {}
  }

  private onPointerDrag(event: PointerEvent) {
    const press = this.press;
    if (!press || event.pointerId !== press.id) return;
    const point = this.updatePointer(event);
    if (!this.dragging) {
      const dx = point.x - press.startX;
      const dy = point.y - press.startY;
      if (Math.hypot(dx, dy) < C.dragStartDistance) return;
      clearTimeout(press.hold);
      // Horizontal touch drags browse instead of turning the front case.
      if (press.touch && Math.abs(dx) >= Math.abs(dy)) press.grabbed = -1;
      this.startDrag(event);
    }
    if (event.cancelable) event.preventDefault();
    const now = performance.now();
    const dx = point.x - press.lastX;
    const dy = point.y - press.lastY;
    const elapsed = Math.max(8, now - press.lastTime);
    press.lastX = point.x;
    press.lastY = point.y;
    press.lastTime = now;
    this.request();
    if (press.locked) return;

    const item = this.cases[this.spinning];
    if (item) {
      const sensitivity = C.dragSensitivity * 0.0045;
      // The soft limit counts from where the case rests, front or back.
      item.spinY = item.spinRest + softSpin(item.spinY - item.spinRest, dx * sensitivity);
      item.spinX = softSpin(item.spinX, dy * sensitivity);
      press.spinVelocity += ((16.667 / elapsed) * dx * sensitivity - press.spinVelocity) * 0.5;
      return;
    }
    const span = press.touch ? C.touchDragSpan : 6 * C.dragSensitivity;
    const delta = -(dx / point.rect.width) * span;
    this.position = clamp(this.position + delta, 0, this.lastIndex);
    const velocity = clamp((16.667 / elapsed) * delta, -C.dragMaxVelocity, C.dragMaxVelocity);
    this.inertia += (velocity - this.inertia) * C.dragVelocitySmoothing;
  }

  private onPointerUp(event: PointerEvent) {
    this.endPress(event, false);
  }

  private onPointerCancel(event: PointerEvent) {
    this.endPress(event, true);
  }

  private endPress(event: PointerEvent, cancelled: boolean) {
    const press = this.press;
    if (!press || event.pointerId !== press.id) return;
    clearTimeout(press.hold);
    const wasDragging = this.dragging;
    const spinning = this.spinning;
    this.press = null;
    this.dragging = false;
    this.spinning = -1;
    // removeEventListener's options type has no passive; the cast keeps the call as it was.
    window.removeEventListener('pointermove', this.onPointerDrag, { passive: false } as AddEventListenerOptions);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerCancel);
    this.element.style.userSelect = '';
    this.updateCursor();
    try {
      if (this.element.hasPointerCapture(press.id)) this.element.releasePointerCapture(press.id);
    } catch {}
    this.request();
    // The release after a hold that turned the case is no tap.
    if (press.held && !wasDragging) {
      this.suppressClickUntil = performance.now() + 140;
      return;
    }
    if (!wasDragging) return;
    this.suppressClickUntil = performance.now() + 140;
    if (press.locked) {
      this.inertia = 0;
      return;
    }
    // The grabbed case, if one was (spinning is -1 otherwise) and it is still in the row.
    const item: JewelCase | undefined = this.cases[spinning];
    if (item) {
      // Turned past halfway, or flicked, the case turns over; otherwise it eases back to where it
      // rested. A pause before letting go counts as no flick.
      const turned = item.spinY - item.spinRest;
      const flick = performance.now() - press.lastTime < 80 && Math.abs(press.spinVelocity) > C.flipFlickVelocity;
      if (Math.abs(turned) > Math.PI / 2) this.settleSpin(spinning, item.spinRest + Math.sign(turned) * Math.PI, C.flipDuration);
      else if (flick) this.settleSpin(spinning, item.spinRest + Math.sign(press.spinVelocity) * Math.PI, C.flipDuration);
      else this.settleSpin(spinning, item.spinRest);
      this.inertia = 0;
      return;
    }
    if (cancelled) {
      this.inertia = 0;
      this.goTo(Math.round(this.position));
      return;
    }
    if (press.touch) {
      const direction = Math.abs(this.inertia) >= C.touchFlickVelocity ? Math.sign(this.inertia) : 0;
      const target = direction > 0 ? Math.floor(this.position) + 1 : direction < 0 ? Math.ceil(this.position) - 1 : Math.round(this.position);
      this.inertia = 0;
      this.goTo(target, 'flick');
      return;
    }
    // Mouse releases keep their momentum; the render loop applies friction and then snaps.
    if (this.reducedMotion) this.goTo(Math.round(this.position));
  }

  private onContextMenu(event: Event) {
    event.preventDefault();
  }

  private onClick(event: MouseEvent) {
    if (this.reading >= 0) {
      return;
    }
    // In the player view only the player's buttons take clicks, and the landed disc, which ejects.
    if (this.ready && this.inPlayer) {
      this.updatePointer(event);
      const button = this.pickButton();
      if (button) this.pressButton(button);
      else if (this.pickSeatedDisc()) this.eject();
      return;
    }
    if (!this.ready || this.listening >= 0 || this.viewBusy()) return;
    if (performance.now() < this.suppressClickUntil) {
      event.preventDefault();
      return;
    }
    this.updatePointer(event);
    const hit = this.pick();
    if (hit < 0 || (this.opened >= 0 && hit !== this.opened)) return;
    this.resetWheel();
    if (hit !== this.activeIndex()) {
      this.pressCase(hit);
      this.goTo(hit, 'click');
      return;
    }
    // A click opens the front case; an open case closes from the page's Back button, Escape,
    // or Space, so clicks inside it stay free for the disc and booklet. A click
    // on the disc in the open case puts it in the player, one on the booklet takes it out.
    if (hit !== this.opened) this.open(hit);
    else if (this.pickDisc()) this.insert();
    else if (this.pickBooklet()) this.openBooklet();
  }

  private resetWheel() {
    clearTimeout(this.wheel?.timer);
    this.wheel = { timer: 0, armed: true, rising: false, total: 0, direction: 0, envelope: 0, peak: 0, count: 0, stepTime: 0, lastTime: 0, hasLast: false };
  }

  // One step per wheel gesture. Trackpad momentum is tracked as a decaying envelope so its
  // tail does not trigger extra steps, while a fresh flick or a held scroll still does.
  private onWheel(event: WheelEvent) {
    if (event.ctrlKey) return;
    event.preventDefault();
    // Turning the wheel moves the row, which would close a case still opening or closing.
    if (!this.ready || this.cases.some((item) => item.openTween)) return;
    let dx = event.deltaX;
    let dy = event.deltaY;
    if (event.deltaMode === 1) {
      dx *= 16;
      dy *= 16;
    } else if (event.deltaMode === 2) {
      dx *= window.innerWidth;
      dy *= window.innerHeight;
    }
    const delta = Math.abs(dx) > Math.abs(dy) * 1.25 ? dx : dy;
    const size = Math.abs(delta);
    const wheel = this.wheel;
    const now = performance.now();
    const gap = wheel.hasLast ? now - wheel.lastTime : Infinity;
    wheel.lastTime = now;
    wheel.hasLast = true;
    clearTimeout(wheel.timer);
    wheel.timer = window.setTimeout(() => this.resetWheel(), C.wheelIdleReset);
    const decayed = gap === Infinity ? 0 : wheel.envelope * Math.exp(-gap / C.wheelEnvelopeTau);
    // While a case is open the wheel neither moves the row nor closes the case. The gesture is still
    // followed, so the momentum tail of a swipe doesn't step the row once the case closes.
    if (this.opened >= 0) {
      Object.assign(wheel, { armed: false, rising: false, total: 0, count: 0, stepTime: now, envelope: Math.max(size, decayed), peak: Math.max(wheel.peak, size) });
      return;
    }
    if (size < C.wheelNoiseFloor) {
      wheel.envelope = decayed;
      return;
    }
    const rising = size > decayed * C.wheelRiseFactor;
    wheel.envelope = Math.max(size, decayed);
    if (!wheel.armed) {
      wheel.count += 1;
      wheel.peak = Math.max(wheel.peak, size);
      const sinceStep = now - wheel.stepTime;
      const paused = gap >= C.wheelPauseGap;
      const tick = gap >= C.wheelTickGap && wheel.count <= 2 && sinceStep >= C.wheelMinStepTick && size >= wheel.peak * C.wheelTickRatio;
      const flick = rising && sinceStep >= C.wheelMinStepFlick;
      const sustained = sinceStep >= C.wheelSustainDelay && wheel.envelope >= wheel.peak * C.wheelSustainRatio;
      if (!(paused || tick || flick || sustained)) return;
      wheel.armed = true;
      wheel.total = 0;
      wheel.direction = 0;
      wheel.rising = !(paused || tick || sustained);
    }
    const direction = delta > 0 ? 1 : -1;
    if (direction !== wheel.direction) {
      wheel.total = 0;
      wheel.direction = direction;
    }
    wheel.total += Math.min(wheel.rising ? Math.max(0, size - decayed) : size, C.wheelEventCap);
    if (wheel.total < C.wheelStepThreshold) return;
    Object.assign(wheel, { armed: false, rising: false, total: 0, count: 0, stepTime: now, peak: size });
    const current = this.targetIndex();
    const next = clamp(current + direction, 0, this.lastIndex);
    if (next !== current) this.goTo(next, 'wheel');
  }

  private resize() {
    const width = Math.max(1, this.element.clientWidth);
    const height = Math.max(1, this.element.clientHeight);
    const aspect = width / height;
    const narrow = width <= C.narrowWidth;
    const short = !narrow && height <= C.shortHeight && width > height;
    this.short = short;
    this.lidAngle = narrow ? C.lidOpenAngleNarrow : C.lidOpenAngle;
    this.bookletSide = narrow ? -1 : 1;
    this.rowGap = C.hGap * (narrow ? C.hGapNarrow : 1);
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    // Narrow viewports shrink the whole gallery so the front case still fits.
    this.gallery.scale.setScalar(C.galleryScale * clamp(aspect / 1.5, 0.45, 1));
    if (narrow || short) {
      const [caseWidth, caseHeight] = this.openCaseSize();
      const fitWidth = (width - C.openFitPadding * 2) / caseWidth;
      this.openFit = short ? Math.min(fitWidth, (height - C.openFitShortMargin * 2) / caseHeight) : fitWidth;
    } else this.openFit = 1;
    // The player sits centred, a little up, shrunk to fit narrow screens.
    const halfHeight = Math.tan(THREE.MathUtils.degToRad(C.cameraFOV / 2)) * C.cameraDistance;
    const halfWidth = halfHeight * aspect;
    this.playerRest.set(0, halfHeight * (short ? C.playerRaiseShort : C.playerRaise), 0);
    this.setLens(this.lens, this.lensRise);
    this.playerScale = MM * C.playerScale * clamp(halfWidth / 1.4, 0.4, 1) * (short ? C.playerScaleShort : 1);
    this.playerBuilt?.group.scale.setScalar(this.playerScale);
    // The booklet's page, as large as its open spread fits, or on phones its single page.
    this.bookletSingle = narrow;
    this.bookletPage = Math.min(narrow ? halfWidth * 2 * C.bookletFitNarrow : halfWidth * C.bookletFitWidth, halfHeight * 2 * C.bookletFitHeight);
    const layout = narrow ? 'single' : 'spread';
    if (this.bookletShown && this.magazine && this.magazine.layout !== layout) this.magazine.update(bookletLayout(layout));
    // The shadow camera isn't scaled with the rig, so its frustum is in scene units.
    const [across, upDown] = C.bookletShadowReach;
    const page = this.bookletPage;
    const shadowCamera = this.bookletSun.shadow.camera;
    Object.assign(shadowCamera, { left: -across * page, right: across * page, top: upDown * page, bottom: -upDown * page, near: 0.5 * page, far: 12 * page });
    shadowCamera.updateProjectionMatrix();
    const stats = this.frameStats;
    const dpr = window.devicePixelRatio || 1;
    if (dpr !== stats.dpr || Math.abs(width * height - stats.area) > stats.area * 0.2) {
      this.quality = 0;
      stats.total = stats.count = 0;
    }
    stats.dpr = dpr;
    stats.area = width * height;
    this.applyPixelRatio();
  }

  private applyPixelRatio() {
    const width = Math.max(1, this.element.clientWidth);
    const height = Math.max(1, this.element.clientHeight);
    // Capped: a phone's 3× would be nine times a 1× screen's pixels, and its heat. MSAA smooths the
    // edges there (the renderer's antialias), not resolution: 2 on a phone ran hot and showed little.
    let ratio = Math.min(window.devicePixelRatio || 1, width <= 767 ? C.pixelRatioNarrow : C.pixelRatioWide);
    if (width * height * ratio * ratio > C.maxPixels) ratio = Math.sqrt(C.maxPixels / (width * height));
    this.renderer.setPixelRatio(ratio * QUALITY[this.quality]);
    this.renderer.setSize(width, height);
    this.request(3);
  }

  // Averages frame intervals while animating and lowers the resolution if the GPU can't keep up.
  private trackFrameTime(interval: number) {
    const stats = this.frameStats;
    stats.awake += 1;
    if (stats.awake >= 3 && interval <= 0.08) this.frameInterval += (interval - this.frameInterval) * 0.2;
    if (stats.awake < 3 || interval > 0.08 || this.quality >= QUALITY.length - 1) return;
    stats.total += interval;
    stats.count += 1;
    if (stats.count < 20) return;
    const average = stats.total / stats.count;
    stats.total = stats.count = 0;
    if (average <= C.slowFrame) return;
    this.quality = Math.min(QUALITY.length - 1, this.quality + (average > C.verySlowFrame ? 2 : 1));
    this.applyPixelRatio();
  }

  private request(frames = 2) {
    this.forceFrames = Math.max(this.forceFrames, frames);
    if (this.raf || this.destroyed) return;
    this.lastTime = performance.now();
    this.frameStats.awake = 0;
    this.raf = requestAnimationFrame(this.frame);
  }

  private frame(now: number) {
    this.raf = 0;
    const interval = Math.max(0, now - this.lastTime) / 1000;
    const dt = Math.min(0.05, interval) * this.timeScale;
    this.trackFrameTime(interval);
    const frames = Math.min(3, dt * 60);
    this.lastTime = now;
    this.updateTweens(dt);

    if (this.pointerMoved || (this.pointerInside && !this.press)) {
      const moved = this.pointerMoved;
      this.pointerMoved = false;
      const hit = this.listening >= 0 || this.reading >= 0 ? -1 : this.pick();
      const overButton = this.pickButton();
      const overDisc = this.seated ? !overButton && this.pickSeatedDisc() : hit >= 0 && hit === this.opened && this.pickDisc();
      const overBooklet = hit >= 0 && hit === this.opened && !overDisc && this.pickBooklet();
      const overPage = this.pageSide();
      if (hit !== this.hovered || overDisc !== this.overDisc || overBooklet !== this.overBooklet || overButton !== this.overButton || overPage !== this.overPage) {
        // Only the mouse's own movement nudges a case, not a case gliding under a still pointer.
        if (hit >= 0 && hit !== this.hovered && !this.press && moved) this.swipe(hit);
        this.hovered = hit;
        this.overDisc = overDisc;
        this.overBooklet = overBooklet;
        this.overButton = overButton;
        this.overPage = overPage;
        this.updateCursor();
        this.forceFrames = Math.max(this.forceFrames, 2);
      }
    }

    if (this.cases.length && !this.dragging) {
      if (Math.abs(this.inertia) > 1e-5) {
        this.position += this.inertia * frames;
        this.inertia *= this.reducedMotion ? 0 : C.friction ** frames;
        if (Math.abs(this.inertia) < 4e-4) this.inertia = 0;
      }
      if (this.inertia === 0 && !this.indexTween) {
        // Critically damped-ish spring onto the nearest case.
        const nearest = Math.round(clamp(this.position, 0, this.lastIndex));
        const offset = nearest - this.position;
        if (offset !== 0 || Math.abs(this.settle) > 1e-5) {
          this.settle += offset * C.snapFreq * C.snapFreq * dt;
          this.settle *= Math.exp(-C.snapDamping * dt);
          this.position += this.settle * dt;
          if (Math.abs(nearest - this.position) < 8e-4 && Math.abs(this.settle) < 0.004) {
            this.position = nearest;
            this.settle = 0;
          }
        }
      }
    }
    this.position = clamp(this.position, -0.05, this.lastIndex + 0.05);

    // Smoothed scroll velocity drives the lean, bank and dip of the cases.
    if (this.reducedMotion) {
      this.flow = 0;
    } else if (dt > 0) {
      const velocity = clamp((this.position - this.lastPosition) / dt, -40, 40);
      this.flow += (velocity - this.flow) * Math.min(1, dt * (Math.abs(velocity) > Math.abs(this.flow) ? 14 : 6));
      if (Math.abs(this.flow) < 0.01) this.flow = 0;
    }
    this.lastPosition = this.position;

    const active = this.activeIndex();
    if (this.cases.length && active !== this.active) {
      this.active = active;
      this.onIndexChange(active);
      this.updateCursor();
    }

    const residual = this.layout(dt);
    this.updatePlayer(dt);
    for (const item of this.cases) {
      if (item.bookletModel.tick(now)) this.forceFrames = Math.max(this.forceFrames, 2);
    }
    this.updateBooklet(dt);
    if (this.frameJobs.length && !this.jobTimer) {
      this.jobTimer = window.setTimeout(() => {
        this.jobTimer = 0;
        const job = this.frameJobs.shift();
        if (job && !this.destroyed) {
          job.run();
          job.done();
        }
        this.request();
      });
    }
    this.renderer.render(this.scene, this.camera);
    if (this.forceFrames > 0) this.forceFrames -= 1;
    const busy = this.press || this.inertia !== 0 || this.settle !== 0 || this.flow !== 0 || this.tweens.size || residual > 0.001 || this.forceFrames > 0 || this.spinRate > 0 || this.frameJobs.length > 0;
    if (busy) this.raf = requestAnimationFrame(this.frame);
  }

  // The player view (see C.insert*): as `listen` goes from 0 to 1 the disc lifts out of the tray,
  // the row pans up out of view while the player rises into its place, and the disc glides over
  // the well and drops onto the spindle. The disc is held where it was lifted rather than panning
  // away with its case. Ejecting runs the same path backwards. Also spins the disc while playing.
  private updatePlayer(dt: number) {
    const t = this.listen;
    const pan = viewPan(t);
    const start = bookletPanStart(this.lidAngle, this.bookletSide);
    const bookletAway = viewPan(this.read - start + C.viewPanFrom);
    const away = Math.max(pan, bookletAway);
    this.gallery.position.x = 0;
    this.gallery.position.y = away * C.insertPan;
    this.gallery.position.z = 0;
    if (this.ready) this.gallery.visible = away < 0.999;
    this.setLens(away, pan);
    if (!this.playerBuilt) return;
    const player = this.playerBuilt.group;
    player.visible = pan > 0.001;
    player.position.set(this.playerRest.x, this.playerRest.y - (1 - pan) * C.insertPan - ease.power3In(this.leave) * C.leaveDrop, this.playerRest.z);
    // With the disc landed, the player leans toward the cursor like the open case, only less; it
    // eases back as the disc leaves or the pointer goes.
    const lean = this.seated && this.pointerInside && !this.reducedMotion ? 1 : 0;
    this.playerLean += (lean - this.playerLean) * Math.min(1, dt * 10);
    if (Math.abs(lean - this.playerLean) < 0.001) this.playerLean = lean;
    else this.forceFrames = Math.max(this.forceFrames, 2);
    const tilt = this.playerLean * C.hoverTiltStrength * C.openHoverTilt * C.playerHoverTilt;
    player.rotation.set(tilt * this.pointer.y, THREE.MathUtils.degToRad(C.playerYaw) + tilt * this.pointer.x, 0);

    const full = (C.spinRpm / 60) * Math.PI * 2;
    const target = this.playing && !this.reducedMotion ? full : 0;
    const slowing = this.inPlayer ? C.spinDown : C.spinDownEject;
    // Up like a motor; down like a brake, steadily, to a definite stop (an exponential coast
    // crawled to a halt).
    if (target > this.spinRate) this.spinRate += (target - this.spinRate) * (1 - Math.exp(-dt / C.spinUp));
    else this.spinRate = Math.max(target, this.spinRate - (full / slowing) * dt);
    if (target === 0 && this.spinRate < 0.02) this.spinRate = 0;
    // The symbol of the button under the pointer, or with keyboard focus, lights up; the others dim back.
    for (const button of this.player.buttons) {
      const hover = button.kind === this.overButton || button.kind === this.focusedButton ? 1 : 0;
      button.hover = this.reducedMotion ? hover : button.hover + (hover - button.hover) * (1 - Math.exp(-dt / C.playerButtonHover));
      if (Math.abs(hover - button.hover) < 0.002) button.hover = hover;
      else this.forceFrames = Math.max(this.forceFrames, 2);
      button.group.position.z = -button.press * C.playerButtonPress;
      button.mark.opacity = C.playerPrintOpacity + (1 - C.playerPrintOpacity) * button.hover;
    }
    const item = this.cases[this.listening];
    if (!item) return;
    // Clockwise seen from the label, as a disc turns, blurred over the arc it turns in spinBlur.
    item.disc.spin.rotation.z -= this.spinRate * dt;
    this.player.spindle.rotation.y -= this.spinRate * dt;
    if (this.player.screen.scrolls && this.seated) {
      drawPlayerScreen(this.player, this.screenState, performance.now() / 1000);
      this.forceFrames = Math.max(this.forceFrames, 2);
    }
    item.disc.blur.value = this.spinRate * Math.max(C.spinBlur, this.frameInterval);

    const { trayPosition, trayQuaternion, trayScale, seatPosition, seatQuaternion, seatScale, matrix, inverse, axis, forward, point } = PLAYER_SCRATCH;
    item.body.updateWorldMatrix(true, false);
    matrix.multiplyMatrices(item.body.matrixWorld, item.discRest).decompose(trayPosition, trayQuaternion, trayScale);
    trayPosition.y -= this.gallery.position.y;
    axis.set(0, 0, 1).applyQuaternion(trayQuaternion);
    trayPosition.addScaledVector(axis, ease.power3Out(clamp(t / 0.3, 0, 1)) * C.insertLift);
    player.updateWorldMatrix(true, false);
    matrix.multiplyMatrices(player.matrixWorld, this.player.seat).decompose(seatPosition, seatQuaternion, seatScale);
    const carry = ease.power3InOut(clamp((t - 0.35) / 0.45, 0, 1));
    const drop = ease.power3InOut(clamp((t - 0.78) / 0.22, 0, 1));
    axis.set(0, 1, 0).applyQuaternion(player.quaternion);
    seatPosition.addScaledVector(axis, C.insertHover * (1 - drop));
    const disc = item.disc.group;
    disc.position.lerpVectors(trayPosition, seatPosition, carry);
    disc.quaternion.slerpQuaternions(trayQuaternion, seatQuaternion, carry);
    disc.scale.setScalar(trayScale.x + (seatScale.x - trayScale.x) * carry);

    // Keep the disc out of its case too. The open case is tipped back (openTilt), so as it slides
    // straight up past the hanging disc its lower part comes forward through where the disc hangs:
    // where the case's bottom edge passes over the disc, the tray surface is nearer the camera than
    // where the disc rose from, and the tray drew over the disc. In the case's millimetres every
    // point of the disc stays insertClearance in front of the walls' tops within the case's
    // outline, and near its edges in front of a 45° slope down from them, so the push starts and
    // ends gently. The push is straight toward the camera: the disc swells a little as the case
    // passes rather than drifting on screen. Only while the case is away or on its way: at rest in
    // the tray the disc is inside the case, and it lifts well clear before the case starts.
    if (pan > 0) {
      disc.updateWorldMatrix(true, false);
      inverse.copy(item.body.matrixWorld).invert();
      matrix.copy(inverse).multiply(disc.matrixWorld);
      // The camera's direction (world z) in the case's frame.
      forward.setFromMatrixColumn(inverse, 2);
      if (forward.z > 0.2) {
        const halfWidth = (C.caseWidth / 2) * MM, halfHeight = (C.caseHeight / 2) * MM;
        const front = CASE.trayFront * MM + C.insertClearance * MM;
        let deficit = 0;
        for (const sample of DISC_SAMPLES) {
          point.copy(sample).applyMatrix4(matrix);
          const outside = Math.max(Math.abs(point.x) - halfWidth, Math.abs(point.y) - halfHeight);
          deficit = Math.max(deficit, front - Math.max(0, outside) - point.z);
        }
        if (deficit > 0) disc.position.z += deficit / forward.z;
      }
    }

    // Keep the disc out of the player, whatever the path and the screen's shape do. In the player's
    // millimetres, every point of the disc stays insertClearance above the top, and near the sides
    // above a 45° slope down from the top edges, so the push starts gently as the disc comes over
    // an edge rather than jumping; over the well it may go down to the floor, to land on the
    // spindle. The push is straight up the player's axis (still in `axis`).
    disc.updateWorldMatrix(true, false);
    matrix.copy(player.matrixWorld).invert().multiply(disc.matrixWorld);
    let lift = 0;
    for (const sample of DISC_SAMPLES) {
      point.copy(sample).applyMatrix4(matrix);
      const outside = Math.max(Math.abs(point.x), Math.abs(point.z)) - PLAYER.half;
      const floor = outside < 0 && Math.hypot(point.x, point.z - C.wellZ) < C.wellRadius
        ? PLAYER.floor : PLAYER.top + C.insertClearance - Math.max(0, outside);
      lift = Math.max(lift, floor - point.y);
    }
    if (lift > 0) disc.position.addScaledVector(axis, lift * player.scale.x);
  }

  // As read goes from 0 to 1, the stack feeds over the cylinder, back to front, with a bend
  // travelling from its exposed edge to its trailing edge. Carrying overlaps the roll once the
  // holders are clear; the same paper straightens and settles on its front cover.
  // The same magazine lies where it lands, closed on the cover in the same place, and keeps
  // its open spread centred. On a jump both drop out of view like the player.
  private updateBooklet(dt: number) {
    const item = this.cases[this.reading];
    this.renderer.shadowMap.autoUpdate = Boolean(item);
    if (!item) {
      this.bookletSun.intensity = 0;
      this.bookletAmbient.intensity = 0;
      this.bookletFloor.visible = false;
      return;
    }
    const t = this.read;
    // How many times wider than in the lid the sheets stand apart, once out of it (see C.bookletSheetGap).
    const loft = Math.max(1, C.bookletStackOut / (item.sheetGap * Math.max(1, Math.ceil(item.bookletModel.pageCount / 2) - 1)));
    item.bookletTuck.value = 1 - ease.power3InOut(clamp(t / C.bookletTuckUntil, 0, 1));
    const { restPosition, restQuaternion, restScale, readPosition, readQuaternion, backUp, turn, matrix, axis, tilt, centre, roll, shift, untilt, still, heading } = BOOKLET_SCRATCH;
    // The reader keeps the same camera as Listen. Account for its raised viewpoint during
    // the roll, keeping the intended reading height and angle without a second camera move.
    const halfHeight = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * this.camera.position.z;
    const drop = ease.power3In(this.leave) * C.leaveDrop;
    // Include the lens shift used to raise the case on short screens. The reading centre
    // stays at bookletRaise on screen as that case-only framing disappears.
    readPosition.set(0, this.camera.position.y + (C.bookletRaise + this.camera.projectionMatrix.elements[9]) * halfHeight, 0);
    // The camera never turns: above the reader it frames it with a lens shift, looking straight
    // ahead. Tip the page back from that view's image plane, not toward the camera: facing a
    // camera about 26 degrees off its axis, the square page drew about 10% taller than wide.
    const readingPitch = THREE.MathUtils.degToRad(C.bookletTilt);
    readQuaternion.setFromAxisAngle(tilt, -readingPitch);
    const size = bookletReadingSize(this.bookletPage, this.camera.position.y, this.camera.position.z, readingPitch, readPosition.y);

    const { booklet } = item;
    if (booklet.visible) {
      item.lid.updateWorldMatrix(true, false);
      matrix.multiplyMatrices(item.lid.matrixWorld, item.bookletRest).decompose(restPosition, restQuaternion, restScale);
      restPosition.sub(this.gallery.position);
      const phase = (from: number, to: number) => clamp((t - from) / (to - from), 0, 1);
      // Material feeds through a fixed cylindrical path. Moving the centre alone would leave
      // the stack rigid: the vertex shader wraps each sheet point and turns its normal with it.
      const rolled = bookletPlaced(bookletEase(clamp(t / C.bookletRollUntil, 0, 1)), this.lidAngle, this.bookletSide);
      setBookletRoll(rolled, this.lidAngle, this.bookletSide, item.bend.value);
      // Going round the cylinder, the booklet follows its own paper: placed and turned by its
      // centre on the cylinder, not by a separate path.
      bookletRoll(0, item.bend.value, centre);
      // One change of pose, eased over the whole flight from the release: the tilt, from lying in
      // the open case in perspective to flat in the reader; the size; and a shift that brings the
      // end of the way round to the reader's centre. The way round is a cylinder lying on the
      // case, its axis along the spine, and stays one: turning that axis upright as the booklet
      // went round made a cone of it, and the booklet's tilt changed more than once.
      const settle = bookletEase(phase(bookletFedAt(this.lidAngle, this.bookletSide, bookletTurnFrom(this.bookletSide)), 1));
      // The paper straightens with the same change, and lands flat. (Straightening from the
      // cylinder's front on peaked after the booklet had stopped there: a pause, then more.)
      item.bookletFlatten.value = settle * settle;
      // Where the way round ends in the case's frame, and so the shift that lands it on the
      // reader's centre (across and in depth; the height is the screen's, below).
      const natural = (time: number, out: THREE.Vector3) => {
        const progress = bookletPlaced(bookletEase(clamp(time / C.bookletRollUntil, 0, 1)), this.lidAngle, this.bookletSide);
        setBookletRoll(progress, this.lidAngle, this.bookletSide, roll);
        bookletRoll(0, roll, out);
        return out.set(out.x, 0, out.y).applyQuaternion(restQuaternion).multiplyScalar(restScale.x).add(restPosition);
      };
      natural(1, shift).sub(readPosition).negate();
      const placed = centre;
      axis.set(placed.x, 0, placed.y).applyQuaternion(restQuaternion).multiplyScalar(restScale.x);
      // The fit to the screen comes in once the booklet is out from under the lid and going round:
      // started as the paper left the holders, it moved the paper still between the lid's lips.
      const framed = ease.power3InOut(clamp((item.bend.value.y - bookletTurnFrom(this.bookletSide)) / (C.bookletFrameSpan * MM), 0, 1));
      item.stackLoft.value = 1 + (loft - 1) * framed;
      booklet.position.copy(restPosition).add(axis);
      booklet.position.x += shift.x * settle;
      booklet.position.z += shift.z * settle;
      // The height on screen is one smooth curve. Pulled out, the booklet rises over the case as it
      // lifts off the tilted lid; from where it starts round the cylinder (when the case's pan, and
      // the lens with it, start), its height on screen carries on at the speed it had and eases
      // into the reader's by bookletLevelUntil (a Hermite curve). Made of the rise, the levelling,
      // the shift and the perspective of coming toward the camera, each with its own easing, it
      // went in steps, up and down twice.
      const turnAt = bookletFedAt(this.lidAngle, this.bookletSide, bookletTurnFrom(this.bookletSide));
      if (t > turnAt) {
        const lens = this.lens, lensRise = this.lensRise;
        this.setLens(0);
        this.camera.updateMatrixWorld();
        const step = 0.005;
        const from = natural(turnAt, heading).project(this.camera).y;
        const before = natural(turnAt - step, heading).project(this.camera).y;
        this.setLens(lens, lensRise);
        this.camera.updateMatrixWorld();
        const span = C.bookletLevelUntil - turnAt, u = clamp((t - turnAt) / span, 0, 1);
        const to = heading.copy(readPosition).project(this.camera).y;
        const target = (2 * u ** 3 - 3 * u ** 2 + 1) * from + (u ** 3 - 2 * u ** 2 + u) * (from - before) / step * span
          + (3 * u ** 2 - 2 * u ** 3) * to;
        const now = heading.copy(booklet.position).project(this.camera).y;
        booklet.position.y += (target - now) * (this.camera.position.z - booklet.position.z) / this.camera.projectionMatrix.elements[5];
      }
      booklet.position.y -= drop;
      // Turned about its spine by the centre's tangent, the shader bending the paper about that
      // centre; the case's pose turns into the reader's on top of that. The final tangent is -pi;
      // the backing pose cancels it to leave the front cover facing us.
      axis.set(0, 1, 0);
      backUp.setFromAxisAngle(axis, Math.PI).premultiply(readQuaternion);
      untilt.copy(restQuaternion).invert().premultiply(backUp);
      still.identity().slerp(untilt, settle);
      booklet.quaternion.copy(restQuaternion).multiply(turn.setFromAxisAngle(axis, centre.z)).premultiply(still);
      booklet.scale.setScalar(restScale.x + (size / (C.bookletSize * MM) - restScale.x) * settle);
      this.frameFlyingBooklet(item, framed);
      seatInBooklet(item.bookletModel);
    }

    // The light comes in as the booklet arrives. The floor's shadow fades in once it has landed
    // (fadeFloorShadow); with zero opacity the floor stays hidden.
    const [lightFrom, lightUntil] = C.bookletLightIn;
    const lighting = ease.power3InOut(clamp((t - lightFrom) / (lightUntil - lightFrom), 0, 1));
    const [sunFrom, sunUntil] = C.bookletSunIn;
    this.bookletSun.intensity = (C.bookletTravelSun + (C.bookletSun - C.bookletTravelSun) * lighting)
      * ease.power3InOut(clamp((t - sunFrom) / (sunUntil - sunFrom), 0, 1));
    this.bookletSun.shadow.intensity = this.bookletSingle && this.bookletShown ? C.bookletSingleShadow : 1;
    this.bookletAmbient.intensity = (this.bookletSingle ? C.bookletAmbientSingle : C.bookletAmbient) * lighting;
    this.bookletFloor.material.opacity = C.bookletFloorShadow * this.floorShade;
    this.bookletFloor.visible = this.bookletFloor.material.opacity > 0;

    const magazine = this.magazine;
    if (magazine) this.updateShift(magazine, dt);
    // The rig, and the magazine with it: its pages lie on its z = 0 plane, where the booklet's back
    // page was.
    const rig = this.bookletRig;
    rig.quaternion.copy(readQuaternion);
    rig.scale.setScalar(size);
    axis.set(-this.bookletShift * size, 0, -(C.bookletThickness / C.bookletSize) * size / 2).applyQuaternion(readQuaternion);
    rig.position.copy(readPosition).add(axis);
    rig.position.y -= drop;
    if (!magazine) return;
    if (this.bookletShown) {
      item.stackLoft.value = loft;
      magazine.position.copy(rig.position);
      magazine.quaternion.copy(rig.quaternion);
      magazine.scale.copy(rig.scale);
    }
    // Back on its cover and centred on it again: the booklet takes over for the way back.
    if (this.closingBooklet && magazine.page === 0 && !magazine.turning && Math.abs(this.bookletShift - 0.5) < 0.03) this.putBookletBack();
  }

  // Frame the curved paper and keep it above the case. Fit by adjusting the paper's scale,
  // never by pushing it back through the tray. The case itself keeps its upward-only pan.
  // `free` (0 to 1) brings in the fit to the screen and the envelope for the stack's bulge over
  // bookletFrameSpan mm once the booklet is out from under the lid. On short screens and phones the
  // stored booklet shows larger than it lands, and the envelope lay below the paper: in at once,
  // they jumped it 6 to 37 px in one frame. Clearance of the paper itself applies in full.
  private frameFlyingBooklet(item: JewelCase, free: number) {
    if (free === 0) return;
    const { booklet, bend: { value: roll } } = item;
    const { point, paper, matrix, caseMatrix, lidMatrix, bounds, normal } = BOOKLET_SCRATCH;
    let count = 0;
    for (let n = 0; n <= 16; n++) {
      bookletBent((n / 16 - 0.5) * C.bookletSize * MM, roll, item.bookletFlatten.value, point);
      const bx = point.x, bz = point.y, angle = point.z;
      for (let m = 0; m <= 8; m++) for (const side of [-1, 1]) {
        const z = side * C.bookletFlightDepth * MM * free;
        bounds[count++] = bx + Math.sin(angle) * z;
        bounds[count++] = (m / 8 - 0.5) * C.bookletSize * MM;
        bounds[count++] = bz + Math.cos(angle) * z;
      }
    }
    const height = this.element.clientHeight;
    const margin = this.short ? C.bookletFlightMarginShort : C.bookletFlightMargin;
    const limit = Math.max(0.1, 1 - margin * 2 / height);
    const projection = this.camera.projectionMatrix.elements;
    const tan = 1 / projection[5];
    const top = limit + projection[9], bottom = -limit + projection[9];
    // Use the same padded paper bounds at the final reading pose as the size ceiling.
    // This prevents the roll's forward depth or the shared camera from magnifying it past
    // its landing size, and is exactly neutral at the handoff to the reader.
    const finalY = Math.tan(THREE.MathUtils.degToRad(C.cameraFOV / 2)) * C.cameraDistance * C.bookletRaise;
    const finalDistance = lensDistance(C.playerFOV);
    // Read head-on: the camera doesn't rise for the booklet (see setLens).
    const cameraY = 0;
    const finalPitch = THREE.MathUtils.degToRad(C.bookletTilt);
    const finalSize = bookletReadingSize(this.bookletPage, cameraY, finalDistance, finalPitch);
    const finalTan = Math.tan(THREE.MathUtils.degToRad(C.playerFOV / 2));
    // The paper's own height, without the bulge padding: the padding projects differently as the
    // paper turns, and let the paper itself come in 3% larger than it lands.
    let finalLow = Infinity, finalHigh = -Infinity;
    for (const y of [-finalSize / 2, finalSize / 2]) {
      const worldY = finalY + Math.cos(finalPitch) * y;
      const worldZ = -Math.sin(finalPitch) * y;
      const projected = (worldY - cameraY) / ((finalDistance - worldZ) * finalTan);
      finalLow = Math.min(finalLow, projected);
      finalHigh = Math.max(finalHigh, projected);
    }
    const maxSpan = finalHigh - finalLow;
    item.body.updateWorldMatrix(true, false);
    caseMatrix.copy(item.body.matrixWorld).invert();
    item.lid.updateWorldMatrix(true, false);
    lidMatrix.copy(item.lid.matrixWorld).invert();
    const apron = C.bookletClearanceApron * MM;
    // The clearance margin comes in with the fit; the paper never goes into the plastic. Kept at
    // once, the margin lifted the paper in one frame as it left the holders.
    const spare = C.bookletClearance * MM * free;
    const surface = Math.max(CASE.trayFront + 2.5, CASE.disc + C.discThickness / MM / 2) * MM + spare;
    // Alternate framing and clearance. Both use the same formed-paper bounds; a correction
    // to one cannot silently invalidate the other. There is no state carried between frames.
    for (let pass = 0; pass < 8; pass++) {
      matrix.compose(booklet.position, booklet.quaternion, booklet.scale);
      let lower = -Infinity, upper = Infinity, projectedLow = Infinity, projectedHigh = -Infinity;
      for (let i = 0; i < count; i += 3) {
        point.fromArray(bounds, i).applyMatrix4(matrix);
        const distance = this.camera.position.z - point.z;
        // Each sample is padded both ways; the paper is midway, after the second.
        if (i % 6 === 3) {
          paper.set((bounds[i - 3] + bounds[i]) / 2, (bounds[i - 2] + bounds[i + 1]) / 2, (bounds[i - 1] + bounds[i + 2]) / 2).applyMatrix4(matrix);
          const projected = (paper.y - this.camera.position.y) / ((this.camera.position.z - paper.z) * tan);
          projectedLow = Math.min(projectedLow, projected);
          projectedHigh = Math.max(projectedHigh, projected);
        }
        upper = Math.min(upper, top * distance * tan - (point.y - this.camera.position.y));
        lower = Math.max(lower, bottom * distance * tan - (point.y - this.camera.position.y));
      }
      const distance = this.camera.position.z - booklet.position.z;
      const back = Math.max(0, (lower - upper) / ((top - bottom) * tan));
      // Only its size is fitted, not its place: the booklet may leave the screen on the way, and
      // shifted to keep inside the margins it was pushed down as it went over the top of its arc,
      // a second step in its height. (Its height on screen is set before, as one curve.)
      const fit = 1 + (Math.min(distance / (distance + back), maxSpan / (projectedHigh - projectedLow), 1) - 1) * free;
      booklet.scale.multiplyScalar(fit);
      let lift = 0;
      if (this.gallery.visible) {
        let liftBody = 0, liftLid = 0;
        matrix.compose(booklet.position, booklet.quaternion, booklet.scale);
        matrix.premultiply(caseMatrix);
        for (let i = 0; i < count; i += 3) {
          point.fromArray(bounds, i).applyMatrix4(matrix);
          // The 45-degree apron makes clearance start smoothly beside the case instead of
          // jumping when a sample crosses its edge, as in the disc's player clearance.
          const outside = Math.max(0, Math.abs(point.x) - C.caseWidth * MM / 2 - apron, Math.abs(point.y) - C.caseHeight * MM / 2 - apron);
          liftBody = Math.max(liftBody, surface - outside - point.z);
        }
        matrix.compose(booklet.position, booklet.quaternion, booklet.scale).premultiply(lidMatrix);
        for (let i = 0; i < count; i += 3) {
          point.fromArray(bounds, i).applyMatrix4(matrix);
          const across = Math.max(0, Math.abs(point.x + CASE.hingeX * MM) - C.caseWidth * MM / 2 - apron);
          const outside = Math.max(across, Math.abs(point.y) - C.caseHeight * MM / 2 - apron, 0);
          let ceiling = CASE.lidInner * MM + outside;
          // The paper leaves beneath the lid: its top/bottom lips extend farther down
          // than the plate and can catch the trailing edge during screen fitting. Beside a lip,
          // inside it, the paper is clear at any depth: the limit rises steeply away from it (it
          // rose at 45 degrees over the 10 mm apron, so the paper lying 1.5 mm beside the lips
          // was pushed out several mm in one frame as it came free).
          const beside = Math.max(0, (C.caseHeight / 2 - C.caseWall) * MM - Math.abs(point.y));
          const flangeOutside = Math.max(across, beside * C.bookletLipSteep,
            Math.abs(point.y) - C.caseHeight * MM / 2 - apron, 0);
          ceiling = Math.min(ceiling, (C.caseDepth / 2 - C.lidFlange) * MM + flangeOutside);
          liftLid = Math.max(liftLid, point.z - ceiling + spare);
        }
        // Under the lid, out along its normal: the case lies tilted, and moved toward the camera
        // the paper slid along its spine into the lid's lip. Over the body, toward the camera: along
        // its tilted normal it also rose on screen as it went round over the disc half. There it
        // comes in with the fit: the paper still on the lid beside the hinge lies lower than the
        // tray, and held to the tray's height at once, it jumped 7 mm as its edge left the holders.
        if (liftBody > 0) booklet.position.z += liftBody * free / caseMatrix.elements[10];
        if (liftLid > 0) booklet.position.addScaledVector(normal.setFromMatrixColumn(item.lid.matrixWorld, 2), -liftLid);
        lift = Math.max(liftBody * free, liftLid);
      }
      if (fit > 0.99999 && lift < 1e-5) break;
    }
  }

  // Eases bookletShift toward where the magazine should be held in the middle.
  private updateShift(magazine: LeafThroughObject, dt: number) {
    // One page at a time, it always lies right of the spine. An open spread is centred as soon as
    // it opens; a closed one (on its cover or back page) only once the last turn has landed, so it
    // doesn't slide while a page is still turning.
    const pages = magazine.visiblePages;
    if (!this.bookletShown || magazine.layout === 'single') this.bookletTarget = 0.5;
    else if (this.closingBooklet) {
      // Closing, the booklet centres on its cover along with the pages turning back, a step a
      // page, so it arrives as the last one lands and the way back can start then (centred only
      // after the turn, the flight waited most of a second; all at once, it jumped ahead of it).
      const remaining = Math.max(0, magazine.page - 2);
      this.bookletTarget = 0.5 * (1 - (this.closingFrom > 0 ? remaining / this.closingFrom : 0));
    }
    else if (pages.length > 1) this.bookletTarget = 0;
    else if (!magazine.turning) this.bookletTarget = pages[0] === 0 ? 0.5 : -0.5;
    const target = this.bookletTarget;
    this.bookletShift += (target - this.bookletShift) * (this.reducedMotion ? 1 : Math.min(1, dt * C.bookletCentreFollow));
    if (Math.abs(target - this.bookletShift) < 0.001) this.bookletShift = target;
    else this.forceFrames = Math.max(this.forceFrames, 2);
  }

  // The camera, from the gallery (0) to the shared player/booklet view (1). The field of view narrows to
  // playerFOV while the camera backs off. For the player it also moves in front of it and up, by
  // `rise` (0 to 1), until it sees it from playerView degrees above; the booklet is read head-on
  // from where the gallery's camera looks, as LeafThrough shows a magazine (seen from above, its
  // pages turned through the bottom, and drew taller than wide). It stays aimed straight ahead; a lens
  // shift (view offset) moves the image back by as much as the camera moved, so the z = 0 plane
  // stays framed the same and only the viewpoint changes. The fog moves back with it.
  private setLens(amount: number, rise = amount) {
    this.lens = amount;
    this.lensRise = rise;
    const fov = C.cameraFOV + (C.playerFOV - C.cameraFOV) * amount;
    const distance = lensDistance(fov);
    const reach = distance * Math.tan(THREE.MathUtils.degToRad(fov / 2));
    const x = this.playerRest.x * rise;
    const y = (this.playerRest.y + distance * Math.tan(THREE.MathUtils.degToRad(C.playerView))) * rise;
    this.camera.fov = fov;
    this.camera.position.set(x, y, distance);
    // setViewOffset also sets the aspect to fullWidth / fullHeight, so the full size is the aspect by
    // 1, and the offsets are fractions of the height.
    const aspect = Math.max(1, this.element.clientWidth) / Math.max(1, this.element.clientHeight);
    // The raise on short screens (rowRaiseShort), as a fraction of the height; gone in the player view.
    const raise = this.short ? ((C.rowRaiseShort + (C.openRaiseShort - C.rowRaiseShort) * this.openRoom) / Math.max(1, this.element.clientHeight)) * (1 - amount) : 0;
    if (amount > 0 || raise) this.camera.setViewOffset(aspect, 1, -x / (2 * reach), y / (2 * reach) + raise, aspect, 1);
    else {
      this.camera.clearViewOffset();
      this.camera.aspect = aspect;
    }
    this.camera.updateProjectionMatrix();
    // Gone by the time the player is well in view (the booklet's are the reader's, bookletLightIn).
    const [lightFrom, lightUntil] = C.bookletLightIn;
    const galleryLight = 1 - ease.power3InOut(clamp((this.read - lightFrom) / (lightUntil - lightFrom), 0, 1));
    this.keyLight.intensity = C.keyIntensity * galleryLight;
    this.fillLight.intensity = C.fillIntensity * galleryLight;
    this.stripLight.intensity = C.topStripIntensity * galleryLight;
    this.rimLight.intensity = C.rimIntensity * clamp(1 - amount * 2.5, 0, 1) * galleryLight;
    this.ambientLight.intensity = (C.ambientIntensity + C.playerAmbient * amount) * galleryLight;
    this.scene.environmentIntensity = C.environmentIntensity * galleryLight;
    const fog = this.scene.fog as THREE.Fog;
    fog.near = 7 + distance - C.cameraDistance;
    fog.far = 14 + distance - C.cameraDistance;
  }

  // Places every case on a shallow arc, then eases each one toward its slot. Cases further
  // from the front follow more loosely, so the row trails behind fast moves.
  private layout(dt: number) {
    const active = this.activeIndex();
    const moving = !this.reducedMotion;
    const lean = moving ? clamp(Math.sign(this.flow) * Math.sqrt(Math.abs(this.flow)) * C.flowLean, -C.flowLeanMax, C.flowLeanMax) : 0;
    const dip = moving ? Math.min(C.flowDipMax, Math.abs(this.flow) * C.flowDip) : 0;
    const follow = this.dragging ? C.followTight : C.followBase;
    const depth = Math.max(C.discThickness * 3, 0.12, C.depthGap) * 2.4;
    // While a case opens, the others move aside and back to make room.
    let focus = -1;
    let room = 0;
    this.cases.forEach((item, index) => {
      if (item.open > room) {
        room = item.open;
        focus = index;
      }
    });
    room = ease.power3InOut(clamp(room / 0.6, 0, 1));
    this.openRoom = room;
    let residual = 0;

    this.cases.forEach((item, index) => {
      const offset = index - this.position;
      const distance = Math.abs(offset);
      const isActive = index === active;
      const angle = offset * 0.35;
      let x = Math.sin(angle) * this.rowGap * 2.4;
      let y = (isActive ? C.activeDiscY : 0) - dip * (isActive ? 0.7 : 1);
      let z = depth - Math.cos(angle) * depth;
      let rotX = 0;
      let rotY = -angle + lean * (isActive ? 1 : 1.12);
      let rotZ = -lean * C.flowBank * (isActive ? 0.7 : 1);
      const restScale = (isActive ? 1 : Math.max(C.inactiveScale, 1 - distance * (1 - C.inactiveScale) * 0.6)) * C.caseScale;
      let scale = restScale * this.intro.active;
      if (focus >= 0 && index !== focus) {
        const aside = Math.sign(index - focus) * room * C.openSpread;
        const back = room * C.openRecede;
        x += this.screenRight.x * aside - this.toCamera.x * back;
        y += this.screenRight.y * aside - this.toCamera.y * back;
        z += this.screenRight.z * aside - this.toCamera.z * back;
      }
      let visible = distance <= C.renderRadius + 0.5;
      if (!isActive) {
        // Intro: neighbours grow in from behind, staggered by distance.
        const others = clamp(this.intro.others, 0, 2);
        const delay = (Math.min(distance, C.flightStaggerMax) / C.flightStaggerMax) * C.flightStaggerIn;
        const progress = clamp((Math.min(1, others) - delay) / Math.max(0.1, 1 - C.flightStaggerIn), 0, 1);
        const grow = ease.glide(progress) + Math.max(0, others - 1);
        visible = visible && grow > C.flightPopScaleIn;
        scale = restScale * grow;
        z -= (1 - Math.min(1, grow)) * C.flightRecede;
      }
      item.group.visible = visible;

      // Opening: first the case turns toward the camera and settles at its open size, then the lid
      // swings open while the body slides right, keeping the open case centred.
      const face = ease.power3InOut(clamp(item.open / 0.6, 0, 1));
      const swing = ease.power3InOut(clamp((item.open - 0.3) / 0.7, 0, 1));
      if (face > 0) {
        rotX += (this.facing.x - rotX) * face;
        rotY += (this.facing.y - rotY) * face;
        rotZ += (this.facing.z - rotZ) * face;
        scale += (C.openScale * this.openFit * this.intro.active - scale) * face;
        x += this.toCamera.x * C.openForward * face;
        y += this.toCamera.y * C.openForward * face;
        z += this.toCamera.z * C.openForward * face;
      }
      // Opened like a book: short of flat, both halves rise equally from the hinge into a V toward
      // the camera, the body turning back about the hinge by half of what the lid stops short of
      // flat, and the hinge (the spine) slides to the middle. Flat (180°) the body doesn't turn.
      const lidAngle = THREE.MathUtils.degToRad(this.lidAngle);
      const rise = ((Math.PI - lidAngle) / 2) * swing;
      const hinge = CASE.hingeX * MM;
      item.body.rotation.y = -rise;
      item.body.position.set(hinge * (1 - swing) - hinge * Math.cos(rise), 0, -hinge * Math.sin(rise));
      item.lid.rotation.y = -swing * lidAngle;
      // Opened like a book (phones), the disc's half turns away from the bright part of the
      // environment and the disc went dull next to the booklet. Its reflections turn back by the
      // same amount, so it reads as it does lying flat. Not for a disc out in the player.
      const envTurn = index === this.listening ? 0 : rise;
      if (envTurn !== item.envTurn) {
        item.envTurn = envTurn;
        const { group, turn, axis } = TURN_SCRATCH;
        group.setFromEuler(item.group.rotation).premultiply(this.gallery.quaternion);
        turn.setFromAxisAngle(axis, -envTurn).premultiply(group).multiply(group.invert());
        for (const material of item.disc.materials) material.envMapRotation.setFromQuaternion(turn);
      }
      // The pick plane covers both halves as seen from the front.
      item.pick.scale.x = 1 + swing * (2 * Math.cos(rise) - 1);
      // Light reaches the disc as the lid opens; until then it sits in the closed case's shade.
      item.disc.shade.value = C.discClosedShade + (1 - C.discClosedShade) * ease.power3InOut(clamp(swing / 0.5, 0, 1));

      // The hovered case tilts toward the cursor; an open case only follows it a little.
      const hoverTarget = this.hovered === index && this.spinning < 0 ? 1 : 0;
      item.hover += (hoverTarget - item.hover) * Math.min(1, dt * 10);
      if (item.hover > 0.001) {
        const tilt = item.hover * C.hoverTiltStrength * (1 - face * (1 - C.openHoverTilt));
        rotX += tilt * this.pointer.y;
        rotY += tilt * this.pointer.x;
      }

      const pushTotal = Math.abs(item.pushX) + Math.abs(item.pushY) + Math.abs(item.pushZ) + Math.abs(item.pushVX) + Math.abs(item.pushVY)
        + Math.abs(item.pushVZ) + Math.abs(item.pushRotX) + Math.abs(item.pushRotY) + Math.abs(item.pushRotVX) + Math.abs(item.pushRotVY);
      if (pushTotal > 8e-4) {
        const damping = Math.exp(-C.pushDamping * dt);
        const pull = Math.min(1, dt * C.pushReturn);
        item.pushX += item.pushVX * dt; item.pushVX *= damping; item.pushX -= item.pushX * pull;
        item.pushY += item.pushVY * dt; item.pushVY *= damping; item.pushY -= item.pushY * pull;
        item.pushZ += item.pushVZ * dt; item.pushVZ *= damping; item.pushZ -= item.pushZ * pull;
        item.pushRotX += item.pushRotVX * dt; item.pushRotVX *= damping; item.pushRotX -= item.pushRotX * pull;
        item.pushRotY += item.pushRotVY * dt; item.pushRotVY *= damping; item.pushRotY -= item.pushRotY * pull;
        x += item.pushX;
        y += item.pushY;
        z += item.pushZ;
        residual += pushTotal;
      } else if (pushTotal > 0) {
        Object.assign(item, { pushX: 0, pushY: 0, pushZ: 0, pushVX: 0, pushVY: 0, pushVZ: 0, pushRotX: 0, pushRotY: 0, pushRotVX: 0, pushRotVY: 0 });
      }

      const { position, rotation } = item.group;
      if (!item.placed) {
        position.set(x, y, z);
        rotation.set(rotX, rotY, rotZ);
        item.group.scale.setScalar(scale);
        item.placed = true;
      } else {
        const k = clamp(follow - distance * C.followFalloff, C.followMin, C.followTight);
        const amount = this.reducedMotion ? 1 : Math.min(1, dt * k);
        residual += Math.abs(x - position.x) + Math.abs(y - position.y) + Math.abs(z - position.z) + Math.abs(scale - item.group.scale.x)
          + Math.abs(rotX - rotation.x) + Math.abs(rotY - rotation.y) + Math.abs(rotZ - rotation.z) + Math.abs(hoverTarget - item.hover);
        position.x += (x - position.x) * amount;
        position.y += (y - position.y) * amount;
        position.z += (z - position.z) * amount;
        item.group.scale.setScalar(item.group.scale.x + (scale - item.group.scale.x) * amount);
        rotation.x += (rotX - rotation.x) * amount;
        rotation.y += (rotY - rotation.y) * amount;
        rotation.z += (rotZ - rotation.z) * amount;
      }

      // Tilt from a drag relaxes on its own; the turn (spinY) settles when the drag ends.
      if (this.spinning !== index && !item.resetTween) {
        item.spinX += (0 - item.spinX) * Math.min(1, dt * 2.5);
        if (Math.abs(item.spinX) < 1e-4) item.spinX = 0;
        residual += Math.abs(item.spinX);
      }
      item.spin.rotation.x = item.spinX + item.pushRotX;
      item.spin.rotation.y = item.spinY + item.pushRotY;
      item.group.renderOrder = Math.round(500 + position.z * 10 - index * 0.01);
    });
    return residual;
  }

  destroy() {
    this.destroyed = true;
    clearTimeout(this.loadTimer);
    cancelAnimationFrame(this.raf);
    clearTimeout(this.wheel.timer);
    clearTimeout(this.jobTimer);
    this.resizeObserver.disconnect();
    this.element.removeEventListener('pointerdown', this.onPointerDown);
    this.element.removeEventListener('pointermove', this.onPointerMove);
    this.element.removeEventListener('pointerleave', this.onPointerLeave);
    this.element.removeEventListener('click', this.onClick);
    this.element.removeEventListener('contextmenu', this.onContextMenu);
    this.element.removeEventListener('wheel', this.onWheel);
    // removeEventListener's options type has no passive; the cast keeps the call as it was.
    window.removeEventListener('pointermove', this.onPointerDrag, { passive: false } as AddEventListenerOptions);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerCancel);
    // Emptying the collection is no loading progress to report.
    this.onProgress = undefined;
    this.setAlbums([]);
    this.playerBuilt?.resources.forEach((resource) => resource.dispose());
    const { textures, geometries, materials } = this.shared;
    [...Object.values(textures), ...Object.values(geometries), ...Object.values(materials)].forEach((resource) => resource.dispose());
    this.bookletFloor.geometry.dispose();
    this.bookletFloor.material.dispose();
    this.bookletSun.shadow.dispose();
    this.environment.dispose();
    this.renderer.dispose();
    // Switching artists makes a new scene; free the context now rather than at garbage collection,
    // since browsers only keep a few alive.
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }
}
