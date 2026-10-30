#!/usr/bin/env node
// Adds each album's tracklist and its Apple Music match to public/bands/<band>/band.json, for the
// player's tracklist and 30-second previews. The tracklist comes from the CD on MusicBrainz
// (musicbrainz.release when band.json pins one, otherwise the earliest official single-CD release
// of the release group, as in download-covers.sh). The album on Apple Music is found through the
// artist's Apple ID (from the artist's MusicBrainz links): every album there whose name matches,
// ignoring edition notes such as "(Deluxe Edition)" or "(Remastered 2020)", is compared track by
// track, and the one matching most tracks with the fewest extras wins. Each track then records
// its Apple track ID, so the page only has to fetch fresh preview URLs. Requires Node 18 or newer.
//
// Usage: node scripts/fetch-tracks.mjs <band> [album id ...]   (no ids: every album)

import { readFile, writeFile } from 'node:fs/promises';

const USER_AGENT = 'discography-demo/0.1 (local demo)';
// MusicBrainz allows about one request a second; the iTunes API about 20 a minute.
const PAUSE = { musicbrainz: 1100, itunes: 3200 };
const COUNTRY = 'us';

const [band, ...only] = process.argv.slice(2);
if (!band) {
  console.error('Usage: node scripts/fetch-tracks.mjs <band> [album id ...]');
  process.exit(1);
}
const configPath = `public/bands/${band}/band.json`;
const config = JSON.parse(await readFile(configPath, 'utf8'));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const last = { musicbrainz: 0, itunes: 0 };

// Waits out the service's rate limit, then fetches JSON, retrying on 503 and network errors.
async function get(service, url) {
  for (let attempt = 0; attempt < 5; attempt++) {
    await sleep(Math.max(0, last[service] + PAUSE[service] - Date.now()));
    last[service] = Date.now();
    try {
      const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
      if (response.ok) return await response.json();
      if (response.status !== 503 && response.status !== 429) throw new Error(`${response.status} for ${url}`);
    } catch (error) {
      if (attempt === 4) throw error;
    }
    await sleep(5000 * (attempt + 1));
  }
  throw new Error(`Gave up on ${url}`);
}

// Lower case, accents and punctuation removed, so "Their Law: The Singles 1990–2005" and "Their
// Law the Singles 1990 - 2005" compare equal.
const simple = (text) => text.replace(/ß/g, 'ss').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '');

// Drops edition and version notes: bracketed parts naming one, and " - Remastered 2011" style tails.
const EDITION = /deluxe|edition|remaster|anniversary|expanded|special|version|standard|live|acoustic|mix|mono|stereo|demo|bonus|explicit|clean/i;
const bare = (text) => simple(text
  .replace(/\s*[([][^)\]]*[)\]]/g, (part) => (EDITION.test(part) ? '' : part))
  .replace(/\s+-\s+(.*)$/, (part, tail) => (EDITION.test(tail) || /^(ep|single)$/i.test(tail) ? '' : part)));

// The CD release the tracklist comes from.
async function pickRelease(album) {
  if (album.musicbrainz.release) return album.musicbrainz.release;
  const { releases } = await get('musicbrainz', `https://musicbrainz.org/ws/2/release?release-group=${album.musicbrainz.releaseGroup}&inc=media&limit=100&fmt=json`);
  const cds = releases
    .filter((release) => release.status === 'Official' && release.media.length === 1 && release.media[0].format === 'CD')
    .sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999') || a.id.localeCompare(b.id));
  return cds[0]?.id;
}

async function mbTracks(releaseId) {
  const release = await get('musicbrainz', `https://musicbrainz.org/ws/2/release/${releaseId}?inc=recordings+artist-credits&fmt=json`);
  const artist = release['artist-credit']?.[0]?.artist?.id;
  const tracks = release.media[0].tracks.map((track) => ({ title: track.title, length: track.length ? Math.round(track.length / 1000) : undefined }));
  return { artist, tracks };
}

async function appleArtist(mbArtist) {
  const artist = await get('musicbrainz', `https://musicbrainz.org/ws/2/artist/${mbArtist}?inc=url-rels&fmt=json`);
  for (const relation of artist.relations || []) {
    const match = /(?:itunes|music)\.apple\.com\/.*artist\/(?:[^/]+\/)?(?:id)?(\d+)/.exec(relation.url?.resource || '');
    if (match && !relation.ended) return Number(match[1]);
  }
  for (const relation of artist.relations || []) {
    const match = /(?:itunes|music)\.apple\.com\/.*artist\/(?:[^/]+\/)?(?:id)?(\d+)/.exec(relation.url?.resource || '');
    if (match) return Number(match[1]);
  }
  return undefined;
}

// Pairs our tracks with Apple's songs: same title first, then the title without version notes,
// then the same position. Returns Apple track IDs (or undefined) in our order.
function pairTracks(tracks, songs) {
  const free = new Set(songs);
  const take = (test) => {
    const song = [...free].find(test);
    if (song) free.delete(song);
    return song;
  };
  const found = tracks.map((track) => take((song) => simple(song.trackName) === simple(track.title)));
  tracks.forEach((track, n) => {
    found[n] ??= take((song) => bare(song.trackName) === bare(track.title));
  });
  tracks.forEach((track, n) => {
    found[n] ??= take((song) => song.trackNumber === n + 1 && bare(song.trackName).startsWith(bare(track.title).slice(0, 6)));
  });
  return found.map((song) => song?.trackId);
}

// A collection may contain albums by several artists; cache each artist's Apple catalog separately.
const artistAlbums = new Map();
let changed = 0;
for (const album of config.albums) {
  if (only.length && !only.includes(album.id)) continue;
  if (!album.musicbrainz?.releaseGroup) continue;
  console.log(`${album.title}`);
  const releaseId = await pickRelease(album);
  if (!releaseId) {
    console.log('  no single-CD release on MusicBrainz; skipped');
    continue;
  }
  const { artist, tracks } = await mbTracks(releaseId);
  console.log(`  ${tracks.length} tracks from release ${releaseId}`);

  let catalog = artistAlbums.get(artist);
  if (!catalog) {
    const appleId = config.appleArtist ?? (artist && await appleArtist(artist));
    if (!appleId) throw new Error('No Apple artist ID on MusicBrainz; set "appleArtist" in band.json');
    const { results } = await get('itunes', `https://itunes.apple.com/lookup?id=${appleId}&entity=album&limit=200&country=${COUNTRY}`);
    catalog = results.filter((result) => result.wrapperType === 'collection');
    artistAlbums.set(artist, catalog);
  }

  // Same name first, then the name without edition notes; closest track count first, explicit
  // before clean, and at most four tried.
  let candidates = catalog.filter((result) => simple(result.collectionName) === simple(album.title));
  if (!candidates.length) candidates = catalog.filter((result) => bare(result.collectionName) === bare(album.title));
  if (!candidates.length) candidates = catalog.filter((result) => bare(result.collectionName).startsWith(bare(album.title)));
  candidates = candidates
    .filter((result) => result.trackCount >= tracks.length * 0.6)
    .sort((a, b) => Math.abs(a.trackCount - tracks.length) - Math.abs(b.trackCount - tracks.length)
      || (a.collectionExplicitness === 'cleaned') - (b.collectionExplicitness === 'cleaned'))
    .slice(0, 4);

  let best = null;
  for (const candidate of candidates) {
    const { results } = await get('itunes', `https://itunes.apple.com/lookup?id=${candidate.collectionId}&entity=song&limit=200&country=${COUNTRY}`);
    const songs = results.filter((result) => result.wrapperType === 'track' && (result.discNumber ?? 1) === 1);
    const ids = pairTracks(tracks, songs);
    const matched = ids.filter(Boolean).length;
    const extras = candidate.trackCount - matched;
    if (!best || matched > best.matched || (matched === best.matched && extras < best.extras)) best = { candidate, ids, matched, extras };
    if (matched === tracks.length && extras === 0) break;
  }

  delete album.appleMusic;
  delete album.appleMusicCountry;
  if (best?.matched) {
    album.appleMusic = best.candidate.collectionId;
    album.appleMusicCountry = COUNTRY;
    best.ids.forEach((id, n) => {
      if (id) tracks[n].apple = id;
    });
    console.log(`  Apple Music: ${best.candidate.collectionName} (${best.candidate.collectionId}), ${best.matched}/${tracks.length} tracks`);
    const missing = tracks.filter((track) => !track.apple).map((track) => track.title);
    if (missing.length) console.log(`  no preview: ${missing.join(', ')}`);
  } else {
    console.log('  not found on Apple Music');
  }
  album.tracks = tracks;
  changed++;
}

await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
console.log(`Updated ${changed} album(s) in ${configPath}`);
