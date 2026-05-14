# Worker 26 — nsf-edition-organizer

**Model:** Sonnet · **Thinking:** ON · **Effort:** High
**Branch:** `feat/mux-magic-revamp/26-nsf-edition-organizer`
**Worktree:** `.claude/worktrees/26_nsf-edition-organizer/`
**Phase:** 3 (Name Special Features overhaul)
**Depends on:** 25 (overhaul of unnamed handling — paths through the pipeline change shape) and implicitly 3a (split)
**Parallel with:** 27 (different module), 23, 34 (different commands)

---

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Tests must cover the change scope. Yarn only. See [AGENTS.md](../../AGENTS.md). Background context lives in [docs/PLAN.md §9](../PLAN.md).

---

## Your Mission

Improve the **edition-folder organization** behavior of `nameSpecialFeaturesDvdCompareTmdb`. Today, when `moveToEditionFolders: true`, files with `{edition-…}` tags get moved into a Plex-compatible nested structure:

```
<sourceParent>/
  <Title> (<Year>)/
    <Title> (<Year>) {edition-DirectorsCut}/
      <Title> (<Year>) {edition-DirectorsCut}.mkv
      <Title> (<Year>) {edition-DirectorsCut}-trailer.mkv
      <Title> (<Year>) {edition-DirectorsCut}-behindthescenes.mkv
```

The mechanics work today but have several rough edges that this worker addresses.

### Issues to fix

#### 1. Sibling-file co-movement

Today, only files whose **own** filename carries `{edition-X}` get moved. But trailers and behind-the-scenes files that **belong to** an edition (live next to it in the source folder, share a base name modulo Plex suffix) should also move along with the main feature.

Example today (broken):
```
Source folder:
  Movie (2020) {edition-DirectorsCut}.mkv  → moved
  Movie (2020) {edition-DirectorsCut}-trailer.mkv  → NOT moved (no {edition} tag itself)
```

Desired:
```
Movie (2020)/
  Movie (2020) {edition-DirectorsCut}/
    Movie (2020) {edition-DirectorsCut}.mkv
    Movie (2020) {edition-DirectorsCut}-trailer.mkv  ← moved along with its main feature
```

The detection rule: a file is a **sibling** of an edition main feature if its name strips to the same base (i.e., removing one of the known Plex special-feature suffixes from the end yields the main feature's filename). Plex suffix list already exists in the codebase (`-trailer`, `-behindthescenes`, etc.) — reuse it from worker-3a's `filename/plexSuffixes.ts`.

#### 2. Collision detection at the destination

Today, if the destination edition folder already exists with files in it, behavior is ambiguous (the existing code may overwrite, may skip, may error — investigate before deciding the new contract). New contract:

- If destination folder exists and is **empty**: proceed with the move.
- If destination folder exists and contains a file with the same name as one we'd move in: emit a `{ hasCollision: true, filename, destinationPath, existingPath }` event and **skip the move** (don't overwrite). Behavior matches today's existing on-disk collision handling for renames.
- If destination folder exists and contains *different* files: proceed with the move (the destination is an existing edition folder we're adding files to).

#### 3. Multi-edition releases

When a release has multiple editions (Director's Cut + Theatrical + Extended), each edition gets its own folder. Sibling-file co-movement (issue #1) must scope to the correct edition — a `-trailer` file's base name determines which edition it joins.

Worth writing a fixture test: a folder with `Movie (2020) {edition-DirectorsCut}.mkv`, `Movie (2020) {edition-DirectorsCut}-trailer.mkv`, `Movie (2020) {edition-Theatrical}.mkv`, `Movie (2020) {edition-Theatrical}-trailer.mkv` → produces two edition folders, each containing the right two files.

#### 4. Dry-run preview

Today's command supports `moveToEditionFolders: true | false` but no dry-run mode. Add a **preview event** emitted **before** any move happens, summarizing the planned moves:

```ts
type EditionPlanEvent = {
  type: "editionPlan"
  moves: Array<{
    sourceFilename: string
    destinationPath: string
    editionName: string
    isSibling: boolean  // true if moving along with a main feature
  }>
}
```

Useful for the web UI to show the user what's about to happen. The actual moves then proceed (unless the existing `nonInteractive: false` mode chooses to gate them on user confirmation — out of scope here).

### What does NOT change

- The Plex folder-naming convention (`<Title> (<Year>) {edition-<Name>}/`).
- The list of recognized Plex suffixes.
- The `moveToEditionFolders` flag default (`false`).
- The discriminated union result event types from the broader command (just adds `editionPlan`).

---

## Tests (per test-coverage discipline)

- **Unit:** sibling detection — `findSiblingsForEdition(mainFeatureName, allFilesInFolder)` returns the trailer + behind-the-scenes etc. that share the base.
- **Unit:** sibling detection scopes correctly across two editions in the same folder.
- **Unit:** collision rules:
  - Empty destination folder → proceed
  - Destination folder has same-name file → emit collision + skip
  - Destination folder has different files → proceed (additive)
- **Unit:** `editionPlan` event is emitted before any FS move.
- **Integration:** fixture with multi-edition release + siblings → correct files in correct folders after the run.
- **e2e:** web UI receives `editionPlan` event and renders the planned moves before they execute.

---

## TDD steps

1. Failing tests above.
2. Extract `findSiblingsForEdition` helper (likely lives in `editions/`).
3. Update `moveToEditionFolder` (or its orchestration) to gather siblings + queue them.
4. Add collision detection at destination.
5. Add `editionPlan` event emission upstream of the actual moves.
6. Wire the event into the web UI for preview rendering.
7. Full gate.

---

## Files (post-worker-3a layout)

- `packages/server/src/app-commands/nameSpecialFeaturesDvdCompareTmdb/editions/findSiblingsForEdition.ts` (new or extension)
- `packages/server/src/app-commands/nameSpecialFeaturesDvdCompareTmdb/editions/moveToEditionFolder.ts` (extend with sibling-handling + collision detection)
- `packages/server/src/app-commands/nameSpecialFeaturesDvdCompareTmdb/editions/buildEditionPlan.ts` (new)
- `packages/server/src/app-commands/nameSpecialFeaturesDvdCompareTmdb/events.ts` (extend with `EditionPlanEvent`)
- Web UI: edition-plan preview component (search [packages/web/src/components/](../../packages/web/src/components/))
- Tests for all of the above

---

## Verification checklist

- [ ] Worker 25 ✅ merged before starting (implicit dependency on 3a)
- [ ] Worktree created
- [ ] Manifest row → `in-progress`
- [ ] Failing tests committed first
- [ ] Sibling files move alongside their edition's main feature
- [ ] Collision rules behave per spec
- [ ] Multi-edition fixture produces correct nesting
- [ ] `editionPlan` event emitted before moves; visible in web UI
- [ ] Standard gate clean
- [ ] PR opened
- [ ] Manifest row → `done`

## Out of scope

- Edition-name normalization (e.g. mapping "Theatrical Cut" → "Theatrical"). The existing edition-tag parser owns this.
- Reverse operation (un-nesting an edition folder back into flat siblings). Could be a future worker.
- Persisting edition plans (worker 27 owns state persistence).
