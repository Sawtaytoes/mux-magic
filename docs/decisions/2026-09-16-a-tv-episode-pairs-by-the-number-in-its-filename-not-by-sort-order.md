# 2026-09-16 — A TV episode pairs by the number in its filename, not by sort order

- **Status:** Accepted
- **Date:** 2026-09-16
- **Type:** Behavior
- **Supersedes:** —
- **Superseded by:** —
- **Area:** core / api / cli
- **Source:** Flintstones ingest, 2026-09-16 (T3 Code chat `70f62c90-1a07-49de-afac-a60958f7c709`), PR #301

## Decision

`nameTvShowEpisodes` reads the season and episode number out of each filename
(`s01e06` or `1x06` by default, or the caller's `filenameRegex`) and pairs the file
with the TVDB episode carrying that number. A file whose filename names a **different
season** than the one being looked up is skipped with a log line, never renamed.
Natural-sort index pairing survives only as the fallback for a file that carries no
numbering at all, and `startEpisodeNumber` offsets that fallback.

This is the rule `nameAnimeEpisodesAniDB` already followed through
`pairEpisodeToFileIndex`; the TV command now follows it too.

## Context

A download's own ordering does not have to agree with TVDB, and in the general case
does not. Worse, a flat series folder sorts its `s00` specials **ahead** of season 1.

## Why

### What we rejected — DO NOT revert to this

`episodes.at(index)` over the natural-sorted file list as the only pairing rule.

Answering the TVDB prompt for season 1 against a folder holding specials plus season 1
renamed the first 28 specials into `s01e01`…`s01e28` — a pilot became "The Flintstone
Flyer" — while the real season 1 files kept their original names. Two files then claimed
the same episode and **no error was raised anywhere**.

Do not restore silent index pairing, and do not make the filename numbering opt-in
behind a flag. The safe default is the one that cannot quietly mis-map.

### Why it must not be re-litigated

Reversing the damage took a full positional audit of 28 files against the immutable
download. That audit only worked because 25 of the 28 were still byte-identical to
their originals; the mapping could be proven rather than guessed by luck.

## Evidence

The owner's correction, 2026-09-16: *"This is something we fixed for naming anime
episodes with anidb. We should probably fix that for TV Show episodes as well. Also
make sure the ordering is correct. The copy in Downloads/ doesn't always line up with
TVDB or TMDB."*

`packages/core/src/app-commands/nameTvShowEpisodes.test.ts` covers the
specials-sorted-first folder, out-of-order pairing, and the `1920x1080` false positive
the anchored patterns exclude.
