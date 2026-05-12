# Worker 17 — run-in-background-sequence-modal

**Model:** Sonnet · **Thinking:** ON · **Effort:** High
**Branch:** `feat/mux-magic-revamp/17-run-in-background-sequence-modal`
**Worktree:** `.claude/worktrees/17_run-in-background-sequence-modal/`
**Phase:** 1B web
**Depends on:** 10 (apirunmodal-rename — modal must be renamed to SequenceRunModal first)
**Parallel with:** all other 1B web workers EXCEPT 10

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Yarn only. See [AGENTS.md](../../AGENTS.md).

## Your Mission

Add "Run in background" capability to the Sequence Run modal (renamed from `ApiRunModal` by worker `10`):

1. An explicit **"Run in background"** button alongside the existing Cancel.
2. Clicking the **backdrop** (or pressing Escape) also moves the modal to background — does NOT cancel the job.
3. **Only the explicit Cancel button** cancels the job. Backgrounding leaves the job running; the user can find it in the Jobs screen.

### State design

Currently the modal is open/closed binary. Add a third state: backgrounded. Sketch:

```ts
type SequenceRunModalState =
  | { mode: "closed" }
  | { mode: "open"; source: "step" | "sequence"; jobId: string }
  | { mode: "background"; source: "step" | "sequence"; jobId: string }
```

When backgrounded, the modal unmounts (or hides via CSS) but the job + SSE subscription stay alive. A small toast or status badge in the header indicates "1 background job running."

### Re-opening a backgrounded modal

Two options:
- **A. Click the "1 background job" badge** to re-open the modal with the same jobId, state synced from the existing SSE subscription.
- **B. Click the job in the Jobs screen** to re-open with the same jobId.

Pick whichever is more discoverable. Document choice in PR.

### Cancellation discipline

The existing Cancel button should still terminate the job server-side. Verify the SSE close + DELETE request still happen — backgrounding must NOT trigger any server-side cancel.

### Edge cases

- Job completes while backgrounded → toast or notification surfaces "Sequence X completed."
- Multiple backgrounded jobs → header badge shows count, click expands a list.
- Page navigation away → backgrounded job keeps running; on return, badge still visible if job still active.

## TDD steps

1. Failing test: click "Run in background" while modal open; modal should unmount but a `runningJobAtom` still has the jobId. Commit.
2. Failing test: click backdrop; same behavior.
3. Failing test: click Cancel button; server DELETE called.
4. Implement state machine + UI.
5. Verify all three tests pass.

## Files

- `packages/web/src/components/SequenceRunModal/SequenceRunModal.tsx` (post-worker-10 rename)
- Modal state atoms
- Header component (to add the "background jobs" badge)
- Possibly Jobs screen integration
- Tests + stories

## Verification checklist

- [ ] Worktree created
- [ ] Worker 10 ✅ merged before starting (verify in manifest)
- [ ] Manifest row → `in-progress`
- [ ] Failing tests committed first
- [ ] "Run in background" button added
- [ ] Backdrop click backgrounds (doesn't cancel)
- [ ] Cancel button still cancels (server DELETE called)
- [ ] Re-open path implemented (Option A or B documented in PR)
- [ ] Multi-background-job badge in header
- [ ] E2E: full background → re-open → cancel flow passes
- [ ] Standard gate clean
- [ ] PR opened
- [ ] Manifest row → `done`

## Out of scope

- Notifications API integration (browser-level system notifications)
- Persisting backgrounded jobs across page reloads (job state lives in atoms; reload re-fetches via Jobs endpoint anyway)
- Renaming "Cancel" to "Stop" or any UX terminology changes
