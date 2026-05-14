# Worker 27 — nsf-cache-state-persistence

**Model:** Sonnet · **Thinking:** ON · **Effort:** High
**Branch:** `feat/mux-magic-revamp/27-nsf-cache-state-persistence`
**Worktree:** `.claude/worktrees/27_nsf-cache-state-persistence/`
**Phase:** 3 (Name Special Features overhaul, but the job-state change is global)
**Depends on:** 25 (implicit dependency on 3a; coordinates on cache directory layout)
**Parallel with:** 26 (different module)

---

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Tests must cover the change scope. Yarn only. See [AGENTS.md](../../AGENTS.md). Background context lives in [docs/PLAN.md §9](./PLAN.md).

---

## Your Mission

Two coupled changes:

1. **Add `paused` to the global `JobStatus` enum** with a separate `reason` field for human-readable cause.
2. **Persist NSF state to disk** so a paused job (e.g., waiting for user input on an unnamed file) survives a server restart and can be resumed.

### Why these are coupled

Today, the user's interaction with the NSF command relies on **in-memory SSE prompts**. If the server restarts while a job is waiting for the user to pick a candidate for an unnamed file, the job is lost — no record on disk that it existed, no way to resume.

Combining (1) and (2): the `paused` state has a defined meaning (the job is awaiting external input) **and** the job's state is on disk so it can be revived after a restart.

---

### Change 1: JobStatus enum — add `paused`

Per the exploration of [packages/server/src/api/types.ts](../../packages/server/src/api/types.ts):

```ts
export type JobStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "skipped"
```

Becomes:

```ts
export type JobStatus =
  | "pending"
  | "running"
  | "paused"      // NEW: awaiting external input (e.g., user pick, network reconnect)
  | "completed"
  | "failed"
  | "cancelled"
  | "skipped"

export type JobPauseReason =
  | "user_input"  // waiting for the user to respond to a prompt
  | "rate_limit"  // backing off a third-party API
  // future reasons added as needed
```

The `Job` type gains a `pauseReason: JobPauseReason | null` field. Non-paused jobs have `pauseReason: null`.

State machine:

- `pending → running` (start)
- `running → paused` (handler emits a prompt; awaiting answer)
- `paused → running` (answer received; pipeline resumes)
- `running → completed | failed | cancelled` (terminal)
- `paused → cancelled` (user cancels while paused)
- `running → skipped` (sequence step skipped because parent failed)

The `running → paused` transition needs to be reachable from inside the observable pipeline. Wire it through the existing `updateJob` call from wherever prompts are emitted (search for the prompt-event emitter; it's tied to the SSE channel today).

### Change 2: On-disk job persistence

Today `jobStore` is in-memory only. Add a write-through persistence layer:

- **Location:** `<userDataDir>/mux-magic/jobs/` — one JSON file per job, named `<jobId>.json`. Coordinate directory layout with worker 25 (unnamed cache lives under the same `<userDataDir>/mux-magic/` root).
- **Write triggers:** on every job update that changes `status`, `error`, `pauseReason`, or appends to `outputs`. Don't write on every log append (would thrash disk); write logs separately.
- **Logs:** append to `<userDataDir>/mux-magic/jobs/<jobId>.log` as plain text, one line per log entry. Append-only, never rewrites.
- **Read on server boot:** scan `<userDataDir>/mux-magic/jobs/*.json`. Reconstruct jobs into the in-memory store. Jobs in `running` state at restart get reset to `failed` with `error: "server restarted while running"` — they can't be safely resumed mid-pipeline. Jobs in `paused` state are kept as `paused` and can be resumed when the user re-engages.

### Resuming a paused job

For `paused` jobs:

- The web UI surfaces them in a "Paused Jobs" view with a "Resume" button.
- Resume triggers a new SSE channel for that job, reattaching to the (presumably still-pending) prompt.
- **Caveat:** the underlying pipeline (the observable) is gone after a server restart. Resuming a job that was paused before a restart actually means **re-running the command from a known checkpoint**. Today there's no checkpointing; the command starts over.
- For the first version of this worker: a resumed-after-restart `paused` job simply re-runs the whole command. The cache from worker 25 (unnamed file choices) means the user doesn't re-answer the same prompts. **Acceptable for v1.**
- A future worker can add true mid-pipeline checkpointing.

### Cleanup

- Jobs older than 30 days (configurable via `JOB_RETENTION_DAYS` env var, default 30) are pruned on server boot.
- Completed jobs older than 7 days are pruned on a periodic interval (every hour during server uptime).
- The user can manually clear all jobs via a UI button or `DELETE /jobs` API endpoint.

### Implementation notes

- Use a **write-after-update** strategy: every `updateJob` call also writes the JSON. Atomic write via temp-file + rename to avoid corruption on crash.
- The directory `<userDataDir>/mux-magic/` — determine the correct platform path:
  - Windows: `%APPDATA%/mux-magic/` (typically `C:\Users\<user>\AppData\Roaming\mux-magic\`)
  - macOS: `~/Library/Application Support/mux-magic/`
  - Linux: `${XDG_DATA_HOME:-~/.local/share}/mux-magic/`
  - Use a small library like `env-paths` or implement directly; do not hardcode `~/.mux-magic/`.
- Provide a config override via `MUX_MAGIC_DATA_DIR` env var for testing and unconventional setups.

---

## Tests (per test-coverage discipline)

- **Unit:** `JobStatus` includes `paused`; `JobPauseReason` defined.
- **Unit:** `updateJob` with `status: "paused"` writes JSON to disk.
- **Unit:** server boot scans the jobs directory and reconstructs the in-memory store.
- **Unit:** jobs in `running` state at boot are reset to `failed`.
- **Unit:** prune-on-boot deletes job files older than the retention threshold.
- **Integration:** start a sequence; pause it; restart the server; the paused job appears in the jobs list with `paused` status.
- **Integration:** atomic write — kill the process mid-write; the on-disk file is either the old or new contents, never garbage.
- **e2e:** web UI shows "Paused Jobs" view with paused jobs and a Resume button.

---

## TDD steps

1. Failing tests above.
2. Add `paused` to `JobStatus`; add `pauseReason` to `Job` type; thread through all switch/case sites that exhaustively match `JobStatus`.
3. Add disk-persistence layer in `jobStore.ts`: `persistJob(job)`, `readPersistedJobs()`, atomic write via temp-file + rename.
4. Wire `updateJob` to call `persistJob` after each in-memory update.
5. Add boot-scan logic in server startup.
6. Add prune-on-boot + interval prune.
7. Add the "Paused Jobs" UI view + Resume button.
8. Wire the prompt-emit path to set `status: "paused"` and `pauseReason: "user_input"` before emitting; restore `running` on answer.
9. Full gate.

---

## Files

- [packages/server/src/api/types.ts](../../packages/server/src/api/types.ts) — extend `JobStatus`, `Job`, add `JobPauseReason`
- [packages/server/src/api/jobStore.ts](../../packages/server/src/api/jobStore.ts) — persistence layer
- New: `packages/server/src/api/jobPersistence.ts` (atomic write + read + prune helpers)
- [packages/server/src/server.ts](../../packages/server/src/server.ts) — call boot-scan on startup
- Wherever prompts are emitted (search for `PromptEvent` emitters) — wire pause/unpause transitions
- Web UI: paused-jobs view, Resume button (search [packages/web/src/components/](../../packages/web/src/components/))
- Tests for all of the above

---

## Verification checklist

- [ ] Worker 25 ✅ merged before starting
- [ ] Worktree created
- [ ] Manifest row → `in-progress`
- [ ] Failing tests committed first
- [ ] `JobStatus` includes `paused`; `pauseReason` field on `Job`
- [ ] Job state persisted on every status change
- [ ] Server boot reconstructs in-memory store from disk
- [ ] `running` at restart → reset to `failed`
- [ ] Atomic write tested via mid-write kill scenario
- [ ] Paused-jobs UI view + Resume button work end-to-end
- [ ] Prune-on-boot + interval prune work per retention thresholds
- [ ] Coordinated with worker 25 on `<userDataDir>/mux-magic/` layout
- [ ] Standard gate clean
- [ ] PR opened
- [ ] Manifest row → `done`

## Out of scope

- True mid-pipeline checkpointing (resume from exact operator). The v1 behavior is "re-run from the start; user's cached answers carry forward."
- Sharing job state across multiple server instances (no multi-server support).
- Encrypting persisted job state (out of scope unless the user adds it).
- Worker-25's unnamed cache mechanics (different file; just shares the parent directory convention).
