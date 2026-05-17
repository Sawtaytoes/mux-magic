# Worker 66 — rename-files-standalone-command

**Model:** Sonnet · **Thinking:** ON · **Effort:** Medium
**Branch:** `feat/mux-magic-revamp/66-rename-files-standalone-command`
**Worktree:** `.claude/worktrees/66_rename-files-standalone-command/`
**Phase:** 4
**Depends on:** 01 (done)
**Soft-depends on:** 63 (done — establishes `RenameRegexField` for reuse) and 65 (flags + sample tester — `renameFiles` should ship with the same UI affordances on day one if 65 has merged; otherwise inherit them when 65 lands)
**Parallel with:** any worker that doesn't touch [packages/server/src/app-commands/copyFiles.ts](../../packages/server/src/app-commands/copyFiles.ts) (read-only here, for helper extraction), [packages/server/src/api/routes/commandRoutes.ts](../../packages/server/src/api/routes/commandRoutes.ts), [packages/server/src/api/schemas.ts](../../packages/server/src/api/schemas.ts), [packages/cli/src/cli.ts](../../packages/cli/src/cli.ts), or [packages/web/src/commands/commands.ts](../../packages/web/src/commands/commands.ts).

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Yarn only. See [AGENTS.md](../../AGENTS.md).

## Context

Today the **only** way to apply a regex rename to a set of files is to bundle it into `copyFiles` ([copyFiles.ts:38-47](../../packages/server/src/app-commands/copyFiles.ts#L38-L47)) or `moveFiles` — every rename costs a copy or move operation. Three real cases this blocks:

1. **Multi-stage rename pipelines.** Per-series anime sync produces filenames like `Daemons of the Shadow Realm - s01e03 - Dera.and.Hana.mkv` because the source release group uses dots as word separators. A second-pass rename to convert `.` → ` ` between ` - ` and `.mkv` needs another rename step — but you don't want to copy the files again, and `moveFiles` has the same problem (it moves them to a new destination). What you want is "rename in place."
2. **Rename without disturbing location.** User has files in their final library and just wants to fix the casing or strip a tag. No copy, no move, just rename.
3. **Composability.** Worker 1c removed Gallery-Downloader's monolithic anime-sync orchestrator in favor of mux-magic sequence steps. The split between "file movement" and "file naming" should be reflected in the command surface: one command moves, one renames. Today's bundled `renameRegex` on copy/move blurs that.

User's exact ask (in conversation): *"Another step card that lets you rename files? Then I could do the copy and run a separate regex on the filename to fix it up."*

The existing `renameRegex` capability on `copyFiles` / `moveFiles` **stays as-is** — Worker 63 just shipped that UI, and yanking it would break the YAML users have already authored. This worker adds a sibling command, not a replacement.

## Your Mission

Add a `renameFiles` command — pure in-place rename, no copy, no move — that reuses the same `RenameRegex` schema shape so any user's existing `renameRegex` snippet from `copyFiles` is paste-compatible.

### Schema

`renameFilesRequestSchema` in [packages/server/src/api/schemas.ts](../../packages/server/src/api/schemas.ts):

```ts
export const renameFilesRequestSchema = z.object({
  sourcePath: z.string().describe("Directory containing files to rename."),
  isRecursive: z
    .boolean()
    .default(false)
    .describe(
      "Recursively descend into subdirectories. Default false.",
    ),
  recursiveDepth: z
    .number()
    .int()
    .min(0)
    .default(0)
    .describe(
      "Max depth when isRecursive is true. 0 = unlimited; mirrors deleteFilesByExtension.",
    ),
  fileFilterRegex: regexWithFlagsSchema.optional().describe(
    "If set, only files matching this pattern are renamed.",
  ),
  renameRegex: renameRegexSchema.describe(
    "Required. Applied to each matched filename + extension via String.replace.",
  ),
})
```

`fileFilterRegex` is optional (no filter = rename every file the recursion touches). `renameRegex` is **required** for `renameFiles` (the command is meaningless without it; unlike `copyFiles` where the regex is purely an optional transform on top of the copy).

### Handler

`packages/server/src/app-commands/renameFiles.ts` — observable returning per-file `{ source: string; destination: string }` records, mirroring [copyFiles.ts:28-31](../../packages/server/src/app-commands/copyFiles.ts#L28-L31). Key shape:

```ts
export const renameFiles = ({
  fileFilterRegex,
  isRecursive,
  recursiveDepth,
  renameRegex,
  sourcePath,
}: RenameFilesParams): Observable<RenameRecord> => /* ... */
```

Pipeline:

1. `getFiles({ sourcePath, isRecursive, recursiveDepth })` — already a primitive in `@mux-magic/tools`.
2. Filter via `fileFilterRegex` (when set) using the same matching logic copyFiles uses at [copyFiles.ts:86-95](../../packages/server/src/app-commands/copyFiles.ts#L86-L95).
3. For each surviving file: compute the new name via `applyRenameRegex` (see "Helper extraction" below). If the new name equals the old name (regex matched but produced no change, or didn't match), log a `NO-OP` and skip the rename — don't waste a syscall.
4. Rename via `file.renameFile(newName)` (the existing `FileInfo.renameFile` from [createRenameFileOrFolder.ts:19-42](../../packages/tools/src/createRenameFileOrFolder.ts#L19-L42)). Atomic same-volume metadata op.
5. Emit `{ source, destination }`.
6. Wrap in the standard AbortController shell ([copyFiles.ts:70-91](../../packages/server/src/app-commands/copyFiles.ts#L70-L91)) for sequence-cancel / parallel-sibling fail-fast semantics.

**Collision handling.** If two source files in the same directory map to the same target name, the second `fs.rename` would overwrite the first on Windows (and emit `EEXIST` or overwrite silently on POSIX depending on filesystem). Detect this in a pre-flight pass: compute every target name, group by lowercase path key, error fast with the full collision list if any group has size > 1. Better to halt than to silently lose a file.

### Helper extraction

`applyRenameRegex` currently lives at [copyFiles.ts:38-47](../../packages/server/src/app-commands/copyFiles.ts#L38-L47). Move it to `packages/tools/src/applyRenameRegex.ts` so `copyFiles`, `moveFiles`, and the new `renameFiles` all import the same canonical helper. The `RenameRegex` type moves with it. Update the existing imports in `copyFiles.ts` and `moveFiles.ts` — pure refactor, no behavior change there.

This avoids the three-handler drift problem (one handler adds `flags` support, the other two forget). When worker 65 lands its `flags` support, only `applyRenameRegex` needs the change.

### HTTP route

Register `renameFiles` in [packages/server/src/api/routes/commandRoutes.ts](../../packages/server/src/api/routes/commandRoutes.ts) mirroring the `copyFiles` entry at line 219+. `extractOutputs` should emit `renamedPaths: string[]` (the new full paths) so a downstream step can target the just-renamed set if needed.

### CLI adapter

`packages/cli/src/cli-commands/renameFilesCommand.ts` — thin yargs wrapper mirroring `copyFilesCommand.ts`. Positional `sourcePath`, `--renameRegex-pattern` + `--renameRegex-replacement` (or a single `--renameRegex` JSON arg, whichever pattern the other CLI commands use), `--fileFilterRegex`, `--isRecursive`, `--recursiveDepth`. Register in [packages/cli/src/cli.ts](../../packages/cli/src/cli.ts).

### Web command card

New entry in [packages/web/src/commands/commands.ts](../../packages/web/src/commands/commands.ts):

```ts
renameFiles: (() => {
  const field = fieldBuilder(renameFilesRequestSchema)
  return {
    summary: "Rename files in place via regex (no copy, no move).",
    tag: "File Operations",
    outputFolderName: null,
    outputs: [{ name: "renamedPaths", label: "Renamed file paths" }],
    fields: [
      field("sourcePath", { type: "path", label: "Source Path" }),
      field("isRecursive", { type: "boolean", label: "Recursive" }),
      field("recursiveDepth", {
        type: "number",
        label: "Depth",
        default: 1,
        min: 1,
        visibleWhen: { fieldName: "isRecursive", value: true },
      }),
      field("fileFilterRegex", {
        type: "regexWithFlags", // see worker 65; if 65 hasn't merged, use "string" and let 65 promote it
        label: "File Filter Regex",
      }),
      field("renameRegex", {
        type: "renameRegex", // from worker 63
        label: "Rename Regex",
      }),
    ],
  }
})(),
```

Reuses the field components and dispatcher entries from workers 63 and 65 — no new web component needed in this worker.

## Files

### New

- `packages/server/src/app-commands/renameFiles.ts` — the handler.
- `packages/server/src/app-commands/renameFiles.test.ts` — golden paths + collision detection + no-op skipping + recursive cases.
- `packages/cli/src/cli-commands/renameFilesCommand.ts` — CLI adapter.
- `packages/tools/src/applyRenameRegex.ts` — extracted helper.
- `packages/tools/src/applyRenameRegex.test.ts` — round-trip tests (the existing copyFiles tests cover the behavior, but the standalone helper deserves its own tests).

### Modified

- `packages/server/src/api/schemas.ts` — add `renameFilesRequestSchema`.
- `packages/server/src/api/routes/commandRoutes.ts` — register the new command.
- `packages/server/src/app-commands/copyFiles.ts` — import `applyRenameRegex` from `@mux-magic/tools` instead of defining it locally; re-export the type if anything else depended on the local export.
- `packages/server/src/app-commands/moveFiles.ts` — same import switch.
- `packages/tools/src/index.ts` — export `applyRenameRegex` + the `RenameRegex` type.
- `packages/cli/src/cli.ts` — register `renameFilesCommand`.
- `packages/web/src/commands/commands.ts` — add the `renameFiles` card definition.
- `packages/web/public/command-descriptions.js` — add the `renameFiles` description.
- `docs/workers/MANIFEST.md` — flip to `in-progress` at start, `done` after PR merge.

### Pattern templates to mirror

- App-command observable shape → [copyFiles.ts:56-271](../../packages/server/src/app-commands/copyFiles.ts#L56-L271)
- AbortController wrap → [copyFiles.ts:70-91](../../packages/server/src/app-commands/copyFiles.ts#L70-L91)
- HTTP route registration → [commandRoutes.ts:219-238](../../packages/server/src/api/routes/commandRoutes.ts#L219-L238) (the `copyFiles` entry)
- CLI adapter shape → [packages/cli/src/cli-commands/copyFilesCommand.ts](../../packages/cli/src/cli-commands/copyFilesCommand.ts)
- Recursive-with-depth pattern → [packages/server/src/app-commands/deleteFilesByExtension.ts](../../packages/server/src/app-commands/deleteFilesByExtension.ts) for the `isRecursive` + `recursiveDepth` field pair (worker 63 also references this in its `visibleWhen` example)
- Per-step `outputs` declaration in commands.ts → any existing card whose `extractOutputs` is consumed downstream

## TDD steps

1. **Helper extraction test**: `applyRenameRegex.test.ts` covers empty-input, no-match, simple replace, named-group replace. Existing copyFiles tests still pass after the import switch.
2. **Handler test, golden path**: directory of 5 files matching the pattern → 5 renamed; emitted records correct; `vol.toJSON()` reflects new names.
3. **Handler test, filter applied**: directory of 10 files, 3 match the filter → only 3 renamed.
4. **Handler test, no-op**: pattern doesn't change the name (e.g. pattern `(.+)` replacement `$1`) → no `fs.rename` call (verify via `vol.toJSON()` mtime stability if possible, or via a spy on the rename helper) + log emission per file.
5. **Handler test, collision detection**: two files `Foo.s01e01.mkv` and `Foo.S01E01.mkv` with a pattern that lowercases the prefix → both target `foo.s01e01.mkv` → command errors at start with the full collision pair listed, no renames happen.
6. **Handler test, recursive**: nested directories with `isRecursive: true, recursiveDepth: 2` → files at depth 1 and 2 are renamed; depth 3 untouched.
7. **Handler test, AbortController**: subscribe then immediately unsubscribe → no `fs.rename` calls completed (use the same pattern as copyFiles' cancellation tests).
8. **Route test**: POST `/api/copyFiles` equivalent for renameFiles round-trips the new schema correctly.
9. **CLI smoke**: `mux-magic renameFiles ./scratch --renameRegex-pattern "foo" --renameRegex-replacement "bar"` against a throwaway dir works.
10. **Manual web smoke**: open the builder, drop a `renameFiles` step, fill in pattern + replacement, run against a scratch dir, verify the files rename. Optionally chain a `copyFiles` step followed by a `renameFiles` step to confirm the two-pass workflow that motivated this worker.

## Verification checklist

- [ ] Worktree created
- [ ] Manifest row → `in-progress`
- [ ] Failing tests written first (helper, handler golden path, collision, no-op, recursive, AbortController)
- [ ] `applyRenameRegex` extracted to `@mux-magic/tools`; copyFiles + moveFiles use the imported version
- [ ] `renameFiles` handler implemented; all tests green
- [ ] Collision detection halts before any rename
- [ ] HTTP route registered with `renamedPaths` output
- [ ] CLI adapter registered
- [ ] Web command card renders with reused field types
- [ ] `command-descriptions.js` updated
- [ ] Manual smoke per TDD step 10 (including the chained two-pass workflow)
- [ ] Existing copyFiles / moveFiles tests pass unmodified after the import switch
- [ ] Standard pre-merge gate clean: `yarn lint → typecheck → test → e2e → lint`
- [ ] PR opened against `feat/mux-magic-revamp`
- [ ] Manifest row → `done`

## Out of scope

- **Removing `renameRegex` from `copyFiles` / `moveFiles`.** Backward-compatible coexistence. A future worker can deprecate if the bundled path proves unused.
- **Conditional replacement segments** (`${episodeName ? - $<episodeName>}`). Same out-of-scope item as worker 65 — defer until a real release group hits the case.
- **Cross-volume rename fallback.** `fs.rename` errors with `EXDEV` across volumes. If the user needs a cross-volume rename they should `copyFiles` (which already handles this) instead. Document this in the field hint; don't silently fall back to copy + delete (that's a different operation with different failure modes).
- **Undo / rollback** for partial-batch failures. If `fs.rename` fails halfway through a batch, the renames already applied stay applied. Document the behavior; don't build a rollback log (overkill for in-place same-volume rename, which is near-atomic per file).
- **Smart name disambiguation** when collisions are detected (e.g. auto-append `(1)`, `(2)`). Halt-and-list is the chosen design — user resolves the conflict by editing their pattern or splitting into multiple steps.
- **Subfolder renames.** Files only. Folder renames is a different operation (`moveFolders` or `renameFolder`); not in scope here.
- **Sample-tester UI inside this worker.** That lives in worker 65 on `RenameRegexField`. This worker reuses the component as-is.
