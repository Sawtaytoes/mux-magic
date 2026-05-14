# Worker 40 — file-organization-commands

**Model:** Sonnet · **Thinking:** ON · **Effort:** Medium
**Branch:** `feat/mux-magic-revamp/40-file-organization-commands`
**Worktree:** `.claude/worktrees/40_file-organization-commands/`
**Phase:** 4
**Depends on:** 20
**Parallel with:** any Phase 4 worker that doesn't touch `packages/cli/src/cli.ts`, `packages/server/src/api/routes/commandRoutes.ts`, or `packages/server/src/api/schemas.ts`

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Yarn only. See [AGENTS.md](../../AGENTS.md).

## Your Mission

Add three filesystem-housekeeping commands to Mux-Magic, ported from PowerShell scripts the user runs by hand during disc-rip workflows. After this worker, all three can run from the CLI, from the web builder, and inside chained sequences — the user no longer has to drop out to PowerShell mid-workflow, and the operations are portable (Linux / CI / Docker).

The repo already has every supporting piece needed (`getFiles`, `getFolder`, `aclSafeCopyFile`, `renameFileOrFolder`, `runTasks`, `createProgressEmitter`, AbortController plumbing). Each command is a thin assembly of existing primitives — do not invent new utilities.

### Original PowerShell scripts (reference only — do not commit)

```ps1
# Script 1 — Foldarize
$sourceDir = "G:\Disc-Rips\Casper - 4K"
Get-ChildItem -Path $sourceDir -File | ForEach-Object {
  $fileNameWithoutExtension = [System.IO.Path]::GetFileNameWithoutExtension($_.Name)
  $subDir = Join-Path -Path $sourceDir -ChildPath $fileNameWithoutExtension
  if (-not (Test-Path -Path $subDir)) { New-Item -Path $subDir -ItemType Directory | Out-Null }
  Move-Item -Path $_.FullName -Destination $subDir
}

# Script 2 — Distribute attachments
$source = ".\attachments"
Get-ChildItem -Directory | Where-Object { $_.Name -ne "attachments" } | ForEach-Object {
    Copy-Item -Path $source -Destination $_.FullName -Recurse
}
Remove-Item -Path $source -Recurse -Force

# Script 3 — Flatten children to parent
$sourceDir = "G:\Disc-Rips\Disney Shorts"
Get-ChildItem -Path $sourceDir -Directory | ForEach-Object {
    Get-ChildItem -Path $_.FullName -File | Move-Item -Destination $sourceDir
}
```

### Commands to add

All three are camelCase, follow the existing `flattenOutput` / `moveFiles` Observable pattern, and live as app-commands in `packages/server/src/app-commands/` with thin yargs adapters in `packages/cli/src/cli-commands/`.

#### 1. `moveFilesIntoNamedFolders`

- **CLI**: `mux-magic moveFilesIntoNamedFolders <sourcePath>`
- **What**: For each file in `sourcePath`, create a subdirectory named after the file's basename (extension stripped) and move the file into it. `Casper.mkv` → `Casper/Casper.mkv`.
- **Edge cases**: skips entries that are already directories (rely on `getFiles` which filters via `filterFileAtPath`). Files with no extension → folder name equals the full filename.
- **Mechanism**: `fs.rename` via [createRenameFileOrFolder.ts:19-42](../../packages/tools/src/createRenameFileOrFolder.ts#L19-L42) — source and destination always share a parent dir, so same-volume by construction. Atomic metadata op, near-instant even for 50GB MKVs.
- **Emits**: `Observable<{ source: string; destination: string }>`, one record per file.
- **Flags**: none.

#### 2. `distributeFolderToSiblings`

- **CLI**: `mux-magic distributeFolderToSiblings [sourceFolderPath]`
- **What**: Copies the folder at `sourceFolderPath` into every sibling directory of its parent. The `attachments` folder is the canonical use case.
- **Positional default**: `sourceFolderPath` defaults to `./attachments` (yargs `default: "./attachments"`, **not** `demandOption: true`) so the canonical workflow `cd into-show-dir && mux-magic distributeFolderToSiblings` just works. The command remains fully generic — any path can be passed explicitly.
- **Flag**:
  - CLI: `--deleteSourceFolderAfterDistributing` (boolean, default `false`)
  - JS: `isDeletingSourceFolderAfterDistributing: boolean` (default `false`)
  - When `true`, removes `sourceFolderPath` after all copies succeed. Defaults to `false` so the destructive step is opt-in.
- **Mechanism**: list parent's children with `getFolder`, filter out `sourceFolderPath` itself, then for each sibling recursively copy contents. Reuse `aclSafeCopyFile` + `runTasks` + progress-emitter pattern from [moveFiles.ts](../../packages/server/src/app-commands/moveFiles.ts) and [copyFiles.ts](../../packages/server/src/app-commands/copyFiles.ts). Sibling directories may live on other volumes, so the byte-copying path is required.
- **Emits**: `Observable<{ source: string; destination: string }>`, one record per file copied across all siblings.

#### 3. `flattenChildFolders`

- **CLI**: `mux-magic flattenChildFolders <parentPath>`
- **What**: For each immediate child directory of `parentPath`, move all of its files up to `parentPath`. Distinct from existing `flattenOutput`, which operates on a single folder and moves its contents one level up — this command iterates over every child instead.
- **Flag**:
  - CLI: `--deleteEmptyChildFoldersAfterFlattening` (boolean, default `false`)
  - JS: `isDeletingEmptyChildFoldersAfterFlattening: boolean` (default `false`)
  - When `true`, removes the (now-empty) child directories after the moves complete. Defaults to `false` so the empties are preserved for inspection — same precedent as `flattenOutput`'s `isDeletingSourceFolder`.
- **Mechanism**: enumerate child dirs with `getFolder`, then for each child enumerate files with `getFiles` and rename each into `parentPath` via `FileInfo.renameFile`. Same-volume guaranteed.
- **Emits**: `Observable<{ source: string; destination: string }>`, one record per file moved.

## Files

### New

- `packages/server/src/app-commands/moveFilesIntoNamedFolders.ts`
- `packages/server/src/app-commands/moveFilesIntoNamedFolders.test.ts`
- `packages/server/src/app-commands/distributeFolderToSiblings.ts`
- `packages/server/src/app-commands/distributeFolderToSiblings.test.ts`
- `packages/server/src/app-commands/flattenChildFolders.ts`
- `packages/server/src/app-commands/flattenChildFolders.test.ts`
- `packages/cli/src/cli-commands/moveFilesIntoNamedFoldersCommand.ts`
- `packages/cli/src/cli-commands/distributeFolderToSiblingsCommand.ts`
- `packages/cli/src/cli-commands/flattenChildFoldersCommand.ts`

### Modified

- `packages/cli/src/cli.ts` — register the three new yargs `CommandModule`s alongside `copyFilesCommand`, `moveFilesCommand`, `flattenOutputCommand`.
- `packages/server/src/api/routes/commandRoutes.ts` — three imports (top, ~L22), three names in the command-name list (~L122), and three registry entries with `getObservable`, `schema`, `summary`, `tags: ["File Operations"]` mirroring the `flattenOutput` (L233) and `moveFiles` (L459) entries.
- `packages/server/src/api/schemas.ts` — three Zod request schemas mirroring `flattenOutputRequestSchema` and `moveFilesRequestSchema`.
- `packages/web/public/command-descriptions.js` — three new descriptions (or regenerate via `yarn build:command-descriptions` if available; otherwise hand-edit following the pattern at L36, L44, L256).
- `docs/workers/MANIFEST.md` — flip this worker's row to `in-progress` at start, `done` after PR merge.

### Pattern templates to mirror line-for-line

- App-command structure & AbortController wrap → [flattenOutput.ts:41-176](../../packages/server/src/app-commands/flattenOutput.ts#L41-L176)
- App-command with `{ source, destination }` records + per-file `runTasks` → [moveFiles.ts:43-207](../../packages/server/src/app-commands/moveFiles.ts#L43-L207)
- CLI adapter shape (positional + option + handler + `InferArgvOptions`) → [flattenOutputCommand.ts](../../packages/cli/src/cli-commands/flattenOutputCommand.ts)
- HTTP route registration → [commandRoutes.ts:233-245](../../packages/server/src/api/routes/commandRoutes.ts#L233-L245) (`flattenOutput` entry)

### Building blocks to reuse (do NOT recreate)

From `@mux-magic/tools`:
- `getFiles({ sourcePath })` — files-only iteration with `FileInfo.renameFile` already attached
- `getFolder(...)` / `listDirectoryEntries(...)` — for child-directory enumeration
- `aclSafeCopyFile(source, destination, { signal, onProgress })` — for `distributeFolderToSiblings`
- `makeDirectory(path)` — for creating target dirs in distribute
- `renameFileOrFolder` / `createRenameFileOrFolderObservable` — fs.rename wrapper (already used by `FileInfo.renameFile`)
- `logInfo`, `logAndRethrowPipelineError`

From `packages/server/src/tools/`:
- `runTasks` (taskScheduler) — for `distributeFolderToSiblings`'s per-file concurrency
- `createProgressEmitter(jobId, { totalFiles, totalBytes })` — progress events for the web UI
- `getActiveJobId` — null in CLI mode, set in HTTP mode; gates the conditional emitter setup
- `subscribeCli()` — used in CLI handlers

## Implementation notes

- **Code rules** (enforced by lint — see `docs/agents/code-rules.md`): no `for`/`while` loops, no `let` reassignment, full variable names, booleans prefixed with `is`/`has`, always-braced `if`/`else`, single-destructured-object function params (when 2+ args), arrow functions with implicit returns. Match the style in `flattenOutput.ts` / `moveFiles.ts` exactly.
- **Renames vs. copies**: scripts #1 and #3 use `renameFileOrFolder` (atomic, same-volume). Script #2 uses `aclSafeCopyFile` (sibling dirs may live on other mounts).
- **AbortController**: wrap each command's inner pipeline in `new Observable((subscriber) => { const abortController = new AbortController(); ... return () => { abortController.abort(); innerSubscription.unsubscribe() } })`. Required for sequence-cancel / parallel-sibling fail-fast — same pattern as `flattenOutput`.
- **Progress emitter**: gate on `getActiveJobId()` (null in CLI mode, set in HTTP mode). Same conditional setup pattern as `moveFiles.ts:76-97`.
- **HTTP `tags`**: use `["File Operations"]` for all three — same bucket as `copyFiles`, `moveFiles`, `flattenOutput`.

## TDD steps

For each command, write failing tests first, then implement.

Test runner: vitest. Filesystem: `memfs` via `vol.fromJSON` + `vol.reset()` in `beforeEach`. Pattern reference: [copyFiles.test.ts](../../packages/server/src/app-commands/copyFiles.test.ts).

Per-command coverage:
- **`moveFilesIntoNamedFolders`**
  - Golden path: directory of files → each ends up under same-named subfolder; emitted records correct.
  - Skip pre-existing directories: directory mixed with files; directories untouched.
  - File with no extension: folder name equals full filename.
  - Empty source dir: no emissions, no crash.
- **`distributeFolderToSiblings`**
  - Golden path: source folder copied recursively into every sibling.
  - Source folder itself is skipped (not copied into itself).
  - Default flag → source preserved; flag on → source removed.
  - No siblings: completes with no emissions, no crash.
  - Nested files inside source are copied correctly (recursion verified).
- **`flattenChildFolders`**
  - Golden path: every immediate child's files moved up to parent; records correct.
  - Files already at parent level untouched.
  - Default flag → empty child dirs preserved; flag on → removed.
  - Does not recurse into grandchildren (only immediate child dirs are processed).
  - Empty parent: no emissions, no crash.

Assertion pattern: `firstValueFrom(command(...).pipe(toArray()))` for emission lists, plus `vol.toJSON()` for final filesystem state.

## Verification checklist

- [ ] Worktree created at `.claude/worktrees/40_file-organization-commands/`
- [ ] Manifest row → `in-progress`
- [ ] Failing tests written first (per command, per case)
- [ ] All three app-commands implemented and tests green
- [ ] All three CLI adapters implemented; registered in `cli.ts`
- [ ] HTTP routes registered in `commandRoutes.ts` with Zod schemas in `schemas.ts`
- [ ] `command-descriptions.js` updated (or regenerated) so the web UI lists all three
- [ ] Manual CLI smoke against a throwaway scratch dir for all three commands
- [ ] Web UI smoke: server runs, Commands sidebar shows all three under "File Operations"
- [ ] Standard pre-merge gate clean: `yarn lint → typecheck → test → e2e → lint`
- [ ] PR opened against `feat/mux-magic-revamp`
- [ ] Manifest row → `done`

## Out of scope

- Optimizing the existing `moveFiles` command to use `fs.rename` for same-volume moves — a separate worker if desired; do not bundle.
- Adding a `--dry-run` flag — the repo's safety convention is opt-in destructive flags (already done here), not dry-run.
- Adding a `--fileFilterRegex` flag to `moveFilesIntoNamedFolders` — considered and explicitly rejected; basename-only is the chosen design.
- Refactoring `flattenOutput` to share a helper with `flattenChildFolders`. Duplicate the per-file copy pipeline in-place; defer DRY-up to a later cleanup worker.
- HA trigger / webhook integration for these commands.
- Smart filename-conflict resolution at destination (overwrite is the default, matching `flattenOutput`'s behavior). If a sibling already contains a same-named entry under `distributeFolderToSiblings`, overwrite. If `moveFilesIntoNamedFolders` finds a same-named existing directory, the file moves into it (existing files at the destination overwritten by the underlying `fs.rename`).
