// Loads a band's page config from public/bands/<band>/band.json. Asset paths in it are relative to
// that file, so each band's folder is self-contained. ?band=<folder> picks the band; without it the
// page shows the title screen. public/bands/index.json lists the bands it offers, in order.
//
// Shape: { name, logo, theme: { background, backgroundCenter, backgroundEdge, ink }, albums: [...] }.
// logo is optional (a one-colour SVG); without it the page sets the band's name in type.
// Each album: id, title, year, kind, cover, and optionally disc (scan of the printed CD), back (back
// insert, ideally with its spines), bookletBack (the booklet's back page, seen inside the open lid)
// and tracks. color, accent and motif drive the generated artwork used when scans are missing.
// musicbrainz holds what scripts/download-covers.sh needs and is not used by the page.
export const defaultTheme = { background: '#ebe3d4', backgroundCenter: '#f6f0e5', backgroundEdge: '#e1d7c5', ink: '#252521' };

const bandsUrl = (path) => new URL(`${import.meta.env.BASE_URL}bands/${path}`, window.location.href);

export function bandFromUrl() {
  const requested = new URLSearchParams(window.location.search).get('band');
  return requested && /^[a-z0-9-]+$/.test(requested) ? requested : null;
}

// The title screen and the menu load every band, so each config is fetched once.
const cache = new Map();

export function loadBand(band) {
  if (!cache.has(band)) cache.set(band, fetchBand(band).catch((error) => {
    cache.delete(band);
    throw error;
  }));
  return cache.get(band);
}

async function fetchBand(band) {
  const url = bandsUrl(`${band}/band.json`);
  const response = await fetch(url);
  // Servers with a single-page fallback answer a missing file with the page itself, so a body that
  // isn't JSON also means there is no such band.
  const config = response.ok ? await response.json().catch(() => null) : null;
  if (!config?.albums?.length) throw new Error(`No band config with albums at ${url.pathname}`);
  const resolve = (path) => (path ? new URL(path, url).href : undefined);
  const years = config.albums.map((album) => Number(album.year));
  return {
    ...config,
    folder: band,
    logo: resolve(config.logo),
    theme: { ...defaultTheme, ...config.theme },
    years: [Math.min(...years), Math.max(...years)],
    // The scene prints the band name on generated spines and pages.
    albums: config.albums.map((album) => ({
      ...album,
      artist: config.name,
      cover: resolve(album.cover),
      disc: resolve(album.disc),
      back: resolve(album.back),
      bookletBack: resolve(album.bookletBack),
    })),
  };
}

// Every band in index.json that loads; a broken one is left out rather than breaking the list.
export async function loadBands() {
  const response = await fetch(bandsUrl('index.json'));
  const folders = response.ok ? await response.json().catch(() => []) : [];
  const bands = await Promise.all(folders.map((folder) => loadBand(folder).catch(() => null)));
  return bands.filter(Boolean);
}
