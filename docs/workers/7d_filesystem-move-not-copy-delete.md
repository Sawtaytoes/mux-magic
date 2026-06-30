# Worker 7d — Filesystem move, not copy+delete (no temp on same-volume moves)

**Model:** Sonnet · **Thinking:** ON · **Effort:** Medium
**Branch:** `worker-7d-filesystem-move-not-copy-delete`
**Worktree:** `.claude/worktrees/7d_filesystem-move-not-copy-delete/`
**Phase:** 5
**Depends on:** none (worker 59 already shipped the primitives)
**Parallel with:** anything not touching `packages/core/src/app-commands/flatten*.ts` or `packages/tools/src/aclSafeCopyFile.ts`

---

## Background — read first

[docs/decisions/2026-05-19-atomic-copy-and-filesystem-move.md](../decisions/2026-05-19-atomic-copy-and-filesystem-move.md) is the governing decision. The rule:

- A **move** is `fs.rename` — an O(1) metadata op on the same volume, **no temp file, no byte copy**. It only falls back to a streaming copy on `EXDEV` (genuinely cross-volume).
- A **copy** uses `aclSafeCopyFile` (temp `.muxmagic.tmp` → rename, FICLONE fast path, ZFS-EPERM-as-success). The temp exists ONLY to make the copy crash-atomic.

`moveFiles` (`moveSingleFile`) is the reference implementation and is already correct.

## Your Mission

Make every command whose semantics are "move" (or "copy-then-delete-original") use the filesystem move (`fs.rename`) on the same volume instead of an `aclSafeCopyFile` byte-copy + delete. Same-volume moves must be **instant** and must not write a temp file.

### Confirmed bug — `flattenOutput`

[packages/core/src/app-commands/flattenOutput.ts](../../packages/core/src/app-commands/flattenOutput.ts) flattens files up into `dirname(sourcePath)` — **always the same volume** — yet calls `aclSafeCopyFile` per file (logs `"COPIED BACK"`) and then, when `isDeletingSourceFolder: true`, does `rm(sourcePath, { recursive: true })`. That's copy + delete, not a move.

Fix:
- When `isDeletingSourceFolder: true`: move each file with the same `fs.rename`-first / `EXDEV`-fallback logic `moveFiles` uses (extract and reuse `moveSingleFile` rather than duplicating it — promote it to `@mux-magic/tools` or a shared `app-commands` helper). The trailing `rm` then only needs to remove the now-empty source folder.
- When `isDeletingSourceFolder: false` (default): keep the copy — originals are intentionally preserved for inspection (overwrite-in-parent is the intended collision case). Do not change this path's semantics.
- Keep the overwrite-same-name-in-parent behavior either way (`isOverwriteAllowed: true` equivalent — rename-with-overwrite unlinks the destination first, exactly as `moveSingleFile` does).

### Audit the rest (fix or confirm-correct, with a one-line note each)

| Command | Expected |
|---|---|
| `moveFiles` | already correct (rename-first, EXDEV→copy) — leave as the reference |
| `moveFilesIntoNamedFolders` | already pure `fs.rename` (same-volume) — confirm |
| `flattenChildFolders` | already pure `fs.rename` (same-volume) — confirm |
| `flattenOutput` | **FIX** (above) |
| `distributeFolderToSiblings` | copies a folder into N siblings — copy is correct (can't rename to many targets); the optional source-delete after distributing is fine. Confirm + note. |
| `renumberChapters` | mkvmerge remux writes a new file — not a move. Confirm it isn't doing a needless copy of the original. |

Also extract `moveSingleFile` so there's ONE same-volume-move-with-EXDEV-fallback primitive, not copies drifting per command.

## TDD steps

1. Failing test: `flattenOutput({ isDeletingSourceFolder: true })` on a memfs same-volume tree asserts the files were **renamed** (source paths gone, no `.muxmagic.tmp` ever created, source folder removed). Today it copies.
2. Implement the move path; keep the copy path for `isDeletingSourceFolder: false` (add/keep a test that originals survive there).
3. Test the shared `moveSingleFile` primitive directly (same-volume rename; simulated `EXDEV` → copy+unlink fallback).
4. Confirm-correct tests/notes for the audit table.

## Files

- [packages/core/src/app-commands/flattenOutput.ts](../../packages/core/src/app-commands/flattenOutput.ts)
- [packages/core/src/app-commands/moveFiles.ts](../../packages/core/src/app-commands/moveFiles.ts) (extract `moveSingleFile`)
- [packages/tools/src/aclSafeCopyFile.ts](../../packages/tools/src/aclSafeCopyFile.ts) (reference only — no change expected)
- the sibling move commands listed in the audit table

## Verification checklist

- [ ] `flattenOutput` delete-path renames (no temp, no byte copy) on same volume; copy-path unchanged
- [ ] one shared `moveSingleFile` primitive, reused
- [ ] audit table resolved (fixed or confirmed-correct with a note)
- [ ] Standard gates clean (`yarn lint → typecheck → test`, then `yarn e2e` if UI/route touched)
- [ ] PR opened against `feat/mux-magic-revamp`; MANIFEST row flipped to `done`
