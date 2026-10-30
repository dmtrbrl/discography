// Procedural textures as pure functions of their parameters: the disc print's normal and roughness
// maps, the tray's stipple, and LeafThrough's paper grain. The scene has them generated in a worker
// (procedural.worker.ts), so making them doesn't hold the page while the loading screen is up
// (170 ms on a laptop, a second on a phone), and runs them here where workers aren't available.

export interface ProceduralParams {
  // Side of the disc print's maps and of the tray's, in pixels.
  mapResolution: number;
  traySize: number;
  // From the C object in scene.ts.
  frontRough: number;
  texGrain: number;
  texPrint: number;
  texScratches: number;
  texGloss: number;
  trayStipple: number;
  trayRough: number;
}

export interface ProceduralMaps {
  frontNormal: Uint8Array;
  frontRough: Uint8Array;
  trayNormal: Uint8Array;
  trayRough: Uint8Array;
  // Greyscale paper grain as RGBA pixels, GRAIN_SIZE square.
  grain: Uint8ClampedArray<ArrayBuffer>;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function valueNoise(x: number, y: number) {
  const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

function normalsFromHeight(heightMap: Float32Array, size: number) {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = heightMap[y * size + Math.max(0, x - 1)] - heightMap[y * size + Math.min(size - 1, x + 1)];
      const ny = heightMap[Math.max(0, y - 1) * size + x] - heightMap[Math.min(size - 1, y + 1) * size + x];
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
function frontNormal(size: number, { texPrint, texScratches }: ProceduralParams) {
  const heightMap = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const radius = Math.hypot(x - size / 2, y - size / 2) + 0.0001;
      heightMap[y * size + x] = Math.sin(radius * 0.6) * 0.02 + (valueNoise(x * 0.4, y * 0.4) - 0.5) * 0.5 * texPrint;
    }
  }
  for (let n = 0; n < Math.floor(30 * texScratches); n++) {
    const angle = Math.random() * Math.PI * 2;
    const length = 30 + Math.random() * 220;
    const startX = Math.random() * size;
    const startY = Math.random() * size;
    const depth = (Math.random() * 0.7 + 0.2) * texScratches;
    for (let step = 0; step < length; step++) {
      const x = Math.round(startX + Math.cos(angle) * step);
      const y = Math.round(startY + Math.sin(angle) * step);
      if (x > 0 && y > 0 && x < size - 1 && y < size - 1) heightMap[y * size + x] -= depth;
    }
  }
  for (let n = 0; n < Math.floor(500 * texScratches); n++) {
    heightMap[Math.floor(Math.random() * size) * size + Math.floor(Math.random() * size)] += (Math.random() - 0.5) * texScratches * 1.2;
  }
  return normalsFromHeight(heightMap, size);
}

function frontRoughness(size: number, { frontRough, texGrain, texPrint, texGloss }: ProceduralParams) {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const radius = Math.hypot(x - size / 2, y - size / 2);
      let roughness = frontRough + (valueNoise(x * 2.3, y * 2.3) - 0.5) * 0.35 * texGrain + (valueNoise(x * 0.5, y * 0.5) - 0.5) * 0.3 * texPrint;
      roughness -= (Math.sin((radius / (size * 0.5)) * 14) * 0.5 + 0.5) * 0.5 * texGloss;
      const index = (y * size + x) * 4;
      data[index] = data[index + 1] = data[index + 2] = clamp(roughness, 0.02, 1) * 255;
      data[index + 3] = 255;
    }
  }
  return data;
}

// Satin black polystyrene with a fine stipple.
function trayMaps(size: number, { trayStipple, trayRough }: ProceduralParams) {
  const heightMap = new Float32Array(size * size);
  for (let n = 0; n < heightMap.length; n++) heightMap[n] = valueNoise(n % size, Math.floor(n / size)) * trayStipple;
  const roughness = new Uint8Array(size * size * 4);
  for (let n = 0; n < heightMap.length; n++) {
    roughness[n * 4] = roughness[n * 4 + 1] = roughness[n * 4 + 2] = clamp(trayRough + (heightMap[n] / trayStipple - 0.5) * 0.3, 0.05, 1) * 255;
    roughness[n * 4 + 3] = 255;
  }
  return { normal: normalsFromHeight(heightMap, size), roughness };
}

// LeafThrough's built-in paper grain, drawn once for all the booklets. The library draws it afresh
// for each magazine (78 ms each, 0.8 s of the start for ten cases); handed a canvas, it only wraps
// it in a texture. The same steps and seed as its createPaperPattern (0.1.6), so the paper looks
// as it did.
export const GRAIN_SIZE = 384;
const GRAIN_KERNEL = [[1, 0.108, -0.049, 0.022], [0.131, 0.016, -0.014, 0.008], [-0.039, -0.018, 0, 0.009], [0.021, 0.005, 0.004, 0.009]];
const GRAIN_CLOUD = 0.07;
const GRAIN_CLOUD_PERIOD = 32;
const GRAIN_LEVELS = [[0, 0.537], [0.001, 0.624], [0.01, 0.675], [0.05, 0.714], [0.1, 0.733], [0.25, 0.761], [0.5, 0.788], [0.75, 0.816], [0.9, 0.835], [0.95, 0.847], [0.99, 0.867], [0.999, 0.89], [1, 0.914]];
function paperGrain() {
  const size = GRAIN_SIZE;
  let seed = 7;
  const random = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  // Gaussian specks, softened by a small kernel.
  const noise = new Float32Array(size * size);
  for (let i = 0; i < noise.length; i++) noise[i] = Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random());
  const at = (x: number, y: number) => noise[((y + size) % size) * size + ((x + size) % size)];
  const reach = GRAIN_KERNEL.length - 1;
  const grain = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let v = 0;
      for (let dy = -reach; dy <= reach; dy++) {
        const row = GRAIN_KERNEL[Math.abs(dy)];
        for (let dx = -reach; dx <= reach; dx++) v += row[Math.abs(dx)] * at(x + dx, y + dy);
      }
      grain[y * size + x] = v;
    }
  }
  // A slow clouding: periodic value noise.
  const period = GRAIN_CLOUD_PERIOD;
  const grid = new Float32Array(period * period);
  for (let i = 0; i < grid.length; i++) grid[i] = random();
  const cell = (x: number, y: number) => grid[(((y % period) + period) % period) * period + (((x % period) + period) % period)];
  const cloudAt = (x: number, y: number) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = x - xi;
    const fy = y - yi;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const a = cell(xi, yi) + (cell(xi + 1, yi) - cell(xi, yi)) * sx;
    const b = cell(xi, yi + 1) + (cell(xi + 1, yi + 1) - cell(xi, yi + 1)) * sx;
    return a + (b - a) * sy;
  };
  const cloud = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) cloud[y * size + x] = cloudAt((x / size) * period, (y / size) * period);
  }
  const spread = (values: Float32Array) => {
    let mean = 0;
    for (const v of values) mean += v;
    mean /= values.length;
    let variance = 0;
    for (const v of values) variance += (v - mean) ** 2;
    return Math.sqrt(variance / values.length) || 1;
  };
  const cloudScale = (GRAIN_CLOUD * spread(grain)) / spread(cloud);
  for (let i = 0; i < grain.length; i++) grain[i] += cloud[i] * cloudScale;
  // Grey by rank, through the fixed levels, so only the brightest specks stand out.
  const order = Array.from(grain.keys()).sort((a, b) => grain[a] - grain[b]);
  const pixels = new Uint8ClampedArray(size * size * 4);
  let level = 1;
  order.forEach((pixel, rank) => {
    const share = rank / (order.length - 1);
    while (GRAIN_LEVELS[level][0] < share) level++;
    const [fromShare, from] = GRAIN_LEVELS[level - 1];
    const [toShare, to] = GRAIN_LEVELS[level];
    const g = Math.round(255 * (from + ((to - from) * (share - fromShare)) / (toShare - fromShare)));
    const o = pixel * 4;
    pixels[o] = pixels[o + 1] = pixels[o + 2] = g;
    pixels[o + 3] = 255;
  });
  return pixels;
}

export function generateProcedural(params: ProceduralParams): ProceduralMaps {
  const tray = trayMaps(params.traySize, params);
  return { frontNormal: frontNormal(params.mapResolution, params), frontRough: frontRoughness(params.mapResolution, params), trayNormal: tray.normal, trayRough: tray.roughness, grain: paperGrain() };
}

// The maps' buffers, to hand over rather than copy.
export const transferables = (maps: ProceduralMaps): Transferable[] => [maps.frontNormal.buffer, maps.frontRough.buffer, maps.trayNormal.buffer, maps.trayRough.buffer, maps.grain.buffer];
