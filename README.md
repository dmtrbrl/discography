# Discography

A gallery of ten favorite albums from ten artists, shown as physical CDs. Flick through the jewel cases, turn one over, open it, leaf through its booklet, and place the disc on a CD player. Built with Solid, three.js, TypeScript, and [LeafThrough](https://github.com/dmtrbrl/leafthrough).

| # | Artist | Album | Year |
| --- | --- | --- | --- |
| 1 | Nirvana | *Nevermind* | 1991 |
| 2 | Red Hot Chili Peppers | *Californication* | 1999 |
| 3 | David Bowie | *Aladdin Sane* | 1973 |
| 4 | Enya | *Shepherd Moons* | 1991 |
| 5 | Björk | *Post* | 1995 |
| 6 | Radiohead | *Kid A* | 2000 |
| 7 | The Prodigy | *The Fat of the Land* | 1997 |
| 8 | The Knife | *Silent Shout* | 2006 |
| 9 | Rammstein | *Mutter* | 2001 |
| 10 | Crystal Castles | *Crystal Castles* | 2008 |

## Run

```bash
npm install
npm run dev
```

The root URL opens the gallery. `#/kid-a` opens with an album selected; append `/open` for its open case, `/listen` for the player or `/booklet` for its booklet. `#/about` describes the project. The routes live in the hash, so the build works from any folder, GitHub Pages included. `npm run typecheck` and `npm run build` verify the project.

## Use

- Drag or scroll the row, or use its arrows, to move between records.
- Drag the front case to turn it over. Click it or its title to open it; **Close** at the top left closes it again.
- Click the booklet in the open lid, or choose **Booklet** at the bottom left, to turn the archived pages. Escape or **Close** returns to the case.
- Click the disc, the album title, or **Listen** at the bottom right to place it on the player. The player's buttons, or the row under it, play 30-second Apple Music previews where available; **Apple Music** and **Buy the CD** sit either side of the album title. **Eject** at the top left, or a click on the disc, returns it to its case.
- **About** at the top left of the gallery describes the project.
- Arrow keys, Home, End, Enter, Space, and Escape support the main gallery. The booklet has its own page controls and keyboard support.

## Artwork and data

The visible collection is [`public/bands/favorites/band.json`](public/bands/favorites/band.json). Each album has a 1200-pixel official digital front cover, a high-resolution CD scan, a back insert, and local booklet scans. The booklet viewer splits archived spreads into square pages in memory; it never alters the source files. The disc renderer detects the circular scan and trims its outermost edge to keep the artwork centred without showing scanner background during rotation.

The five artists that were already in the project still have their original folders under `public/bands/`; the collection reuses their disc, back, and booklet-back files. The new albums keep their physical artwork and booklet scans under `public/bands/favorites/`. See [ARTWORK_SOURCES.md](ARTWORK_SOURCES.md) for edition choices, source links, and quality notes. Tracklists come from MusicBrainz CD releases, with preview IDs matched to Apple Music by `scripts/fetch-tracks.mjs`.

Cover art, booklet scans, disc designs, and logos belong to their respective rights holders. This repository is a design and interaction experiment.

---

Made by [Dmytro Barylo](https://dmytrobarylo.com).
