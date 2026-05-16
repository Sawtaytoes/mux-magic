# Worker 58 — promptmodal-cancel-and-play-fix

**Model:** Sonnet · **Thinking:** ON · **Effort:** Medium
**Branch:** `feat/mux-magic-revamp/58-promptmodal-cancel-and-play-fix`
**Worktree:** `.claude/worktrees/58_promptmodal-cancel-and-play-fix/`
**Phase:** 4
**Depends on:** —
**Parallel with:** any worker that doesn't touch [PromptModal.tsx](../../packages/web/src/components/PromptModal/PromptModal.tsx) or [FileExplorerModal.tsx](../../packages/web/src/components/FileExplorerModal/FileExplorerModal.tsx).

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Yarn only. See [AGENTS.md](../../AGENTS.md).

## Your Mission

The PromptModal — the interactive picker that surfaces when a running command emits a `type: "prompt"` SSE event (e.g. `nameSpecialFeaturesDvdCompareTmdb` asking the user to categorize a file as `behindthescenes` / `deleted` / `featurette` / etc.) — has **two user-blocking bugs that ship together**. Both were observed live by the user during a `nameSpecialFeaturesDvdCompareTmdb` single-step run. Fix both in one PR because they share the same component and the same in-modal action area.

### Bug 1 — The `▶ Play` button does nothing

Clicking `▶ Play` in the PromptModal silently no-ops. The user sees no preview, no error, nothing.

**Root cause:** [PromptModal.tsx:164-172](../../packages/web/src/components/PromptModal/PromptModal.tsx#L164-L172) and the per-option play at [PromptModal.tsx:213-222](../../packages/web/src/components/PromptModal/PromptModal.tsx#L213-L222) both call `window.openVideoModal(promptData.filePath)`. That global function is registered by [FileExplorerModal.tsx:395-402](../../packages/web/src/components/FileExplorerModal/FileExplorerModal.tsx#L395-L402) inside a `useEffect`, and it just calls `setVideoPath(absolutePath)` — local React state inside FileExplorerModal.

The problem is the next line: [FileExplorerModal.tsx:426](../../packages/web/src/components/FileExplorerModal/FileExplorerModal.tsx#L426) is `if (!explorerState) return null`. When the file explorer is NOT open (the normal case when PromptModal fires), the entire FileExplorerModal renders `null`, so the `<VideoModal />` sub-component at [line 773](../../packages/web/src/components/FileExplorerModal/FileExplorerModal.tsx#L773) never mounts. The `setVideoPath` call succeeds and updates internal state — that state then sits in a component that renders nothing.

Net effect: `window.openVideoModal` is a global that **only works when the file explorer happens to be open**. From the PromptModal it never does.

The `// Expose openVideoModal on window for legacy result cards that call it.` comment at [FileExplorerModal.tsx:394](../../packages/web/src/components/FileExplorerModal/FileExplorerModal.tsx#L394) confirms this was always an interim pattern. Time to retire it.

### Bug 2 — No clear way to cancel out

The user has three ways to dismiss the PromptModal today, none of which are clear or correct:

1. **Click the backdrop** → [PromptModal.tsx:140](../../packages/web/src/components/PromptModal/PromptModal.tsx#L140) calls `close()` which just nulls `promptModalAtom`. The server-side observable stays suspended; the job stays in `running`. Nothing in the UI tells the user this.
2. **Press `Escape`** → [PromptModal.tsx:91-117](../../packages/web/src/components/PromptModal/PromptModal.tsx#L91-L117) submits a `-2` cancel option **if one exists**, falling back to `-1` skip, falling back to nothing. For `nameSpecialFeaturesDvdCompareTmdb` prompts the options are `0..7` plus `-1` (Skip), so Escape submits `-1` — which skips THIS file, not cancels the job. The user reasonably expected Escape to mean "stop everything."
3. **Backdrop-click out → scroll to the step card → press the Stop button on the running step.** This is the only way to actually cancel the job, and the user has to discover it.

There is no visible button labeled `Cancel`, `Stop`, `X`, or anything else inside the modal that explicitly cancels the running job. The modal also gives no visual signal that closing it leaves the job blocked.

The user's verbatim feedback:

> "Technically, there is. I just click out and hit 'stop' on the job. But it's not clear."

## What to ship

### Part A — Make `▶ Play` actually preview the file (decouple from FileExplorerModal)

Promote the video preview sub-modal into its own standalone component driven by a Jotai atom. Mount it once at app top-level (next to `<PromptModal />` and `<FileExplorerModal />` in [BuilderPage.tsx](../../packages/web/src/pages/BuilderPage/BuilderPage.tsx)). FileExplorerModal and PromptModal both set the atom; the standalone VideoPreviewModal renders whenever the atom is non-null.

Concretely:

- New component `packages/web/src/components/VideoPreviewModal/VideoPreviewModal.tsx`. Lift the existing video-sub-modal element rendered at [FileExplorerModal.tsx:773](../../packages/web/src/components/FileExplorerModal/FileExplorerModal.tsx#L773) into it.
- New atom `packages/web/src/components/VideoPreviewModal/videoPreviewModalAtom.ts` holding `{ path: string } | null`.
- In `PromptModal.tsx`, replace both `window.openVideoModal(...)` calls with `setVideoPreview({ path: ... })` using `useSetAtom(videoPreviewModalAtom)`.
- In `FileExplorerModal.tsx`, **delete** the `useEffect` that assigns `window.openVideoModal` and the local `videoPath` state. Replace the in-explorer Play buttons with the same atom setter. Delete the `videoPath`-dependent Escape branch in the keydown effect — VideoPreviewModal handles its own Escape.
- In [types.window.d.ts](../../packages/web/src/types.window.d.ts), remove the `openVideoModal` declaration.
- Mount `<VideoPreviewModal />` in `BuilderPage.tsx` alongside the other modal singletons.
- Keep the same z-index ordering (VideoPreview > PromptModal > FileExplorerModal backdrop) so the preview always sits on top of whatever opened it.

The standalone modal must NOT depend on `explorerState` (or any FileExplorer concept). It renders iff its own atom is non-null.

### Part B — Clear cancel-out from the prompt

Add an in-modal action bar with **two visually distinct controls** at the bottom of the picker:

1. **`Cancel job`** (red / destructive styling, e.g. `bg-red-700`). Fires `DELETE /jobs/<promptData.jobId>` AND clears `promptModalAtom`. This is the "stop everything" path. Pair it with the `runOrStopStepAtom` cancel semantics — at minimum, after the DELETE call the corresponding step's status becomes `cancelled` via the existing SSE-done flow ([useLogStream.ts:123-135](../../packages/web/src/hooks/useLogStream.ts#L123-L135) already clears the modal on `isDone` for the matching job).
2. **`Close (job stays running)`** (subdued / secondary styling). Just clears the atom — does not cancel the job. Adds an inline note next to it that says e.g. `"The pipeline will keep waiting for input"` so the user knows the job is still blocked.

Important contract: the existing **option buttons** (the categorized choices the server sent) are unchanged — picking `featurette` still submits `selectedIndex: 5` to `/jobs/:id/input` and the pipeline continues with the next file. Cancel-job and Close-modal are **new** controls, not replacements.

### Keyboard wiring

Keep digits + Space + Escape working, but make Escape's behavior **explicit and consistent**:

- **Digits `0..9`** — pick that option (unchanged).
- **`Space`** — pick `-1` Skip if it exists (unchanged).
- **`Escape`** — close the modal WITHOUT cancelling the job. Display a one-time tooltip on the `Cancel job` button if Escape was pressed, hinting "Use Cancel job to stop the pipeline." (Don't make Escape destructive — the user pressing Escape to dismiss a modal is universal UX and they shouldn't lose a long-running job by accident.)
- **`Ctrl+C`** (or `Cmd+C` on macOS) inside the modal — fire the `Cancel job` action. The keyboard cousin of the red button. This is one of the few times the global Ctrl+C shortcut shouldn't be hijacked by clipboard copy, because **(a)** there's no selection inside a modal that's all buttons, and **(b)** the destructive action deserves a fast keyboard out.

Document these shortcuts in the modal itself — small `kbd` chips beneath the option list (matches the existing pattern at [PromptModal.tsx:189-193](../../packages/web/src/components/PromptModal/PromptModal.tsx#L189-L193) where digit hints are already shown).

### Visual signal that the modal blocks the pipeline

Add a small inline header line above the option list, e.g.:

> ⏸ The pipeline is paused waiting for your choice.

This communicates the invariant the user doesn't currently realize: closing the modal does NOT advance the pipeline. Combined with the explicit `Close (job stays running)` button, this should eliminate the "I clicked out and the job is just sitting there" confusion.

## TDD steps

1. Write failing test in `VideoPreviewModal.test.tsx`: when the atom is set, the modal renders the video element with the given `src`; when cleared, nothing renders. Independent of FileExplorerModal mounting.
2. Update `PromptModal.test.tsx` to assert that clicking `▶ Play` calls the atom setter (not `window.openVideoModal`). Inject a spy via the wrapping `<Provider>`.
3. Add a `PromptModal.test.tsx` test for the new `Cancel job` button — clicking it fires a `DELETE` request to `/jobs/<id>` (mock `fetch`) and clears the atom.
4. Add a `PromptModal.test.tsx` test for `Close (job stays running)` — clicking clears the atom but does NOT call `fetch`.
5. Add a `PromptModal.test.tsx` test for the new Escape semantic — Escape clears the atom but does NOT submit any option to `/jobs/:id/input` and does NOT fire a DELETE.
6. Add an e2e covering the full flow: start a single-step run that triggers a prompt (use a fake-mode scenario or the existing `nameSpecialFeaturesDvdCompareTmdb` test fixture), see the prompt modal, click `▶ Play`, see the video preview overlay, close it, click `Cancel job`, verify the step transitions to `cancelled`.
7. Implement each fix, watch the failing tests go green.
8. Final lint sweep.

## Files

**New:**
- [packages/web/src/components/VideoPreviewModal/VideoPreviewModal.tsx](../../packages/web/src/components/VideoPreviewModal/) (+ `.test.tsx`, `.stories.tsx`, `.mdx`)
- [packages/web/src/components/VideoPreviewModal/videoPreviewModalAtom.ts](../../packages/web/src/components/VideoPreviewModal/)

**Modified:**
- [packages/web/src/components/PromptModal/PromptModal.tsx](../../packages/web/src/components/PromptModal/PromptModal.tsx) — atom setter, Cancel/Close buttons, Escape rewrite, paused-pipeline header, kbd hints
- [packages/web/src/components/PromptModal/PromptModal.test.tsx](../../packages/web/src/components/PromptModal/PromptModal.test.tsx) — new tests above
- [packages/web/src/components/FileExplorerModal/FileExplorerModal.tsx](../../packages/web/src/components/FileExplorerModal/FileExplorerModal.tsx) — delete `window.openVideoModal`, delete local `videoPath`, replace Play handlers with atom setter, remove `videoPath` from the Escape effect
- [packages/web/src/pages/BuilderPage/BuilderPage.tsx](../../packages/web/src/pages/BuilderPage/BuilderPage.tsx) — mount `<VideoPreviewModal />`
- [packages/web/src/types.window.d.ts](../../packages/web/src/types.window.d.ts) — drop `openVideoModal` declaration
- [packages/web/src/components/PromptModal/PromptModal.mdx](../../packages/web/src/components/PromptModal/PromptModal.mdx) — document new buttons + Escape semantics
- [packages/web/src/components/FileExplorerModal/FileExplorerModal.mdx](../../packages/web/src/components/FileExplorerModal/FileExplorerModal.mdx) — document atom-driven preview
- [docs/workers/MANIFEST.md](MANIFEST.md) — flip this worker's row to `done` on merge

## Verification checklist

- [ ] Standard gates clean (`yarn lint → typecheck → test → e2e → lint`)
- [ ] `▶ Play` opens the video preview from PromptModal **without** FileExplorerModal being open
- [ ] `Cancel job` button visibly red, fires `DELETE /jobs/:id`, transitions the step to `cancelled`
- [ ] `Close (job stays running)` button visibly secondary, leaves the job in `running`, inline note explains the consequence
- [ ] Escape no longer accidentally submits `-1`/`-2` to `/jobs/:id/input`
- [ ] `Ctrl+C` / `Cmd+C` inside the modal cancels the job
- [ ] Paused-pipeline header visible above the option list
- [ ] kbd chips visible for digits, Space, Escape, Ctrl+C
- [ ] No remaining references to `window.openVideoModal` anywhere in the web package
- [ ] PR opened against `feat/mux-magic-revamp`
- [ ] [docs/workers/MANIFEST.md](MANIFEST.md) row updated to `done`

## Why this is `asap`

The PromptModal just shipped its prompt-event wiring (today's session — `useLogStream` and `SequenceRunModal` were updated to route `type: "prompt"` events into `promptModalAtom`). The user immediately ran into both bugs on their first real use of the modal in a `nameSpecialFeaturesDvdCompareTmdb` run. Until this worker lands, anyone running an interactive command:

1. Can't preview the file the prompt is asking them to categorize (Play does nothing).
2. Has no clear way to stop a job they no longer want, and will think the job is hung when the modal is closed by accident.

Both are user-blocking on the most-used interactive command in the codebase.
