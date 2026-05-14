# Worker 0b — auto-paste-yaml

**Model:** Haiku · **Thinking:** OFF · **Effort:** Low
**Branch:** `feat/mux-magic-revamp/0b-auto-paste-yaml`
**Worktree:** `.claude/worktrees/0b_auto-paste-yaml/`
**Phase:** 1B web
**Depends on:** 01
**Parallel with:** all other 1B web workers

> **Status as of 2026-05-13:** Done. Shipped directly on `feat/mux-magic-revamp` (no separate worker branch). Architecture: the auto-paste logic is a custom hook [useAutoClipboardLoad](../../packages/web/src/hooks/useAutoClipboardLoad.ts) that reads the clipboard, checks if it looks like YAML (heuristic: contains `:` or starts with `-`), and if so, attempts to load via the existing `loadYamlFromText` pipeline. The hook is called on-demand in the [Load button's onClick](../../packages/web/src/components/PageHeader/PageHeader.tsx) — if successful, the button shows a green checkmark for 1.5s without opening the modal (zero flash, instant UX feedback). If it fails, the modal opens as a fallback for manual Ctrl+V paste. [LoadModal](../../packages/web/src/components/LoadModal/LoadModal.tsx) keeps the existing paste-event-driven path for both the fallback and any user who opens the modal manually. Tests: 12 for LoadModal (paste behavior), 5 for the hook (successful load, non-YAML rejection, empty/denied/invalid-YAML cases).

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Yarn only. See [AGENTS.md](../../AGENTS.md).

## Your Mission

When the user opens the YAML-upload modal, if the clipboard contains valid-looking YAML, **auto-paste it** into the textarea. Saves a manual paste click.

### Behavior spec

- On modal open: read clipboard via `navigator.clipboard.readText()`.
- If text is non-empty AND looks like YAML (heuristic: contains a colon or starts with `-`; or attempt a permissive YAML parse — pick whichever you can verify cheaply), populate the textarea.
- If clipboard read is denied (permissions), or text is empty, or doesn't look like YAML: leave textarea empty (existing behavior).
- Don't surface a permission prompt mid-flow; if `navigator.clipboard.readText()` requires user activation, only run after the modal-open click handler.

### Files to find

Find the YAML-upload modal in `packages/web/`. It's wired into the sequence builder's "Import" or "Upload YAML" button. Search for `loadYamlFromText` or `js-yaml` imports to locate. Likely candidates:
- A component named something like `LoadYamlModal`, `ImportYamlModal`, or part of `BuilderToolbar`.

### Test

Mock `navigator.clipboard.readText` to return YAML; render the modal; assert the textarea has the YAML pre-filled. Mock it to return non-YAML; assert textarea is empty.

## TDD steps

1. Locate the YAML-upload modal component.
2. Write a failing test mocking the clipboard API.
3. Implement clipboard read on modal mount/open.
4. Verify the test passes.

## Files

- The YAML-upload modal component (find via grep)
- Its test file
- Possibly its story file (add a story with mocked clipboard for visual verification)

## Verification checklist

- [ ] Worktree created
- [ ] Manifest row → `in-progress`
- [ ] Failing test committed first
- [ ] Clipboard read on modal open
- [ ] Permission-denied path doesn't break (test it)
- [ ] Standard gate clean (including `yarn e2e` — the modal's e2e spec should still pass)
- [ ] PR opened
- [ ] Manifest row → `done`

## Out of scope

- Validating that the pasted YAML is well-formed (existing parse-on-submit handles that)
- Auto-importing on paste (still requires the user to click confirm in the modal)
- Auto-paste on any other modal
