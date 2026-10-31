import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import solid from 'vite-plugin-solid';

// The gallery shows nothing until every case has its disc and cover, and the browser would learn
// of those files only once the script has run and fetched collection.json. A preload for each lets them
// download alongside the script. They go after the script and stylesheet tags, at the priority of
// images, so the script isn't starved by forty requests queued ahead of it (on a slow connection it
// arrived after most of the artwork); the back inserts and booklet backs, which the reveal doesn't
// wait for (scene.ts, setAlbums), queue behind the discs and covers at a lower priority still. type=
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
        const links = (kinds: string[], priority?: 'low') => config.albums.flatMap((album) => kinds.flatMap((kind) => {
          const path = album[kind];
          if (!path) return [];
          // Paths are relative to the album's folder; the href relative to the page, as the build's
          // other URLs are (base './').
          const href = `.${new URL(path, `file:///albums/${album.id}/`).pathname}`;
          return [{ tag: 'link', attrs: { rel: 'preload', as: 'image', href, type: `image/${href.split('.').pop()}`, ...(priority ? { fetchpriority: priority } : {}) }, injectTo: 'head' as const }];
        }));
        const tables = Object.keys(bundle ?? {}).find((file) => /RectAreaLightUniformsLib/.test(file));
        return [
          ...(tables ? [{ tag: 'link', attrs: { rel: 'modulepreload', href: `./${tables}`, crossorigin: true }, injectTo: 'head' as const }] : []),
          ...links(['disc', 'cover']),
          ...links(['back', 'bookletBack'], 'low'),
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
