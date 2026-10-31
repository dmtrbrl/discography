#!/usr/bin/env node
// node scripts/optimize-images.mjs [album id ...]
//
// Converts the collection's artwork to the sizes the page draws and to AVIF, with a WebP twin for
// browsers without AVIF (collection.ts picks the format). Run it after download-covers.sh: that
// script saves the archive's JPEGs, which are two to five times larger than needed. Paths in
// collection.json (relative to each album's folder, public/albums/<id>/) are rewritten to the .avif
// files, and a JPEG inside that folder is removed once converted; a source elsewhere is left alone.
// Already converted albums are skipped. Needs Node 18+ and the sharp dev dependency (npm install).
import sharp from 'sharp';
import { readFile, writeFile, unlink, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const only = process.argv.slice(2);
const dir = path.join(root, 'public', 'albums');
const jsonPath = path.join(dir, 'collection.json');
const config = JSON.parse(await readFile(jsonPath, 'utf8'));

// Largest size the page uses for each kind (scene.ts draws square art into 1024 px canvases, the
// back insert into a 1310 × 1024 one; main.tsx splits a booklet spread into two 1024 px pages), and
// the encoder quality. Discs keep 1200 px: the scan is cropped to the disc before it is scaled.
const KINDS = {
  cover: { size: 1024, avif: 62, webp: 86 },
  disc: { size: 1200, avif: 58, webp: 84 },
  back: { size: 1320, avif: 52, webp: 78 },
  bookletBack: { size: 1024, avif: 60, webp: 85 },
  bookletScans: { size: 2048, avif: 52, webp: 78 },
};
const SOURCES = /\.(jpe?g|png)$/i;

const size = async (file) => (await stat(file).catch(() => null))?.size ?? 0;
const totals = {};
const add = (kind, key, bytes) => { (totals[kind] ??= { before: 0, after: 0, files: 0 })[key] += bytes; };

// Converts one of an album's images; returns the collection.json path to use for it.
async function convert(albumDir, relative, kind) {
  const settings = KINDS[kind];
  const source = path.resolve(albumDir, relative);
  const base = source.replace(/\.[^.]+$/, '');
  const avif = `${base}.avif`;
  const webp = `${base}.webp`;
  const relativeAvif = relative.replace(/\.[^.]+$/, '.avif');
  if (!SOURCES.test(source)) {
    if (!(await size(avif)) || !(await size(webp))) console.warn(`  ! ${relative}: no source to convert and ${!(await size(avif)) ? 'no .avif' : 'no .webp'} beside it`);
    return relative;
  }
  const before = await size(source);
  if (!before) {
    console.warn(`  ! ${relative}: missing`);
    return relative;
  }
  const image = sharp(source).rotate().resize({ width: settings.size, height: settings.size, fit: 'inside', withoutEnlargement: true });
  await image.clone().avif({ quality: settings.avif, effort: 4, chromaSubsampling: '4:4:4' }).toFile(avif);
  await image.clone().webp({ quality: settings.webp, effort: 6, smartSubsample: true }).toFile(webp);
  const after = await size(avif);
  add(kind, 'before', before);
  add(kind, 'after', after);
  totals[kind].files += 1;
  const inside = !path.relative(albumDir, source).startsWith('..');
  if (inside) await unlink(source);
  console.log(`  ${relative} -> .avif ${(after / 1024).toFixed(0)} KB (was ${(before / 1024).toFixed(0)} KB)${inside ? '' : ', source kept'}`);
  return relativeAvif;
}

for (const album of config.albums) {
  if (only.length && !only.includes(album.id)) continue;
  console.log(album.id);
  const albumDir = path.join(dir, album.id);
  for (const kind of ['cover', 'disc', 'back', 'bookletBack']) {
    if (album[kind]) album[kind] = await convert(albumDir, album[kind], kind);
  }
  if (album.bookletScans) album.bookletScans = await Promise.all(album.bookletScans.map((scan) => convert(albumDir, scan, 'bookletScans')));
}
await writeFile(jsonPath, `${JSON.stringify(config, null, 2)}\n`);

let before = 0, after = 0;
for (const [kind, t] of Object.entries(totals)) {
  before += t.before;
  after += t.after;
  console.log(`${kind.padEnd(12)} ${String(t.files).padStart(3)} files  ${(t.before / 1048576).toFixed(1).padStart(6)} MB -> ${(t.after / 1048576).toFixed(1).padStart(5)} MB (avif)`);
}
if (before) console.log(`total        ${(before / 1048576).toFixed(1)} MB -> ${(after / 1048576).toFixed(1)} MB; collection.json updated`);
