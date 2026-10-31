# Roadmap

What is still open on Discography, and the ideas that are not planned. What is built and the
decisions from review that later work must respect are in [DECISIONS.md](DECISIONS.md); how to run
the project, its layout, the data scripts and the checks are in [README.md](../README.md); the
booklet animation's implementation is in [BOOKLET_ANIMATION.md](BOOKLET_ANIMATION.md).

Keep this file to what is left: when an item lands, remove it here and record what was decided in
DECISIONS.md. The dated history of the work is in git (`ROADMAP.md` at commit `fe2455b` and
before, about 1,650 lines).

## Open

1. **Booklet motion sign-off.** Still marked "in review" when the log closed: the way out (two
   arcs, then round one cylinder), the landing and the lighting crossfade; the paper's
   show-through amount; and the single layout on phones, where the next page shows at the right
   edge under the current one. Review each on desktop and on a phone; once signed off, drop
   "in review" from section 5 of BOOKLET_ANIMATION.md and this item.
2. **Mobile loading.** Last measured at Lighthouse 12: 63 mobile, 98 desktop. The mobile score
   was held by the time to the reveal on its emulated 3G (LCP is the album title, which appears
   with the gallery) and by LeafThrough's start cost for ten booklets. LeafThrough 0.1.7 shipped
   the library-side items found while profiling (the paper grain drawn once and shared, the sheet
   geometry shared per layout and page aspect, a `Texture` passed as a page no longer uploaded a
   second time, page uploads spread over frames); the gallery runs on it since 31 October 2026 but
   has not been measured again. Re-run the Lighthouse and start-profile measurements (README,
   Checks), then see whether the gallery's own workarounds still earn their keep: the inside pages
   applied only at the landing (`pendingPages`), kept because the upload burst hitched the flight,
   and the grain generated in the worker and passed as `paper.grain`.
3. **Official shop links.** No album has a `buy` link; Buy the CD falls back to an Amazon search
   for the artist, title and CD. MusicBrainz has almost no shop links; pick them by hand if wanted.
4. **Loose ends in the code** (noted when the project moved to TypeScript, all still there): discs
   carry `hover`, `spinX`, `spinY`, `resetTween`, `placed` and the `Push` fields from when they
   were standalone, none of them read; `endPress` reads `this.cases[spinning]` without a guard;
   `destroy()` calls `setAlbums([])`, which reports `onProgress(0, 0)`.

## Known gaps

- "Lose It" (Feel It Break, track 2) has no preview: Apple's album listing omits it in every
  storefront checked (it was a free single of the week), so there is no track ID to fetch. Nothing
  to do unless Apple adds it; `check-album.mjs` skips tracks without an Apple ID.

## Ideas, not planned

- Clicking the spinning disc to pause.
- Clear trays (needs `Tray` scans or a generated inside of the insert).
- Glossier paper: LeafThrough `paper.roughness` 0.3 gave the curl a faint highlight and changed
  nothing else; a one-line option.
