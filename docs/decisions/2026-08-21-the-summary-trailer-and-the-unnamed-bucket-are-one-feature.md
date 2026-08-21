# 2026-08-21 — The summary trailer and the UNNAMED-FEATURES/ bucket are one feature

- **Status:** Accepted
- **Date decided:** 2026-08-21
- **Area:** core / web
- **Supersedes:** [2026-08-21-nsf-siblings-emit-the-same-summary-trailer](2026-08-21-nsf-siblings-emit-the-same-summary-trailer.md)
- **Source:** PR #244, correcting PR #238 (owner: *"They should be bucketed"*)

## Decision

An NSF-family command that emits the summary trailer **must also move its
leftovers into `<sourcePath>/UNNAMED-FEATURES/`**. The two are a single
feature and neither ships alone.

The reason is not symmetry, it is a hard coupling in the UI: `SmartMatchModal`
builds its rename `oldPath` — and its video-preview path — as
`<sourcePath>/UNNAMED-FEATURES/<filename><extension>` via
`buildBucketOldPath`, at every call site, with **no command-name branch and no
fallback to `sourcePath`**. A command that reports leftovers without bucketing
them therefore renders a ✨ Fix Unnamed button whose Apply fails `ENOENT` on
every row and whose preview 404s.

Bucketing carries two obligations that are easy to miss:

- **Read the bucket back before moving this run's leftovers in.** The
  top-level enumeration (`getFilesAtDepth({ depth: 0 })`) is files-only and
  never recurses into the bucket, so a prior run's leftovers vanish from the
  report — and Smart Match never reopens on them — without an explicit
  `readBucketUnrenamedFiles`. Read first, move second, or the two sets
  double-count.
- **Duplicate-prompt losers are leftovers.** They are unnamed files the user
  still has to deal with; leaving them loose and unreported means the only way
  to find them is to browse the disc folder.

## What we rejected — DO NOT revert to this

**"The trailer is a reporting contract, not a filesystem one."** That sentence
was in the superseded decision and it shipped a button that could not work.
Do not reason about the trailer as though the UI will rename files wherever it
finds them — it will not look in `sourcePath`, it looks in the bucket and only
in the bucket.

Also rejected: keeping "skip-in-place" as a per-command filesystem style. The
narrow no-TMDB sibling was specced that way in
[worker 34](../workers/34_onlyNameSpecialFeaturesDvdCompare-new-command.md);
once it reports leftovers to the UI, skip-in-place is no longer available to it.

## Why it must not be re-litigated

The failure is invisible in review and in the type system. The trailer
type-checks, the button renders, the Storybook story looks correct, and the
break only appears when a real user clicks Apply on a real disc folder — which
is exactly how it reached `master` in #238. The regression test in
`onlyNameSpecialFeaturesDvdCompare.test.ts` asserts the exact path
`SmartMatchModal` constructs, so the two sides cannot drift apart silently
again; keep that assertion pinned to the modal's format rather than loosening
it to "somewhere under sourcePath".
