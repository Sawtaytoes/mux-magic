# 2026-08-21 — Every NSF-family command emits the same summary trailer

> [!WARNING]
> **SUPERSEDED on 2026-08-21 by [the trailer and the UNNAMED-FEATURES/ bucket are one feature](2026-08-21-the-summary-trailer-and-the-unnamed-bucket-are-one-feature.md).**
> This used to be the decision. It is kept for history — do NOT implement what's
> below. The paragraph claiming the trailer is "a reporting contract, not a
> filesystem one" is wrong and shipped a broken button: Smart Match builds its
> rename path against `UNNAMED-FEATURES/` unconditionally, so a command that
> emits the trailer must also bucket. Everything else in this file still holds.

- **Status:** Superseded by [2026-08-21-the-summary-trailer-and-the-unnamed-bucket-are-one-feature](2026-08-21-the-summary-trailer-and-the-unnamed-bucket-are-one-feature.md)
- **Date decided:** 2026-08-21
- **Area:** core / web
- **Source:** PR #238 (owner report: "'fix unnamed' is not available for the second option in that dropdown. I dunno why.")

## Decision

Every command in the Name Special Features family emits the same trailing
summary record — `{ unrenamedFilenames, possibleNames, allKnownNames,
unnamedFileCandidates }` — as its last event, whether or not it does a TMDB
lookup. The web identifies that record **structurally** (`isNsfSummary` in
`findNsfResults.ts`: an `unrenamedFilenames` array plus a `possibleNames`
array), never by command name, so matching the shape is the entire contract
for getting the leftover-files block and the ✨ Fix Unnamed (Smart Match)
button. A new sibling that skips the trailer silently ships without Smart
Match.

The trailer is a **reporting** contract, not a filesystem one. Emitting it
does not commit a command to the TMDB sibling's `UNNAMED-FEATURES/`
bucketing: `onlyNameSpecialFeaturesDvdCompare` leaves leftovers in
`sourcePath` and Smart Match renames them where they sit.

A command whose output `NsfRunResults` renders must also be listed in
`SPECIALIZED_RENDERER_COMMANDS` (`GenericRunResults.tsx`), or its renames
are shown twice — once by the NSF panel, once by the generic accordion.

## What we rejected — DO NOT revert to this

**Skip-with-log as the whole UX for unmatched files.**
[Worker 34](../workers/34_onlyNameSpecialFeaturesDvdCompare-new-command.md)
specced the no-TMDB sibling with *"`unnamed/` — replaced by skip-with-log for
unmatched files"* and *"No summary trailer, no unnamed-file-candidate set."*
That is now wrong and the worker spec is stale on this point. Do not drop the
trailer from a narrow-scope sibling on the reasoning that Smart Match belongs
to "the bigger command" — the DVDCompare candidate list has already been
scraped by the time files come out unmatched, and throwing it away is what
left the user with four unnameable files and no button.

Also rejected: gating `NsfRunResults` on a command-name allowlist. The
structural check is what let this fix land with zero UI changes.

## Why it must not be re-litigated

The no-TMDB variant exists for concerts, documentaries and miniseries extras
— exactly the discs where DVDCompare timecodes drift and files land
unmatched. It was the variant that most needed Smart Match and the only one
that didn't have it, for eight weeks, with no signal in the UI as to why.
