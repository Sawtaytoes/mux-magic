# Worker 0c — scale-resolution-aspect-lock

**Model:** Sonnet · **Thinking:** ON · **Effort:** Medium
**Branch:** `feat/mux-magic-revamp/0c-scale-resolution-aspect-lock`
**Worktree:** `.claude/worktrees/0c_scale-resolution-aspect-lock/`
**Phase:** 1B web
**Depends on:** 01
**Parallel with:** all other 1B web workers

> **Status as of 2026-05-13:** Verified still pending. [packages/web/src/components/DslRulesBuilder/ScaleResolutionRule.tsx](../../packages/web/src/components/DslRulesBuilder/ScaleResolutionRule.tsx) has no `aspectLock` / chain icon / lock-state references; dimensions still edit independently.

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Yarn only. See [AGENTS.md](../../AGENTS.md).

## Your Mission

Scale Resolution has two dimensions (width, height). Today, editing one doesn't update the other — even when the user clearly wants to maintain aspect ratio. Add:

1. A **default-enabled** aspect-ratio lock icon (chain icon) next to the width/height inputs.
2. When locked: editing one dimension auto-computes the other based on the source's aspect ratio.
3. When unlocked: dimensions edit independently.
4. The lock icon's visual state (locked/unlocked) is a Jotai atom in the step's state.

### Implementation

Find the Scale Resolution rule UI in [packages/web/src/components/DslRulesBuilder/ScaleResolutionRule.tsx](../../packages/web/src/components/DslRulesBuilder/ScaleResolutionRule.tsx) (verify).

Aspect ratio comes from the source file's metadata. The user's task list says this is currently absent — i.e., when the rule is configured BEFORE running on real files, there's no source aspect to pull from. Two strategies:
- **A. Cache last-seen aspect:** when the rule's step runs against a file, store the resulting aspect on the step's state. Subsequent edits use the cached value. First-time edits assume 16:9.
- **B. Always assume a default:** lock just enforces a ratio, doesn't compute it. User toggles between 16:9 / 4:3 / "freeform" via a dropdown next to the lock.

Pick (A) if the runtime data is reliably available; pick (B) if not. Document choice in PR.

### State persistence

The lock state is per-step, not global. Store it in the step's params alongside width/height.

## TDD steps

1. Write failing test: render rule, verify lock icon present and default-on; change width with lock on, assert height updated proportionally.
2. Implement state + UI.
3. Verify test passes.

## Files

- [packages/web/src/components/DslRulesBuilder/ScaleResolutionRule.tsx](../../packages/web/src/components/DslRulesBuilder/ScaleResolutionRule.tsx) (verify path)
- The rule's test + story
- Step state atoms (for persistence)

## Verification checklist

- [ ] Worktree created
- [ ] Manifest row → `in-progress`
- [ ] Failing test first
- [ ] Lock icon default-enabled
- [ ] Locked: dimensions paired
- [ ] Unlocked: dimensions independent
- [ ] State persists in step params
- [ ] PR documents which aspect-source strategy chosen (A or B)
- [ ] Story covers both lock states
- [ ] Standard gate clean
- [ ] PR opened
- [ ] Manifest row → `done`

## Out of scope

- Pulling source aspect ratio from a live file probe (unless your strategy requires it AND it's cheap)
- Adding new preset ratios beyond 16:9 / 4:3 / freeform
