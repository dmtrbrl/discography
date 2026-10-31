# Project notes

Read `ROADMAP.md` first: the current state, what is open, and the design decisions from review
(including looks that were tried and rejected). `README.md` has how to run the project, its layout,
the data scripts and the checks; `BOOKLET_ANIMATION.md` is the booklet animation's implementation
reference.

- All visual and motion tuning lives in the `C` object at the top of `src/scene.ts`.
- Match real CD photos rather than stylised effects; check the decisions in `ROADMAP.md` before
  reintroducing an effect listed as rejected.
- Update `ROADMAP.md` when something lands or a decision changes, in the section it belongs to; the
  dated history lives in git, not in the file. How-to material goes in `README.md`.
- The ten albums are final. Their data, including each edition's image sources and the Apple and
  Spotify IDs, is in `public/albums/collection.json`; each album's artwork is in
  `public/albums/<id>/`; the albums have regression checks in `scripts/check-<id>.mjs` (Mutter's
  is still to write).
