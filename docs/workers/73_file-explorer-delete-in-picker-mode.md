# Worker 73 — FileExplorerModal: allow delete in picker mode

**Status:** ready
**Track:** web
**Model:** Haiku
**Effort:** Low
**Thinking:** OFF
**Depends:** — (touches only [FileExplorerModal.tsx](../../packages/web/src/components/FileExplorerModal/FileExplorerModal.tsx))

## Why

In the current React `FileExplorerModal`, the footer that contains the actual `Delete selected` button is mode-gated:

```tsx
// packages/web/src/components/FileExplorerModal/FileExplorerModal.tsx:728
{!isPicker && (
  <div id="file-explorer-footer" …>
    <span id="file-explorer-selection-count">{selected.size} selected</span>
    <button id="file-explorer-delete-btn" …>Delete selected</button>
  </div>
)}
```

When the user opens the explorer in **picker mode** — i.e. through `PathField`, `FolderMultiSelectField`, or `VariableCard`'s Browse flow, all three pass a `pickerOnSelect` callback — `isPicker` is `true` and the footer never renders. The user can still:

- Tick the per-row checkboxes (none of the checkbox handlers care about `isPicker`).
- See the red `DELETE → PERMANENT` *badge* in the title bar (it's a status pill telling them the current path can't trash — typical on network shares and external drives like `G:\Disc-Rips\…`).
- See the `PICKER` badge and the `📌 Use this folder` confirm button.

…but there is no Delete button anywhere on screen. The checkboxes appear functional, yet selection has no terminal action. The old vanilla-JS `public/index.html` file manager (removed in [ab00590b](../../) — `chore(legacy): delete loose legacy assets in public/`) always exposed delete regardless of how the user got there; the React rewrite tightened the mode split too far.

The red `DELETE → PERMANENT` pill makes this worse — visually it reads like a destructive *button* (red background, uppercase, top-right of a modal that looks like a confirm dialog), but it's a status indicator with `title` text only. Users repeatedly click it expecting it to perform the action.

Concrete repro (from the conversation that motivated this worker — Bug's Life Blu-ray cleanup):

1. Add a `PathField` step pointing at a parent like `G:\Disc-Rips\`.
2. Click the folder-pick affordance — opens `FileExplorerModal` with `pickerOnSelect` set.
3. Navigate into `A Bug's Life - 4K`.
4. Tick the unwanted `_t02.mkv` / `_t05.mkv` / `_t06.mkv` rows.
5. Look for a delete button — there isn't one. Only `📌 Use this folder` and `✕`.

## What

Two small coordinated changes:

1. **Always render the delete footer** when the user has files selected, regardless of `isPicker`. Drop the `!isPicker &&` gate at [FileExplorerModal.tsx:728](../../packages/web/src/components/FileExplorerModal/FileExplorerModal.tsx#L728); the `disabled={selected.size === 0}` already keeps it inert when nothing's picked. Picker mode keeps its `📌 Use this folder` header button — both can coexist because they live in different rows (title bar vs footer) and serve different intents (confirm-pick vs cleanup).

2. **De-emphasize the `DELETE → PERMANENT` pill as an action.** It is a status indicator and should look like one. Two options — pick the one that fits the existing badge styling system best:
   - Strip the bright `bg-rose-900/50` background fill and keep only the rose-tinted border + text, matching how a "warning chip" usually reads vs how a destructive button reads. Same logic for the `Delete → Recycle Bin` green variant (badge, not button).
   - Or: add `cursor-default` and `aria-hidden`-style framing so it does not invite click attempts. The existing `title` tooltip already explains *why* the path can't trash; that's the badge's whole job.

   Either way, the footer's actual `Delete selected` button stays the *only* affordance that performs the action — and that button's color is already rose-700, which now becomes the single destructive button on the screen rather than competing with the badge.

## Out of scope

- Directory deletion (the row-level checkboxes are still disabled for directories, per the existing `disabled={entry.isDirectory}` rule — that's a separate concern about recursive-delete safety).
- A keyboard shortcut for delete (e.g. `Delete` key). Worth a follow-up worker once the visible button exists.
- Inline delete-per-row icon column (currently each row has only a 📋 copy-path action). Could be added later, but a footer-bulk-delete restores the old behavior with the minimum change.
- Restyling the title-bar layout. The header already wraps with `flex-wrap`; the badge layout stays.

## Files

- [packages/web/src/components/FileExplorerModal/FileExplorerModal.tsx](../../packages/web/src/components/FileExplorerModal/FileExplorerModal.tsx) — drop the `!isPicker` gate on the footer (line ~728); tone down the `deleteModeClass` background to read as a badge, not a button (lines ~426–429).
- [packages/web/src/components/FileExplorerModal/FileExplorerModal.test.tsx](../../packages/web/src/components/FileExplorerModal/FileExplorerModal.test.tsx) — add a test that the `Delete selected` button is present and enabled after ticking a file in picker mode. The existing `"shows PICKER badge and Use this folder button in picker mode"` test (around line 152) is the place to extend; or add a sibling case so each assertion stays focused.
- [packages/web/src/components/FileExplorerModal/FileExplorerModal.stories.tsx](../../packages/web/src/components/FileExplorerModal/FileExplorerModal.stories.tsx) — extend `PickerMode` (or add a `PickerModeWithDelete` story) that ticks a file so VRT (worker 6a, when it lands) snapshots the footer-visible-in-picker state.
- [packages/web/src/components/FileExplorerModal/FileExplorerModal.mdx](../../packages/web/src/components/FileExplorerModal/FileExplorerModal.mdx) — update the "Behaviour" bullets so the `Delete` row no longer implies browse-only. Mention that the `DELETE → PERMANENT`/`Delete → Recycle Bin` pill is a status indicator (not an action).

## Acceptance

- Opening the explorer in picker mode, ticking one or more files, and clicking `Delete selected` performs the same `DELETE /files` request as browse mode.
- The `📌 Use this folder` button still works and still closes the modal via `pickerOnSelect(currentPath)`.
- The `Delete selected` button is `disabled` when `selected.size === 0` in both modes (no regression from existing browse-mode behavior).
- The `DELETE → PERMANENT` and `Delete → Recycle Bin` pills no longer visually read as buttons. Hover/focus states show they're informational only.
- Vitest + e2e green. (E2E touches the file explorer indirectly through PathField; a focused unit test for the picker-mode-delete path is the primary gate.)
- `yarn web:typecheck` clean — no prop changes here, but the test additions need to use the existing `userEvent.click` / `findByText` patterns already in [FileExplorerModal.test.tsx](../../packages/web/src/components/FileExplorerModal/FileExplorerModal.test.tsx).

## Notes

- The badge's red color was *chosen deliberately* — `/files/delete-mode` returns `"permanent"` for paths that can't be trashed (network drives, USB external drives like the `G:\` in the motivating screenshot). The fix keeps the red tint to preserve that signal but flattens it so it doesn't compete with the rose-700 actual destructive button.
- The behavior the user described as "the old HTML version" refers to the pre-React `public/index.html` UI (deleted in [ab00590b](../../) — see the `chore(legacy)` commit), where browse + delete was always available because there was no mode split at all. This worker doesn't restore that page; it just makes the React modal stop hiding the delete action from picker callers.
- After implementation, mark this row `done` in [MANIFEST.md](MANIFEST.md) per the workers-flip-own-done convention.
