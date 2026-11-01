# Discography

An experiment in browsing music as physical CDs: each album in its plastic jewel case, with the booklet folded inside.

**[Open Discography](https://dmtrbrl.github.io/discography/)**

Flick through a row of favorite albums, turn a case over to read its back and spines, open it, leaf through the booklet, and put the disc on a CD player to hear 30-second song previews.

## The idea

Streaming made albums into a square thumbnail. A CD was an object: a case that clicked open, a disc with its own printed face, a booklet with lyrics and photos to read while the music played. Discography tries to bring that back on a screen, so an album is something you pick up and handle rather than a link.

Everything is drawn in the browser with three.js from the real artwork: official covers, scans of the printed discs, back inserts and booklets of actual CD editions. The plastic, its scratches and the sheen of the discs were tuned against photos of real CDs rather than made to look stylised. The booklets turn with [LeafThrough](https://github.com/dmtrbrl/leafthrough), a library for flipping through pages on the web.

## Sources

Disc, back insert and booklet scans come from the community-run [Cover Art Archive](https://coverartarchive.org/) and [MusicBrainz](https://musicbrainz.org/); the exact edition and image used for each album are recorded in its `sources` entry in `public/albums/collection.json`. Covers and song previews come from Apple Music; the Apple and Spotify links in the player point at the same editions.

Cover art, booklet scans, disc designs, and logos belong to their respective rights holders.

The type is DM Sans, DM Mono and Instrument Serif, served from the page under the SIL Open Font License (see `public/fonts/`).

## Running it

```bash
npm install
npm run dev        # Vite dev server at http://127.0.0.1:5173/
npm run typecheck  # tsc, strict, no emit
npm run build      # type-check, then a production build into dist/
npm run preview    # serve the build
```

Views live in the hash, so every link needs nothing from the server but the page: `#/<id>` brings an album to the front, `#/<id>/open` opens it, `#/<id>/listen` puts its disc in the player, `#/<id>/booklet` opens its booklet, and `#/about` is the page about the project. The page keeps the hash up to date.

Every push to `main` builds and publishes `dist/` to GitHub Pages (`.github/workflows/deploy.yml`; the repository's Pages source must be "GitHub Actions"). The build uses relative URLs (`base: './'`), so it runs from a project subfolder.

## Layout

| Path | Role |
| --- | --- |
| `src/scene.ts` | Everything 3D: the `GalleryScene` class, the cases, discs, booklet flight and player, materials and shaders, input, motion and loading. All visual and motion tuning lives in the `C` object at the top. |
| `src/main.tsx` | The Solid app: loading screen, masthead, caption and arrows, the bottom row's controls, the bubble cursor, keyboard handling, routing and history, previews. Talks to the scene through its public methods. |
| `src/collection.ts` | The types for `collection.json` and what the page gets from it, the loader (which picks AVIF or WebP), and the hash route helpers. |
| `src/procedural.ts`, `src/procedural.worker.ts` | The disc print's and tray's procedural maps and LeafThrough's paper grain, generated once in a worker. |
| `src/style.css`, `index.html` | The page shell and the self-hosted fonts; the HTML preloads the fonts and `collection.json`. |
| `vite.config.ts` | The Solid plugin and `preloadArtwork`, which writes a preload link for every album's disc and cover into the built page (on phones only the first album's small copies). |
| `public/albums/collection.json` | The collection (see below). |
| `public/albums/<id>/` | One album's artwork: `cover`, `disc`, `back` and `booklet-back` (`.avif` with a `.webp` twin) and the booklet's pages in `booklet/`. |
| `public/fonts/` | DM Sans, DM Mono and Instrument Serif as woff2, with the licence. |
| `scripts/` | The data scripts and the checks (below). |

## The collection

`public/albums/collection.json` holds the collection's `name`, an optional `theme` and `albums`. Each album has `id`, `artist`, `title`, `year` and `kind`; its artwork as paths relative to `public/albums/<id>/` (`cover`, `disc`, their small copies for phones `coverSmall` and `discSmall`, `back`, `bookletBack`, `bookletScans`, with `bookletPageCount` and `bookletFit`); `tracks` (title, length and Apple track ID); `appleMusic` with `appleMusicCountry`, `spotify` and an optional `buy` link; `sources`, where each image came from; and `musicbrainz`, the release group, release and image picks the download script uses.

Refreshing the data, for every album or the ones named:

```bash
bash scripts/download-covers.sh [album id ...]   # cover, disc scan, back insert and booklet back from MusicBrainz and the Cover Art Archive (curl, jq)
node scripts/optimize-images.mjs [album id ...]  # then AVIF and WebP at the sizes the page draws, plus the small copies for phones, paths rewritten (sharp)
node scripts/fetch-tracks.mjs [album id ...]     # the CD's tracklist from MusicBrainz and its Apple Music match (Node 18+)
```

The booklet pages and the Spotify IDs were picked and verified by hand; `specs/DECISIONS.md` (The data) records how.

## Checks

Playwright-driven checks run against the dev server in headless Chrome. They need `playwright-core` and a Chrome install; point `PLAYWRIGHT_CORE` at the module if it isn't on this project's resolution path. The dev server exposes the scene as `window.scene` for them, and Shift+D opens a slow-motion panel for review.

```bash
npm run dev
PLAYWRIGHT_CORE=../leafthrough/node_modules/playwright-core/index.mjs node scripts/check-booklet.mjs http://127.0.0.1:5173/
```

| Script | What it checks |
| --- | --- |
| `check-booklet.mjs` | The booklet's lifecycle: sheet count, no early interior requests, the same page object in flight and in the reader, no automatic first turn, outside clicks, Escape and Close, reopening, the gallery's lighting restored; Surrender on desktop and a portrait phone, Mutter on a landscape phone, Citizen of Glass with reduced motion (on desktop: phones play the motion regardless); Mutter opened straight into the booklet on a phone, keeping its inside pages once the full-size cover arrives. |
| `check-booklet-roll.mjs [url] [album]` | The page shaders on the GPU through transform feedback: 201 poses of the roll at three screen sizes, clearance of the lid, holders and tray, a reversible path, a flat landing and the paper's speed profile. |
| `check-case-transition.mjs` | The case's exit for the booklet against Listen's: the same projection at matching pan values, the shared lens, the 2.4 and 1.9 s durations. |
| `check-insert-path.mjs` | The disc never goes into the player on its way in or out, at ten screen sizes for three albums, and never jumps between samples. |
| `check-album.mjs [url] [album id ...]` | Albums end to end (all ten without ids), with the expectations read from collection.json: the booklet's page count and every panel drawn whole from its scan, every page reached, the Apple and Spotify links, and every preview Apple provides played, on desktop and mobile. `SHOTS=<dir>` saves captures. |

Run them after a change to the case, the booklet, the player or the data; `npm run build` type-checks. The first four run on the current gallery: Surrender as the thin eight-page booklet, Mutter as the thick sixteen-page one, Citizen of Glass for the lazy interior requests.

Beyond the checks, review has used ad-hoc scripts kept outside the repo, with `playwright-core` and headless Chrome on the GPU (`--use-angle=metal --enable-gpu --ignore-gpu-blocklist`; SwiftShader runs at about 9 fps):

- Screenshots and frame-by-frame captures of a motion, diffed pixel by pixel against the committed build served from a `git worktree`; crops around the pointer for the bubble.
- `requestAnimationFrame` intervals and `longtask` entries per segment of a scripted session, and the time in `compileShader`, `linkProgram` and `texSubImage2D` patched on the WebGL prototypes.
- Time to the reveal under CDP `Network.emulateNetworkConditions` (3G, 4G, 10 Mbps; the loading decisions go by slow 4G, 1.6 Mbps and 150 ms, with the CPU slowed 4×, on a phone viewport), the order and timing of every request, Lighthouse against a local server that gzips text as GitHub Pages does (`vite preview` doesn't), and CDP `Profiler` runs of the start at 1× and 4× CPU throttling.
- Load with `waitUntil: 'commit'` when timing the loading screen: the page's `load` event waits for the artwork. Keep source files unchanged during a run; a Vite reload breaks a lifecycle check.

## More

The `specs/` folder holds the documents for development: [DECISIONS.md](specs/DECISIONS.md) has what is built and the design decisions from review, including what was tried and rejected, the known gaps and the ideas not planned; [BOOKLET_ANIMATION.md](specs/BOOKLET_ANIMATION.md) is the implementation reference for the booklet's animation.
