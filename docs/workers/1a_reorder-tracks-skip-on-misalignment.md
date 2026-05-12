# Worker 1a — reorder-tracks-skip-on-misalignment

**Model:** Sonnet · **Thinking:** ON · **Effort:** Medium
**Branch:** `feat/mux-magic-revamp/1a-reorder-tracks-skip-on-misalignment`
**Worktree:** `.claude/worktrees/1a_reorder-tracks-skip-on-misalignment/`
**Phase:** 1B other
**Depends on:** 01
**Parallel with:** all other 1B workers

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Yarn only. See [AGENTS.md](../../AGENTS.md).

## Your Mission

The `reorderTracks` command currently fails when a file's track count doesn't match the supplied indexes (e.g., asked to reorder track 3 but file has only 2 tracks). Add a **"skip on track misalignment"** option that lets the sequence continue gracefully:

1. New schema field on the command: `shouldSkipOnTrackMisalignment: boolean` (default `false` — preserve current behavior for existing sequences).
2. When `true` and a file's track count doesn't match: log a warning (structured: "skipped — track misalignment, expected N, got M") and move to the next file.
3. UI: checkbox on the reorderTracks card.
4. Logs: even when `shouldSkipOnTrackMisalignment === false` (default behavior), the existing error message should note "tracks should align if the command was added correctly".

### Implementation files

- [packages/server/src/cli-commands/reorderTracksCommand.ts](../../packages/server/src/cli-commands/reorderTracksCommand.ts)
- [packages/server/src/app-commands/reorderTracks.ts](../../packages/server/src/app-commands/reorderTracks.ts)
- Web UI: generic StepCard reads from the command schema, so the checkbox will auto-appear once the schema is updated. Verify by running dev server after schema change.

### Why not a DSL-based pre-check?

The task list noted: "We might need another solution entirely like something that checks the track count and feeds it to this function. But that might be too complicated as we'd need the DSL here." **Out of scope for this worker.** The checkbox is the immediate fix; a future worker (likely `24 source-path-abstraction` or beyond) can layer DSL-based validation.

## TDD steps

1. Failing tests:
   - With `shouldSkipOnTrackMisalignment: true`: run on a 2-track file with reorder indexes for 3 tracks. Assert the command logs a skip and doesn't error.
   - With `shouldSkipOnTrackMisalignment: false` (default): same input errors as today.
   Commit.
2. Add the schema field.
3. Implement the skip path in `reorderTracks.ts`.
4. Update error message to mention "tracks should align if the command was added correctly".
5. Run `yarn build:command-descriptions` so the UI label / help text pick up the new field.

## Files

- [packages/server/src/cli-commands/reorderTracksCommand.ts](../../packages/server/src/cli-commands/reorderTracksCommand.ts) — yargs flag
- [packages/server/src/app-commands/reorderTracks.ts](../../packages/server/src/app-commands/reorderTracks.ts) — handler logic
- The command schema (find via grep for the existing reorderTracks Zod schema)
- Tests
- Description regen output

## Verification checklist

- [ ] Worktree created
- [ ] Manifest row → `in-progress`
- [ ] Failing tests first
- [ ] Schema field added (boolean prefix per AGENTS.md: `shouldSkip...`)
- [ ] Skip path implemented and logged
- [ ] Default behavior unchanged for existing sequences
- [ ] UI checkbox auto-renders (verify in dev server)
- [ ] Standard gate clean
- [ ] PR opened
- [ ] Manifest row → `done`

## Out of scope

- DSL-based pre-validation of track counts
- Other "skip on X" options for other commands
- Changing the underlying ffmpeg/mkvmerge spawn behavior
