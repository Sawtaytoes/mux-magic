# Worker 0e — story-actions-and-reopen

**Model:** Haiku · **Thinking:** OFF · **Effort:** Low
**Branch:** `feat/mux-magic-revamp/0e-story-actions-and-reopen`
**Worktree:** `.claude/worktrees/0e_story-actions-and-reopen/`
**Phase:** 1B web
**Depends on:** 01
**Parallel with:** all other 1B web workers

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Yarn only. See [AGENTS.md](../../AGENTS.md).

## Your Mission

Two Storybook ergonomics:
1. Stories with callback props (e.g. `onClick`, `onClose`, `onSubmit`) should wire them to `action()` from `@storybook/test` so the Actions panel logs invocations. Currently many stories pass static mock functions that produce no UI feedback.
2. Stories for components that include a **modal** which the user can dismiss should provide a "Re-open modal" button in the story toolbar (so once closed, the modal can be brought back without reloading the page).

### Sweep approach

For (1):
- Grep `packages/web/src/**/*.stories.tsx` for `() => {}` or `vi.fn()` callback props.
- Replace with `action("onCallbackName")`.
- Import: `import { action } from "@storybook/test"` (verify the import path; addon-vitest may re-export under a different module).

For (2):
- Grep for stories that render `*Modal` components and pass a closeable prop.
- Add a `<button onClick={() => setOpen(true)}>Re-open modal</button>` in the story wrapper.
- Reset state on the button click (e.g. via local Jotai store or `useState`).

### Don't blanket-apply

Some callbacks are deliberately static (e.g. test fixtures that assert specific values). Don't replace those — only swap when the existing callback is a no-op stub.

## TDD steps

1. Pick 2-3 representative stories to convert; verify the Actions panel logs as expected (manual Storybook visual check, not Vitest).
2. Sweep remaining stories.
3. `yarn lint`, `yarn typecheck`, `yarn test` all clean — story tests should still pass since they don't depend on the callback identity.

## Files

- Many `packages/web/src/**/*.stories.tsx` files
- Possibly story decorators in [packages/web/.storybook/preview.tsx](../../packages/web/.storybook/preview.tsx)

## Verification checklist

- [ ] Worktree created
- [ ] Manifest row → `in-progress`
- [ ] Story conversion done; Actions panel logs callbacks for converted stories
- [ ] Re-open-modal button added where applicable
- [ ] Standard gate clean
- [ ] PR opened
- [ ] Manifest row → `done`

## Out of scope

- Writing NEW stories
- Refactoring story decorators or providers
- Replacing static fixtures in tests (this is Storybook-only)
