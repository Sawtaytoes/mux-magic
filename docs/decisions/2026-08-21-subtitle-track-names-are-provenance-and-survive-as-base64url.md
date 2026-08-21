# 2026-08-21 — Subtitle track names are provenance and survive extraction as base64url

- **Status:** Accepted
- **Date decided:** 2026-08-21
- **Area:** core
- **Source:** chat session with the owner, 2026-08-21; measured against his 9,634-file anime library

## Decision

A subtitle track's name is **provenance** — it records the release group, the
track's role, and whether the owner edited it. Extraction and merging must
preserve it.

1. `extractSubtitles` reads `track_name` from the source, normalizes it, and
   encodes it into the extracted filename as **base64url**:
   `<video>.track<N>.<lang>.name-<base64url>.<ext>`. The segment is omitted
   when the source track has no name.
2. `mergeSubtitlesMkvMerge` decodes that segment and emits
   `--track-name 0:<name>` immediately before the subtitle file it applies to.
3. Names are normalized to one canonical shape, so no judgement is ever needed
   again:

   ```
   <Role>[ (<Qualifier>)][ [<Group>]][ (edited by Sawtaytoes)]
   ```

   The edit marker **keeps every editor already credited in the source name** and
   appends new ones: `Full Subtitles [Chihiro (ed. Kametsu)]` becomes
   `Full Subtitles [Chihiro] (edited by Kametsu)`, and the owner is added later as
   `(edited by Kametsu and Sawtaytoes)`. An edit with no named editor is `(edited)`.

   Roles are exactly `Full Subtitles`, `Signs & Songs`, `Forced`, `Commentary`.
   Everything else is regexed into one of them — `Dialogue`, `English`, `Full`,
   `Stylized Subtitles` and `Main` all become `Full Subtitles`; `Signs/Songs`,
   `S&S`, `Sign&Songs` and `Songs/Titles/NEPs` all become `Signs & Songs`.

## What we rejected — DO NOT revert to this

**Do not put the raw track name in the filename.** That is what the owner tried
before, and it is why the names were removed again: the names are not
valid filenames. Measured against his library, **67 of the 262 distinct
surviving names — 1,145 tracks, 24% of every named track — contain a character
Windows forbids in a filename**, nearly all of them `/`:

```
Stylized Subtitles [iKaos/corre/moi15moi]      Signs/Songs/NEPs [iKaos/corre/moi15moi]
Signs/Songs                                     Songs/Titles/NEPs [iKaos/corre]
VobSub: Signs                                   ASS / Forced
```

**Do not use standard base64 either.** Its alphabet contains `/`, so it
reintroduces the exact bug. base64url (`-` and `_`, no padding) is the only safe
encoding here. This is not a stylistic preference.

**Do not drop the name silently, which is what the code did before this.**
`ExtractSubtitleTrack` had no title field at all and
`mergeSubtitlesMkvMerge` never emitted `--track-name`, so every ingest quietly
destroyed the record of which group the subtitles came from.

**Do not "simplify" the normalizer back to passing the raw name through.** The
whole point is that the owner never has to judge a name again.

**Do not append the owner to a name just because it says "modified".** Normalizing
records only editors the *name* credits. That the **owner** edited a track is not
provable from the name — it is proved by comparing the track against the source
release. `addEditorToTrackName` is deliberately a separate call for that reason.
Blindly appending him would claim edits he never made on releases he only downloaded.

**Do not read `(X modified)` as always naming an editor.** It is ambiguous.
`Commie (BSEnc modified)` means BSEnc edited Commie's subs, but
`Signs & Songs (Steins;Sub modified)` means Steins;Sub's subs were modified by someone
unrecorded — X is the *group*. X is the editor only when a group is named elsewhere.
Adverbs are filtered too: `R1 (Heavily modified) [Judgement]` credits nobody.

## Why it must not be re-litigated

This silently destroyed provenance across an entire library. Measured on the
owner's `Family/Anime` and `Family/Shows`: **10,359 of 15,135 subtitle tracks —
68.4%, across 9,634 files — have an empty track name.** There is no way to tell
from those files which group produced the subtitles, or which ones the owner
edited himself.

Recovering them is only possible while the original downloads still exist, and
that recovery is a prerequisite for a 75 TiB cleanup that is otherwise blocked.
Every ingest run before this fix made the problem bigger.

The canonical format is the owner's own choice, made explicitly: role first,
group in brackets, `Full Subtitles` / `Signs & Songs` as the role words, and
`(edited by Sawtaytoes)` as the edited marker.
