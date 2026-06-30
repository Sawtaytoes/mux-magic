# 2026-05-14 — `copyFiles`/`moveFiles` are generalized; no per-media-type commands

- **Status:** Accepted
- **Date decided:** 2026-05-14
- **Area:** core
- **Source:** worker 1f; memory `project_copy_sync_design.md`

## Decision

File movement is handled by **generalized** `copyFiles` / `moveFiles` commands driven by regex knobs (`fileFilterRegex`, `folderFilterRegex`, `isIncludingFolders`, `renameRegex`) plus `deleteCopiedOriginals`. Media-type semantics (anime, manga, …) live in **YAML sequences**, not in command code. `copyFiles` emits `{ source, destination }` records.

## What we rejected — DO NOT revert to this

Do not add media-type-specific commands like `copyAnime`, `copyManga`, or `cleanupOriginalsIfSucceeded`. Those were the original shape and were rejected in favor of regex-driven generality. If a request comes in for "an anime copy command," the answer is a configured `copyFiles` step in a sequence (or a `forEachTemplate`/`forEachFolder` group), **not** a new typed command.

## Why it must not be re-litigated

Per-media-type commands multiply the command surface for what is one parameterized operation, and they bypass the five-wiring-surfaces cost for no benefit. The generalized knobs already cover the cases. (A future "destination-as-source-of-truth" sync mode is filed as a direction, not yet built — that's the only sanctioned extension here.)
