// Loads a band's page config from public/bands/<band>/band.json. Asset paths in it are relative to
// that file, so each band's folder is self-contained. ?band=<folder> picks the band; without it the
// page shows the title screen. public/bands/index.json lists the bands it offers, in order. The
// shapes below document the JSON (BandConfig, AlbumConfig) and what the page gets from it (Band,
// Album).

export interface Theme {
  background: string;
  backgroundCenter: string;
  backgroundEdge: string;
  ink: string;
}

// Generated artwork when scans are missing.
export type Motif = 'sun' | 'waves' | 'arches' | 'rings' | 'lines';

// What scripts/download-covers.sh needs; not used by the page.
export interface MusicBrainzSource {
  releaseGroup: string;
  release?: string;
  coverRelease?: string;
  backImage?: string;
  backHalf?: 'left' | 'right';
  bookletBack?: string;
}

// A track on the CD (scripts/fetch-tracks.mjs): its length in seconds and its Apple Music track
// ID, when Apple has it, for the 30-second preview.
export interface Track {
  title: string;
  length?: number;
  apple?: number;
}

export interface AlbumConfig {
  id: string;
  title: string;
  year: string;
  kind: string;
  cover: string;
  // Scan of the printed CD.
  disc?: string;
  // Back insert, ideally with its spines.
  back?: string;
  // The booklet's back page, seen inside the open lid.
  bookletBack?: string;
  tracks?: Track[];
  // The album on Apple Music (an iTunes collection ID), for previews and the store link.
  appleMusic?: number;
  // Where to buy the CD, when the artist's own shop sells it; otherwise the page searches Amazon.
  buy?: string;
  color?: string;
  accent?: string;
  motif?: Motif;
  musicbrainz?: MusicBrainzSource;
}

export interface BandConfig {
  name: string;
  // A one-colour SVG or PNG; without it the page sets the band's name in type.
  logo?: string;
  // Evens out a logo that looks too big or too small next to the others (default 1).
  logoScale?: number;
  theme?: Partial<Theme>;
  albums: AlbumConfig[];
}

// Paths resolved to URLs, and the band name added (the scene prints it on generated spines and pages).
export interface Album extends Omit<AlbumConfig, 'cover'> {
  cover?: string;
  artist: string;
}

export interface Band extends Omit<BandConfig, 'theme' | 'albums'> {
  folder: string;
  theme: Theme;
  years: [number, number];
  albums: Album[];
}

export const defaultTheme: Theme = { background: '#ebe3d4', backgroundCenter: '#f6f0e5', backgroundEdge: '#e1d7c5', ink: '#252521' };

const bandsUrl = (path: string) => new URL(`${import.meta.env.BASE_URL}bands/${path}`, window.location.href);

export function bandFromUrl(): string | null {
  const requested = new URLSearchParams(window.location.search).get('band');
  return requested && /^[a-z0-9-]+$/.test(requested) ? requested : null;
}

// The album in front and whether it is open: ?band=<folder>&album=<id>, plus &open while it is open,
// or &listen while its disc is in the player. The page keeps these up to date, so a link restores
// the gallery as it was.
export function albumFromUrl(): { album: string | null; open: boolean; listen: boolean } {
  const params = new URLSearchParams(window.location.search);
  return { album: params.get('album'), open: params.has('open') || params.has('listen'), listen: params.has('listen') };
}

export function galleryUrl(band: string, album?: string, open = false, listen = false): string {
  const state = listen ? '&listen' : open ? '&open' : '';
  return `?band=${encodeURIComponent(band)}${album ? `&album=${encodeURIComponent(album)}` : ''}${state}`;
}

// The title screen and the menu load every band, so each config is fetched once.
const cache = new Map<string, Promise<Band>>();

export function loadBand(band: string): Promise<Band> {
  let loading = cache.get(band);
  if (!loading) {
    loading = fetchBand(band).catch((error: unknown) => {
      cache.delete(band);
      throw error;
    });
    cache.set(band, loading);
  }
  return loading;
}

async function fetchBand(band: string): Promise<Band> {
  const url = bandsUrl(`${band}/band.json`);
  const response = await fetch(url);
  // Servers with a single-page fallback answer a missing file with the page itself, so a body that
  // isn't JSON also means there is no such band.
  const config: BandConfig | null = response.ok ? await response.json().catch(() => null) : null;
  if (!config?.albums?.length) throw new Error(`No band config with albums at ${url.pathname}`);
  const resolve = (path?: string) => (path ? new URL(path, url).href : undefined);
  const years = config.albums.map((album) => Number(album.year));
  return {
    ...config,
    folder: band,
    logo: resolve(config.logo),
    theme: { ...defaultTheme, ...config.theme },
    years: [Math.min(...years), Math.max(...years)],
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
export async function loadBands(): Promise<Band[]> {
  const response = await fetch(bandsUrl('index.json'));
  const folders: string[] = response.ok ? await response.json().catch(() => []) : [];
  const bands = await Promise.all(folders.map((folder) => loadBand(folder).catch(() => null)));
  return bands.filter((band): band is Band => band !== null);
}
