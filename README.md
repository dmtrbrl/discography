# Discography

An experiment in browsing music as physical CDs: each album in its plastic jewel case, with the booklet folded inside.

**[Open Discography](https://dmtrbrl.github.io/discography/)**

Flick through a row of favorite albums, turn a case over to read its back and spines, open it, leaf through the booklet, and put the disc on a CD player to hear 30-second song previews.

## The idea

Streaming made albums into a square thumbnail. A CD was an object: a case that clicked open, a disc with its own printed face, a booklet with lyrics and photos to read while the music played. Discography tries to bring that back on a screen, so an album is something you pick up and handle rather than a link.

Everything is drawn in the browser with three.js from the real artwork: official covers, scans of the printed discs, back inserts and booklets of actual CD editions. The plastic, its scratches and the sheen of the discs were tuned against photos of real CDs rather than made to look stylised. The booklets turn with [LeafThrough](https://github.com/dmtrbrl/leafthrough), a library for flipping through pages on the web.

## Sources

Disc, back insert and booklet scans come from the community-run [Cover Art Archive](https://coverartarchive.org/) and [MusicBrainz](https://musicbrainz.org/); the exact edition and image used for each album are recorded in its `sources` entry in `public/albums/collection.json`. Covers and song previews come from Apple Music.

Cover art, booklet scans, disc designs, and logos belong to their respective rights holders.

The type is DM Sans, DM Mono and Instrument Serif, served from the page under the SIL Open Font License (see `public/fonts/`).
