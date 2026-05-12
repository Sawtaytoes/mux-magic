# Worker 1d — gallery-downloader-consume-mux-magic-shared

**Model:** Sonnet · **Thinking:** ON · **Effort:** Medium
**Branch:** `feat/gallery-downloader-revamp/1d-consume-shared` (in the Gallery-Downloader repo)
**Worktree:** `D:\Projects\Personal\media-sync\.claude\worktrees\1d_consume_shared\`
**Phase:** 1B cross-repo
**Depends on:** 1c (decoupling done so the shared-tools dedup makes sense), 02 (npm publish workflow renamed to `@mux-magic/shared`), and the user has tagged a first `shared-v0.x.0` release of `@mux-magic/shared`
**Parallel with:** 1e, 1f

## Universal Rules (TL;DR)

Worktree-isolated in the Gallery-Downloader repo. Yarn only.

## Your Mission

Gallery-Downloader maintains its own `packages/shared-tools` (local utilities that duplicate Mux-Magic's `@mux-magic/shared`). After Mux-Magic publishes `@mux-magic/shared` to npm (worker `02` + a manual release tag from the user), Gallery-Downloader should consume the npm package and delete the local duplicate.

### Investigation

1. Read `D:\Projects\Personal\media-sync\packages\shared-tools\` to enumerate its exports (or the renamed version after worker `1b`).
2. Compare with `@mux-magic/shared`'s exports (read [packages/shared/src/index.ts](../../packages/shared/src/index.ts) in the Mux-Magic repo).
3. For each Gallery-Downloader-local utility:
   - If it exists in `@mux-magic/shared` → replace import.
   - If it doesn't → either (a) propose adding it to `@mux-magic/shared` (file a follow-up worker) OR (b) keep it as a Gallery-Downloader-only internal util (move to a more appropriately-named internal package).

### Dependency

Gallery-Downloader needs `@mux-magic/shared` as a regular npm dependency:

```jsonc
// In each consuming package.json:
"dependencies": {
  "@mux-magic/shared": "^0.1.0"  // or whatever version was published
}
```

### Verification

After updating imports and running `yarn install`:
- `yarn typecheck` confirms the imports resolve and types match.
- Run any tests in Gallery-Downloader that exercise the shared utilities.
- Manually verify the npm version pulled in matches what's published (no resolution issues from yarn's berry or worktree resolution).

## TDD steps

1. Enumerate the duplicates (`shared-tools` exports vs `@mux-magic/shared` exports).
2. For each: write a failing test asserting the npm-imported version behaves identically. Commit.
3. Replace imports.
4. Delete the duplicates from `shared-tools`.
5. Verify tests pass.

## Files (in Gallery-Downloader repo)

- `D:\Projects\Personal\media-sync\packages\shared-tools\src\*` — likely deletions
- Many `D:\Projects\Personal\media-sync\packages\*\src\**\*.ts` — import path updates
- Each consuming `package.json` — add `@mux-magic/shared` dep

## Verification checklist

- [ ] Worktree created
- [ ] Manifest row → `in-progress`
- [ ] User has published `@mux-magic/shared` to npm (verify with `yarn info @mux-magic/shared`)
- [ ] All local duplicates of `@mux-magic/shared` exports deleted
- [ ] All imports updated to `@mux-magic/shared`
- [ ] Gallery-Downloader's tests pass
- [ ] PR opened
- [ ] Manifest row → `done`

## Out of scope

- Adding new exports to `@mux-magic/shared` — file follow-up workers in Mux-Magic repo if needed
- Refactoring shared utilities themselves
- Renaming `shared-tools` to something else (kept as-is if used for Gallery-Downloader-internal utilities)
