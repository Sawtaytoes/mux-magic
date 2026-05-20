# Worker 74 — promptmodal-paused-badge-pulse

**Model:** Haiku · **Thinking:** OFF · **Effort:** Low
**Branch:** `feat/mux-magic-revamp/74-promptmodal-paused-badge-pulse`
**Worktree:** `.claude/worktrees/74_promptmodal-paused-badge-pulse/`
**Phase:** UX polish
**Depends on:** 58
**Parallel with:** anything not touching [StepCard.tsx](../../packages/web/src/components/StepCard/StepCard.tsx) or [StatusBadge.tsx](../../packages/web/src/components/StatusBadge/) or the PromptModal dismissal path.

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Yarn only. See [AGENTS.md](../../AGENTS.md).

## Mission

After worker 58, dismissing the PromptModal (Escape, backdrop click, or `Close (job stays running)`) **minimizes** the prompt rather than clearing it — `promptModalAtom` keeps the payload with `isMinimized: true` and [StepCard.tsx:247-258](../../packages/web/src/components/StepCard/StepCard.tsx#L247-L258) renders a clickable "paused" badge that reopens the modal. The wiring is correct, but the badge appears with zero motion — a user who dismissed by accident (backdrop click while triaging adjacent UI is the common case) has no visual breadcrumb pointing at where their prompt went.

Add a one-shot pulse animation to the paused badge that fires when its `isMinimized` becomes `true` (i.e. on the dismiss transition, not on every render). The pulse should be short (≤ ~900ms total, two cycles), use the existing amber palette the badge already lives in, and respect `prefers-reduced-motion`.

## What to ship

- **One-shot pulse keyframe.** Add a Tailwind keyframe (or use the existing `animate-pulse` if its timing is short enough) gated on a per-step `isJustMinimized` flag that flips true when the underlying prompt's `isMinimized` transitions `false → true`, then auto-flips back after the animation ends (~900ms). Don't loop indefinitely — that would compete with active job animations elsewhere on the page.
- **prefers-reduced-motion fallback.** Skip the animation when the user prefers reduced motion; show only the static paused badge. Use a CSS `@media (prefers-reduced-motion: reduce)` rule on the keyframe.
- **No animation when the prompt arrives *already* minimized.** The pulse is a "you just dismissed something" signal, not a "this exists" signal. The first time the badge renders for a brand-new prompt, no pulse — only on the dismissal transition.
- **Storybook story** capturing the just-minimized state so the animation is visually reviewable.

## TDD

1. Failing test in `StepCard.test.tsx`: simulate a prompt that becomes minimized; the paused badge gains a `data-just-minimized` (or equivalent) attribute / class for ~900ms and then loses it.
2. Failing test: the badge does NOT gain the just-minimized class when the prompt arrives already minimized.
3. Failing test: when `prefers-reduced-motion: reduce` is set, the badge renders without the animation class.
4. Implement; tests go green.

## Files

**Modified:**

- [packages/web/src/components/StepCard/StepCard.tsx](../../packages/web/src/components/StepCard/StepCard.tsx) — detect the `isMinimized` transition and gate a pulse class; auto-reset after animationend.
- [packages/web/src/components/StepCard/StepCard.test.tsx](../../packages/web/src/components/StepCard/) — three cases above.
- [packages/web/src/components/StepCard/StepCard.stories.tsx](../../packages/web/src/components/StepCard/) — story for the just-minimized state.
- [packages/web/tailwind.config.ts] OR `packages/web/src/index.css` — keyframe definition (one or the other, match repo convention).
- [docs/workers/MANIFEST.md](MANIFEST.md) — flip this worker's row to `done` on merge.

## Verification

- [ ] Paused badge pulses on dismissal-driven minimize, not on first-render minimize
- [ ] Pulse self-stops after ≤ 900ms
- [ ] `prefers-reduced-motion: reduce` suppresses the animation
- [ ] Standard gate clean (`yarn lint → typecheck → test → e2e → lint`)
- [ ] Storybook story committed
- [ ] Worktree created
- [ ] Manifest row → `in-progress`
- [ ] PR opened
- [ ] Manifest row → `done`

## Why this is its own worker

Worker 58 shipped the foundation (atom-driven minimize + reopen via StepCard badge). The pulse is a small UX polish — orthogonal to the cancellation/dismissal contract — and bundling it into the broader follow-up sweep would muddy the diff. Haiku-sized.
