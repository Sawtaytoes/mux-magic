# 2026-06-30 — A special feature is never auto-named without a Plex `-<type>` suffix

- **Status:** Accepted
- **Date decided:** 2026-06-30 (chat session; formalizes long-standing intent)
- **Area:** core / web
- **Source:** chat session 2026-06-30 (Name Special Features Smart Match gallery naming); builds on [Plex extras suffix vocabulary](2023-07-31-plex-extras-suffix-vocabulary.md)

## Decision

When Name Special Features renames a file, **every special-feature file gets
exactly one Plex local-extras `-<type>` suffix** — one of:
`-behindthescenes`, `-deleted`, `-featurette`, `-interview`, `-scene`,
`-short`, `-trailer`, `-other` (plus `-teaser`). The suffix vocabulary is the
[2023-07-31 decision](2023-07-31-plex-extras-suffix-vocabulary.md); this
decision adds that the suffix is **mandatory**, never optional.

The **feature film itself** is the only file that may be named without an
extras suffix (it's `Title (Year)`, optionally with an `{edition-…}` tag).
Everything else is an extra and must carry a `-<type>`.

If a type cannot be determined automatically, the file is **not** auto-named
to a bare title. Instead it is surfaced to the user to classify — via the
Smart Match modal, which must let the user **pick from the Plex type list**
(the eight/nine types above) for any file whose type the parser couldn't
infer. `-other` is the correct catch-all when nothing more specific fits —
notably **image/photo galleries** (DVDCompare's `… (N images)` /
`… (N pages)` entries), which are always `-other`, never bare and never a
content-type suffix borrowed from their title words.

## What we rejected — DO NOT revert to this

- **Emitting a bare extra title with no suffix.** A leftover like
  `Film (26 images)` or `Poster Art (10 images)` renamed without `-other`
  produces a file Plex will not recognize as an extra — and worse, a
  suffix-less name is indistinguishable from main-feature/content naming, so
  a misclassified gallery can pollute the library as if it were a movie. The
  observed trigger: galleries surface through `parseUntimedSuggestions`
  (`parseSpecialFeatures.ts`) with `type: undefined`, and the suffix rules in
  `getSpecialFeatureFromTimecode.ts` only matched literal `image gallery` /
  `art gallery` / `stills` — not the `(N images)` form — so they fell through
  to a bare name.
- **Letting a title-word keyword override the gallery signal.** A gallery
  named `Behind-the-Scenes (21 images)` must be `-other`, NOT
  `-behindthescenes`: the `(N images)` marker means it's a photo gallery, not
  a behind-the-scenes video. Gallery detection takes precedence over the
  keyword→tag table for these entries.
- **Auto-naming an un-typeable file rather than asking.** If the parser can't
  determine a type, do not guess a bare name — surface a type picker. Silent
  bare-naming is the failure mode this decision exists to prevent.

## Why it must not be re-litigated

The suffix is an external contract with Plex (see the vocabulary decision),
and a missing suffix is a silent, user-visible library regression: Plex stops
recognizing the file as an extra, and a suffix-less file name can be
misread as primary content. The cost of a wrong/absent tag is paid in the
user's actual media library, with no error surfaced — exactly the kind of
quiet regression the decision log exists to stop. If you believe a file
should ever be auto-named without a `-<type>`, write a new dated file that
supersedes this one and get the user's sign-off first.
