# Project notes

Read `specs/DECISIONS.md` first: what is built and the design decisions from review (including
looks that were tried and rejected, and the known gaps and ideas not planned at the end; nothing
is open, the project is complete). `README.md` has how to run the project, its layout, the data scripts and the checks;
`specs/BOOKLET_ANIMATION.md` is the booklet animation's implementation reference.

- All visual and motion tuning lives in the `C` object at the top of `src/scene.ts`.
- Match real CD photos rather than stylised effects; check `specs/DECISIONS.md` before
  reintroducing an effect listed as rejected.
- When something lands or a decision changes, update the section it belongs to in
  `specs/DECISIONS.md`; the dated history lives in git, not in the files. How-to material goes in
  `README.md`.
- The ten albums are final. Their data, including each edition's image sources and the Apple and
  Spotify IDs, is in `public/albums/collection.json`; each album's artwork is in
  `public/albums/<id>/`; `scripts/check-album.mjs` checks any album end to end against the data.
