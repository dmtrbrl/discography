# Discography slider demo

A focused Solid + Three.js demo modelled on the disc gallery at [A24 Films](https://a24.raviklaassens.com/). The current collection is **Nirvana**. It includes ten core album releases: three studio albums, three live albums, and four compilations. Reissues and box sets are outside this first slider demo.

## Run it

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. To check the production build, run `npm run build` and then `npm run preview`.

## Interactions

- Move the mouse over a disc and it tilts toward the cursor. A fast pass across a disc nudges it.
- Drag the front disc to spin it in 3D. It eases back when you let go.
- Drag anywhere else to scrub through the row. Releases keep their momentum, then snap to the nearest disc.
- Scroll or swipe on a trackpad to move one album per gesture. The arrow keys, Home, End and the previous and next buttons also work.
- Click a side disc to bring it to the front. Click the front disc or press Space to flip it to its data side.

## How it works

1. [`src/data.js`](src/data.js) is the normalized album array. Each item has an ID, title, year, category, and cover path.
2. [`src/scene.js`](src/scene.js) builds a CD per album: a printed front ring, an iridescent data side, a bevelled edge and a glass hub. All of them use physical materials lit by a generated studio environment.
3. Discs sit on a shallow arc inside a group tilted -30° on both X and Y, viewed from a 40° camera. The motion constants are ported from the reference gallery and grouped in the `C` object at the top of the file.
4. Each frame, every disc eases toward its slot. Discs further from the front follow more loosely, and the whole row leans, banks and dips with scroll speed. The render loop stops when everything is at rest.
5. [`src/main.jsx`](src/main.jsx) shows the caption, the controls, and a loading counter. The scene owns the motion and reports the disc in front back to Solid. It keeps the gallery hidden until every disc has its final artwork and the fonts have loaded, then plays the intro. A 12-second timeout reveals it anyway with placeholders.
6. Each disc shows a scan of the printed CD from `public/discs` when one exists. The scene finds the disc in the scan and fits it, whatever the crop or background. Otherwise it uses the square cover from `public/covers`, with a drawn mirror band. If both fail, the disc shows generated placeholder artwork. Everything is stored locally, so the demo still renders if a public music API is unavailable.
7. The data side is shaded in the shader as bright silver. Diffraction from the tracks adds soft pastel rainbow wedges that line up with two light directions and move as the disc turns. It also has faint track lines, a silver mirror band, and a few fine scratches that only glint where their angle catches the light. Each album gets its own scratch rotation, seeded from its ID.

## Next phase: artist search

The slider accepts any array with the shape in `src/data.js`. A future catalog adapter can search artists via the [MusicBrainz API](https://musicbrainz.org/doc/MusicBrainz_API), request album release groups for the selected artist, and resolve artwork through [Cover Art Archive](https://coverartarchive.org/). Normalize those results to the same array, then call `scene.setAlbums(newAlbums)` and reset the selected index. The search layer should debounce requests, respect MusicBrainz rate limits, cache responses, and handle missing artwork. No search UI or live API request is included in this first version.

## Artwork and scope

Album metadata was checked against [MusicBrainz's Nirvana discography](https://musicbrainz.org/artist/5b11f4ce-a62d-471e-81fc-a69a8278c7da) and the [LiveNirvana album list](https://www.livenirvana.com/official/albums.html). Cover images came from Cover Art Archive release groups. Disc scans are the images tagged `Medium`, taken from the earliest CD release that has one. Run `scripts/download-covers.sh` (needs `curl` and `jq`) to refresh both. It records the release-group IDs, respects MusicBrainz rate limits, and keeps an existing scan if MusicBrainz can't be reached. Icon has no archived disc scan, so it uses its cover. The cover art remains the property of its respective rights holders. This repository is a local design and interaction demo.
