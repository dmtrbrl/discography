# Discography slider demo

A focused Solid + Three.js demo modelled on the disc gallery at [A24 Films](https://a24.raviklaassens.com/). The current collection is **Nirvana**. It includes seven core album releases up to 2002: three studio albums, two live albums, and two compilations. Later compilations and live releases, reissues and box sets are outside this demo.

## Run it

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. To check the production build, run `npm run build` and then `npm run preview`.

## Interactions

- Move the mouse over a case and it tilts toward the cursor. A fast pass across a case nudges it.
- Drag the front case to turn it in 3D and see its spines and back insert. It eases back when you let go; turn it past halfway or flick it hard and it turns over to its back, and stays there until you move to another album.
- Drag anywhere else to scrub through the row. Releases keep their momentum, then snap to the nearest case.
- Scroll or swipe on a trackpad to move one album per gesture. The arrow keys, Home and End also work. With a mouse, a bubble cursor says what a click will do: open, previous or next.
- Click a side case to bring it to the front. Click the front case or press Space to open it: it turns to face you like an open book and the lid swings open to show the disc in its tray and the booklet's back page. Use the Back button top left, click beside it, press Space or Escape, or move to another album to close it.

## How it works

1. Everything band-specific lives in [`public/bands/nirvana/band.json`](public/bands/nirvana/band.json): the band name, logo, theme colours and albums, with artwork paths relative to the file. [`src/band.js`](src/band.js) loads it and documents the shape. To show another band, add `public/bands/<name>/` with its own `band.json`, logo and artwork, and open `/?band=<name>`.
2. [`src/scene.js`](src/scene.js) builds a CD jewel case per album, to real dimensions (142 × 125 × 10.4 mm): a clear lid with the booklet behind it, a clear base with the back insert folded into two spines, and a black tray holding the CD, with a ribbed strip along the hinge. The plastic has a soft reflected band with faint scratches and smudges, and the tray is satin, stippled black. The CD has a printed front ring, an iridescent data side, a bevelled edge and a clear hub. All of them use physical materials lit by a generated studio environment.
3. Cases sit on a shallow arc inside a group tilted -22° on both X and Y (the reference uses -30°; cases read better turned more toward the viewer), viewed from a 40° camera. The motion constants are ported from the reference gallery and grouped in the `C` object at the top of the file.
4. Each frame, every case eases toward its slot. Cases further from the front follow more loosely, and the whole row leans, banks and dips with scroll speed. The render loop stops when everything is at rest.
5. [`src/main.jsx`](src/main.jsx) shows the logo, the caption centred under the front case (year, kind and title, cross-fading when the album changes), the bubble cursor, and a loading counter. The scene owns the motion and reports the case in front back to Solid. It keeps the gallery hidden until every case has its final artwork and the fonts have loaded. Then the loading screen fades out, and only after that does the gallery fade in and play its intro, followed by the caption. A 12-second timeout reveals it anyway with placeholders.
6. The booklet shows the cover from `covers/` in the band's folder. The back insert uses a scan from `backs/` when one exists; a scan without spines gets generated ones, and without a scan the whole insert is generated from the album data. The booklet's back page, seen inside the open lid, comes from `booklets/` or is generated. Each disc shows a scan of the printed CD from `discs/` when one exists. The scene finds the disc in the scan and fits it, whatever the crop or background. Otherwise it uses the square cover, with a drawn mirror band. If both fail, the disc shows generated placeholder artwork. Everything is stored locally, so the demo still renders if a public music API is unavailable.
7. The data side is shaded in the shader as bright silver. Diffraction from the tracks adds soft pastel rainbow wedges that line up with two light directions and move as the disc turns. It also has faint track lines, a silver mirror band, and a few fine scratches that only glint where their angle catches the light. Each album gets its own scratch rotation, seeded from its ID.

## Next phase: artist search

The slider accepts any album array with the shape in `band.json`. A future catalog adapter can search artists via the [MusicBrainz API](https://musicbrainz.org/doc/MusicBrainz_API), request album release groups for the selected artist, and resolve artwork through [Cover Art Archive](https://coverartarchive.org/). Normalize those results to the same array, then call `scene.setAlbums(newAlbums)` and reset the selected index. The search layer should debounce requests, respect MusicBrainz rate limits, cache responses, and handle missing artwork. No search UI or live API request is included in this first version.

## Artwork and scope

Album metadata was checked against [MusicBrainz's Nirvana discography](https://musicbrainz.org/artist/5b11f4ce-a62d-471e-81fc-a69a8278c7da) and the [LiveNirvana album list](https://www.livenirvana.com/official/albums.html). Cover images came from Cover Art Archive release groups. Disc scans and back inserts are the images tagged `Medium` and `Back`, both taken from the earliest CD release that has both, so they show the same edition (failing that, each from the earliest release that has it). The booklet's back page has no reliable tag, so `band.json` lists its source per album. Run `scripts/download-covers.sh nirvana` (needs `curl` and `jq`) to refresh a band's artwork, or add album IDs to refresh only those. It reads the release-group IDs from `band.json`, writes the paths it found back into it, respects MusicBrainz rate limits, and keeps existing scans if MusicBrainz can't be reached. Every album has its back insert and booklet back page downloaded. The Nirvana wordmark in `public/bands/nirvana/logo.svg` comes from Wikimedia Commons (`NirvanaLogo.svg`, public domain as a text logo; the wordmark may be trademarked). The cover art remains the property of its respective rights holders. This repository is a local design and interaction demo.
