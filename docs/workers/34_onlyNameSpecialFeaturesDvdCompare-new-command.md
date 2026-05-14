# Worker 34 — onlyNameSpecialFeaturesDvdCompare-new-command

**Model:** Sonnet · **Thinking:** ON · **Effort:** High
**Branch:** `feat/mux-magic-revamp/34-onlyNameSpecialFeaturesDvdCompare`
**Worktree:** `.claude/worktrees/34_onlyNameSpecialFeaturesDvdCompare-new-command/`
**Phase:** 3 (Name Special Features overhaul)
**Depends on:** 22 (rename), 35 (dvdCompareId Variable type), 3a (NSF split — gives module reuse points)
**Parallel with:** 23 (sibling command), 25, 26, 27 (different concerns)

---

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Tests must cover the change scope. Yarn only. See [AGENTS.md](../../AGENTS.md). Background context lives in [docs/PLAN.md §9](./PLAN.md).

---

## Your Mission

Add a third sibling command to the NSF family: `onlyNameSpecialFeaturesDvdCompare`.

### Why this command exists

The existing `nameSpecialFeaturesDvdCompareTmdb` (renamed by worker 22) requires TMDB lookup for movie canonicalization. But many of the user's renaming targets aren't movies — they're concerts, documentaries, miniseries extras, etc. — and TMDB either has no entry or returns garbage matches. Those workflows just need the **DVD Compare timecode matching** for special features (trailers, behind-the-scenes, etc.), without any movie-title canonicalization.

This command is the **non-movie variant**: takes a source folder, takes a DVD Compare URL/ID, and renames files based on timecode matching against DVD Compare's special-features list. No TMDB. No edition-folder reorganization (which is a movies-only Plex convention).

### Scope

For each input file:

1. Match against DVD Compare special features (timecode-based). Reuse worker 3a's `timecode/findMatchingExtra.ts` helper.
2. If a match is found: rename to `<existing-base>-<plex-suffix>.<ext>` per Plex's special-features convention. The base name stays whatever it was; only the Plex suffix changes.
3. If no match: same `nameSpecialFeaturesDvdCompareTmdb`-style fuzzy fallback OR skip with a log entry. **Choose skip-with-log** (matches worker 23's narrow-scope convention; users wanting the fuzzy fallback can run the bigger command).

### Reuse from worker 3a's split

After worker 3a, the existing command lives in `packages/server/src/app-commands/nameSpecialFeaturesDvdCompareTmdb/` as modules. This worker imports:

- `dvdCompare/searchDvdCompare.ts`
- `dvdCompare/resolveDvdCompareInput.ts`
- `timecode/findMatchingExtra.ts`
- `filename/plexSuffixes.ts`
- `filename/buildSpecialFeatureFilename.ts` (or whatever the renamed-filename builder is named)
- `events.ts` for shared event types

The new app-command file should be small (probably <250 lines) because it's leveraging the modular helpers.

### What does NOT get reused

- Anything from `tmdb/` — this command doesn't need TMDB.
- Anything from `editions/` — no edition folder organization for non-movies.
- `unnamed/` — replaced by skip-with-log for unmatched files.
- `duplicates/` — depends. If two files match the same target name (e.g., two trailer files), still need the duplicate-handling. Reuse `duplicates/reorderForDuplicatePrompts.ts`.

### Inputs (Zod schema)

```ts
const onlyNameSpecialFeaturesDvdCompareRequestSchema = z.object({
  sourcePath: z.string().describe("Directory containing special-features files."),
  dvdCompareId: z.string().optional(),
  url: z.string().optional(),
  searchTerm: z.string().optional(),
  timecodePadding: z.number().optional().default(2).describe("Seconds of slack when matching extras."),
  fixedOffset: z.number().optional().default(0),
  autoNameDuplicates: z.boolean().optional().default(false),
})
```

(Same DVD Compare input-validation as worker 23: at least one of `dvdCompareId`/`url`/`searchTerm` required.)

### Outputs

- `{ oldName, newName }` — single rename
- `{ skippedFilename, reason: "no_extra_match" }` — file didn't match any known extra
- `{ hasCollision: true, filename, targetFilename }` — pre-existing file collision (existing behavior pattern)
- Duplicate-handling prompts via the shared `duplicates/` module

### CLI registration

`packages/cli/src/cli-commands/onlyNameSpecialFeaturesDvdCompareCommand.ts`. Register in `packages/cli/src/cli.ts`.

### Web UI integration

Command appears in CommandPicker under `"Naming Operations"` tag (same as sibling commands). Field-builder default rendering should suffice; add a `FieldOverrides` entry only if needed.

---

## Tests (per test-coverage discipline)

- **Unit:** matched file renames to `<base>-<plex-suffix>.<ext>`.
- **Unit:** unmatched file emits `skippedFilename` event.
- **Unit:** duplicate target names trigger the shared duplicate-handling prompt.
- **Unit:** Zod schema rejects requests with no DVD Compare identifier.
- **Integration:** end-to-end run against a fixture with 3 files (2 matched + 1 unmatched) → 2 renames + 1 skip event.
- **e2e:** create sequence with this command in the web UI; runs against a temp folder.

---

## TDD steps

1. Failing tests above.
2. Sketch the new app-command file using fake DVD Compare client.
3. Import the shared modules from worker 3a's split.
4. Add Zod schema; register in `commandRoutes.ts`.
5. Add CLI command file; register in `cli.ts`.
6. Run integration + e2e; verify file behavior.
7. Full gate.

---

## Files

**Create:**
- `packages/server/src/app-commands/onlyNameSpecialFeaturesDvdCompare.ts`
- `packages/cli/src/cli-commands/onlyNameSpecialFeaturesDvdCompareCommand.ts`
- Tests for both

**Modify:**
- [packages/server/src/api/schemas.ts](../../packages/server/src/api/schemas.ts)
- [packages/server/src/api/routes/commandRoutes.ts](../../packages/server/src/api/routes/commandRoutes.ts)
- [packages/cli/src/cli.ts](../../packages/cli/src/cli.ts)

---

## Verification checklist

- [ ] Workers 22 ✅, 35 ✅, 3a ✅ merged before starting
- [ ] Worktree created
- [ ] Manifest row → `in-progress`
- [ ] Failing tests committed first
- [ ] New app-command file under 250 lines (forcing narrow scope + reuse)
- [ ] Unknown files skip with log; no fuzzy fallback
- [ ] Reuses worker-3a's modular helpers (no helper duplication)
- [ ] CLI invocation works: `yarn media only-name-special-features-dvd-compare --source-path ./fixture`
- [ ] CommandPicker shows the new command
- [ ] `dvdCompareId` field is linkable to a Variable
- [ ] Standard gate clean
- [ ] PR opened
- [ ] Manifest row → `done`

## Out of scope

- TMDB integration (use the existing `nameSpecialFeaturesDvdCompareTmdb` for that).
- Edition folder organization (movies-only; this command is non-movie).
- Fuzzy fallback for unnamed files (use the bigger command).
- Any change to the existing NSF commands' behavior.
