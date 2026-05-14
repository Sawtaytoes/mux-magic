# Worker 1d — gallery-downloader-consume-mux-magic-tools

**Model:** Sonnet · **Thinking:** ON · **Effort:** Medium
**Branch:** `feat/gallery-downloader-revamp/1d-consume-tools` (in the Gallery-Downloader repo)
**Worktree:** `D:\Projects\Personal\media-sync\.claude\worktrees\1d_consume_tools\`
**Phase:** 1B cross-repo
**Depends on:**

- `1c` (decoupling done so the shared-tools dedup makes sense)
- `02` (npm publish workflow renamed for the new scope)
- `39` (Mux-Magic's `packages/shared/` is now `packages/tools/` AND reusable utilities from `packages/server/src/tools/` have been migrated into it)
- A published `@mux-magic/tools` release on npm (user manually tags `shared-v0.x.0` after Phase 0 lands in master)

**Parallel with:** 1e, 1f

> **Status as of 2026-05-13:** Verified still in-progress per the manifest. Cross-repo work in the Gallery-Downloader repo — local `packages/shared-tools/` consolidation onto the published `@mux-magic/tools` is not yet complete.

## Universal Rules (TL;DR)

Worktree-isolated in the Gallery-Downloader repo. Yarn only.

## Your Mission

Gallery-Downloader maintains its own `packages/shared-tools/` (local utilities that duplicate Mux-Magic's `@mux-magic/tools`, including console-log helpers, file-lookup helpers, and other reusables that worker `39` consolidated into `packages/tools/`). After Mux-Magic publishes `@mux-magic/tools` to npm (worker `02` + worker `39` + a manual release tag from the user), Gallery-Downloader should consume the npm package and delete its local duplicates.

This worker is the **payoff** for worker `39`'s consolidation: every utility that `39` moved out of `packages/server/src/tools/` into `packages/tools/src/` is potentially a duplicate that Gallery-Downloader can now drop.

### Investigation

1. Read `D:\Projects\Personal\media-sync\packages\shared-tools\` (or the renamed equivalent after worker `1b`) to enumerate its exports.
2. Compare with `@mux-magic/tools`'s public surface — read [packages/tools/src/index.ts](../../packages/tools/src/index.ts) in the Mux-Magic repo (renamed from `packages/shared/src/index.ts` by worker 39).
3. For each Gallery-Downloader-local utility:
   - **Exact match in `@mux-magic/tools`** → replace import; delete the local duplicate.
   - **Equivalent behavior, different signature** → consider whether to adapt callers to the npm version's signature (preferred when the npm version is the canonical form) or propose adding the alternative as a new export to `@mux-magic/tools` (file a follow-up worker in the Mux-Magic repo).
   - **Gallery-Downloader-only utility** (no equivalent upstream) → keep it as Gallery-Downloader-internal; consider moving to a more appropriately-named internal package if `shared-tools` is now nearly empty.

### Expected high-value replacements

Worker `39` was scoped to move reusable utilities into `@mux-magic/tools`. The most likely duplicates in Gallery-Downloader are:

- **Console / log helpers** — Gallery-Downloader almost certainly has its own `logMessage`, `captureConsoleMessage`, or equivalent. Replace with `@mux-magic/tools` exports.
- **File-system helpers** — `getFiles`, `getFilesAtDepth`, `listDirectoryEntries`, `makeDirectory`, `pathSafety`, etc. — drop the Gallery-Downloader duplicates.
- **String utilities** — `naturalSort`, `cleanupFilename`, `replaceFileExtension`, `getRandomString`.
- **Filters** — `filterIsAudioFile`, `filterIsSubtitlesFile`, `filterIsVideoFile` (if Gallery-Downloader does any file-type filtering).

For each, run a diff between the Gallery-Downloader local implementation and the `@mux-magic/tools` version BEFORE deleting. If they diverge in a meaningful way, surface it in the PR for the user to decide which version is canonical.

### Dependency

Gallery-Downloader needs `@mux-magic/tools` as a regular npm dependency:

```jsonc
// In each consuming package.json:
"dependencies": {
  "@mux-magic/tools": "^0.1.0"  // or whatever version was published
}
```

### Verification

After updating imports and running `yarn install`:
- `yarn typecheck` confirms the imports resolve and types match.
- Run any tests in Gallery-Downloader that exercise the (now-imported) utilities.
- Manually verify the npm version pulled in matches what's published (no resolution issues from yarn berry or worktree resolution).

## TDD steps

1. Enumerate the duplicates (`shared-tools` exports vs `@mux-magic/tools` exports).
2. For each: write a failing test asserting the npm-imported version behaves identically to the existing local one. Commit.
3. Replace imports.
4. Delete the duplicates from `shared-tools`.
5. Verify tests pass.
6. If `shared-tools` is now empty (or contains only one or two stragglers), surface in PR whether the package itself should be deleted / merged into another internal package.

## Files (in Gallery-Downloader repo)

- `D:\Projects\Personal\media-sync\packages\shared-tools\src\*` — likely deletions
- Many `D:\Projects\Personal\media-sync\packages\*\src\**\*.ts` — import path updates
- Each consuming `package.json` — add `@mux-magic/tools` dep, remove `@<gd>/shared-tools` workspace dep if the package is gone

## Verification checklist

- [ ] Worktree created
- [ ] Manifest row → `in-progress`
- [ ] User has published `@mux-magic/tools` to npm (verify with `yarn info @mux-magic/tools`)
- [ ] All local duplicates of `@mux-magic/tools` exports deleted
- [ ] All imports updated to `@mux-magic/tools`
- [ ] Gallery-Downloader's tests pass
- [ ] If `shared-tools` is empty post-cleanup: surface in PR whether to delete the package
- [ ] PR opened
- [ ] Manifest row → `done`

## Out of scope

- Adding new exports to `@mux-magic/tools` — file follow-up workers in Mux-Magic repo if needed
- Refactoring the moved utilities themselves
- Renaming `shared-tools` to something else if kept (kept as-is if still used for Gallery-Downloader-internal utilities)
