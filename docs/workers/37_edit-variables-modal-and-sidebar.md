# Worker 37 — edit-variables-modal-and-sidebar

**Model:** Sonnet · **Thinking:** ON · **Effort:** Medium
**Branch:** `feat/mux-magic-revamp/37-edit-variables-modal-and-sidebar`
**Worktree:** `.claude/worktrees/37_edit-variables-modal-and-sidebar/`
**Phase:** 1B foundation sub-chain (after 36)
**Depends on:** 36 (Variables foundation)
**Parallel with:** all other 1B workers that don't depend on 36

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Tests must cover the change scope. Yarn only. See [AGENTS.md](../../AGENTS.md). Background context lives in [docs/PLAN.md §5.A](../PLAN.md).

## Your Mission

Build the centralized UI for managing sequence-level Variables (the typed system from worker 36). Today, path-variable cards live INLINE in the sequence list, mixed in with the step "chain of events." New behavior: variables move OUT of the sequence list into two coordinated surfaces:

1. **Edit Variables modal** — primary surface; centralized CRUD across all Variable types.
2. **Right-sidebar view on large screens** — mirror of the modal contents, persistently visible alongside the sequence content.

### Surface 1 — Edit Variables modal

A modal opened from a toolbar/header button (e.g., a "Variables" link in `PageHeader` or a chip near the sequence header showing the count of defined variables).

Contents:

- A list of all Variables grouped by type (Paths first; thread count next; DVD Compare IDs after; etc.).
- An "Add Variable" button that opens a type picker (filtered to types whose cardinality isn't already saturated — e.g., if `threadCount` already exists, hide it from the picker).
- Each row renders a `VariableCard` (from worker 36) — type-dispatched label + value input + delete button.
- Save/Cancel buttons that batch atom updates. Or autosave per change — pick based on what the existing path-variable UI does today (most likely autosave, since pathsAtom updates immediately).

### Surface 2 — Right-sidebar view (large screens only)

A panel docked to the right side of the sequence-builder page. Visible at `lg:` breakpoint and up; hidden on smaller screens (where the modal is the only access).

Contents: same as the modal body. No header buttons; no Save/Cancel (autosave). The panel is persistently visible so the user sees variables alongside the sequence as they edit.

The modal and sidebar share the same component (`<VariablesPanel>`); the surfaces just wrap it differently (modal frame vs sidebar container).

### Removing variables from the inline sequence list

Today, [PathVariableCard.tsx](../../packages/web/src/components/PathVariableCard/PathVariableCard.tsx) is rendered inline as part of the sequence list (verify the exact mount point — likely [BuilderSequenceList.tsx](../../packages/web/src/pages/BuilderSequenceList/BuilderSequenceList.tsx) or a sibling). This worker **removes that inline rendering** — variables move exclusively to the modal + sidebar.

Validation: after this change, the sequence list shows only steps + groups; no variable cards. Existing e2e tests that interact with path variables will break — update them to open the modal (or use the sidebar) first.

### Reuse existing primitives

- Modal primitive: this repo has a Modal component extracted by an earlier worker (per react-migration history). Reuse it (don't write a new modal from scratch).
- `<VariableCard>`: comes from worker 36; render one per Variable.
- Form patterns: match how other modals validate + autosave in this project.

### Responsive behavior

- **Below `lg`:** sequence list takes full width; sidebar hidden; modal is the only access point.
- **At `lg` and above:** sequence list shrinks left to make room for the right sidebar (e.g., `lg:grid-cols-[1fr_320px]` or similar).
- The "Variables" button in the header opens the modal at all viewport sizes (sidebar users may still want a focused modal for keyboard-driven edits).

## Tests (per test-coverage discipline)

- **Component:** `<VariablesPanel>` renders a Variable from each registered type without errors.
- **Component:** Adding a variable through the "Add" picker creates the right `Variable` object via `addVariableAtom`.
- **Component:** Removing a variable triggers the existing usage-scan-and-confirm flow from worker 36.
- **Component:** Modal opens via the header button; closes on Save/Cancel/Escape.
- **Component (responsive):** sidebar visible at `lg` width; hidden below.
- **e2e:** create a path variable via the modal; reference it from a step field; save; reload and verify the link survives YAML round-trip.
- **e2e:** removing a referenced variable still triggers the confirmation flow.

## TDD steps

1. Write failing tests for each piece above. Commit each.
2. Build `<VariablesPanel>` component reusing `<VariableCard>` from worker 36.
3. Wrap in modal frame; wire the "Variables" header button.
4. Wrap in sidebar container; wire responsive visibility.
5. Remove the inline `PathVariableCard` (now `VariableCard`) rendering from the sequence list.
6. Update existing e2e tests that depended on inline rendering.
7. Verify all tests pass.

## Files

- New: `packages/web/src/components/VariablesPanel/VariablesPanel.tsx` (+ stories + tests)
- New: `packages/web/src/components/EditVariablesModal/EditVariablesModal.tsx` (+ stories + tests)
- New: `packages/web/src/components/VariablesSidebar/VariablesSidebar.tsx` (responsive wrapper; or fold into a layout component)
- [packages/web/src/components/PageHeader/PageHeader.tsx](../../packages/web/src/components/PageHeader/PageHeader.tsx) — add "Variables" button or chip
- [packages/web/src/pages/BuilderSequenceList/BuilderSequenceList.tsx](../../packages/web/src/pages/BuilderSequenceList/BuilderSequenceList.tsx) — remove inline `VariableCard` rendering
- Page-level layout file — add responsive grid for sidebar at `lg`+
- Existing e2e tests touching path variables — update for the new modal/sidebar entry point

## Verification checklist

- [ ] Worker 36 ✅ merged before starting
- [ ] Worktree created
- [ ] Manifest row → `in-progress`
- [ ] Failing tests committed first
- [ ] Modal opens from header button at all viewport sizes
- [ ] Sidebar visible at `lg`+; hidden below
- [ ] Modal + sidebar share the same panel component (no duplicate impl)
- [ ] Add Variable picker filters out saturated singleton types
- [ ] Remove variable still triggers usage-scan-and-confirm flow
- [ ] Sequence list no longer renders variable cards inline
- [ ] Existing path-variable e2e tests updated and passing
- [ ] Reduced-motion preference respected for any animations
- [ ] Standard gate clean
- [ ] PR opened
- [ ] Manifest row → `done`

## Out of scope

- Variable-type definitions for `threadCount` (worker 11) and `dvdCompareId` (worker 35) — those workers register their own types
- Reordering / sorting variables (current order suffices; sort by type then insertion order)
- Bulk operations (delete-all-of-type, import-from-clipboard, etc.)
- Adding variables from the step-field link picker (today's flow: pick existing variable; this worker doesn't change that)
