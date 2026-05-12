# Worker 15 — dry-run-silent-failures

**Model:** Sonnet · **Thinking:** ON · **Effort:** Medium
**Branch:** `feat/mux-magic-revamp/15-dry-run-silent-failures`
**Worktree:** `.claude/worktrees/15_dry-run-silent-failures/`
**Phase:** 1B web
**Depends on:** 01
**Parallel with:** all other 1B web workers

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Yarn only. See [AGENTS.md](../../AGENTS.md).

## Your Mission

Four sequence-builder cards fail silently on dry-run: Merge Tracks, Copy Files, Delete File by Extension, Modify Subtitles Metadata. When dry-run fails (server returns error), the user gets no feedback in the UI. The OLD master had nicer "Logs" + "Output" display on each card; the React port lost that.

### Root cause hypothesis

Likely all four cards rely on the same step-run pipeline, and the error-surfacing pathway broke or was never re-implemented in the React port. Investigate one card end-to-end (e.g., Copy Files), find why the error isn't shown, fix at the shared layer.

### Implementation outline

1. Trigger a dry-run failure on Copy Files (set `failureMode = true` in dry-run state, click Run).
2. Observe what the server returns: probably a `JobStatus = "failed"` with an `error` field.
3. Find where step-run results are rendered on the card. Likely there's a `<StepResults>` or similar component that shows status + logs.
4. Identify why errors don't display:
   - Maybe the result atom only listens for success.
   - Maybe the error field path is wrong.
   - Maybe the renderer requires non-empty logs.
5. Fix at the shared layer so all four cards (and any others) benefit.

### Tests

For each of the four cards: render in a Jotai store that has dry-run + failure mode on; dispatch run; assert the error message appears in the rendered output.

## TDD steps

1. Write failing tests for all four cards. Commit `test(cards): failing dry-run error display`.
2. Investigate root cause (one card, end-to-end).
3. Fix at the shared layer.
4. Verify all four tests pass.

## Files

- Likely a shared result-renderer: `packages/web/src/components/StepResults/` or similar (grep for the existing pattern that DOES show errors on other cards)
- Step-run atoms (`runOrStopStepAtom`, etc.)
- The four card components or their schema
- Tests for each

## Verification checklist

- [ ] Worktree created
- [ ] Manifest row → `in-progress`
- [ ] Failing tests for all four cards
- [ ] Root cause documented in PR
- [ ] Fix at shared layer (not 4 separate patches)
- [ ] Manual verification on dev server: run each card with dry-run + failureMode; confirm error visible
- [ ] Standard gate clean
- [ ] PR opened
- [ ] Manifest row → `done`

## Out of scope

- Adding new error types or categorization
- Improving the visual design of error display beyond restoring parity with master
- Fixing other cards beyond the four named (file separate followup workers if found)
