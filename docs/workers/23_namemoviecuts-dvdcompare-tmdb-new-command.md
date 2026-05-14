# Worker 23 — nameMovieCutsDvdCompareTmdb-new-command

**Model:** Sonnet · **Thinking:** ON · **Effort:** High
**Branch:** `feat/mux-magic-revamp/23-namemoviecuts-dvdcompare-tmdb`
**Worktree:** `.claude/worktrees/23_namemoviecuts-dvdcompare-tmdb/`
**Phase:** 3 (Name Special Features overhaul)
**Depends on:** 22 (rename complete), 35 (dvdCompareId Variable type)
**Parallel with:** 34 (different command), 24, 25, 26, 27 (different files within NSF family)

---

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Tests must cover the change scope. Yarn only. See [AGENTS.md](../../AGENTS.md). Background context lives in [docs/PLAN.md §9](./PLAN.md).

---

## Your Mission

Add a **new sibling command** to the NSF family: `nameMovieCutsDvdCompareTmdb`.

### Why this command exists

`nameSpecialFeaturesDvdCompareTmdb` (worker 22's renamed version) is a heavy, do-everything command: it renames extras, renames cuts, moves files into edition folders. Many users only want the **movie cuts** part — they have a folder of `Movie.mkv`, `Movie.Directors.Cut.mkv`, `Movie.Theatrical.mkv` files and want them renamed + organized into `Movie (Year)/Movie (Year) {edition-DirectorsCut}/Movie (Year) {edition-DirectorsCut}.mkv` Plex structure, without touching trailers or behind-the-scenes files.

This command is **narrow by design**: only main-feature movie cuts. No special-features renaming, no fuzzy unnamed-file matching. Files that *don't* match a known cut from DVD Compare are skipped (and reported), not renamed-with-a-guess.

### Scope

For each input file in the source folder:

1. Match against DVD Compare cuts (timecode-based, identical logic to the existing command — extract via a shared helper if doing so doesn't bloat scope; otherwise duplicate the matching code and let a future refactor consolidate).
2. If a match is found:
   - Resolve canonical title + year via TMDB.
   - Rename to `{Title} ({Year}) {edition-{CutName}}.{ext}`.
   - Move into `{sourceParent}/{Title} ({Year})/{Title} ({Year}) {edition-{CutName}}/<filename>` (Plex edition-folder structure).
3. If no match: skip with a log entry. No fuzzy fallback.

### Why a separate command instead of a flag on the existing one

- The existing command's surface area is already 1,325 lines. Adding a "movies-only mode" flag adds branching everywhere and makes the pipeline harder to reason about.
- Users articulate the desire differently: "I want to rename movie cuts" vs. "I want to rename special features". Better to give them two named commands than one with a toggle.
- The plan explicitly preserves the existing command unchanged (worker 22's decision); this worker is a clean greenfield addition.

### Reuse vs. duplicate

Three helpers from `nameSpecialFeaturesDvdCompareTmdb.ts` are needed:
- `searchDvdCompare()` — HTML scrape of DVDCompare.net.
- `findMatchingCut()` — duration-padded timecode match.
- `canonicalizeMovieTitle()` — TMDB lookup.

**Decision rule:** extract them into a shared `dvdCompareTmdbHelpers.ts` module (next to the existing app-command) only if doing so is a clean ~50-line extraction with no breakage. If it requires significant restructuring of the existing 1,325-line file, **duplicate the helpers in the new command's file** and leave a TODO comment. Worker 25 (`nsf-fix-unnamed-overhaul`) is a more appropriate place for the larger refactor.

Verify the existing file's structure before deciding; the easy path is to do a thin shared-helper extraction limited to those three pure functions.

### Variable wiring

The new command takes a `dvdCompareId` field (linked to a Variable of type `dvdCompareId` registered by worker 35). This lets users share the same DVD Compare URL/ID across multiple steps in a sequence (e.g. one step matches cuts, another only renames the source folder). The field uses `isLinkable: true` per `CommandField` conventions.

### Inputs (Zod schema)

```ts
const nameMovieCutsDvdCompareTmdbRequestSchema = z.object({
  sourcePath: z.string().describe("Directory containing movie cut files."),
  dvdCompareId: z.string().optional().describe("DVD Compare release ID (or use url/searchTerm)."),
  url: z.string().optional().describe("Full DVDCompare.net URL."),
  searchTerm: z.string().optional().describe("Free-text search term for DVDCompare."),
  timecodePadding: z.number().optional().default(15).describe("Seconds of slack when matching durations."),
  fixedOffset: z.number().optional().default(0).describe("Constant offset to subtract from each file's duration before matching."),
})
```

(Mirror the existing command's URL-resolution semantics: at least one of `dvdCompareId`, `url`, or `searchTerm` is required. Wire validation as the existing command does.)

### Outputs (discriminated union events)

- `{ oldName, newName, destinationPath }` — successful rename + move
- `{ skippedFilename, reason: "no_cut_match" }` — file didn't match any known cut

The output shape is **flatter than the existing command's** because there's no unnamed-file fallback or special-features path.

### CLI registration

Add `packages/cli/src/cli-commands/nameMovieCutsDvdCompareTmdbCommand.ts`. Mirror the existing NSF CLI command's yargs structure (positional `sourcePath`, named flags for the rest). Register it in `packages/cli/src/cli.ts`.

### Web UI integration

The command should appear in the CommandPicker under the same tag as the existing NSF command (likely `"Naming Operations"`). It gets fields from the standard Zod-introspection field-builder; add a `FieldOverrides` entry only if a default rendering is wrong.

---

## Tests (per test-coverage discipline)

- **Unit:** match a fixture file's duration against a known DVD Compare cut → produces the expected `{Title (Year)} {edition-CutName}.mkv` filename.
- **Unit:** unmatched file emits `skippedFilename` event (not a fuzzy guess).
- **Unit:** Plex edition folder path constructed correctly for nested moves.
- **Unit:** Zod schema rejects requests missing all of `dvdCompareId`/`url`/`searchTerm`.
- **Integration:** end-to-end run against a small fixture folder with 3 files (2 known cuts + 1 unknown) → 2 renames + 1 skip event.
- **e2e:** create sequence with this command in the web UI; runs against a temp folder; verify file moves on disk.

---

## TDD steps

1. Failing tests above.
2. Sketch the new app-command file in `packages/server/src/app-commands/nameMovieCutsDvdCompareTmdb.ts` using a fake DVD Compare client (test-only). Get unit tests passing.
3. Wire up the real `searchDvdCompare` helper (either via shared-helper extraction or duplication per decision rule).
4. Add Zod schema in `packages/server/src/api/schemas.ts`.
5. Register in `commandRoutes.ts`.
6. Add CLI command in `packages/cli/src/cli-commands/`.
7. Verify it appears in the CommandPicker.
8. Run integration + e2e.
9. Full gate.

---

## Files

**Create:**
- `packages/server/src/app-commands/nameMovieCutsDvdCompareTmdb.ts`
- Possibly: `packages/server/src/app-commands/dvdCompareTmdbHelpers.ts` (if shared-helper extraction passes the cleanness bar)
- `packages/cli/src/cli-commands/nameMovieCutsDvdCompareTmdbCommand.ts`
- Tests for all of the above

**Modify:**
- [packages/server/src/api/schemas.ts](../../packages/server/src/api/schemas.ts) — add `nameMovieCutsDvdCompareTmdbRequestSchema`
- [packages/server/src/api/routes/commandRoutes.ts](../../packages/server/src/api/routes/commandRoutes.ts) — register new command
- [packages/cli/src/cli.ts](../../packages/cli/src/cli.ts) — register new yargs command
- [packages/server/src/app-commands/nameSpecialFeaturesDvdCompareTmdb.ts](../../packages/server/src/app-commands/nameSpecialFeaturesDvdCompareTmdb.ts) (post-worker-22) — only if shared-helper extraction is done; otherwise untouched

---

## Verification checklist

- [ ] Workers 22 ✅ and 35 ✅ merged before starting
- [ ] Worktree created
- [ ] Manifest row → `in-progress`
- [ ] Failing tests committed first
- [ ] New command file under 300 lines (forcing the narrow scope)
- [ ] Unknown files **skip with a log entry**; no fuzzy fallback
- [ ] CLI invocation works: `yarn media name-movie-cuts-dvd-compare-tmdb --source-path ./fixture`
- [ ] CommandPicker shows the new command in the right tag
- [ ] `dvdCompareId` field is linkable to a Variable
- [ ] Standard gate clean
- [ ] PR opened
- [ ] Manifest row → `done`

## Out of scope

- Editing the existing `nameSpecialFeaturesDvdCompareTmdb` command (workers 25, 26, 27 do that).
- Renaming or moving non-movie media (worker 34 does the non-movie variant).
- A "preview mode" that shows planned renames without applying — could be a follow-up worker.
