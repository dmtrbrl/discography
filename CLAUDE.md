# Project notes

Read `ROADMAP.md` first. It describes the current state, the design decisions from review (including
looks that were tried and rejected), how changes were verified, and the next phases.

- All visual and motion tuning lives in the `C` object at the top of `src/scene.ts`.
- Match real CD photos rather than stylised effects; check `ROADMAP.md` before reintroducing an
  effect listed as rejected.
- Update `ROADMAP.md` when a phase lands or a decision changes.

## Standing requirements for album and booklet work

Apply these whenever researching, adding, or replacing an album in the ten-album gallery.
The user's detailed research, edition references, and exclusions are in
`ARTIST_BOOKLET_HANDOFF.md`; record exact artwork provenance in `ARTWORK_SOURCES.md` and in
the album's `sources` metadata.

- Choose a documented **single-CD physical edition**. Its separate booklet must have
  **6–15 printed pages total, including front and back**; about 8–12 is preferred. Count
  printed pages, not scan files or spreads. Verify the booklet has turnable bound leaves,
  usually staples. Reject folded single sheets, posters, accordions, and booklets borrowed
  from multi-disc editions.
- Choose interiors with substantial photography, illustration, collage, or graphic design.
  A run of plain lyric or black pages is a poor fit. Popular artists from the 1980s onward
  are welcome; retain Nirvana when a qualifying edition is available, and consider Prodigy
  and Pixies among candidates.
- Prefer an **original digital booklet or publisher artwork** of the quality used for
  Coldplay's *X&Y*. Inspect the actual file and its pages before calling it digital art:
  a digital cover alone, a retailer's generated credits PDF, or a PDF made from scans does
  not establish native digital interiors. If using scans, use clean high-resolution files,
  identify them as scans, and explain any difference from the digital source preference.
- Reconstruct the **complete sequence for the chosen edition**, including its true first
  and last pages. Compare every spread with the source; do not count trays, case backs,
  duplicate covers, inserts, or CDs as booklet pages. Keep artwork crossing the spine
  aligned and uncropped, and preserve page proportions. If the digital booklet has different
  pagination from the printed one, label both counts and explain which the demo follows.
- Match the player's tracklist and artwork to the chosen one-CD edition. Keep Apple album
  and track IDs in the **same storefront**. Verify that previews actually load and advance
  for available songs, rather than checking IDs alone. Report songs for which Apple provides
  no preview. Check the booklet and playback on desktop and mobile before handing off.
