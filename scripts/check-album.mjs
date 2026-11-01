// Checks albums end to end against the dev server, with the expectations read from
// public/albums/collection.json: the booklet has the album's page count and every interior panel is
// drawn whole from its scan (half a spread each, nothing cropped, proportions kept), turning reaches
// every page, the player shows the album's Spotify and Apple links, and every preview Apple
// provides plays in turn (a track without one is skipped, as the player skips it), on desktop and on
// a phone. SHOTS=<dir> saves captures of the case, the booklet and the player.
// PLAYWRIGHT_CORE=../leafthrough/node_modules/playwright-core/index.mjs node scripts/check-album.mjs [url] [album id ...]
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_CORE
  ? pathToFileURL(resolve(process.env.PLAYWRIGHT_CORE)).href : 'playwright-core');

const args = process.argv.slice(2);
const url = /^https?:/.test(args[0] ?? '') ? args.shift() : 'http://127.0.0.1:5173/';
const collection = JSON.parse(await readFile(new URL('../public/albums/collection.json', import.meta.url), 'utf8'));
const albums = args.length ? args.map((id) => collection.albums.find((album) => album.id === id) ?? assert.fail(`No album ${id}`)) : collection.albums;

const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--mute-audio'] });
try {
  for (const album of albums) {
    const spreads = album.bookletScans?.length ?? 0;
    const panels = spreads * 2;
    const pages = album.bookletPageCount ?? (spreads + 1) * 2;
    const country = album.appleMusicCountry ?? 'us';
    // The tracks with a preview, 1-based, in the order the player goes through them.
    const playable = (album.tracks ?? []).map((track, i) => (track.apple ? i + 1 : 0)).filter(Boolean);
    console.log(`${album.id}: ${pages} pages from ${spreads} spreads, ${playable.length} of ${album.tracks?.length ?? 0} tracks with a preview`);
    for (const [name, width, height] of [['desktop', 1440, 900], ['mobile', 390, 844]]) {
      const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
      const errors = [], lookupRequests = [], failedArtwork = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('request', (r) => { if (r.url().includes('itunes.apple.com/lookup')) lookupRequests.push(r.url()); });
      page.on('response', (r) => { if (r.url().includes('/albums/') && r.status() !== 200) failedArtwork.push(r.url()); });
      await page.addInitScript((id) => {
        // Every draw of a booklet scan into a page canvas, to check the panel it takes.
        window.__panelDraws = [];
        const draw = CanvasRenderingContext2D.prototype.drawImage;
        CanvasRenderingContext2D.prototype.drawImage = function (image, ...args) {
          if (image instanceof HTMLImageElement && image.src.includes(`/albums/${id}/booklet/`) && args.length === 8 && args[2] > 100 && args[3] > 100) {
            window.__panelDraws.push({ source: image.src, imageWidth: image.naturalWidth, imageHeight: image.naturalHeight, rect: args });
          }
          return draw.call(this, image, ...args);
        };
      }, album.id);
      const shots = process.env.SHOTS;
      const shot = async (what) => { if (shots) await page.screenshot({ path: `${shots}/${album.id}-${what}-${width}x${height}.png` }); };

      await page.goto(`${url}#/${album.id}`);
      await page.waitForFunction(() => window.scene && !window.scene.viewBusy());
      await page.waitForTimeout(800);
      await shot('case');

      await page.goto(`${url}#/${album.id}/booklet`);
      await page.waitForFunction(() => window.scene?.bookletShown && !window.scene.viewBusy());
      await page.waitForFunction((n) => window.__panelDraws.length === n, panels);
      assert.equal(await page.evaluate(() => window.scene.magazine.pageCount), pages, 'The booklet has the album\'s page count');
      await shot('booklet-cover');
      const draws = await page.evaluate(() => window.__panelDraws);
      assert.equal(draws.length, panels, `${spreads} complete spreads supply ${panels} interior pages`);
      for (const [i, d] of draws.entries()) {
        const [sx, sy, sw, sh, , , dw, dh] = d.rect;
        assert.equal(sx, (i % 2) * d.imageWidth / 2, 'Each panel starts at its real outer/centre boundary');
        assert.equal(sy, 0);
        assert.equal(sw, d.imageWidth / 2, 'No horizontal artwork is cropped');
        assert.equal(sh, d.imageHeight, 'No vertical artwork is cropped');
        assert.ok(Math.abs(sw / sh - dw / dh) < 1e-8, 'Artwork proportions are preserved');
      }
      const seen = new Set();
      for (let n = 0; n < pages; n++) {
        (await page.evaluate(() => window.scene.magazine.visiblePages)).forEach((p) => seen.add(p));
        await page.keyboard.press('ArrowRight');
        await page.waitForFunction(() => !window.scene.magazine.turning);
        if (n === 2 || n === 5) await shot(`booklet-turn${n}`);
      }
      assert.deepEqual([...seen].sort((a, b) => a - b), Array.from({ length: pages }, (_, i) => i), 'Turning reaches every page');

      await page.goto(`${url}#/${album.id}/listen`);
      await page.waitForFunction(() => window.scene?.seated && !window.scene.viewBusy());
      assert.match(await page.getByRole('link', { name: 'Apple', exact: true }).getAttribute('href'), new RegExp(`music\\.apple\\.com/${country}/album/${album.appleMusic}`));
      if (album.spotify) assert.match(await page.getByRole('link', { name: 'Spotify', exact: true }).getAttribute('href'), new RegExp(`open\\.spotify\\.com/album/${album.spotify}`));
      await page.getByRole('button', { name: 'Play', exact: true }).click();
      const played = [];
      for (const [i, n] of playable.entries()) {
        await page.waitForFunction((track) => {
          // The page plays the previews through Web Audio and exposes their state in dev (main.tsx).
          const previews = window.__previews, state = window.scene.screenState;
          return state.track === track && state.playing && previews.state() === "playing" && previews.position() > 0.1;
        }, n, { timeout: 30000 });
        played.push(await page.evaluate(() => ({ track: window.scene.screenState.track, title: window.scene.screenState.album.tracks[window.scene.screenState.track - 1].title, time: window.__previews.position() })));
        if (i < playable.length - 1) await page.getByRole('button', { name: 'Next track', exact: true }).click();
      }
      assert.deepEqual(played.map((p) => p.track), playable, 'Every track with a preview plays, the others are skipped');
      assert.equal(lookupRequests.length, 1, 'One lookup serves the entire album');
      assert.equal(new URL(lookupRequests[0]).searchParams.get('country'), country);
      await shot('player');
      await page.getByRole('button', { name: 'Pause', exact: true }).click();
      await page.waitForFunction(() => !window.scene.screenState.playing);
      assert.deepEqual(errors, []);
      assert.deepEqual(failedArtwork, []);
      console.log(`  ${name}: ${draws.length} panels whole, ${pages} pages reached, played ${played.map((p) => p.track).join(' ')}`);
      await page.close();
    }
  }
} finally { await browser.close(); }
