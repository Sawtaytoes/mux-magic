# 2026-05-20 — Recursion depth defaults: 1 in general, 2 for deleteFilesByExtension

- **Status:** Accepted. `deleteFilesByExtension` is currently regressed to 1 in code — **fix needed** (restore 2; see below).
- **Date decided:** 2026-05-20 (general convention); `deleteFilesByExtension` exception confirmed by the user 2026-06-30
- **Area:** core / server/api
- **Source:** schema descriptions in `packages/api/src/api/schemas.ts`; user confirmation 2026-06-30
- *(Filename keeps the original `-is-1` slug for link stability; the title above is authoritative.)*

## Decision

Commands with `isRecursive` + `recursiveDepth` use `recursiveDepth: 0` to mean "use the default." `getFilesAtDepth` semantics: depth N = files in `sourcePath` **plus** N levels of subdirectories (so depth 2 reaches `root/<a>/<b>/file`).

- **Default 1 — general** (`convertLosslessToFlac`, `modifySubtitleMetadata`, `getSubtitleMetadata`): descend one level. Confirmed fine by the user.
- **Default 2 — `deleteFilesByExtension`** (special case): it is typically pointed at a folder **one level above** the per-episode directories — e.g. a library/show root, where extracted subtitles live at `…/<show> - s01e01 - <name>/track2.eng.srt`, **two** levels below where the user runs the command. To wipe every `.srt`, the walk must descend two levels, so the useful default is 2. v1.0.0 correctly defaulted to 2.

## What we rejected — DO NOT revert to this

- Do **not** leave `deleteFilesByExtension`'s default at 1. The current code (`recursiveDepth || 1`, `deleteFilesByExtension.ts:38`) and its schema doc ("0 = default depth of 1", `schemas.ts:639`) are a **regression** from v1.0.0's 2 — they silently leave the subtitles two levels down in place. Both code and doc were changed to 1 together, which made the regression *look* intentional; an earlier audit and an earlier version of this very record were fooled by that agreement. The user confirmed 2 is correct (2026-06-30).
- Do **not** blanket-restore depth 2 for the *other* recursive commands from a v1.0.0 diff — their default of 1 is intended.

## Fix needed (tracked in the fix handoff)

- `deleteFilesByExtension.ts`: `recursiveDepth || 1` → `recursiveDepth || 2`.
- `schemas.ts:639`: "0 = default depth of 1" → "0 = default depth of 2".
- Update the sibling schemas' "mirrors deleteFilesByExtension" wording (e.g. `schemas.ts:261, 361`) so they no longer claim to mirror a value that differs.
- **Open question:** `modifySubtitleMetadata` / `getSubtitleMetadata` also target subtitle files — do they have the same per-episode nesting and therefore also want a default of 2? The user pointed only at `deleteFilesByExtension`; confirm before changing them.

## Why it must not be re-litigated

This exact value got flipped once already (2→1) with code + docs changed together, so it reads as deliberate to anyone who doesn't know the subtitle-cleanup use case. The split is: **general 1, `deleteFilesByExtension` 2.** If another recursive command genuinely needs a deeper default, that's a per-command decision made explicitly — never a blanket revert in either direction.
