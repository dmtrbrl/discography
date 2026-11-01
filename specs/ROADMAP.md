# Roadmap

What is still open on Discography, and the ideas that are not planned. What is built and the
decisions from review that later work must respect are in [DECISIONS.md](DECISIONS.md); how to run
the project, its layout, the data scripts and the checks are in [README.md](../README.md); the
booklet animation's implementation is in [BOOKLET_ANIMATION.md](BOOKLET_ANIMATION.md).

Keep this file to what is left: when an item lands, remove it here and record what was decided in
DECISIONS.md. The dated history of the work is in git (`ROADMAP.md` at commit `fe2455b` and
before, about 1,650 lines).

## Open

Nothing: the project is complete (1 November 2026). The known gaps and the ideas not planned
stay below for reference.

## Known gaps

- "Lose It" (Feel It Break, track 2) has no preview: Apple's album listing omits it in every
  storefront checked (it was a free single of the week), so there is no track ID to fetch. Nothing
  to do unless Apple adds it; `check-album.mjs` skips tracks without an Apple ID.

## Ideas, not planned

- Clicking the spinning disc to pause.
- Clear trays (needs `Tray` scans or a generated inside of the insert).
- Glossier paper: LeafThrough `paper.roughness` 0.3 gave the curl a faint highlight and changed
  nothing else; a one-line option.
