// Loads a band's page config from public/bands/<band>/band.json. Asset paths in it are relative to
// that file, so each band's folder is self-contained. ?band=<folder> picks the band.
//
// Shape: { name, logo, theme: { background, backgroundCenter, backgroundEdge, ink }, albums: [...] }.
// Each album: id, title, year, kind, cover, and optionally disc (scan of the printed CD), back (back
// insert, ideally with its spines), bookletBack (the booklet's back page, seen inside the open lid)
// and tracks. color, accent and motif drive the generated artwork used when scans are missing.
// musicbrainz holds what scripts/download-covers.sh needs and is not used by the page.
export const defaultBand = 'nirvana';

const defaultTheme = { background: '#ebe3d4', backgroundCenter: '#f6f0e5', backgroundEdge: '#e1d7c5', ink: '#252521' };

export function bandFromUrl() {
  const requested = new URLSearchParams(window.location.search).get('band');
  return requested && /^[a-z0-9-]+$/.test(requested) ? requested : defaultBand;
}

export async function loadBand(band = bandFromUrl()) {
  const url = new URL(`${import.meta.env.BASE_URL}bands/${band}/band.json`, window.location.href);
  const response = await fetch(url);
  // Servers with a single-page fallback answer a missing file with the page itself, so a body that
  // isn't JSON also means there is no such band.
  const config = response.ok ? await response.json().catch(() => null) : null;
  if (!config?.albums?.length) throw new Error(`No band config with albums at ${url.pathname}`);
  const resolve = (path) => (path ? new URL(path, url).href : undefined);
  return {
    ...config,
    logo: resolve(config.logo),
    theme: { ...defaultTheme, ...config.theme },
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
