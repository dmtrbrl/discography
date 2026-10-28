# Discography

An experiment in browsing music as it came on CD: jewel cases you can flick through, turn over and open, with the real covers, discs and inserts. Built with Solid, three.js and TypeScript.

The title screen lists the artists. Pick one to see their albums as a row of cases; the Menu button top right switches artist, and the Discography wordmark returns to the title screen.

| Artist | Albums | Years |
| --- | --- | --- |
| Nirvana | *Bleach*, *Nevermind*, *Incesticide*, *In Utero*, *MTV Unplugged in New York*, *From the Muddy Banks of the Wishkah*, *Nirvana* | 1989 to 2002 |
| The Prodigy | *Experience*, *Music for the Jilted Generation*, *The Fat of the Land*, *Always Outnumbered, Never Outgunned*, *Their Law: The Singles 1990–2005*, *Invaders Must Die* | 1992 to 2009 |
| The Knife | *The Knife*, *Deep Cuts*, *Hannah med H*, *Silent Shout* | 2001 to 2006 |
| Rammstein | *Herzeleid*, *Sehnsucht*, *Live aus Berlin*, *Mutter*, *Reise, Reise*, *Rosenrot*, *Liebe ist für alle da* | 1995 to 2009 |
| Crystal Castles | *Crystal Castles*, *Crystal Castles (II)*, *(III)*, *Amnesty (I)* | 2008 to 2016 |

### Scope: single-disc albums only

This is a deliberate choice: the demo shows only albums that come as one CD in one jewel case. Double albums and multi-disc releases are left out (for The Knife, *Tomorrow, in a Year* and *Shaking the Habitual*), and where an album also came out as a special edition with a second CD or a DVD, the artwork comes from a single-CD edition.

## Run it

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. The URL follows the gallery, so a link restores it: `?band=nirvana` opens an artist, `&album=nevermind` brings that album to the front, and `&open` shows it open (for example `/?band=nirvana&album=nevermind&open`). The code is TypeScript in strict mode: `npm run typecheck` checks it, and `npm run build` type-checks before building (then `npm run preview` serves the build).

## Interactions

- Move the mouse over a case and it tilts toward the cursor. A fast pass across a case nudges it.
- Drag the front case to turn it and see its spines and back insert. Turn it past halfway or flick it and it turns over to its back, staying there until you move to another album.
- Drag anywhere else to scrub through the row. Scroll, swipe on a trackpad, use the arrows beside the album title, or the arrow keys, Home and End to move one album at a time. With a mouse, a bubble cursor says what a click will do.
- Click the front case or press Space to open it: it turns to face you like an open book, showing the disc in its tray and the booklet's back page. While it is open, dragging, scrolling and the arrow keys do nothing, and the arrows beside the title hide. Close it with Back, a click beside it, Space or Escape.

## How it works

- **Artists.** Each artist is a folder in [`public/bands/`](public/bands/) with a `band.json` (name, optional logo, albums), a one-colour `logo.svg` where one exists, and the artwork. [`public/bands/index.json`](public/bands/index.json) lists the artists in order. [`src/band.ts`](src/band.ts) loads them and documents the shape.
- **Scene.** [`src/scene.ts`](src/scene.ts) builds a jewel case per album to real dimensions (142 × 125 × 10.4 mm): a clear lid with the booklet behind it, a clear base with the back insert folded into two spines, and a black tray holding the CD. The CD has a printed face from a scan, an iridescent data side and a clear hub. All visual and motion tuning lives in the `C` object at the top of the file.
- **Page.** [`src/main.tsx`](src/main.tsx) has the title screen, the gallery page (masthead, caption, bubble cursor, menu, loading screen) and the routing between them. Switching artist keeps the page and updates the URL, so the browser's back button works.

## Artwork

[`scripts/download-covers.sh`](scripts/download-covers.sh) fetches each album's front cover, disc scan and back insert from [MusicBrainz](https://musicbrainz.org/) and the [Cover Art Archive](https://coverartarchive.org/), and writes the paths into `band.json`. It needs `curl` and `jq`:

```bash
bash scripts/download-covers.sh rammstein            # every album
bash scripts/download-covers.sh rammstein mutter     # only the listed albums
```

By default the disc and back come from the earliest single-CD release that has both, so they show the same edition. An album's `musicbrainz` block can pin the edition (`release`), pick its back image (`backImage`), take the front from a specific release (`coverRelease`), keep one half of a back scan that shows a whole spread (`backHalf`), and name the booklet's back page (`bookletBack`). Albums without scans get generated artwork. Everything is stored locally, so the demo runs without network access.

The logos for Nirvana, The Prodigy, Rammstein and Crystal Castles are cleaned from Wikimedia Commons (public domain as simple text logos; they may be trademarked). The Knife never had one fixed logo; its mark is traced from a logo image on [TheAudioDB](https://www.theaudiodb.com/). Cover art and logos remain the property of their respective rights holders; this repository is a design and interaction experiment.

---

Made by [Dmytro Barylo](https://dmytrobarylo.com).
