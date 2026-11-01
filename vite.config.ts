import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import solid from 'vite-plugin-solid';

// The gallery shows nothing until every case has its disc and cover, and the browser would learn
// of those files only once the script has run and fetched collection.json. A preload for each lets them
// download alongside the script. They go after the script and stylesheet tags, at the priority of
// images, so the script isn't starved by the requests queued ahead of it (on a slow connection it
// arrived after most of the artwork). The back inserts and booklet backs, seen only once a case is
// turned over or opened, are not preloaded: the scene loads them once the row is up (scene.ts,
// afterIntro), so they take no bandwidth from the row on a slow connection. type=
// names the format, so a browser without AVIF skips them and loads the .webp twins collection.ts
// points it at instead. The strip light's lookup tables, a chunk the script imports once it runs, are
// preloaded too, so they come with the script rather than after it.
function preloadArtwork(): Plugin {
  return {
    name: 'preload-artwork',
    transformIndexHtml: {
      order: 'post',
      handler(_html, { bundle }) {
        const config = JSON.parse(readFileSync('public/albums/collection.json', 'utf8')) as { albums: Record<string, string | undefined>[] };
        // Phones (650 px and narrower; scene.ts, narrowWidth) load the small copies of the discs and
        // covers first and the full size once the row is up, so each is preloaded for its screens;
        // on phones only the first album's, though: sharing a slow connection with twenty images,
        // the script itself arrived late. The scene asks for the other albums' as soon as it runs,
        // the front's neighbours first (scene.ts, setAlbums).
        const media = (album: Record<string, string | undefined>, kind: string) =>
          kind.endsWith('Small') ? '(max-width: 650px)' : album[`${kind}Small`] ? '(min-width: 651px)' : undefined;
        const links = (kinds: string[], albums = config.albums) => albums.flatMap((album) => kinds.flatMap((kind) => {
          const path = album[kind];
          if (!path) return [];
          const screens = media(album, kind);
          // Paths are relative to the album's folder; the href relative to the page, as the build's
          // other URLs are (base './').
          const href = `.${new URL(path, `file:///albums/${album.id}/`).pathname}`;
          return [{ tag: 'link', attrs: { rel: 'preload', as: 'image', href, type: `image/${href.split('.').pop()}`, ...(screens ? { media: screens } : {}) }, injectTo: 'head' as const }];
        }));
        const tables = Object.keys(bundle ?? {}).find((file) => /RectAreaLightUniformsLib/.test(file));
        return [
          ...(tables ? [{ tag: 'link', attrs: { rel: 'modulepreload', href: `./${tables}`, crossorigin: true }, injectTo: 'head' as const }] : []),
          ...links(['discSmall', 'coverSmall'], config.albums.slice(0, 1)),
          ...links(['disc', 'cover']),
        ];
      },
    },
  };
}

// Relative asset URLs, so the build works from any folder, such as a GitHub Pages project site.
// The page itself is the only URL: views live in the hash.
export default defineConfig({
  base: './',
  plugins: [solid(), preloadArtwork()],
  build: {
    // Every browser with WebGL2 runs this; no lowering to older syntax.
    target: 'es2022',
    modulePreload: { polyfill: false },
    // three.js is in the main chunk: nothing draws without it. The strip light's lookup tables
    // (RectAreaLightUniformsLib) are the one chunk loaded on the side (scene.ts).
    chunkSizeWarningLimit: 900,
  },
});
