// Regression check: full spread boundaries, real playback of all ten It’s Blitz! previews, and
// captures of the case, booklet and player for the research folder (SHOTS=<dir>).
// PLAYWRIGHT_CORE=../leafthrough/node_modules/playwright-core/index.mjs node scripts/check-its-blitz.mjs [url]
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_CORE
  ? pathToFileURL(resolve(process.env.PLAYWRIGHT_CORE)).href : 'playwright-core');
const url = process.argv[2] ?? 'http://127.0.0.1:5174/';
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
try {
  for (const [name, width, height] of [['desktop', 1440, 900], ['mobile', 390, 844]]) {
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
    const errors = [], lookupRequests = [], failedArtwork = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('request', r => { if (r.url().includes('itunes.apple.com/lookup')) lookupRequests.push(r.url()); });
    page.on('response', r => { if (r.url().includes('/bands/') && r.status() !== 200) failedArtwork.push(r.url()); });
    await page.addInitScript(() => {
      // Muted playback still decodes and advances the actual media, without making test noise.
      window.__audio = [];
      window.Audio = class extends Audio {
        constructor(...args) { super(...args); this.muted = true; window.__audio.push(this); }
      };
      window.__panelDraws = [];
      const draw = CanvasRenderingContext2D.prototype.drawImage;
      CanvasRenderingContext2D.prototype.drawImage = function(image, ...args) {
        if (image instanceof HTMLImageElement && image.src.includes('/booklet-scans/its-blitz/') && args.length === 8 && args[2] > 100 && args[3] > 100) {
          window.__panelDraws.push({ source: image.src, imageWidth: image.naturalWidth, imageHeight: image.naturalHeight, rect: args });
        }
        return draw.call(this, image, ...args);
      };
    });
    const shots = process.env.SHOTS;
    const shot = async (name) => { if (shots) await page.screenshot({ path: `${shots}/${name}-${width}x${height}.png` }); };
    await page.goto(`${url}#/its-blitz`);
    await page.waitForFunction(() => window.scene && !window.scene.viewBusy());
    await page.waitForTimeout(800);
    await shot('case');
    await page.goto(`${url}#/its-blitz/booklet`);
    await page.waitForFunction(() => window.scene?.bookletShown && !window.scene.viewBusy());
    await page.waitForFunction(() => window.__panelDraws.length === 10);
    assert.equal(await page.evaluate(() => window.scene.magazine.pageCount), 12);
    await shot('booklet-cover');
    const draws = await page.evaluate(() => window.__panelDraws);
    assert.equal(draws.length, 10, 'Five complete spreads supply ten interior pages');
    for (const [i, d] of draws.entries()) {
      const [sx, sy, sw, sh, , , dw, dh] = d.rect;
      assert.equal(sx, i % 2 * d.imageWidth / 2, 'Each panel starts at its real outer/centre boundary');
      assert.equal(sy, 0);
      assert.equal(sw, d.imageWidth / 2, 'No horizontal artwork is cropped');
      assert.equal(sh, d.imageHeight, 'No vertical artwork is cropped');
      assert.ok(Math.abs(sw / sh - dw / dh) < 1e-8, 'Artwork proportions are preserved');
    }
    const seen = new Set();
    for (let n = 0; n < 12; n++) {
      (await page.evaluate(() => window.scene.magazine.visiblePages)).forEach(p => seen.add(p));
      await page.keyboard.press('ArrowRight');
      await page.waitForFunction(() => !window.scene.magazine.turning);
      if (n === 2 || n === 5) await shot(`booklet-turn${n}`);
    }
    assert.deepEqual([...seen].sort((a, b) => a - b), Array.from({ length: 12 }, (_, i) => i));
    await page.goto(`${url}#/its-blitz/listen`);
    await page.waitForFunction(() => window.scene?.seated && !window.scene.viewBusy());
    assert.match(await page.getByRole('link', { name: 'Apple Music', exact: true }).getAttribute('href'), /music\.apple\.com\/at\/album\/1443513213/);
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    const played = [];
    for (let n = 1; n <= 10; n++) {
      await page.waitForFunction(track => {
        const audio = window.__audio.at(-1), state = window.scene.screenState;
        return state.track === track && state.playing && audio.currentTime > 0.1 && !audio.paused && !audio.error;
      }, n, { timeout: 30000 });
      played.push(await page.evaluate(() => ({ track: window.scene.screenState.track, title: window.scene.screenState.album.tracks[window.scene.screenState.track - 1].title, time: window.__audio.at(-1).currentTime })));
      if (n < 10) await page.getByRole('button', { name: 'Next track', exact: true }).click();
    }
    assert.equal(lookupRequests.length, 1, 'One lookup serves the entire album');
    assert.equal(new URL(lookupRequests[0]).searchParams.get('country'), 'at');
    await shot('player');
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await page.waitForFunction(() => !window.scene.screenState.playing);
    assert.deepEqual(errors, []);
    assert.deepEqual(failedArtwork, []);
    console.log(name, JSON.stringify({ fullBooklet: true, uncroppedPanels: draws.length, played, errors }));
    await page.close();
  }
} finally { await browser.close(); }
