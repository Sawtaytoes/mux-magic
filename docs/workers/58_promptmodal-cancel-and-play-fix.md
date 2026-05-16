# Worker 58 — nsf-restore-interactive-flow

> **Note on the slug:** filename keeps its original `58_promptmodal-cancel-and-play-fix.md` per the "never renumber filed workers" rule. The branch/worktree slug below reflects the absorbed scope. The original PromptModal bug-fix is Part A; Parts B and C absorb worker 59's Smart Match port and the dry-run fake-mode prompt regression that came up while triaging this worker.

**Model:** Sonnet · **Thinking:** ON · **Effort:** High
**Branch:** `feat/mux-magic-revamp/58-nsf-restore-interactive-flow`
**Worktree:** `.claude/worktrees/58_nsf-restore-interactive-flow/`
**Phase:** 3 (Name Special Features overhaul — restoration sweep)
**Depends on:** —
**Parallel with:** any worker that doesn't touch [PromptModal.tsx](../../packages/web/src/components/PromptModal/PromptModal.tsx), [FileExplorerModal.tsx](../../packages/web/src/components/FileExplorerModal/FileExplorerModal.tsx), the NSF result card, the NSF summary record types, or the NSF fake-data scenario.

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Yarn only. See [AGENTS.md](../../AGENTS.md).

## Your Mission

**Restore Name Special Features to its v1.0.0 interactive behavior.** Three regressions ship together because they share components, event channels, and one mental model: *"the user must be able to interactively review and rename the files NSF couldn't auto-name."*

The three parts:

- **Part A — PromptModal bugs.** Per-file category picker has a broken Play button and no clear cancel-out. Originally the entire scope of this worker.
- **Part B — Smart Match modal regression.** The batch table modal that surfaced *after* a run for leftover unnamed files (lived at `packages/web/public/builder/js/components/specials-mapping-modal.js`, added 2026-05-08 in commit `a7fef431`, deleted 2026-05-10 in commit `28534ec5`) was never ported to React. Restore it.
- **Part C — Fake-mode interactive prompts.** A dry-run / fake-mode NSF execution today auto-skips the interactive choices ([fake-data scenario at line 125-126](../../packages/server/src/fake-data/scenarios/nameSpecialFeaturesDvdCompareTmdb.ts#L125-L126) literally says *"auto-skip after a short pause so the sequence doesn't block waiting for user input"*). The v1.0.0 dry-run fired the same prompts a real run would, which is how the user could QA the interactive flow without a real disc rip. Rewire the fake scenario to emit those prompts.

The unifying theme: a user running NSF today — real or fake — cannot exercise the interactive review UX that v1.0.0 shipped with. Until this worker lands, NSF is one of the most-used commands in the app and one of the most broken.

Worker 25 builds on this worker for the *upgrade* layer (duration-weighted ranking, order tie-break, per-release cache). Get this worker green before starting 25.

---

## Part A — PromptModal: Play button + clear cancel-out

The PromptModal — the interactive picker that surfaces when a running command emits a `type: "prompt"` SSE event (e.g. NSF asking the user to categorize a file as `behindthescenes` / `deleted` / `featurette` / etc.) — has two user-blocking bugs that share the same action area.

### Bug A1 — The `▶ Play` button does nothing

Clicking `▶ Play` in the PromptModal silently no-ops. The user sees no preview, no error, nothing.

**Root cause:** [PromptModal.tsx:164-172](../../packages/web/src/components/PromptModal/PromptModal.tsx#L164-L172) and the per-option play at [PromptModal.tsx:213-222](../../packages/web/src/components/PromptModal/PromptModal.tsx#L213-L222) both call `window.openVideoModal(promptData.filePath)`. That global function is registered by [FileExplorerModal.tsx:395-402](../../packages/web/src/components/FileExplorerModal/FileExplorerModal.tsx#L395-L402) inside a `useEffect`, and it just calls `setVideoPath(absolutePath)` — local React state inside FileExplorerModal.

The problem is the next line: [FileExplorerModal.tsx:426](../../packages/web/src/components/FileExplorerModal/FileExplorerModal.tsx#L426) is `if (!explorerState) return null`. When the file explorer is NOT open (the normal case when PromptModal fires), the entire FileExplorerModal renders `null`, so the `<VideoModal />` sub-component at [line 773](../../packages/web/src/components/FileExplorerModal/FileExplorerModal.tsx#L773) never mounts. The `setVideoPath` call succeeds and updates internal state — that state then sits in a component that renders nothing.

Net effect: `window.openVideoModal` is a global that **only works when the file explorer happens to be open**. From the PromptModal it never does.

### Bug A2 — No clear way to cancel out

Three ways to dismiss the PromptModal today, none clear or correct:

1. **Backdrop click** → [PromptModal.tsx:140](../../packages/web/src/components/PromptModal/PromptModal.tsx#L140) calls `close()` which just nulls `promptModalAtom`. Server observable stays suspended; job stays `running`. Nothing in the UI tells the user this.
2. **Escape** → [PromptModal.tsx:91-117](../../packages/web/src/components/PromptModal/PromptModal.tsx#L91-L117) submits `-2` cancel if present, else `-1` skip, else nothing. For NSF prompts the options are `0..7` plus `-1` (Skip), so Escape submits `-1` — skips THIS file, not cancels the job.
3. **Backdrop out → scroll to step card → Stop on the running step.** The only true cancel, and the user has to discover it.

No visible `Cancel`, `Stop`, or `X` inside the modal explicitly cancels the running job. The modal also gives no visual signal that closing it leaves the job blocked.

User's verbatim feedback: *"Technically, there is. I just click out and hit 'stop' on the job. But it's not clear."*

### What to ship for Part A

#### A1 fix — decouple `▶ Play` from FileExplorerModal

Promote the video preview sub-modal into its own standalone component driven by a Jotai atom. Mount it once at app top-level alongside `<PromptModal />` and `<FileExplorerModal />` in [BuilderPage.tsx](../../packages/web/src/pages/BuilderPage/BuilderPage.tsx).

- New `packages/web/src/components/VideoPreviewModal/VideoPreviewModal.tsx`. Lift the video sub-modal at [FileExplorerModal.tsx:773](../../packages/web/src/components/FileExplorerModal/FileExplorerModal.tsx#L773) into it.
- New atom `packages/web/src/components/VideoPreviewModal/videoPreviewModalAtom.ts` holding `{ path: string } | null`.
- In `PromptModal.tsx`, replace both `window.openVideoModal(...)` calls with `setVideoPreview({ path: ... })` using `useSetAtom(videoPreviewModalAtom)`.
- In `FileExplorerModal.tsx`, **delete** the `useEffect` that assigns `window.openVideoModal` and the local `videoPath` state. Replace the in-explorer Play buttons with the same atom setter. Delete the `videoPath`-dependent Escape branch in the keydown effect — VideoPreviewModal handles its own Escape.
- In [types.window.d.ts](../../packages/web/src/types.window.d.ts), remove the `openVideoModal` declaration.
- Mount `<VideoPreviewModal />` in `BuilderPage.tsx`.
- Keep z-index ordering (VideoPreview > PromptModal > FileExplorerModal backdrop). VideoPreviewModal must NOT depend on `explorerState` — it renders iff its own atom is non-null.

#### A2 fix — explicit cancel-out

Add an in-modal action bar with **two visually distinct controls** at the bottom of the picker:

1. **`Cancel job`** (red / destructive, e.g. `bg-red-700`). Fires `DELETE /jobs/<promptData.jobId>` AND clears `promptModalAtom`. The corresponding step transitions to `cancelled` via the existing SSE-done flow ([useLogStream.ts:123-135](../../packages/web/src/hooks/useLogStream.ts#L123-L135) already clears the modal on `isDone` for the matching job).
2. **`Close (job stays running)`** (subdued / secondary). Just clears the atom. Inline note next to it: *"The pipeline will keep waiting for input."*

The existing **option buttons** (categorized choices the server sent) are unchanged.

#### Keyboard wiring

- **Digits `0..9`** — pick that option (unchanged).
- **`Space`** — pick `-1` Skip if it exists (unchanged).
- **`Escape`** — close the modal WITHOUT cancelling the job. (Don't make Escape destructive — pressing Escape to dismiss a modal is universal UX; the user shouldn't lose a long-running job by accident.)
- **`Ctrl+C`** (or `Cmd+C`) — fire `Cancel job`. There's no selection inside the modal so the global clipboard shortcut is fair game for the destructive cousin.

Document these in the modal itself — small `kbd` chips beneath the option list (matches the existing pattern at [PromptModal.tsx:189-193](../../packages/web/src/components/PromptModal/PromptModal.tsx#L189-L193) where digit hints are already shown).

#### Visual signal that the modal blocks the pipeline

Inline header line above the option list:

> ⏸ The pipeline is paused waiting for your choice.

---

## Part B — Restore the deleted Smart Match modal

The batch "Fix Unnamed" / "Smart Match" modal that v1.0.0 shipped is missing from the React app. It surfaced *after* a run completed in the NSF result card and let the user batch-review leftover unnamed files with per-row confidence scores, dropdowns, and an Apply button.

### Background

- **2026-05-08** — commit `a7fef431 feat(builder): smart-suggestion mapping modal for nameSpecialFeatures (Option C)`. Three files:
  - `packages/web/public/builder/js/util/specials-fuzzy.js` (182 lines) — pure scoring helper.
  - `packages/web/public/builder/js/util/specials-fuzzy.test.ts` (202 lines, 23 tests).
  - `packages/web/public/builder/js/components/specials-mapping-modal.js` (971 lines at delete time).
- **2026-05-10** — commit `28534ec5 chore(legacy): delete public/builder/ and public/vendor/` deleted them all.

Recover the deleted files from git history as the porting reference:

```sh
git show 28534ec5^:packages/web/public/builder/js/util/specials-fuzzy.js
git show 28534ec5^:packages/web/public/builder/js/util/specials-fuzzy.test.ts
git show 28534ec5^:packages/web/public/builder/js/components/specials-mapping-modal.js
```

### What the modal did

A confirmation table that appeared in the NSF result card iff there were leftover unrenamed files AND at least one DVDCompare candidate. Each row:

- Leftover filename + the file's runtime.
- Top suggested candidate name + a 0–1 confidence badge.
- Per-row include checkbox (off for low-confidence rows by default — threshold 0.6).
- Per-row dropdown listing the full candidate set so the user could override the top suggestion.

Rows below `LOW_CONFIDENCE_THRESHOLD = 0.6` were highlighted yellow with explicit "review me" styling. Single `Apply` button at the bottom fired one `POST /files/rename` per accepted row.

### Scoring (port verbatim from `specials-fuzzy.js`)

```text
combined = DURATION_WEIGHT * durationScore + (1 - DURATION_WEIGHT) * filenameScore
```

with `DURATION_WEIGHT = 0.7`, `DURATION_PROXIMITY_TOLERANCE_SECONDS = 90`, `FILENAME_ONLY_SCORE_FACTOR = 0.6`, `LOW_CONFIDENCE_THRESHOLD = 0.6`. Helpers: `parseTimecodeToSeconds`, `tokenizeWords`, combined-score entrypoint. Port verbatim with style/idiom updates to current code rules (no in-place sort, `const` only, etc.).

Scoring runs **inside the modal component** (client-side), as it did in the legacy modal. Worker 25 will move it server-side once the cache + payload upgrades arrive.

### Server-side payload change (minimal)

Today [nameSpecialFeaturesDvdCompareTmdb.events.ts:6-9](../../packages/server/src/app-commands/nameSpecialFeaturesDvdCompareTmdb.events.ts#L6-L9) has:

```ts
export type UnnamedFileCandidate = {
  filename: string
  candidates: string[]
}
```

Expand to:

```ts
export type UnnamedFileCandidate = {
  filename: string
  durationSeconds: number
  candidates: string[]
}
```

The pipeline already has each file's `timecode` in scope at [nameSpecialFeaturesDvdCompareTmdb.ts:184](../../packages/server/src/app-commands/nameSpecialFeaturesDvdCompareTmdb.ts#L184); thread it (as seconds) through [buildUnnamedFileCandidates.ts](../../packages/server/src/app-commands/nameSpecialFeaturesDvdCompareTmdb.buildUnnamedFileCandidates.ts) so the summary record carries the duration. Update the fake-data scenario to include `durationSeconds` too (the Smart Match modal needs it to render).

Don't introduce `CandidateScore`, don't add a new SSE prompt-event channel, don't change `possibleNames` — those are worker 25's.

While editing `buildUnnamedFileCandidates.ts`, **replace the in-place `.sort()` at [lines 45-48](../../packages/server/src/app-commands/nameSpecialFeaturesDvdCompareTmdb.buildUnnamedFileCandidates.ts#L45-L48)** — it violates the "no array mutation" rule.

### Where it mounts in the React app

- The "open the modal" trigger goes in whichever component renders an NSF step's result card. Search for where `unrenamedFilenames` / `unnamedFileCandidates` would be rendered today (likely not rendered at all — that's the gap). Add a `Smart Match…` button next to the result count, visible iff `unrenamedFilenames.length > 0 && possibleNames.length > 0 && sourcePath` resolvable.
- The atom payload: `{ jobId: string, stepId: string, sourcePath: string, unrenamedFiles: Array<{ filename: string; durationSeconds: number }>, candidates: Array<{ name: string; timecode?: string }> } | null`.
- Mount `<SmartMatchModal />` in [BuilderPage.tsx](../../packages/web/src/pages/BuilderPage/BuilderPage.tsx) alongside `<PromptModal />`, `<FileExplorerModal />`, and the new `<VideoPreviewModal />` from Part A.

### What Apply does

`POST /files/rename` per checked row (sequential). Same endpoint the legacy modal used. Modal closes when all renames complete; failed renames keep the row visible with the error inline. If the React-era API doesn't have a single-file rename route, audit `FileExplorerModal`'s rename action for the equivalent. **Don't introduce a new rename endpoint** in this worker — coordinate with whoever owns file-explorer routes if there's a gap.

---

## Part C — Fake-mode NSF should fire interactive prompts

[packages/server/src/fake-data/scenarios/nameSpecialFeaturesDvdCompareTmdb.ts](../../packages/server/src/fake-data/scenarios/nameSpecialFeaturesDvdCompareTmdb.ts) today:

- Phase 2 (line 92-96) emits a synthetic `collision: true` *result event* but never fires a `type: "prompt"` event the PromptModal listens for.
- Phase 4 (line 127-139) lists "Unnamed files with DVDCompare candidate associations" in the log but doesn't fire a Smart Match trigger — and the inline comment at line 125-126 explicitly says *"auto-skip after a short pause so the sequence doesn't block waiting for user input"*.

Rewire the scenario so a fake / dry-run gives the user the same interactive surface a real run would. Concretely:

- Phase 2 — instead of emitting only `collision: true`, also emit a `type: "prompt"` SSE event that opens PromptModal with a small option list (e.g. `Overwrite / Skip / Rename as (2)`). Wait for the user's choice (the scenario should `take(1)` from the prompt-response channel — pattern it after the real pipeline's `getUserSearchInput` flow). On `Cancel` from Part A's new button, the scenario observable terminates with `cancelled`.
- Phase 4 — emit the summary record with the new `durationSeconds`-bearing `unnamedFileCandidates` shape. The web result-card trigger from Part B then makes the `Smart Match…` button appear. The scenario completes after emitting the summary (the modal is post-run UX — it doesn't block scenario completion).
- The user must be able to dry-run-test all three Parts (PromptModal Play / Cancel, Smart Match modal rendering + Apply) end-to-end without a real DVD rip.

If the prompt channel infra requires more wiring on the fake-mode side (e.g. the fake scenario doesn't currently have a way to *await* a prompt response), document it and surface as a blocker — coordinate with whoever owns `promptStore.ts` / `getUserSearchInput.ts`.

---

## TDD steps

Land in this order — each step's tests stay green before adding the next:

### Part A

1. Failing test in `VideoPreviewModal.test.tsx`: setting the atom renders the video element; clearing it unmounts. Independent of FileExplorerModal mounting.
2. Update `PromptModal.test.tsx` so clicking `▶ Play` calls the atom setter (not `window.openVideoModal`).
3. Add `PromptModal.test.tsx` cases for `Cancel job` (fires `DELETE /jobs/<id>`, clears atom) and `Close (job stays running)` (clears atom only, no fetch). Add Escape semantic — close without submit/DELETE; add `Ctrl+C` semantic — destructive cancel.
4. Implement Part A; tests go green.

### Part B

1. Failing server-side test: `buildUnnamedFileCandidates` returns entries with `durationSeconds`. Update existing tests + add coverage for duration plumbing.
2. Implement server-side payload expansion. Update fake-data scenario's summary emission to carry `durationSeconds`.
3. Port `smartMatchScoring.ts` from `specials-fuzzy.js` + its 23-test file (recovered with `git show 28534ec5^:…`). All tests pass.
4. Build the `SmartMatchModal` React component + atom + tests + Storybook stories (`empty`, `all-high-confidence`, `mixed`, `all-low-confidence`) + mdx, per [docs/agents/storybook.md](../agents/storybook.md).
5. Wire the trigger button into the NSF result card. Component test: button visible iff conditions met; click sets the atom.
6. Apply test: N checked rows → exactly N `POST /files/rename` calls (mock `fetch`). Failed row → keeps row visible with error.

### Part C

1. Rewire fake scenario to emit `type: "prompt"` events for the Phase-2 collision and to surface `durationSeconds` on `unnamedFileCandidates`.
2. Integration test: in fake mode, the PromptModal opens for the collision; choosing an option advances the scenario; the post-run `Smart Match…` button appears.

### Cross-cutting

1. **e2e covering all three flows** (one spec, three sub-scenarios — share a single fake-mode run):
    - Click `▶ Play` from PromptModal → video preview overlay opens without the file explorer being open.
    - `Cancel job` → step transitions to `cancelled`; modal clears; SSE-done flow fires.
    - After run completes, `Smart Match…` button appears, opens modal, click `Apply` → renames fire, modal closes.
2. Full pre-merge gate.

---

## Files

**New:**

- [packages/web/src/components/VideoPreviewModal/VideoPreviewModal.tsx](../../packages/web/src/components/VideoPreviewModal/) (+ `.test.tsx`, `.stories.tsx`, `.mdx`)
- [packages/web/src/components/VideoPreviewModal/videoPreviewModalAtom.ts](../../packages/web/src/components/VideoPreviewModal/)
- [packages/web/src/components/SmartMatchModal/SmartMatchModal.tsx](../../packages/web/src/components/SmartMatchModal/) (+ `.test.tsx`, `.stories.tsx`, `.mdx`)
- [packages/web/src/components/SmartMatchModal/smartMatchModalAtom.ts](../../packages/web/src/components/SmartMatchModal/)
- [packages/web/src/components/SmartMatchModal/smartMatchScoring.ts](../../packages/web/src/components/SmartMatchModal/) (+ `.test.ts`) — direct port of recovered `specials-fuzzy.js`.

**Modified:**

- [packages/web/src/components/PromptModal/PromptModal.tsx](../../packages/web/src/components/PromptModal/PromptModal.tsx) — atom setter for Play, Cancel/Close buttons, Escape rewrite, paused-pipeline header, kbd hints.
- [packages/web/src/components/PromptModal/PromptModal.test.tsx](../../packages/web/src/components/PromptModal/PromptModal.test.tsx)
- [packages/web/src/components/PromptModal/PromptModal.mdx](../../packages/web/src/components/PromptModal/PromptModal.mdx) — document new buttons + Escape/Ctrl+C semantics.
- [packages/web/src/components/FileExplorerModal/FileExplorerModal.tsx](../../packages/web/src/components/FileExplorerModal/FileExplorerModal.tsx) — delete `window.openVideoModal`, delete local `videoPath`, replace Play handlers with atom setter, remove `videoPath` from the Escape effect.
- [packages/web/src/components/FileExplorerModal/FileExplorerModal.mdx](../../packages/web/src/components/FileExplorerModal/FileExplorerModal.mdx) — document atom-driven preview.
- [packages/web/src/pages/BuilderPage/BuilderPage.tsx](../../packages/web/src/pages/BuilderPage/BuilderPage.tsx) — mount `<VideoPreviewModal />` and `<SmartMatchModal />`.
- [packages/web/src/types.window.d.ts](../../packages/web/src/types.window.d.ts) — drop `openVideoModal` declaration.
- The NSF result-card component (search under [packages/web/src/components/](../../packages/web/src/components/)) — add the `Smart Match…` button.
- [packages/server/src/app-commands/nameSpecialFeaturesDvdCompareTmdb.events.ts](../../packages/server/src/app-commands/nameSpecialFeaturesDvdCompareTmdb.events.ts) — add `durationSeconds` to `UnnamedFileCandidate`.
- [packages/server/src/app-commands/nameSpecialFeaturesDvdCompareTmdb.buildUnnamedFileCandidates.ts](../../packages/server/src/app-commands/nameSpecialFeaturesDvdCompareTmdb.buildUnnamedFileCandidates.ts) — accept and forward `durationSeconds`; replace in-place `.sort()`.
- [packages/server/src/app-commands/nameSpecialFeaturesDvdCompareTmdb.buildUnnamedFileCandidates.test.ts](../../packages/server/src/app-commands/nameSpecialFeaturesDvdCompareTmdb.buildUnnamedFileCandidates.test.ts)
- [packages/server/src/app-commands/nameSpecialFeaturesDvdCompareTmdb.ts](../../packages/server/src/app-commands/nameSpecialFeaturesDvdCompareTmdb.ts) — thread per-file duration into the `buildUnnamedFileCandidates` call site.
- [packages/server/src/fake-data/scenarios/nameSpecialFeaturesDvdCompareTmdb.ts](../../packages/server/src/fake-data/scenarios/nameSpecialFeaturesDvdCompareTmdb.ts) — emit `type: "prompt"` for Phase-2 collision; include `durationSeconds` in Phase-5 summary; replace the auto-skip comment with the new await-prompt behavior.
- [docs/workers/MANIFEST.md](MANIFEST.md) — flip this worker's row to `done` on merge.

---

## Verification checklist

### Part A

- [ ] `▶ Play` opens the video preview from PromptModal without FileExplorerModal being open
- [ ] `Cancel job` button visibly red, fires `DELETE /jobs/:id`, transitions step to `cancelled`
- [ ] `Close (job stays running)` button visibly secondary, leaves job in `running`, inline note explains the consequence
- [ ] Escape no longer submits `-1`/`-2` to `/jobs/:id/input`
- [ ] `Ctrl+C` / `Cmd+C` inside the modal cancels the job
- [ ] Paused-pipeline header visible above the option list
- [ ] kbd chips visible for digits, Space, Escape, Ctrl+C
- [ ] No remaining references to `window.openVideoModal` anywhere in the web package

### Part B

- [ ] Deleted `specials-fuzzy.js` + `.test.ts` recovered from `28534ec5^` and used as the porting reference
- [ ] `UnnamedFileCandidate` carries `durationSeconds`; CLI + fake-data scenario updated
- [ ] `buildUnnamedFileCandidates` no longer uses in-place `.sort()`
- [ ] Ported `smartMatchScoring.ts` reproduces all behaviors covered by the recovered tests
- [ ] `SmartMatchModal` opens from an NSF result card when conditions met
- [ ] Low-confidence rows render yellow; per-row override dropdown shows full candidate set
- [ ] Apply fires one rename per checked row; failed renames stay visible with the error inline
- [ ] Storybook stories + mdx in place; `yarn build-storybook` clean

### Part C

- [ ] Fake-mode NSF run fires a `type: "prompt"` SSE event for the Phase-2 collision (PromptModal opens)
- [ ] Choosing an option in fake mode advances the scenario
- [ ] After fake run completes, `Smart Match…` button appears in the result card
- [ ] Auto-skip comment at [fake scenario line 125-126](../../packages/server/src/fake-data/scenarios/nameSpecialFeaturesDvdCompareTmdb.ts#L125-L126) removed; replaced with await-prompt behavior

### Cross-cutting

- [ ] Standard gate clean (`yarn lint → typecheck → test → e2e → lint`)
- [ ] e2e covering all three parts in a single spec
- [ ] Worktree created
- [ ] Manifest row → `in-progress`
- [ ] PR opened
- [ ] Manifest row → `done`

## Why this is one worker, not three

All three parts are *restoration*, not feature work — every behavior here was shipping in v1.0.0 and broke during the React conversion / legacy-builder cleanup. They share components ([PromptModal.tsx](../../packages/web/src/components/PromptModal/PromptModal.tsx), [BuilderPage.tsx](../../packages/web/src/pages/BuilderPage/BuilderPage.tsx)), event channels (the `type: "prompt"` SSE channel + `promptModalAtom`), and a single mental model: *the user must be able to interactively review and rename what NSF couldn't auto-name.* Splitting them would make each PR feel like 30% of a feature and force the user to wait for all three before re-running NSF interactively. Shipping together restores the full interactive flow in one go.

Worker 25 (duration-weighted ranking, order tie-break, per-release cache) is the *upgrade* layer that builds on the foundation this worker re-establishes.
