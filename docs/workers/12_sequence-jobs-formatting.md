# Worker 12 — sequence-jobs-formatting

**Model:** Haiku · **Thinking:** OFF · **Effort:** Low
**Branch:** `feat/mux-magic-revamp/12-sequence-jobs-formatting`
**Worktree:** `.claude/worktrees/12_sequence-jobs-formatting/`
**Phase:** 1B web
**Depends on:** 01
**Parallel with:** all other 1B web workers

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Yarn only. See [AGENTS.md](../../AGENTS.md).

## Your Mission

On the Jobs screen, when a sequence has steps with long names, the layout breaks (overflow, wrapping wrong, breaking column alignment). Fix the formatting so long step names truncate or wrap gracefully without breaking the surrounding row.

### Investigation

1. Run `yarn dev` and create a sequence with a step whose name is artificially long (e.g., 80+ characters). Observe the Jobs screen breakage.
2. The Jobs screen lives at [packages/web/src/pages/JobsPage/JobsPage.tsx](../../packages/web/src/pages/JobsPage/JobsPage.tsx) (verify). Find the row component (likely [JobCard.tsx](../../packages/web/src/components/JobCard/JobCard.tsx) or a row inside JobsPage).
3. Identify which CSS class/property is allowing overflow. Common culprits: missing `overflow: hidden` + `text-overflow: ellipsis`, missing `min-width: 0` on a flex child, or a `whitespace: nowrap` that prevents wrapping in the parent.

### Fix strategy

Two options depending on UX preference:
- **Truncate with ellipsis:** add `truncate` (Tailwind) or `overflow: hidden; text-overflow: ellipsis; white-space: nowrap` on the step-name span. Add `title={stepName}` for accessibility.
- **Wrap gracefully:** allow multi-line; ensure the row height adjusts and other columns realign.

Pick truncate-with-tooltip if the Jobs screen is dense; pick wrap if rows naturally have vertical space. Document your choice in the PR description.

## TDD steps

1. Write an e2e (or unit) test rendering JobsPage with a step name 80+ chars long. Assert the container's `clientWidth` doesn't exceed its parent's `clientWidth`. Commit `test(JobsPage): failing test for long step name overflow`.
2. Apply the CSS fix.
3. Verify the test passes.

## Files

- [packages/web/src/pages/JobsPage/JobsPage.tsx](../../packages/web/src/pages/JobsPage/JobsPage.tsx) or the row component
- The component's test file
- Possibly its story file (add a story with a long-name fixture)

## Verification checklist

- [ ] Worktree created
- [ ] Manifest row → `in-progress`
- [ ] Failing test committed first
- [ ] CSS fix applied
- [ ] PR description states which UX choice was made (truncate vs wrap)
- [ ] Standard gate clean
- [ ] Manual visual verification in Storybook AND dev server (Jobs screen)
- [ ] PR opened
- [ ] Manifest row → `done`

## Out of scope

- Redesigning the Jobs screen
- Adding new columns or sorting
- Animation work
