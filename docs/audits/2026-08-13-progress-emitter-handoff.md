# 2026-08-13 — Fix handoff: progress display (filesDone stuck at 0/N, stale final frame)

Work list for another agent. Tracked as **[issue #214](https://github.com/Sawtaytoes/mux-magic/issues/214)**.

Both bugs are **display-only** — no correctness impact. They were found during a real
14-file / ~78 GB anime ingest ([the two-release runbook](../combining-two-releases.md))
where the pipeline produced perfect output while the UI showed `0/12 files` and a step
frozen at `6/14 · 43%`. The owner reasonably read that as a hung job and stopped to
verify files on disk by hand. **That wasted-trust cost is the reason to fix this** —
progress that lies is worse than no progress.

Follow [AGENTS.md](../../AGENTS.md), the [decision log](../decisions/README.md), and the
[testing rules](../agents/testing.md).

All line numbers are against `1bcca422`.

---

## P0 — A. `filesDone` is pinned at 0 for four commands

- **Symptom:** `Step flattenReplace — 0/12 files · 100%`. The byte ratio advances
  normally; the file counter never moves off zero for the entire step.

- **Problem:** the `FileTracker.finish()` JSDoc
  (`packages/core/src/tools/progressEmitter.ts:52-57`) says it *"Marks this file done.
  Folds its size into the cumulative byte tally …, **increments filesDone**, and removes
  the tracker …"*. The implementation
  (`packages/core/src/tools/progressEmitter.ts:302-319`) explicitly does the opposite:

  ```ts
  // filesDone is NOT incremented here — only emitter.incrementFilesDone()
  // does that. tracker.finish() only manages the currentFiles display.
  ```

  `filesDone` is bumped **only** by `emitter.incrementFilesDone()`, which is wired in
  exactly one place: the `withFileProgress` operator
  (`packages/core/src/tools/progressEmitter.ts:445`). Any command that constructs its own
  emitter via `createProgressEmitter` + `startFile`/`finish` therefore never increments
  it:

  | Command | file | `incrementFilesDone` calls |
  | --- | --- | --- |
  | `copyFiles` | `packages/core/src/app-commands/copyFiles.ts` | 0 |
  | `moveFiles` | `packages/core/src/app-commands/moveFiles.ts` | 0 |
  | `flattenOutput` | `packages/core/src/app-commands/flattenOutput.ts` | 0 |
  | `distributeFolderToSiblings` | `packages/core/src/app-commands/distributeFolderToSiblings.ts` | 0 |

  Commands on the `withFileProgress` path are fine — `replaceFlacWithPcmAudio` correctly
  reported `6/14` in the same run. **The JSDoc/implementation disagreement is the actual
  defect**: it guarantees the next person wiring up an emitter gets this wrong too.

- **Fix:** pick ONE owner for `filesDone` and make the contract agree with itself.
  Preferred: let `finish()` own the increment (it already owns the byte fold and the
  `activeFiles` removal, and it is already idempotent via the
  `state.activeFiles.has(trackerId)` guard, so it is the natural home) — then remove the
  `rxFinalize(() => emitter.incrementFilesDone())` wiring in `withFileProgress` so
  `withFileProgress` callers don't **double-count**. Verify that operator's callers all
  go through `startFile`/`finish` before removing it; the ones that don't (generic
  iterators with no per-file identity, which is why `incrementFilesDone` exists) must
  keep calling it explicitly. If that audit shows the split has to stay, then instead fix
  the JSDoc and add the four calls above.

- **Watch out for:** double-counting is the real hazard here, and it is silent — the bar
  would read `24/12`. Whatever direction you choose, assert the exact final count.

- **Acceptance:**
  - Unit test per affected command: a completed run emits a final snapshot with
    `filesDone === totalFiles` (not 0, not 2×).
  - A `withFileProgress`-based command still reports exactly `totalFiles` (regression
    guard against double-counting).
  - JSDoc on `FileTracker.finish` matches what the code does.

---

## P1 — B. Completed steps keep a stale final frame

- **Symptom:** `Step flacToPcm — 6/14 files · 43%`, every per-file row at `0%`, still
  rendered long after the backend recorded that step `completed` and moved on to the next
  one. Indistinguishable from a hang.

- **Problem:** `tick()` (`packages/core/src/tools/progressEmitter.ts:218-238`) throttles
  emissions to one per `THROTTLE_INTERVAL_MS = 1000`, stashing the newest snapshot in
  `state.pendingPayload`. `finalize()`
  (`packages/core/src/tools/progressEmitter.ts:337-344`) then **cancels the pending timer
  and drops the buffered payload without ever flushing it**:

  ```ts
  finalize: () => {
    if (state.pendingTimer !== null) { clearTimeout(state.pendingTimer); state.pendingTimer = null }
    state.pendingPayload = null
  },
  ```

  So the last frame the UI ever receives is whatever the throttle happened to flush — and
  every update after that, including the one that would have shown the step finishing, is
  discarded. Any step whose remaining work completes inside a 1s window ends its life
  displaying a stale intermediate state.

  This is a **deliberate** choice, so treat it as a decision to revisit rather than an
  oversight — the comment at `progressEmitter.ts:79-82` reads *"Does NOT emit a final
  100% — the job's natural status flip to `completed` is enough signal for the UI to
  clear the bar."* For the per-step cards in a sequence run, that signal demonstrably is
  not enough. Confirm whether the sequence step card subscribes to job status at all
  before choosing the fix.

- **Fix (decide between, don't do both blindly):**
  1. **Emitter-side:** have `finalize()` flush `pendingPayload` (synchronously) instead of
     discarding it, so the final rendered frame reflects the true end state. Cheapest and
     fixes it for every consumer. Note `finalize()` is called from RxJS
     `finalize()`/`catchError()`/cancellation paths — a flush on the **cancelled** path
     must not paint a misleading "done" frame, so flush the *snapshot*, not a synthesized
     100%.
  2. **UI-side:** have the step card clear/complete its progress when the job status flips
     to `completed`/`failed`/`cancelled`. Belt-and-braces; also covers a dropped SSE
     frame. Worth doing regardless of (1).

- **Acceptance:**
  - Test that a step whose work finishes inside the throttle window still emits a terminal
    snapshot matching its end state.
  - Test that the cancelled path does not emit a fabricated completion.
  - Manual: run any sequence with several short steps and confirm no card is left showing
    a partial count after the run ends.

---

## Notes for whoever picks this up

- Reproducing needs no big media: any sequence with a `copyFiles` step shows **A**
  instantly, and **B** shows on any step short enough to finish between flushes.
- `POST /api/sequences/validate` (note the `/api` prefix and
  `Accept: application/json`) validates a hand-written sequence with no side effects —
  useful for building a repro sequence quickly.
- Don't "fix" the symptom in the web layer by hiding the counter. The counter is correct
  for `withFileProgress` commands; the bug is that half the commands never feed it.
