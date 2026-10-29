// Loads a band's page config from public/bands/<band>/band.json. Asset paths in it are relative to
// that file. The page shows one collection, public/bands/favorites/band.json; the artist folders
// beside it hold source artwork the collection points to. The shapes below document the JSON
// (BandConfig, AlbumConfig) and what the page gets from it (Band, Album).

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
  // A mixed collection can name the artist on each album.
  artist?: string;
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
  // Some archived booklet backs are the left or right panel of an outer spread.
  bookletBackCrop?: 'left' | 'right';
  // Archived interior booklet scans; spreads are split into pages when the booklet opens.
  bookletScans?: string[];
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
  albums: Album[];
}

const defaultTheme: Theme = { background: '#ebe3d4', backgroundCenter: '#f6f0e5', backgroundEdge: '#e1d7c5', ink: '#252521' };

const bandsUrl = (path: string) => new URL(`${import.meta.env.BASE_URL}bands/${path}`, window.location.href);

// The album in front and its view, as a hash route: #/<id>, plus /open while it is open, /listen
// while its disc is in the player, or /booklet while its booklet is out. The page keeps it up to
// date, so a link restores the gallery as it was. In the hash, a link needs nothing from the server
// but the page itself (GitHub Pages has no single-page fallback).
// #/about is the page about the project, shown over the gallery (the gallery stays as it was).
export const galleryModes = ['open', 'listen', 'booklet'] as const;
export type GalleryMode = (typeof galleryModes)[number];
export type GalleryLink = { album: string | null; mode: GalleryMode | null; about: boolean };
export const aboutPath = '/about';

export function galleryLink(params: { album?: string; mode?: string }, path: string): GalleryLink {
  return { album: params.album ?? null, mode: (params.mode as GalleryMode | undefined) ?? null, about: path === aboutPath };
}

export function galleryPath(album: string, mode: GalleryMode | null = null): string {
  return `/${encodeURIComponent(album)}${mode ? `/${mode}` : ''}`;
}

// Links from before the hash routes (?album=<id>&open or &listen, and the older ?band=<folder> and
// ?home) still reach the page. Moves the album and its state into the hash at once, without adding a
// history entry, and drops the query. An unknown album is left to the router, which goes to the
// gallery's start.
export function moveQueryToHash() {
  if (!window.location.search) return;
  const params = new URLSearchParams(window.location.search);
  const album = params.get('album');
  const mode = params.has('listen') ? 'listen' : params.has('open') ? 'open' : null;
  const hash = album && !window.location.hash ? `#${galleryPath(album, mode)}` : window.location.hash;
  window.history.replaceState(window.history.state, '', `${window.location.pathname}${hash}`);
}

export async function loadBand(band: string): Promise<Band> {
  const url = bandsUrl(`${band}/band.json`);
  const response = await fetch(url);
  // Servers with a single-page fallback answer a missing file with the page itself, so a body that
  // isn't JSON also means there is no such band.
  const config: BandConfig | null = response.ok ? await response.json().catch(() => null) : null;
  if (!config?.albums?.length) throw new Error(`No band config with albums at ${url.pathname}`);
  const resolve = (path?: string) => (path ? new URL(path, url).href : undefined);
  return {
    ...config,
    folder: band,
    logo: resolve(config.logo),
    theme: { ...defaultTheme, ...config.theme },
    albums: config.albums.map((album) => ({
      ...album,
      artist: album.artist || config.name,
      cover: resolve(album.cover),
      disc: resolve(album.disc),
      back: resolve(album.back),
      bookletBack: resolve(album.bookletBack),
      bookletScans: album.bookletScans?.map((path) => resolve(path)!),
    })),
  };
}
