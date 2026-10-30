# Project notes

Read `ROADMAP.md` first. It describes the current state, the design decisions from review (including
looks that were tried and rejected), how changes were verified, and the next phases.

- All visual and motion tuning lives in the `C` object at the top of `src/scene.ts`.
- Match real CD photos rather than stylised effects; check `ROADMAP.md` before reintroducing an
  effect listed as rejected.
- Update `ROADMAP.md` when a phase lands or a decision changes.
- The ten albums are final. Their data, including each edition's image sources and Apple IDs, is in
  `public/bands/favorites/band.json`; every album has a regression check in `scripts/check-<id>.mjs`.
