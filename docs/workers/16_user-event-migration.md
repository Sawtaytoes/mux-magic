# Worker 16 — user-event-migration

**Model:** Sonnet · **Thinking:** ON · **Effort:** High
**Branch:** `feat/mux-magic-revamp/16-user-event-migration`
**Worktree:** `.claude/worktrees/16_user-event-migration/`
**Phase:** 1B web
**Depends on:** 01
**Parallel with:** all other 1B web workers (but **avoid running simultaneously with workers that add new tests**, since their tests may use the old `fireEvent` pattern and need to be in sync)

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Yarn only. See [AGENTS.md](../../AGENTS.md).

## Your Mission

Replace `fireEvent` from `@testing-library/react` with `userEvent` from `@testing-library/user-event` across all web tests. `userEvent` simulates real user interactions (focus, sequenced keystrokes, etc.) more faithfully and catches a class of bugs that `fireEvent` misses.

### Why this matters

- `fireEvent.click(button)` fires only the click event.
- `userEvent.click(button)` mimics the full chain: mousedown → mouseup → click, plus focus management.
- Some interactions (e.g., typing into a controlled input) only behave correctly with `userEvent.type` (per-keystroke), not `fireEvent.input` (single change event).

### Migration mechanics

`userEvent` is async; tests must `await user.click(...)`. Mechanical sweep:

```ts
// Before
import { fireEvent, render, screen } from "@testing-library/react"

it("clicks button", () => {
  render(<Button />)
  fireEvent.click(screen.getByRole("button"))
})

// After
import { render, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"

it("clicks button", async () => {
  const user = userEvent.setup()
  render(<Button />)
  await user.click(screen.getByRole("button"))
})
```

### Sweep approach

1. Grep `fireEvent` across `packages/web/src/`.
2. For each file:
   - Replace `import { fireEvent }` → remove (or replace with `userEvent` if not already imported).
   - Add `userEvent.setup()` at top of each test.
   - Convert `fireEvent.click(x)` → `await user.click(x)`.
   - Convert `fireEvent.change(x, { target: { value: ... }})` → `await user.clear(x)` + `await user.type(x, value)`.
   - Convert `fireEvent.keyDown(x, { key: "Enter" })` → `await user.keyboard("{Enter}")`.
3. Mark each `it` block as `async`.
4. Run `yarn test` per file batch; fix any tests that break due to focus / blur timing changes.

### Watch-outs

- `userEvent.type` is slow if not configured with `delay: null` for unit tests. Use `userEvent.setup({ delay: null })` to disable per-key delay.
- Some tests rely on synchronous `fireEvent` to test rendering snapshots immediately after — those need rewrites.
- The migration may surface latent bugs (tests that passed because `fireEvent` was too synthetic). Fix the real bug, don't downgrade back to `fireEvent`.

### Verify dependency

Confirm `@testing-library/user-event` is installed (check [packages/web/package.json](../../packages/web/package.json)). If not, add with `yarn add -D @testing-library/user-event`.

## TDD steps

Not strictly TDD — this is a refactor with existing tests. But:
1. Pick one test file as a pilot. Convert it. Verify all tests still pass.
2. Document any patterns that emerged (e.g., async setup helpers, common substitutions).
3. Sweep remaining files in chunks (one logical area per commit).

## Files

- All `packages/web/src/**/*.test.{ts,tsx}` files containing `fireEvent`
- Possibly a shared test helper if the new pattern needs one
- [packages/web/package.json](../../packages/web/package.json) (verify devDep)

## Verification checklist

- [ ] Worktree created
- [ ] Manifest row → `in-progress`
- [ ] `@testing-library/user-event` installed
- [ ] All `fireEvent` references replaced (grep clean)
- [ ] All tests pass
- [ ] Test suite runtime unchanged or faster (with `delay: null`)
- [ ] Standard gate clean
- [ ] PR opened
- [ ] Manifest row → `done`

## Out of scope

- Rewriting tests to cover more cases (this is a like-for-like migration)
- Migrating Storybook tests (different runner; out of scope here)
- E2E tests (Playwright has its own user-action API)
