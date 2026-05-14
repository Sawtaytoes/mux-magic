## Worker 3d — loadmodal-backdrop-leak-fix

**Model:** Sonnet · **Thinking:** ON · **Effort:** Medium
**Branch:** `feat/mux-magic-revamp/3d-loadmodal-backdrop-leak-fix`
**Worktree:** `.claude/worktrees/3d_loadmodal-backdrop-leak-fix/`
**Phase:** Bug-fix follow-up to worker 0b
**Depends on:** 0b (introduced the regression)
**Parallel with:** anything else not touching `LoadModal/`, `useAutoClipboardLoad`, or `Modal/`
**Status:** ready

> **Status as of 2026-05-14:** Bisect-confirmed regression introduced by [`4d4b9c71` feat(0b): auto-paste YAML on Load button with instant checkmark](https://github.com/Sawtaytoes/mux-magic/commit/4d4b9c71). Last passing commit: `03d2fa65`. First failing commit: `4d4b9c71`. The auto-paste change altered LoadModal's open/close transitions in a way that leaves the modal **backdrop** mounted after the modal text content unmounts; subsequent header-button clicks are intercepted by the leftover overlay.

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Yarn only. See [AGENTS.md](../../AGENTS.md).

## Your mission

The variables-modal e2e test [`path variable created in modal survives YAML copy-reload`](../../e2e/variables-modal.spec.ts) currently fails because a stale modal backdrop intercepts pointer events after a successful synthetic-paste load. Restore the test to green WITHOUT regressing worker 0b's auto-paste UX.

## Reproducer

```sh
yarn e2e --grep "path variable created in modal survives YAML copy-reload"
```

- **Expected:** 1 passed.
- **Actual:** 1 failed at [`e2e/variables-modal.spec.ts:197`](../../e2e/variables-modal.spec.ts) — the second `await openVariablesModal(page)` call. Playwright reports:

  ```
  <div role="none" class="fixed inset-0 z-50 flex items-center justify-center bg-black/70">…</div>
  intercepts pointer events
  ```

The `<div>` matches the Modal primitive's backdrop ([`packages/web/src/components/Modal/Modal.tsx`](../../packages/web/src/components/Modal/Modal.tsx)).

## Bisect record

| Commit | Result | Time |
|---|---|---|
| `03d2fa65` (parent of `4d4b9c71`) | ✅ pass | ~780ms |
| `4d4b9c71` (worker 0b) | ❌ fail | ~30s timeout retrying click |
| Every commit on `feat/mux-magic-revamp` since | ❌ fail | same |

To verify the bisect yourself:

```sh
git checkout 03d2fa65
yarn e2e --grep "path variable created in modal survives YAML copy-reload"   # passes <5s
git checkout feat/mux-magic-revamp
yarn e2e --grep "path variable created in modal survives YAML copy-reload"   # fails ~30s
```

## What the failing flow does

[`e2e/variables-modal.spec.ts:129-203`](../../e2e/variables-modal.spec.ts):

1. Open Variables modal via header → add a path variable named `Media Root` with value `/mnt/media` → close.
2. Open Sequence-actions menu → click View YAML → copy modal text → press Escape.
3. Open Sequence-actions menu → click Load button (`#load-btn`).
4. **`page.evaluate(...)`** dispatches a synthetic `ClipboardEvent('paste', { clipboardData })` onto `document` carrying the YAML.
5. **`expect(page.getByText(/Paste your saved sequence YAML/)).toBeHidden()`** — passes (text gone).
6. **`await openVariablesModal(page)`** — fails. The Variables button click is blocked by the leftover backdrop layer.

The wait at step 5 confirms the modal *content* is hidden, but the backdrop layer (sibling div with `bg-black/70`) is still in the DOM intercepting pointer events.

## Most likely root cause (hypothesis — verify before patching)

The auto-paste hook [`useAutoClipboardLoad`](../../packages/web/src/hooks/useAutoClipboardLoad.ts) introduced in `4d4b9c71` likely changed how LoadModal's open state transitions on a successful load. Possibilities to investigate in order:

1. **State sequencing in [LoadModal.tsx](../../packages/web/src/components/LoadModal/LoadModal.tsx)**: does the synthetic paste path call `setOpen(false)` before unmounting children, and does the Modal primitive's backdrop key off the same atom that drives content visibility? The before-commit version may have set them atomically; the post-commit version may set them in two ticks.
2. **Modal primitive backdrop unmount**: [Modal.tsx](../../packages/web/src/components/Modal/Modal.tsx) — confirm backdrop and content are gated by the **same** condition. If backdrop is conditionally rendered on a separate atom or on a CSS animation completion, the leak is here.
3. **Overlay stacking**: the test never actually clicks anything that would close LoadModal — it only dispatches a paste. The dispatched-paste handler in LoadModal probably calls `loadYamlFromText` then `closeModal()`. If the close path is async (Promise from clipboard / parse) and the test's `expect(...).toBeHidden()` is satisfied by an intermediate state, the backdrop may close via a CSS transition that hasn't completed when the next click fires.

## Files to inspect

- [`packages/web/src/components/LoadModal/LoadModal.tsx`](../../packages/web/src/components/LoadModal/LoadModal.tsx) (main suspect — 69 lines changed in `4d4b9c71`)
- [`packages/web/src/hooks/useAutoClipboardLoad.ts`](../../packages/web/src/hooks/useAutoClipboardLoad.ts) (new in `4d4b9c71`)
- [`packages/web/src/components/Modal/Modal.tsx`](../../packages/web/src/components/Modal/Modal.tsx) (the primitive owning the backdrop)
- [`packages/web/src/components/PageHeader/PageHeader.tsx`](../../packages/web/src/components/PageHeader/PageHeader.tsx) (Load button wiring; 194 lines changed in `4d4b9c71`)

`git show 4d4b9c71 -- packages/web/src/components/LoadModal/LoadModal.tsx` shows the exact deletions/additions that matter.

## TDD steps

1. **Confirm reproducer**: run the failing e2e test on `feat/mux-magic-revamp` HEAD. Note the timing.
2. **Add a focused unit/component test** that exercises the synthetic-paste close path on LoadModal and asserts the backdrop is gone. This catches regressions faster than e2e.
3. **Patch** the close path (or backdrop unmount sequencing) so backdrop and content tear down atomically.
4. **Verify**: re-run the failing e2e test (`--grep "path variable created in modal survives YAML copy-reload"`) — must pass.
5. **Don't regress worker 0b**: re-run any LoadModal/`useAutoClipboardLoad` tests; manually verify the green-checkmark UX still works on a real Load-button click with clipboard YAML.

## Constraints

- **Do not revert `4d4b9c71`.** Worker 0b's auto-paste UX is a desired feature — the bug is in how its close path interacts with the Modal primitive, not in the feature itself.
- **Do not loosen the e2e assertion** at [variables-modal.spec.ts:192-194](../../e2e/variables-modal.spec.ts) (`expect(...Paste your saved sequence YAML).toBeHidden()`). That assertion is correct; the backdrop should also be gone by the time it passes.
- The test was deliberately written by worker 37 to verify the YAML round-trip across a paste flow — it's a load-bearing regression test for variable persistence, not just a click sequence.

## Verification checklist

- [ ] `yarn e2e --grep "path variable created in modal survives YAML copy-reload"` passes.
- [ ] Full `yarn e2e` still shows 0 failures (no other tests regressed).
- [ ] `yarn typecheck`, `yarn lint:biome`, `yarn lint:eslint` clean.
- [ ] `yarn workspace @mux-magic/web test --run` clean (no LoadModal / useAutoClipboardLoad / Modal regressions).
- [ ] Manual smoke: in dev server, copy YAML to clipboard → click Load → green checkmark appears, no modal flash → click any other header button immediately → click registers (no overlay block).

## Notes for handoff

- The bisect was performed on Windows / Chromium / Playwright. Test runs against the React SPA at `WEB_PORT` with the API at `PORT`; both auto-boot via `playwright.config.ts` `webServer` entries.
- Branch tip when this prompt was written: `01bc5d45 style(lint): biome formatter pass`. The two unpushed-at-investigation-time commits (`4a04dfe1`, `01bc5d45`) are now on `origin/feat/mux-magic-revamp`.
- 51/52 e2e tests pass at branch tip; this prompt covers the only failure.
