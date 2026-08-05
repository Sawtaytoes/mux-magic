# 2026-08-05 — `keepLanguages` never emits a zero-audio file

- **Status:** Accepted
- **Date decided:** 2026-08-05
- **Area:** core
- **Source:** chat session (Reservoir Dogs ingest + movie-ingest runbook; owner: "the biggest issue I've run into doing this manually is accidentally removing the wrong audio tracks — we don't wanna wind up with media that has no audio")

## Decision

`keepSpecifiedLanguageTracks` (the mkvmerge choke point behind `keepLanguages`)
probes the source with `mkvmerge --identify` first. If filtering to the
requested audio languages would strip **every** audio track — including
`und`/missing-language tracks that `getTrackLanguages` (MediaInfo) drops from
language accounting — it **omits `--audio-tracks` entirely and keeps all
original audio**, logging a warning. A post-write assertion re-probes the
output and, if a file that had audio came out silent, **deletes the output and
fails that file** rather than leaving it on disk. A trim that would produce a
silent file is never a valid outcome.

## What we rejected — DO NOT revert to this

- Passing `--audio-tracks <langs>` straight to mkvmerge with no check on
  whether any audio track survives. That is what silently produced silent
  files: an English-native disc's French/Italian featurette (or a track with a
  missing language tag) trimmed to `eng` came out with **zero** audio, and the
  mkvmerge error was swallowed (`logAndSwallowPipelineError`), so nothing
  surfaced. Do **not** remove the `getMkvInfo` pre-check or the post-write
  audio-count assertion, and do **not** rely on MediaInfo/`getTrackLanguages`
  alone to decide what audio exists — it omits language-less tracks.

## Why it must not be re-litigated

This closes a real, repeated data-quality failure the owner hits by hand across
a large special-features backlog: media landing in the library with no audio.
The guard is cheap (two extra `--identify` calls per file) and the correctness
guarantee — "an audio-bearing source never yields a silent trim" — is worth far
more than the probe cost. If the matching logic ever needs to change, keep the
invariant: **the output must retain at least one audio track whenever the source
had one.**
