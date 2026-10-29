// Checks that the disc never goes into the CD player while it is put in and taken out.
//
//   npm run dev   # in another terminal
//   PLAYWRIGHT_CORE=../leafthrough/node_modules/playwright-core/index.mjs node scripts/check-insert-path.mjs [url]
//
// For each screen size and album it opens the case, starts the insert and freezes it, then steps the
// path from 0 to 1 (the eject is the same path backwards) and measures, in the player's millimetres,
// how far any point of the disc goes below the player's top (or the well's floor, over the well).
// Also reports the largest step the disc takes between samples against the 90th percentile, to catch
// jumps. Needs the dev server, which hands the scene to the page as window.scene. Exits with 1 if the
// disc goes in anywhere.

import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT_CORE ? pathToFileURL(resolve(process.env.PLAYWRIGHT_CORE)).href : 'playwright-core');
const url = process.argv[2] ?? 'http://localhost:5173/';
// Desktop, tablets, phones upright and phones turned sideways (their own layout, see shortHeight).
const sizes = [[1440, 900], [1920, 1080], [1280, 720], [2560, 1080], [1024, 1366], [768, 1024], [390, 844], [320, 640], [844, 390], [667, 375]];
const albums = ['nevermind', 'kid-a', 'crystal-castles'];

const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
let worst = 0;
for (const [width, height] of sizes) {
  for (const album of albums) {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.goto(`${url}?album=${album}&open`);
    await page.waitForSelector('.preloader.is-done', { timeout: 30000 });
    await page.waitForTimeout(2500);
    const result = await page.evaluate(() => {
      const scene = window.scene;
      scene.insert();
      scene.killTween(scene.listenTween);
      const item = scene.cases[scene.listening];
      const player = scene.player.group;
      const Vector3 = player.position.constructor;
      const inverse = player.matrixWorld.clone();
      const point = new Vector3();
      // The player's half width, top, base and well floor (mm), the well's radius, and the slack allowed.
      const half = 73, top = 9, base = -9, floor = -1, well = 62, slack = 0.5;
      let worst = { depth: 0, t: 0 };
      const steps = [];
      let last = null;
      for (let n = 0; n <= 400; n++) {
        const t = n / 400;
        scene.listen = t;
        scene.updatePlayer(0);
        const position = item.disc.group.position.clone();
        if (last) steps.push(position.distanceTo(last));
        last = position;
        if (!player.visible) continue;
        item.disc.group.updateWorldMatrix(true, true);
        player.updateWorldMatrix(true, false);
        inverse.copy(player.matrixWorld).invert();
        // The disc lies in its spin group's xy plane, radius 1; both faces of its thickness.
        for (const radius of [0.2, 0.4, 0.6, 0.8, 0.9, 1]) {
          for (let a = 0; a < 72; a++) {
            const angle = (a / 72) * Math.PI * 2;
            for (const face of [-0.005, 0.005]) {
              point.set(Math.cos(angle) * radius, Math.sin(angle) * radius, face).applyMatrix4(item.disc.spin.matrixWorld).applyMatrix4(inverse);
              if (Math.abs(point.x) > half || Math.abs(point.z) > half || point.y < base - 2) continue;
              const surface = Math.hypot(point.x, point.z) < well ? floor : top;
              const depth = surface + slack - point.y;
              if (depth > worst.depth) worst = { depth, t };
            }
          }
        }
      }
      scene.listen = 0;
      scene.updatePlayer(0);
      const sorted = [...steps].sort((a, b) => a - b);
      return { ...worst, jump: Math.max(...steps) / sorted[Math.floor(sorted.length * 0.9)] };
    });
    worst = Math.max(worst, result.depth);
    const verdict = result.depth > 0 ? `INTO THE PLAYER ${result.depth.toFixed(1)} mm at t = ${result.t.toFixed(3)}` : 'clear';
    console.log(`${width} × ${height} ${album}: ${verdict}; largest step ${result.jump.toFixed(2)}× the 90th percentile`);
    await page.close();
  }
}
await browser.close();
console.log(worst > 0 ? `Fails: the disc goes ${worst.toFixed(1)} mm into the player.` : 'Passes: the disc stays clear of the player.');
process.exit(worst > 0 ? 1 : 0);
