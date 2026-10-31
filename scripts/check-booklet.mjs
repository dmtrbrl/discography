// Checks the booklet's model, lazy artwork and interaction lifecycle in the dev server.
// npm run dev
// PLAYWRIGHT_CORE=../leafthrough/node_modules/playwright-core/index.mjs node scripts/check-booklet.mjs [url]
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT_CORE
  ? pathToFileURL(resolve(process.env.PLAYWRIGHT_CORE)).href : 'playwright-core');
const url = process.argv[2] ?? 'http://localhost:5173/';
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
try {
  for (const [width, height, album, reducedMotion] of [
    [1440, 900, 'surrender', 'no-preference'],
    [390, 844, 'surrender', 'no-preference'],
    [844, 390, 'mutter', 'no-preference'],
    [390, 844, 'citizen-of-glass', 'reduce'],
  ]) {
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion });
    const errors = [], interiorRequests = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('request', (request) => {
      if (request.url().includes('/booklet/')) interiorRequests.push(request.url());
    });
    await page.goto(`${url}#/${album}`);
    await page.waitForSelector('.preloader.is-done', { state: 'attached', timeout: 30000 });
    await page.waitForFunction(() => window.scene?.ready && !window.scene.viewBusy());
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.scene.opened >= 0 && !window.scene.viewBusy());
    const initial = await page.evaluate(() => {
      const scene = window.scene, item = scene.cases[scene.opened];
      let sheets = 0;
      item.bookletModel.traverse((node) => { if (node.isMesh) sheets++; });
      const lighting = [];
      scene.scene.traverse((node) => { if (node.isLight) lighting.push([node.type, node.intensity]); });
      return { sheets, sides: item.bookletModel.pageCount, lighting, environment: scene.scene.environmentIntensity };
    });
    assert.equal(initial.sheets, Math.ceil(initial.sides / 2), 'The case already contains its page stack');
    assert.equal(interiorRequests.length, 0, 'Interior scans stay unloaded inside the case');
    await page.mouse.click(width / 2, 100);
    assert.ok(await page.evaluate(() => window.scene.opened >= 0), 'An outside click keeps the case open');
    await page.getByRole('button', { name: 'Booklet', exact: true }).click();
    await page.waitForFunction(() => window.scene.bookletShown && !window.scene.viewBusy());
    const landed = await page.evaluate(() => {
      const scene = window.scene;
      return { page: scene.magazine.page, same: scene.magazine === scene.cases[scene.reading].bookletModel };
    });
    assert.equal(landed.page, 0, 'The cover does not turn automatically');
    assert.ok(landed.same, 'The reader uses the same physical page object');
    if (album === 'citizen-of-glass') {
      assert.equal(await page.evaluate(() => window.scene.magazine.pageCount), 8, 'Citizen of Glass has eight pages');
      assert.equal(new Set(interiorRequests).size, 3, 'All three interior spreads load once the booklet opens');
    }
    await page.mouse.click(width / 2, 100);
    assert.ok(await page.evaluate(() => window.scene.inBooklet), 'An outside click keeps the booklet out');
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => window.scene.magazine.page > 0 && !window.scene.magazine.turning);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.scene.reading < 0 && !window.scene.viewBusy());
    assert.ok(await page.evaluate(() => {
      const scene = window.scene, item = scene.cases[scene.opened];
      return item.bookletModel.parent === item.booklet && item.bookletModel.page === 0 && !item.bookletModel.enabled;
    }), 'The same booklet returns to its case on its cover');
    const returned = await page.evaluate(() => {
      const scene = window.scene, lighting = [];
      scene.scene.traverse((node) => { if (node.isLight) lighting.push([node.type, node.intensity]); });
      return { lighting, environment: scene.scene.environmentIntensity };
    });
    assert.deepEqual(returned.lighting, initial.lighting, 'Closing restores the case lighting');
    assert.equal(returned.environment, initial.environment, 'Closing restores the gallery environment');
    await page.getByRole('button', { name: 'Booklet', exact: true }).click();
    await page.waitForFunction(() => window.scene.bookletShown && !window.scene.viewBusy());
    await page.locator('.back-button').click();
    await page.waitForFunction(() => window.scene.reading < 0 && !window.scene.viewBusy());
    assert.ok(await page.evaluate(() => window.scene.opened >= 0), 'Close returns to the open case');
    assert.deepEqual(errors, [], 'No browser or WebGL errors');
    console.log(`${width} × ${height} ${album} (${reducedMotion}): passes; ${initial.sheets} sheets already in the case, no early interior requests`);
    await page.close();
  }
} finally {
  await browser.close();
}
