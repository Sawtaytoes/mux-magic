# 2026-05-15 — e2e failures are real; don't dismiss them as flaky

- **Status:** Accepted
- **Date decided:** 2026-05-15 (date captured in memory; a standing behavioral correction — may predate this)
- **Area:** process
- **Source:** memory `feedback_test_failures_environmental.md` (2026-05-15), `feedback_lint_before_merge.md`

## Decision

A `yarn e2e` failure almost always means real code broke. Build `web/dist` first (`yarn build:web-static`) and re-run — don't ask, just do it. Only Vitest **pool** noise (port collisions across many worktrees) is sometimes genuinely environmental, and that's a narrow exception. Run `yarn lint` to **zero warnings** before `gh pr merge` (CI treats warnings as failures), and run the check-only `yarn lint:biome` after any `git merge`.

## What we rejected — DO NOT revert to this

- Do not wave off a red e2e as "probably environmental / flaky" and merge anyway. Previous sessions built a reputation for breaking e2e by doing exactly this; the user corrected it. The default assumption is *your change broke it.*
- Do not trust a local `yarn lint` exit 0 as "mergeable." `yarn lint` auto-fixes and can report warnings with exit 0 while CI's `yarn lint:biome` rejects them — PR #135 failed CI on 5 `noAccumulatingSpread` warnings that local lint had "passed."

## Why it must not be re-litigated

Rationalizing a real regression as flaky is exactly how broken behavior reaches the user in manual use — the thing this whole decision log exists to prevent. Treat e2e and the CI lint command as the trust gate, not advisory.
