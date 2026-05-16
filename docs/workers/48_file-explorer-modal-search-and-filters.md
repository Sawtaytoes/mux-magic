# Worker 48 — file-explorer-modal-search-and-filters

**Model:** Sonnet · **Thinking:** ON · **Effort:** Medium
**Branch:** `feat/mux-magic-revamp/48-file-explorer-modal-search-and-filters`
**Worktree:** `.claude/worktrees/48_file-explorer-modal-search-and-filters/`
**Phase:** 5
**Depends on:** 01
**Parallel with:** any Phase 5 worker that doesn't touch [packages/web/src/components/FileExplorerModal/](../../packages/web/src/components/FileExplorerModal/).

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Yarn only. See [AGENTS.md](../../AGENTS.md).

## Your Mission

Tighten [FileExplorerModal](../../packages/web/src/components/FileExplorerModal/FileExplorerModal.tsx) for users browsing large directories (the disc-rip parent has ~700 entries; anime/manga libraries are even denser). Three deliverables:

### 1. Search/filter input

Add a text input at the top of the file list (near the breadcrumb / above the table). It does an in-memory, case-insensitive substring filter against `entry.name` and applies to the currently-loaded directory only — do not fan out to a server-side recursive search.

- Filter is debounced lightly (~80–120ms is fine; this is purely client-side over an already-rendered list) so each keystroke isn't a full re-layout on a 1k-entry directory.
- Reset on directory change (breadcrumb click, double-click into folder, "up" navigation).
- Empty filter shows everything (matches today's behavior).
- The filter composes with the video-only toggle in §2: both filters AND together.
- Keep the existing select-all checkbox honest — when a filter is active, "select all" only selects matching rows (the user expectation when they've narrowed the view). Verify this against the existing `setSelected` logic around [FileExplorerModal.tsx:320](../../packages/web/src/components/FileExplorerModal/FileExplorerModal.tsx).

### 2. Video-only toggle button

Add a toggle button next to the search input that, when active, hides any row whose name is not a video file. **Reuse the existing detector** — `isVideoFile()` is already defined locally at [FileExplorerModal.tsx:50](../../packages/web/src/components/FileExplorerModal/FileExplorerModal.tsx) and consumed at line 632. Do not duplicate or re-derive the extension list. If the toggle would benefit other modals later (file pickers in the builder), consider lifting `isVideoFile` and its `VIDEO_EXTENSIONS` set into a sibling utility file (`FileExplorerModal.fileTypes.ts` — dotted-suffix per the [no-barrel-for-single-command-splits convention](../../AGENTS.md)) so future workers can import it without dragging in the whole modal. Lifting is **optional** for this worker; only do it if the diff is small.

Default state: off (current behavior preserved). Persist neither across mounts nor across sessions — this is a transient view filter.

### 3. Clipboard-icon "does nothing" investigation

The user reported that the 📋 icon "does nothing." Grep first: the icon button at [FileExplorerModal.tsx:722](../../packages/web/src/components/FileExplorerModal/FileExplorerModal.tsx) **does** call `copyPath` (defined at [FileExplorerModal.tsx:332](../../packages/web/src/components/FileExplorerModal/FileExplorerModal.tsx)), which calls `navigator.clipboard.writeText(fullPath)` with a `window.prompt` fallback for the rare browser without clipboard API access.

Two plausible explanations to verify and address — confirm by manual smoke before coding:

1. **Most likely — missing visual confirmation.** The copy succeeds silently. The user clicks, sees no toast/flash/change of icon, and concludes "does nothing." Fix: add a brief visual ack — the lowest-risk option is to swap the icon glyph to a check mark for ~1.2s after the writeText resolves (and back to 📋 after). Avoid introducing a new toast system just for this; do not touch the modal's selection state.
2. **Less likely — clipboard API denied.** If the modal is rendered inside an iframe or the page is opened without a user-gesture trust origin, `navigator.clipboard.writeText` can reject. The current code already has the `window.prompt` fallback, so this should still surface *something*. Confirm by reading the catch path — if `window.prompt` is being suppressed by the modal stacking context or the browser's anti-prompt heuristic, that's the bug. In that case, swap the fallback to render the path inline in a small inline-input the user can manually copy.

Document which case applied in the PR description. If both are plausible after the investigation, ship the visual-confirmation change (it's safe regardless) and a defensive improvement to the fallback path.

## Tests (per test-coverage discipline)

- Unit: filter input — typing "abc" narrows to rows whose name contains `abc` case-insensitively; clearing restores all rows; navigating to a new directory clears the filter.
- Unit: video-only toggle — hides non-video rows; the `isVideoFile` set used is the same one used at line 50 (test by feeding fixture names: `.mkv`, `.mp4`, `.txt`, `.srt`, `Some-Folder` without extension).
- Unit: filter + toggle compose (AND).
- Unit: select-all under a filter only selects the visible rows.
- Unit: copy-icon click triggers `navigator.clipboard.writeText` with the full joined path; on resolve, the icon flips to the ack glyph for the documented window and then back.
- Story: a new `FileExplorerModal` Storybook story exercising the search + toggle + copy-ack interaction (mirror existing stories).

## TDD steps

1. **Red** — `test(web): failing tests for FileExplorerModal search/filter/copy-ack`. Cover all the cases above; expect them to fail.
2. **Green — search input** in its own commit.
3. **Green — video-only toggle** in its own commit, reusing `isVideoFile`.
4. **Green — clipboard ack** in its own commit, plus any fallback hardening if §3 investigation called for it.
5. **Story + mdx** updates in their own commit.
6. **Manifest** — `chore(manifest): worker 48 done`.

## Files

### Extend

- [packages/web/src/components/FileExplorerModal/FileExplorerModal.tsx](../../packages/web/src/components/FileExplorerModal/FileExplorerModal.tsx)
- [packages/web/src/components/FileExplorerModal/FileExplorerModal.test.tsx](../../packages/web/src/components/FileExplorerModal/FileExplorerModal.test.tsx)
- [packages/web/src/components/FileExplorerModal/FileExplorerModal.stories.tsx](../../packages/web/src/components/FileExplorerModal/FileExplorerModal.stories.tsx)
- [packages/web/src/components/FileExplorerModal/FileExplorerModal.mdx](../../packages/web/src/components/FileExplorerModal/FileExplorerModal.mdx)

### New (optional — only if §2 lift-out is chosen)

- `packages/web/src/components/FileExplorerModal/FileExplorerModal.fileTypes.ts` — extracted `isVideoFile` + `VIDEO_EXTENSIONS`.

### Reuse — do not reinvent

- The local `isVideoFile` at [FileExplorerModal.tsx:50](../../packages/web/src/components/FileExplorerModal/FileExplorerModal.tsx) is the canonical detector. Do not introduce a competing video-extension list.
- The existing `copyPath` handler at [FileExplorerModal.tsx:332](../../packages/web/src/components/FileExplorerModal/FileExplorerModal.tsx) already does the clipboard write; extend it, don't replace it.

## Verification checklist

- [ ] Investigation outcome for §3 documented in PR description (visual-confirmation vs. fallback hardening, or both)
- [ ] Failing-test commit landed before the green commits
- [ ] No new "shows-toast" infrastructure invented
- [ ] Storybook story renders cleanly and exercises the new affordances
- [ ] Standard gate clean (`lint → typecheck → test → e2e → lint`)
- [ ] `chore(manifest): worker 48 done` is a separate commit
- [ ] PR opened against `feat/mux-magic-revamp`
- [ ] [docs/workers/MANIFEST.md](MANIFEST.md) row updated to `done`

## Out of scope

- Server-side recursive search across the filesystem from the modal.
- A general-purpose toast notification system. The clipboard-ack glyph swap is intentionally local.
- Persisting the video-only toggle across mounts/sessions.
- Adding additional content-type toggles (audio-only, subtitle-only) in this worker. Lifting `isVideoFile` to a sibling file (§2) is the prep that makes those future toggles a small follow-up.
