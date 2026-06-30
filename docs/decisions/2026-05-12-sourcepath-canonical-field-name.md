# 2026-05-12 — `sourcePath` is the canonical primary-input field name

- **Status:** Accepted
- **Date decided:** 2026-05-12 (open-questions resolution `bfbfc7db`); implemented in worker 24
- **Area:** core
- **Source:** worker 24 (`source-path-abstraction`); memory `project_source_path_canonical.md`

## Decision

Every command's primary input-directory field is named **`sourcePath`** internally, with the user-facing label **"Source Path"**. The constants live in `packages/tools/src/sourcePath.ts` and are re-exported from `@mux-magic/tools`. Old YAML keeps loading via a read-time `legacyFieldRenames` map.

## What we rejected — DO NOT revert to this

- Do not invent a "more descriptive" per-command input name. Pre-worker-24 the field had drifted across `sourceFilesPath`, `mediaFilesPath`, `folderPath`, `filePath`, and `sourcePath`; that drift was unified on purpose. A new command must use `sourcePath`, not a new synonym.
- The one deliberate exception, `deleteCopiedOriginals.pathsToDelete`, must **not** be "normalized" to `sourcePath` — it is a list of targets, not a single source.

## Why it must not be re-litigated

The whole point of worker 24 was to stop the per-command naming drift that made sequences and link-resolution inconsistent. Re-introducing a bespoke input name re-opens that drift and breaks the shared `wrapAsSourcePath` / link machinery that assumes the canonical name.
