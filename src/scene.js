import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Tuning ported from the reference gallery (a24.raviklaassens.com). The disc radius is 1 unit.
const C = {
  discThickness: 0.01, edgeBleed: 0.005, edgeBevel: 1, seamOverlap: 0.008,
  // Radii as a fraction of the disc: centre hole, clear clamping zone, then the mirror band up to the print.
  holeSize: 0.127, hubSize: 0.31, labelInner: 0.345, mirrorBandShade: 0.2,
  plasticTint: '#b9bcc0', plasticOpacity: 0.08, plasticEdge: 0.45, plasticRings: [[0.2, 0.0035, 0.1], [0.14, 0.004, 0.12]],
  frontRough: 0.42, frontMetal: 0.48, frontClearcoat: 0.8, texGrain: 0.59, texPrint: 0.35, texScratches: 0.36, texGloss: 1,
  backColor: '#83888f', backRough: 0.2, backMetal: 1, backClearcoat: 0.5, backBand: 0.035, backBandOpacity: 0.88,
  // Data side look: reflection kept from the environment, plus a flat silver lift so it reads as a
  // bright mirror in a light room, and a soft white streak along the light.
  backReflect: 0.75, backSilver: 0.3, backSheen: 0.45,
  trackLines: 0.025, scratchAmount: 0.5, scratchCount: 22, scratchArcs: 5,
  // Rainbow: two light directions in world space (x, y, z, weight), how tightly the wedges line up
  // through the centre, and how much the colours wash out toward silver.
  diffractionStrength: 1.1, diffractionSaturation: 0.8, diffractionFocus: 1.5, diffractionSpacing: 1600,
  diffractionLights: [[-0.3, 0.75, 0.6, 1], [0.7, -0.2, 0.7, 0.6]],
  edgeColor: '#e4e7ec', edgeRoughness: 0.16, edgeMetalness: 0.2,
  galleryScale: 1.08, hGap: 2.3, depthGap: 1, activeDiscY: 0.06, galleryRotX: -30, galleryRotY: -30, inactiveScale: 0.8,
  cameraDistance: 4.4, cameraFOV: 40, exposure: 0.86, environmentIntensity: 1, fogColor: '#f1f0eb',
  keyIntensity: 0.75, keyColor: '#fff9e8', keyX: 3.5, keyY: -8, fillIntensity: 0.3, rimIntensity: 0.75, rimColor: '#499ff5', topStripIntensity: 1.9,
  hoverTiltStrength: 0.21, dragSensitivity: 0.95, dragVelocitySmoothing: 0.32, dragMaxVelocity: 0.5, friction: 0.89,
  maxSpinAngle: 180, resetDuration: 1.2, dragStartDistance: 5, snapDuration: 0.46,
  flowLean: 0.055, flowLeanMax: 0.3, flowBank: 0.32, flowDip: 0.014, flowDipMax: 0.09,
  followTight: 15, followBase: 11, followFalloff: 1.15, followMin: 6.5, snapFreq: 9.5, snapDamping: 12,
  wipePush: 0.012, wipePushMax: 0.5, wipeSpin: 0.009, wipeSpinMax: 0.4, wipeMinSpeed: 9, pushDamping: 4.5, pushReturn: 3.4, pressDepth: 0.55, pressTilt: 1.5,
  flightRecede: 2.2, flightStaggerIn: 0.28, flightStaggerMax: 4, flightPopScaleIn: 0.02, introDuration: 1.15,
  touchDragSpan: 1.8, touchFlickVelocity: 0.035,
  wheelNoiseFloor: 0.3, wheelStepThreshold: 6, wheelEventCap: 24, wheelEnvelopeTau: 550, wheelRiseFactor: 1.2, wheelTickGap: 34, wheelTickRatio: 1,
  wheelPauseGap: 130, wheelIdleReset: 150, wheelMinStepTick: 90, wheelMinStepFlick: 190, wheelSustainDelay: 480, wheelSustainRatio: 0.8,
  renderRadius: 5, loadTimeout: 12000, artResolution: 1024, mapResolution: 1024, maxPixels: 8e6, slowFrame: 0.022, verySlowFrame: 0.04,
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

// Pixel ratio multipliers, stepped down while frames keep running long.
const QUALITY = [1, 0.85, 0.7, 0.55];

function cubicBezier(x1, y1, x2, y2) {
  const ax = 3 * x1 - 3 * x2 + 1, bx = 3 * x2 - 6 * x1, cx = 3 * x1;
  const ay = 3 * y1 - 3 * y2 + 1, by = 3 * y2 - 6 * y1, cy = 3 * y1;
  return (x) => {
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

const ease = {
  glide: cubicBezier(0.32, 0.72, 0, 1),
  linear: (t) => t,
  power3Out: (t) => 1 - (1 - t) ** 3,
  power3InOut: (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2),
};

function motionFor(source, distance) {
  const duration = C.snapDuration;
  if (source === 'wheel') return { duration: duration + 0.05, ease: ease.glide, kick: 2.5 };
  if (source === 'key') return { duration: Math.min(0.6, duration - 0.04 + distance * 0.05), ease: ease.glide, kick: 4 };
  if (source === 'click') return { duration: clamp(0.45 + distance * 0.11, duration, 1.05), ease: ease.glide, kick: Math.min(5, distance * 1.4) };
  if (source === 'flick') return { duration: duration + 0.1, ease: ease.glide, kick: 0 };
  return { duration, ease: ease.power3Out, kick: 0 };
}

// Keeps a dragged disc from spinning freely past roughly half a turn in the same direction.
function softSpin(angle, delta) {
  const limit = THREE.MathUtils.degToRad(C.maxSpinAngle);
  const over = Math.max(0, Math.abs(angle) - limit * 0.8) / limit;
  const resistance = 1 / (1 + over * over * 14);
  return angle + delta * (Math.sign(delta) === Math.sign(angle) || angle === 0 ? resistance : 1);
}

function valueNoise(x, y) {
  const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

function normalsFromHeight(heightMap, size) {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let nx = heightMap[y * size + Math.max(0, x - 1)] - heightMap[y * size + Math.min(size - 1, x + 1)];
      let ny = heightMap[Math.max(0, y - 1) * size + x] - heightMap[Math.min(size - 1, y + 1) * size + x];
      const inverse = 1 / Math.sqrt(nx * nx + ny * ny + 1);
      const index = (y * size + x) * 4;
      data[index] = (nx * inverse * 0.5 + 0.5) * 255;
      data[index + 1] = (ny * inverse * 0.5 + 0.5) * 255;
      data[index + 2] = (inverse * 0.5 + 0.5) * 255;
      data[index + 3] = 255;
    }
  }
  return data;
}

// Printed front: faint optical rings, ink grain, scratches and dust.
function makeFrontNormal(size) {
  const heightMap = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const radius = Math.hypot(x - size / 2, y - size / 2) + 0.0001;
      heightMap[y * size + x] = Math.sin(radius * 0.6) * 0.02 + (valueNoise(x * 0.4, y * 0.4) - 0.5) * 0.5 * C.texPrint;
    }
  }
  for (let n = 0; n < Math.floor(30 * C.texScratches); n++) {
    const angle = Math.random() * Math.PI * 2;
    const length = 30 + Math.random() * 220;
    const startX = Math.random() * size;
    const startY = Math.random() * size;
    const depth = (Math.random() * 0.7 + 0.2) * C.texScratches;
    for (let step = 0; step < length; step++) {
      const x = Math.round(startX + Math.cos(angle) * step);
      const y = Math.round(startY + Math.sin(angle) * step);
      if (x > 0 && y > 0 && x < size - 1 && y < size - 1) heightMap[y * size + x] -= depth;
    }
  }
  for (let n = 0; n < Math.floor(500 * C.texScratches); n++) {
    heightMap[Math.floor(Math.random() * size) * size + Math.floor(Math.random() * size)] += (Math.random() - 0.5) * C.texScratches * 1.2;
  }
  return normalsFromHeight(heightMap, size);
}

function makeFrontRoughness(size) {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const radius = Math.hypot(x - size / 2, y - size / 2);
      let roughness = C.frontRough + (valueNoise(x * 2.3, y * 2.3) - 0.5) * 0.35 * C.texGrain + (valueNoise(x * 0.5, y * 0.5) - 0.5) * 0.3 * C.texPrint;
      roughness -= (Math.sin((radius / (size * 0.5)) * 14) * 0.5 + 0.5) * 0.5 * C.texGloss;
      const index = (y * size + x) * 4;
      data[index] = data[index + 1] = data[index + 2] = clamp(roughness, 0.02, 1) * 255;
      data[index + 3] = 255;
    }
  }
  return data;
}

function makeDataTexture(data, size, anisotropy) {
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
  const ctx = canvas.getContext('2d');
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
function planarRing(inner, outer) {
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
function latheParts(parts, segments) {
  const pieces = parts.map((points) => new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), segments));
  const geometry = mergeGeometries(pieces);
  pieces.forEach((piece) => piece.dispose());
  return geometry;
}

// Solid outer rim: flat top and bottom, a straight side wall and small rounded corners.
function makeEdgeGeometry() {
  const half = C.discThickness / 2;
  // The rim's faces tuck under the artwork and data rings so no background shows at the seam.
  const inner = 1 - C.edgeBleed - C.seamOverlap;
  const round = half * 0.5 * C.edgeBevel;
  const side = [];
  for (let n = 0; n <= 8; n++) {
    const angle = -Math.PI / 2 + (n / 8) * (Math.PI / 2);
    side.push([1 - round + Math.cos(angle) * round, -half + round + Math.sin(angle) * round]);
  }
  for (let n = 0; n <= 8; n++) {
    const angle = (n / 8) * (Math.PI / 2);
    side.push([1 - round + Math.cos(angle) * round, half - round + Math.sin(angle) * round]);
  }
  return latheParts([[[inner, -half], [1 - round, -half]], side, [[1 - round, half], [inner, half]]], 256);
}

// The clear centre: one flat ring of plastic, as thick as the disc, from the hole to the artwork.
function makeHubGeometry() {
  const half = C.discThickness * 0.51;
  const inner = C.holeSize;
  const outer = C.hubSize + C.seamOverlap;
  return latheParts([[[inner, -half], [outer, -half]], [[outer, -half], [outer, half]], [[outer, half], [inner, half]], [[inner, half], [inner, -half]]], 160);
}

// Clear polycarbonate for the centre: plain see-through plastic with a slight tint. Real
// refraction (transmission) would show a blurred copy of the artwork and render the scene twice.
// Plain opacity would also fade the reflections, so edges seen side-on (Fresnel) and specular
// highlights stay opaque. That outlines the hole and rim and keeps the glints, like real plastic.
function makePlastic({ roughness, opacity }) {
  const material = new THREE.MeshPhysicalMaterial({
    color: C.plasticTint, roughness, metalness: 0, transparent: true, opacity, depthWrite: false,
    clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1, side: THREE.DoubleSide, forceSinglePass: true,
  });
  // Faint moulded rings (stacking ring, hole lip) as soft bands of extra opacity.
  const rings = C.plasticRings.map(([radius, width, amount]) => `plasticAlpha += ${amount.toFixed(3)} * exp(-pow((plasticRadius - ${radius.toFixed(4)}) / ${width.toFixed(4)}, 2.0));`).join('\n');
  material.customProgramCacheKey = () => 'plastic';
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float plasticRadius;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nplasticRadius = length(position.xz);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float plasticRadius;')
      .replace('#include <opaque_fragment>', `float plasticFresnel = pow(1.0 - abs(dot(normal, geometryViewDir)), 3.0);
float plasticGlint = dot(reflectedLight.directSpecular + reflectedLight.indirectSpecular, vec3(0.3333));
float plasticAlpha = diffuseColor.a + plasticFresnel * ${C.plasticEdge.toFixed(3)} + plasticGlint;
${rings}
diffuseColor.a = clamp(plasticAlpha, 0.0, 1.0);
#include <opaque_fragment>`);
  };
  return material;
}

// The data side. Its tracks are concentric, so they act as a diffraction grating. Light splits
// into soft pastel wedges on either side of the centre, lined up with the light, and the rest reads
// as bright silver. Grating maths after Alan Zucconi's CD-ROM shader, with his spectrum fit. Also
// adds faint track lines, light-catching scratches and a silver, slightly see-through band around
// the hub. `seed` varies the scratches per disc.
function makeBackMaterial(shared, seed) {
  const material = new THREE.MeshPhysicalMaterial({
    color: C.backColor, roughness: C.backRough, metalness: C.backMetal, clearcoat: C.backClearcoat, clearcoatRoughness: 0.05, envMapIntensity: 1.2,
    transparent: true,
  });
  const [lightA, lightB] = C.diffractionLights;
  const glsl = (value) => value.toFixed(4);
  material.customProgramCacheKey = () => 'cd-back';
  material.onBeforeCompile = (shader) => {
    shader.uniforms.cdLightA = { value: new THREE.Vector3(...lightA.slice(0, 3)).normalize() };
    shader.uniforms.cdLightB = { value: new THREE.Vector3(...lightB.slice(0, 3)).normalize() };
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
function makeScratchCanvas(size) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, size, size);
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  const stroke = (x, y, angle, length, strength, width) => {
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

// A stable 0 to 1 value per album, so each disc keeps its own wear.
function seedFrom(text) {
  let hash = 2166136261;
  for (const char of String(text)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return (hash >>> 0) / 4294967295;
}

function makeSharedResources(renderer) {
  const anisotropy = renderer.capabilities.getMaxAnisotropy();
  const size = C.mapResolution;
  const textures = {
    frontNormal: makeDataTexture(makeFrontNormal(size), size, anisotropy),
    frontRough: makeDataTexture(makeFrontRoughness(size), size, anisotropy),
    scratches: new THREE.CanvasTexture(makeScratchCanvas(size)),
  };
  const geometries = {
    front: planarRing(C.hubSize, 1 - C.edgeBleed),
    back: planarRing(C.hubSize, 1 - C.edgeBleed),
    edge: makeEdgeGeometry(),
    hub: makeHubGeometry(),
    pick: new THREE.CircleGeometry(1, 24),
  };
  const materials = {
    // Clear polycarbonate rim with a faint thin-film shimmer.
    edge: new THREE.MeshPhysicalMaterial({
      color: C.edgeColor, roughness: C.edgeRoughness, metalness: C.edgeMetalness, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.1,
      iridescence: 1, iridescenceIOR: 1.6, iridescenceThicknessRange: [300, 900], side: THREE.DoubleSide,
    }),
    hub: makePlastic({ roughness: 0.05, opacity: C.plasticOpacity }),
    pick: new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide, depthWrite: false }),
  };
  return { textures, geometries, materials, anisotropy };
}

// Finds the disc in a scan: rows and columns where enough pixels differ from the background,
// sampled at the corners. Scans come tightly cropped or with a margin, on white or on black, and
// sometimes cut off at the sides, so the larger extent is taken as the diameter.
function findDiscInScan(image) {
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  const full = { x: (width - Math.max(width, height)) / 2, y: (height - Math.max(width, height)) / 2, size: Math.max(width, height) };
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, size, size);
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
  const extent = (counts) => {
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

// Draws the label into the ring around the clear hub. A disc scan is fitted to the disc and
// already shows its own mirror band; square cover art is cover-fitted and gets a drawn one.
function makeArtTexture(image, anisotropy, scan = false) {
  const size = C.artResolution;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.arc(size / 2, size / 2, (size / 2) * Math.max(C.holeSize, C.hubSize), 0, Math.PI * 2, true);
  ctx.clip('evenodd');
  ctx.fillStyle = '#0c0c0e';
  ctx.fillRect(0, 0, size, size);
  if (scan) {
    const disc = findDiscInScan(image);
    ctx.drawImage(image, disc.x, disc.y, disc.size, disc.size, 0, 0, size, size);
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
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = anisotropy;
  return texture;
}

function fitText(ctx, text, maxWidth, startSize, minSize = 42) {
  let size = startSize;
  do {
    ctx.font = `500 ${size}px Georgia, serif`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 4;
  } while (size > minSize);
  return size;
}

function makeFallbackArt(album, index) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1024;
  const ctx = canvas.getContext('2d');
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
  ctx.fillText((album.artist || 'NIRVANA').toUpperCase(), 105, 120);
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

function makeDisc(shared, seed) {
  const { geometries, materials } = shared;
  const group = new THREE.Group();
  const spin = new THREE.Group();
  group.add(spin);
  const frontMaterial = new THREE.MeshPhysicalMaterial({
    roughness: C.frontRough, metalness: C.frontMetal, roughnessMap: shared.textures.frontRough,
    clearcoat: C.frontClearcoat, clearcoatRoughness: 0.18 * (1 - C.texGloss),
    normalMap: shared.textures.frontNormal, normalScale: new THREE.Vector2(0.3, 0.3), envMapIntensity: 0.85,
  });
  const front = new THREE.Mesh(geometries.front, frontMaterial);
  const backMaterial = makeBackMaterial(shared, seed);
  const back = new THREE.Mesh(geometries.back, backMaterial);
  const edge = new THREE.Mesh(geometries.edge, materials.edge);
  const hub = new THREE.Mesh(geometries.hub, materials.hub);
  front.position.z = C.discThickness / 2 + 6e-4;
  back.position.z = -C.discThickness / 2 - 6e-4;
  back.rotation.y = Math.PI;
  for (const mesh of [edge, hub]) mesh.rotation.x = Math.PI / 2;
  spin.add(front, back, edge, hub);
  // The flat, invisible pick disc stays outside the spin group so hit tests ignore spin and flip.
  const pick = new THREE.Mesh(geometries.pick, materials.pick);
  group.add(pick);
  return {
    group, spin, pick, frontMaterial, backMaterial, art: null, disposed: false,
    hover: 0, spinX: 0, spinY: 0, resetTween: null, placed: false,
    pushX: 0, pushY: 0, pushZ: 0, pushVX: 0, pushVY: 0, pushVZ: 0, pushRotX: 0, pushRotY: 0, pushRotVX: 0, pushRotVY: 0,
  };
}

export class DiscScene {
  // onProgress(loaded, total) reports artwork loading; onReady fires when the gallery appears.
  constructor(element, albums, onIndexChange, { onProgress, onReady } = {}) {
    this.element = element;
    this.onIndexChange = onIndexChange;
    this.onProgress = onProgress;
    this.onReady = onReady;
    this.ready = false;
    this.albums = [];
    this.discs = [];
    this.tweens = new Set();
    this.raf = 0;
    this.lastTime = 0;
    this.forceFrames = 0;
    this.quality = 0;
    this.frameStats = { awake: 0, total: 0, count: 0, area: 0, dpr: 0 };
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.canHover = window.matchMedia('(hover: hover)').matches;

    // Gallery motion state: position is a fractional disc index.
    this.position = 0;
    this.lastPosition = 0;
    this.inertia = 0;
    this.settle = 0;
    this.flow = 0;
    this.target = -1;
    this.indexTween = null;
    this.active = -1;
    // Discs start shrunk away; the intro grows them in once the gallery is revealed.
    this.intro = { active: 0, others: 0 };

    // Pointer state.
    this.pointer = new THREE.Vector2();
    this.hitUV = { x: 0, y: 0 };
    this.hovered = -1;
    this.pointerMoved = false;
    this.press = null;
    this.dragging = false;
    this.spinning = -1;
    this.suppressClickUntil = 0;
    this.move = { x: 0, y: 0, time: 0, speedX: 0, speedY: 0 };
    this.resetWheel();

    this.raycaster = new THREE.Raycaster();
    this.loader = new THREE.ImageLoader();
    // High-DPI screens barely need MSAA, and it is costly at that resolution.
    this.renderer = new THREE.WebGLRenderer({ antialias: (window.devicePixelRatio || 1) < 2, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = C.exposure;
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    element.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(C.fogColor, 7, 14);
    this.camera = new THREE.PerspectiveCamera(C.cameraFOV, 1, 0.1, 100);
    this.camera.position.set(0, 0, C.cameraDistance);
    this.camera.lookAt(0, 0, 0);
    this.gallery = new THREE.Group();
    this.gallery.rotation.set(THREE.MathUtils.degToRad(C.galleryRotX), THREE.MathUtils.degToRad(C.galleryRotY), 0);
    // Hidden until every disc has its artwork, so nothing pops in.
    this.gallery.visible = false;
    this.scene.add(this.gallery);
    this.addLights();
    this.shared = makeSharedResources(this.renderer);
    Object.values(this.shared.textures).forEach((texture) => this.renderer.initTexture(texture));

    this.frame = this.frame.bind(this);
    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerDrag = this.onPointerDrag.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);
    this.onPointerCancel = this.onPointerCancel.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerLeave = this.onPointerLeave.bind(this);
    this.onClick = this.onClick.bind(this);
    this.onWheel = this.onWheel.bind(this);
    element.addEventListener('pointerdown', this.onPointerDown);
    element.addEventListener('pointermove', this.onPointerMove);
    element.addEventListener('pointerleave', this.onPointerLeave);
    element.addEventListener('click', this.onClick);
    element.addEventListener('wheel', this.onWheel, { passive: false });
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(element);

    this.setAlbums(albums);
    this.resize();
    // Reveal once every disc has its final artwork and the page fonts are in. The timeout reveals
    // anyway (with placeholders) so a hung request never blocks the page.
    const timeout = new Promise((resolve) => {
      this.loadTimer = setTimeout(resolve, C.loadTimeout);
    });
    Promise.race([Promise.all([this.loaded, document.fonts?.ready]), timeout]).then(() => this.reveal());
  }

  reveal() {
    if (this.ready || this.destroyed) return;
    clearTimeout(this.loadTimer);
    this.ready = true;
    this.gallery.visible = true;
    // Compile every shader now rather than when a disc first scrolls into view.
    this.renderer.compile(this.scene, this.camera);
    this.playIntro();
    this.onReady?.();
    this.request(3);
  }

  addLights() {
    RectAreaLightUniformsLib.init();
    this.scene.add(new THREE.AmbientLight('#ffffff', 0.25));
    const key = new THREE.DirectionalLight(C.keyColor, C.keyIntensity);
    key.position.set(C.keyX, C.keyY, 6);
    const fill = new THREE.DirectionalLight('#ffffff', C.fillIntensity);
    fill.position.set(-5, -2, 4);
    const rim = new THREE.DirectionalLight(C.rimColor, C.rimIntensity);
    rim.position.set(0, 3, -6);
    const strip = new THREE.RectAreaLight('#ffffff', C.topStripIntensity, 6, 0.4);
    strip.position.set(0, 3.2, 3);
    strip.lookAt(0, 0, 0);
    this.scene.add(key, fill, rim, strip);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const source = new THREE.CanvasTexture(makeEnvironmentCanvas());
    source.mapping = THREE.EquirectangularReflectionMapping;
    this.environment = pmrem.fromEquirectangular(source);
    source.dispose();
    pmrem.dispose();
    this.scene.environment = this.environment.texture;
    this.scene.environmentIntensity = C.environmentIntensity;
  }

  setAlbums(albums) {
    this.discs.forEach((disc) => {
      disc.disposed = true;
      disc.frontMaterial.dispose();
      disc.backMaterial.dispose();
      disc.art?.dispose();
      this.gallery.remove(disc.group);
    });
    this.albums = albums;
    this.tweens.clear();
    this.indexTween = null;
    this.position = this.lastPosition = 0;
    this.inertia = this.settle = this.flow = 0;
    this.target = -1;
    this.active = -1;
    this.hovered = -1;
    let loaded = 0;
    this.onProgress?.(0, albums.length);
    const pending = [];
    this.discs = albums.map((album, index) => {
      const disc = makeDisc(this.shared, seedFrom(album.id ?? index));
      disc.pick.userData.index = index;
      this.setArt(disc, makeFallbackArt(album, index));
      // Prefer a scan of the printed disc, then the square cover, then the generated placeholder.
      const sources = [album.disc && { url: album.disc, scan: true }, album.cover && { url: album.cover, scan: false }].filter(Boolean);
      pending.push(new Promise((resolve) => {
        const loadNext = () => {
          const source = sources.shift();
          if (!source) return resolve();
          this.loader.load(source.url, (image) => {
            if (!disc.disposed) this.setArt(disc, image, source.scan);
            resolve();
          }, undefined, loadNext);
        };
        loadNext();
      }).then(() => {
        if (!disc.disposed) this.onProgress?.((loaded += 1), albums.length);
      }));
      this.gallery.add(disc.group);
      return disc;
    });
    this.loaded = Promise.all(pending);
    this.request(3);
  }

  setArt(disc, image, scan = false) {
    const art = makeArtTexture(image, this.shared.anisotropy, scan);
    disc.art?.dispose();
    disc.art = art;
    disc.frontMaterial.map = art;
    // Upload now; a first upload mid-scroll stalls the frame.
    this.renderer.initTexture(art);
    disc.frontMaterial.needsUpdate = true;
    this.request();
  }

  playIntro() {
    if (this.reducedMotion) {
      this.intro.active = this.intro.others = 1;
      return;
    }
    this.tween(this.intro, { active: 1 }, C.introDuration, ease.glide);
    this.tween(this.intro, { others: 1 }, C.introDuration * 0.85, ease.linear, null, C.introDuration * 0.1);
  }

  // Minimal tween runner, advanced from the render loop.
  tween(target, to, duration, easing, onComplete, delay = 0) {
    const tween = { target, to, from: null, duration: Math.max(0.001, duration), easing, onComplete, time: -delay };
    this.tweens.add(tween);
    this.request();
    return tween;
  }

  killTween(tween) {
    if (tween) this.tweens.delete(tween);
  }

  updateTweens(dt) {
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

  get lastIndex() {
    return Math.max(0, this.discs.length - 1);
  }

  activeIndex() {
    return Math.round(clamp(this.position, 0, this.lastIndex));
  }

  // The index a new step should start from, so quick repeated presses queue up.
  targetIndex() {
    return this.target >= 0 ? this.target : this.activeIndex();
  }

  goTo(index, source = 'snap') {
    if (!this.ready || !this.discs.length) return;
    const target = clamp(Math.round(index), 0, this.lastIndex);
    const motion = motionFor(source, Math.abs(target - this.position));
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

  step(delta) {
    this.resetWheel();
    this.goTo(this.targetIndex() + delta, 'key');
  }

  // Flips a disc to its data side, or back.
  flip(index = this.activeIndex()) {
    const disc = this.discs[index];
    if (!this.ready || !disc) return;
    this.killTween(disc.resetTween);
    disc.resetTween = this.tween(disc, { spinY: Math.abs(disc.spinY) > Math.PI / 2 ? 0 : Math.PI, spinX: 0 }, this.reducedMotion ? 0.15 : 0.75, ease.power3InOut, () => {
      disc.resetTween = null;
    });
  }

  resetSpin(index) {
    const disc = this.discs[index];
    if (!disc || (Math.abs(disc.spinX) < 0.001 && Math.abs(disc.spinY) < 0.001)) return;
    this.killTween(disc.resetTween);
    disc.resetTween = this.tween(disc, { spinX: 0, spinY: 0 }, this.reducedMotion ? 0.15 : C.resetDuration, ease.power3Out, () => {
      disc.resetTween = null;
    });
  }

  // A fast mouse pass over a disc nudges and twists it.
  swipe(index) {
    const disc = this.discs[index];
    if (!disc || this.reducedMotion || Math.hypot(this.move.speedX, this.move.speedY) < C.wipeMinSpeed) return;
    const push = C.wipePushMax;
    const twist = C.wipeSpinMax;
    disc.pushVX += clamp(this.move.speedX * C.wipePush, -push, push);
    disc.pushVY -= clamp(this.move.speedY * C.wipePush, -push, push);
    disc.pushRotVY += clamp(this.move.speedX * C.wipeSpin, -twist, twist);
    disc.pushRotVX += clamp(this.move.speedY * C.wipeSpin, -twist, twist);
    this.request();
  }

  // A click presses the disc in, tilting around the point that was hit.
  pressDisc(index) {
    const disc = this.discs[index];
    if (!disc || this.reducedMotion) return;
    disc.pushVZ -= C.pressDepth;
    disc.pushRotVY += this.hitUV.x * C.pressTilt;
    disc.pushRotVX -= this.hitUV.y * C.pressTilt;
    this.request();
  }

  updatePointer(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    this.pointer.x = (x / rect.width) * 2 - 1;
    this.pointer.y = -(y / rect.height) * 2 + 1;
    return { x, y, rect };
  }

  pick() {
    const targets = this.discs.filter((disc) => disc.group.visible).map((disc) => disc.pick);
    if (!targets.length) return -1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObjects(targets, false)[0];
    if (!hit) return -1;
    this.hitUV.x = hit.uv ? hit.uv.x * 2 - 1 : 0;
    this.hitUV.y = hit.uv ? hit.uv.y * 2 - 1 : 0;
    return hit.object.userData.index;
  }

  updateCursor() {
    if (!this.press) this.element.style.cursor = this.hovered >= 0 ? 'pointer' : 'grab';
  }

  onPointerMove(event) {
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
    this.request();
  }

  onPointerLeave() {
    if (this.press) return;
    this.pointerMoved = false;
    this.hovered = -1;
    this.updateCursor();
    this.request();
  }

  onPointerDown(event) {
    if (!this.ready || event.button !== 0 || !event.isPrimary || !this.discs.length) return;
    const point = this.updatePointer(event);
    const hit = this.pick();
    this.press = {
      id: event.pointerId,
      touch: event.pointerType !== 'mouse',
      startX: point.x, startY: point.y,
      lastX: point.x, lastY: point.y, lastTime: performance.now(),
      // Only the disc in front can be grabbed and spun.
      grabbed: hit >= 0 && Math.abs(hit - this.position) < 0.6 ? hit : -1,
    };
    this.hovered = hit;
    window.addEventListener('pointermove', this.onPointerDrag, { passive: false });
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerCancel);
    this.request();
  }

  startDrag(event) {
    this.dragging = true;
    this.killTween(this.indexTween);
    this.indexTween = null;
    this.target = -1;
    this.resetWheel();
    this.inertia = 0;
    this.settle = 0;
    this.spinning = this.press.grabbed;
    this.element.style.cursor = 'grabbing';
    this.element.style.userSelect = 'none';
    const disc = this.discs[this.spinning];
    if (disc) {
      this.killTween(disc.resetTween);
      disc.resetTween = null;
    }
    try { this.element.setPointerCapture(event.pointerId); } catch {}
  }

  onPointerDrag(event) {
    const press = this.press;
    if (!press || event.pointerId !== press.id) return;
    const point = this.updatePointer(event);
    if (!this.dragging) {
      const dx = point.x - press.startX;
      const dy = point.y - press.startY;
      if (Math.hypot(dx, dy) < C.dragStartDistance) return;
      // Horizontal touch drags browse instead of spinning the front disc.
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

    const disc = this.discs[this.spinning];
    if (disc) {
      const sensitivity = C.dragSensitivity * 0.0045;
      disc.spinY = softSpin(disc.spinY, dx * sensitivity);
      disc.spinX = softSpin(disc.spinX, dy * sensitivity);
      return;
    }
    const span = press.touch ? C.touchDragSpan : 6 * C.dragSensitivity;
    const delta = -(dx / point.rect.width) * span;
    this.position = clamp(this.position + delta, 0, this.lastIndex);
    const velocity = clamp((16.667 / elapsed) * delta, -C.dragMaxVelocity, C.dragMaxVelocity);
    this.inertia += (velocity - this.inertia) * C.dragVelocitySmoothing;
  }

  onPointerUp(event) {
    this.endPress(event, false);
  }

  onPointerCancel(event) {
    this.endPress(event, true);
  }

  endPress(event, cancelled) {
    const press = this.press;
    if (!press || event.pointerId !== press.id) return;
    const wasDragging = this.dragging;
    const spinning = this.spinning;
    this.press = null;
    this.dragging = false;
    this.spinning = -1;
    window.removeEventListener('pointermove', this.onPointerDrag, { passive: false });
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerCancel);
    this.element.style.userSelect = '';
    this.updateCursor();
    try {
      if (this.element.hasPointerCapture(press.id)) this.element.releasePointerCapture(press.id);
    } catch {}
    this.request();
    if (!wasDragging) return;
    this.suppressClickUntil = performance.now() + 140;
    if (spinning >= 0) {
      this.resetSpin(spinning);
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

  onClick(event) {
    if (!this.ready) return;
    if (performance.now() < this.suppressClickUntil) {
      event.preventDefault();
      return;
    }
    this.updatePointer(event);
    const hit = this.pick();
    if (hit < 0) return;
    this.resetWheel();
    if (hit !== this.activeIndex()) {
      this.pressDisc(hit);
      this.goTo(hit, 'click');
      return;
    }
    this.flip(hit);
  }

  resetWheel() {
    clearTimeout(this.wheel?.timer);
    this.wheel = { timer: 0, armed: true, rising: false, total: 0, direction: 0, envelope: 0, peak: 0, count: 0, stepTime: 0, lastTime: 0, hasLast: false };
  }

  // One step per wheel gesture. Trackpad momentum is tracked as a decaying envelope so its
  // tail does not trigger extra steps, while a fresh flick or a held scroll still does.
  onWheel(event) {
    if (event.ctrlKey) return;
    event.preventDefault();
    if (!this.ready) return;
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
    wheel.timer = setTimeout(() => this.resetWheel(), C.wheelIdleReset);
    const decayed = gap === Infinity ? 0 : wheel.envelope * Math.exp(-gap / C.wheelEnvelopeTau);
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

  resize() {
    const width = Math.max(1, this.element.clientWidth);
    const height = Math.max(1, this.element.clientHeight);
    const aspect = width / height;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    // Narrow viewports shrink the whole gallery so the front disc still fits.
    this.gallery.scale.setScalar(C.galleryScale * clamp(aspect / 1.5, 0.45, 1));
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

  applyPixelRatio() {
    const width = Math.max(1, this.element.clientWidth);
    const height = Math.max(1, this.element.clientHeight);
    let ratio = Math.min(window.devicePixelRatio || 1, width <= 767 ? 1.5 : 2);
    if (width * height * ratio * ratio > C.maxPixels) ratio = Math.sqrt(C.maxPixels / (width * height));
    this.renderer.setPixelRatio(ratio * QUALITY[this.quality]);
    this.renderer.setSize(width, height);
    this.request(3);
  }

  // Averages frame intervals while animating and lowers the resolution if the GPU can't keep up.
  trackFrameTime(interval) {
    const stats = this.frameStats;
    stats.awake += 1;
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

  request(frames = 2) {
    this.forceFrames = Math.max(this.forceFrames, frames);
    if (this.raf || this.destroyed) return;
    this.lastTime = performance.now();
    this.frameStats.awake = 0;
    this.raf = requestAnimationFrame(this.frame);
  }

  frame(now) {
    this.raf = 0;
    const interval = Math.max(0, now - this.lastTime) / 1000;
    const dt = Math.min(0.05, interval);
    this.trackFrameTime(interval);
    const frames = Math.min(3, dt * 60);
    this.lastTime = now;
    this.updateTweens(dt);

    if (this.pointerMoved) {
      this.pointerMoved = false;
      const hit = this.pick();
      if (hit !== this.hovered) {
        if (hit >= 0 && !this.press) this.swipe(hit);
        this.hovered = hit;
        this.updateCursor();
        this.forceFrames = Math.max(this.forceFrames, 2);
      }
    }

    if (this.discs.length && !this.dragging) {
      if (Math.abs(this.inertia) > 1e-5) {
        this.position += this.inertia * frames;
        this.inertia *= this.reducedMotion ? 0 : C.friction ** frames;
        if (Math.abs(this.inertia) < 4e-4) this.inertia = 0;
      }
      if (this.inertia === 0 && !this.indexTween) {
        // Critically damped-ish spring onto the nearest disc.
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

    // Smoothed scroll velocity drives the lean, bank and dip of the discs.
    if (this.reducedMotion) {
      this.flow = 0;
    } else if (dt > 0) {
      const velocity = clamp((this.position - this.lastPosition) / dt, -40, 40);
      this.flow += (velocity - this.flow) * Math.min(1, dt * (Math.abs(velocity) > Math.abs(this.flow) ? 14 : 6));
      if (Math.abs(this.flow) < 0.01) this.flow = 0;
    }
    this.lastPosition = this.position;

    const active = this.activeIndex();
    if (this.discs.length && active !== this.active) {
      this.active = active;
      this.onIndexChange(active);
    }

    const residual = this.layout(dt);
    this.renderer.render(this.scene, this.camera);
    if (this.forceFrames > 0) this.forceFrames -= 1;
    const busy = this.press || this.inertia !== 0 || this.settle !== 0 || this.flow !== 0 || this.tweens.size || residual > 0.001 || this.forceFrames > 0;
    if (busy) this.raf = requestAnimationFrame(this.frame);
  }

  // Places every disc on a shallow arc, then eases each one toward its slot. Discs further
  // from the front follow more loosely, so the row trails behind fast moves.
  layout(dt) {
    const active = this.activeIndex();
    const moving = !this.reducedMotion;
    const lean = moving ? clamp(Math.sign(this.flow) * Math.sqrt(Math.abs(this.flow)) * C.flowLean, -C.flowLeanMax, C.flowLeanMax) : 0;
    const dip = moving ? Math.min(C.flowDipMax, Math.abs(this.flow) * C.flowDip) : 0;
    const follow = this.dragging ? C.followTight : C.followBase;
    const depth = Math.max(C.discThickness * 3, 0.12, C.depthGap) * 2.4;
    let residual = 0;

    this.discs.forEach((disc, index) => {
      const offset = index - this.position;
      const distance = Math.abs(offset);
      const isActive = index === active;
      const angle = offset * 0.35;
      let x = Math.sin(angle) * C.hGap * 2.4;
      let y = (isActive ? C.activeDiscY : 0) - dip * (isActive ? 0.7 : 1);
      let z = depth - Math.cos(angle) * depth;
      let rotX = 0;
      let rotY = -angle + lean * (isActive ? 1 : 1.12);
      const rotZ = -lean * C.flowBank * (isActive ? 0.7 : 1);
      const restScale = isActive ? 1 : Math.max(C.inactiveScale, 1 - distance * (1 - C.inactiveScale) * 0.6);
      let scale = restScale * this.intro.active;
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
      disc.group.visible = visible;

      // The hovered disc tilts toward the cursor.
      const hoverTarget = this.hovered === index && this.spinning < 0 ? 1 : 0;
      disc.hover += (hoverTarget - disc.hover) * Math.min(1, dt * 10);
      if (disc.hover > 0.001) {
        rotX += disc.hover * C.hoverTiltStrength * this.pointer.y;
        rotY += disc.hover * C.hoverTiltStrength * this.pointer.x;
      }

      const pushTotal = Math.abs(disc.pushX) + Math.abs(disc.pushY) + Math.abs(disc.pushZ) + Math.abs(disc.pushVX) + Math.abs(disc.pushVY)
        + Math.abs(disc.pushVZ) + Math.abs(disc.pushRotX) + Math.abs(disc.pushRotY) + Math.abs(disc.pushRotVX) + Math.abs(disc.pushRotVY);
      if (pushTotal > 8e-4) {
        const damping = Math.exp(-C.pushDamping * dt);
        const pull = Math.min(1, dt * C.pushReturn);
        disc.pushX += disc.pushVX * dt; disc.pushVX *= damping; disc.pushX -= disc.pushX * pull;
        disc.pushY += disc.pushVY * dt; disc.pushVY *= damping; disc.pushY -= disc.pushY * pull;
        disc.pushZ += disc.pushVZ * dt; disc.pushVZ *= damping; disc.pushZ -= disc.pushZ * pull;
        disc.pushRotX += disc.pushRotVX * dt; disc.pushRotVX *= damping; disc.pushRotX -= disc.pushRotX * pull;
        disc.pushRotY += disc.pushRotVY * dt; disc.pushRotVY *= damping; disc.pushRotY -= disc.pushRotY * pull;
        x += disc.pushX;
        y += disc.pushY;
        z += disc.pushZ;
        residual += pushTotal;
      } else if (pushTotal > 0) {
        Object.assign(disc, { pushX: 0, pushY: 0, pushZ: 0, pushVX: 0, pushVY: 0, pushVZ: 0, pushRotX: 0, pushRotY: 0, pushRotVX: 0, pushRotVY: 0 });
      }

      const { position, rotation } = disc.group;
      if (!disc.placed) {
        position.set(x, y, z);
        rotation.set(rotX, rotY, rotZ);
        disc.group.scale.setScalar(scale);
        disc.placed = true;
      } else {
        const k = clamp(follow - distance * C.followFalloff, C.followMin, C.followTight);
        const amount = this.reducedMotion ? 1 : Math.min(1, dt * k);
        residual += Math.abs(x - position.x) + Math.abs(y - position.y) + Math.abs(z - position.z) + Math.abs(scale - disc.group.scale.x)
          + Math.abs(rotX - rotation.x) + Math.abs(rotY - rotation.y) + Math.abs(rotZ - rotation.z) + Math.abs(hoverTarget - disc.hover);
        position.x += (x - position.x) * amount;
        position.y += (y - position.y) * amount;
        position.z += (z - position.z) * amount;
        disc.group.scale.setScalar(disc.group.scale.x + (scale - disc.group.scale.x) * amount);
        rotation.x += (rotX - rotation.x) * amount;
        rotation.y += (rotY - rotation.y) * amount;
        rotation.z += (rotZ - rotation.z) * amount;
      }

      // Tilt from a spin drag relaxes on its own; a flip (spinY) stays until flipped back.
      if (this.spinning !== index && !disc.resetTween) {
        disc.spinX += (0 - disc.spinX) * Math.min(1, dt * 2.5);
        if (Math.abs(disc.spinX) < 1e-4) disc.spinX = 0;
        residual += Math.abs(disc.spinX);
      }
      disc.spin.rotation.x = disc.spinX + disc.pushRotX;
      disc.spin.rotation.y = disc.spinY + disc.pushRotY;
      disc.group.renderOrder = Math.round(500 + position.z * 10 - index * 0.01);
    });
    return residual;
  }

  destroy() {
    this.destroyed = true;
    clearTimeout(this.loadTimer);
    cancelAnimationFrame(this.raf);
    clearTimeout(this.wheel.timer);
    this.resizeObserver.disconnect();
    this.element.removeEventListener('pointerdown', this.onPointerDown);
    this.element.removeEventListener('pointermove', this.onPointerMove);
    this.element.removeEventListener('pointerleave', this.onPointerLeave);
    this.element.removeEventListener('click', this.onClick);
    this.element.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('pointermove', this.onPointerDrag, { passive: false });
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerCancel);
    this.setAlbums([]);
    const { textures, geometries, materials } = this.shared;
    [...Object.values(textures), ...Object.values(geometries), ...Object.values(materials)].forEach((resource) => resource.dispose());
    this.environment.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
