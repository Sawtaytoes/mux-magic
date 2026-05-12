# Worker 13 — merge-subtitles-offsets-label

**Model:** Haiku · **Thinking:** OFF · **Effort:** Low
**Branch:** `feat/mux-magic-revamp/13-merge-subtitles-offsets-label`
**Worktree:** `.claude/worktrees/13_merge-subtitles-offsets-label/`
**Phase:** 1B web
**Depends on:** 01
**Parallel with:** all other 1B web workers

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Yarn only. See [AGENTS.md](../../AGENTS.md).

## Your Mission

The Merge Subtitles/Tracks card has an unnamed numeric-array field for **offsets** (must be 1:1 with the number of episodes being merged). Add:
1. A clear label: "Offsets (milliseconds, one per episode)"
2. Help text below: "Provide one offset per source file. The order must match the order of episodes selected above. Negative values shift the subtitle earlier; positive values shift it later. This field is only useful for manual runs; sequences and schedules should rely on auto-aligned tracks."

### Investigation

Find the Merge Subtitles command's UI card. The command is at [packages/server/src/cli-commands/mergeSubtitlesCommand.ts](../../packages/server/src/cli-commands/mergeSubtitlesCommand.ts) — the schema there defines the field name (search for `offsets` or similar). The UI uses generic StepCard, so the label comes from the field's `description` in the command schema, not from a card-specific component.

The fix is likely:
- Update the field's `description` in the command's Zod schema (in `packages/server/src/api/schemas.ts` or similar — see how worker `04`'s description-build script consumes these).
- Re-run `yarn build:command-descriptions` so the new description propagates to the UI.

### Verification of root cause

If you find that the field IS named correctly in the schema but the UI doesn't render it, the bug is in the schema-to-UI label mapping. Investigate before assuming the schema description is the right surface.

## TDD steps

1. Find the schema location and the current field definition.
2. Write a failing test asserting `mergeSubtitlesCommandSchema` has a `description` on the offsets field. Commit.
3. Add the description per the spec above.
4. Run `yarn build:command-descriptions`.
5. Visually verify in dev server + Storybook (the MergeSubtitles step now shows the label).

## Files

- Server-side command schema (find via grep for the existing offsets field)
- `packages/server/scripts/build-command-descriptions.ts` (read-only — verify it picks up the new description)
- The generated descriptions file (committed output)

## Verification checklist

- [ ] Worktree created
- [ ] Manifest row → `in-progress`
- [ ] Schema description added per spec
- [ ] Description regen committed
- [ ] Storybook + dev server show the new label
- [ ] Standard gate clean
- [ ] PR opened
- [ ] Manifest row → `done`

## Out of scope

- Adding validation logic for "must be 1:1 with episode count" (separate worker, possibly future)
- Renaming the underlying schema field
- Changing offset semantics (negative vs positive)
