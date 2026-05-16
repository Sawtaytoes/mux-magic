# Worker 46 — scale-resolution-aspect-link-fix

**Model:** Sonnet · **Thinking:** ON · **Effort:** Medium
**Branch:** `feat/mux-magic-revamp/46-scale-resolution-aspect-link-fix`
**Worktree:** `.claude/worktrees/46_scale-resolution-aspect-link-fix/`
**Phase:** Bug-fix follow-up to worker 0c (Phase 1B web)
**Depends on:** 0c (introduced the per-side lock design that this corrects)
**Parallel with:** anything not touching `DslRulesBuilder/ScaleResolutionRule.tsx`, `AspectLockButton.tsx`, or `ruleMutations.ts`'s scale-resolution helpers
**Status:** ready

> **Status as of 2026-05-15:** Worker 0c shipped two per-group `AspectLockButton` instances and the per-group helpers `setScaleResolutionAspectLock` / `setScaleResolutionDimensionPaired` operate on a single `ScaleResolutionGroup` ("from" | "to"). The "from" lock pairs `(from.width, from.height)` to *its own* prior aspect; the "to" lock pairs `(to.width, to.height)` to *its own* prior aspect. The user's intent is a *cross-group* link: locking should make `(to.width, to.height)` preserve the `(from.width, from.height)` aspect ratio, with a single link icon rendered *between* the two clusters.

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Yarn only. See [AGENTS.md](../../AGENTS.md).

## Your mission

Replace the two per-side `AspectLockButton` instances at [packages/web/src/components/DslRulesBuilder/ScaleResolutionRule.tsx:88-102](../../packages/web/src/components/DslRulesBuilder/ScaleResolutionRule.tsx#L88-L102) and [:147-161](../../packages/web/src/components/DslRulesBuilder/ScaleResolutionRule.tsx#L147-L161) with a single cross-group link rendered between the `from` and `to` field clusters. When linked, edits to `to.width` or `to.height` are constrained to preserve the `(from.width, from.height)` aspect ratio; `from.*` edits remain free. Default-on (undefined ≡ linked), matching worker 0c's default-on convention.

## What today's code does (the bug)

[`ScaleResolutionRule.tsx`](../../packages/web/src/components/DslRulesBuilder/ScaleResolutionRule.tsx):

```ts
const isGroupLocked = (rule, group) =>
  group === "from"
    ? rule.isFromAspectLocked !== false
    : rule.isToAspectLocked !== false

// inside commitDimensionFor:
const mutate = isGroupLocked(rule, group)
  ? setScaleResolutionDimensionPaired   // pairs WITHIN the group
  : setScaleResolutionDimension
```

[`ruleMutations.ts:202-231`](../../packages/web/src/components/DslRulesBuilder/ruleMutations.ts#L202-L231) — `computePairedDimension` uses the group's *own* `currentWidth`/`currentHeight` as the ratio source. So with the "to" lock on, editing `to.width = 1920` recomputes `to.height` from `to`'s prior width:height — which is meaningless when the user just wants `to` to mirror `from`'s aspect.

## Desired behavior

1. **Single link control** rendered between the `from` and `to` field clusters (visually centered, not inside either cluster). Use the same `AspectLockButton` component — it already renders a chain icon and is state-agnostic.
2. **Single state flag** on `ScaleResolutionRule`: `isAspectLinked?: boolean`. `undefined` ≡ linked (default-on, matches 0c). Remove `isFromAspectLocked` / `isToAspectLocked` from new writes.
3. **Linked-edit rules** (consult [ruleMutations.ts:202-231](../../packages/web/src/components/DslRulesBuilder/ruleMutations.ts#L202-L231) for the pairing math, but the *source of ratio* changes):
   - Editing `from.width` or `from.height`: write through unchanged. Do NOT auto-update `to.*` — the user is redefining the source aspect.
   - Editing `to.width` while linked: set `to.width = value`, and `to.height = round(value * from.height / from.width)`.
   - Editing `to.height` while linked: set `to.height = value`, and `to.width = round(value * from.width / from.height)`.
   - If `from.width` or `from.height` is missing / `<= 0`: fall back to the 16:9 default (`FALLBACK_RATIO_WIDTH` / `FALLBACK_RATIO_HEIGHT` already exported from `ruleMutations.ts`).
4. **Read-time legacy migration** (back-compat for any saved sequences from 0c → 46):
   - Treat the rule as **unlinked** iff `isFromAspectLocked === false` OR `isToAspectLocked === false` OR `isAspectLinked === false`. Otherwise linked.
   - On any *write* to the rule, drop the legacy keys and emit only `isAspectLinked` (or omit when linked).

## Files to change

- [packages/web/src/components/DslRulesBuilder/ScaleResolutionRule.tsx](../../packages/web/src/components/DslRulesBuilder/ScaleResolutionRule.tsx) — single link button; rewire `commitDimensionFor` so the "from" group never pairs and the "to" group pairs against `from`'s ratio.
- [packages/web/src/components/DslRulesBuilder/ruleMutations.ts](../../packages/web/src/components/DslRulesBuilder/ruleMutations.ts) — replace `setScaleResolutionAspectLock` (per-group) with `setScaleResolutionAspectLink` (no group arg); replace `setScaleResolutionDimensionPaired` (per-group, self-ratio) with a new helper that takes the `from` group as the ratio source and writes the `to` group (or extend the existing one — see "Design choice" below). Drop the `ASPECT_LOCK_FLAG_BY_GROUP` table. Add a small `readIsAspectLinked(rule)` helper that encapsulates the legacy migration so callers don't sprinkle the OR-chain everywhere.
- [packages/web/src/components/DslRulesBuilder/types.ts](../../packages/web/src/components/DslRulesBuilder/types.ts) — add `isAspectLinked?: boolean`; mark `isFromAspectLocked` / `isToAspectLocked` as legacy-only (a `@deprecated` comment plus "read-only migration target" note) and keep them in the type so older YAML still parses without TS errors. Do NOT remove them from the type — the read-time migration is the contract.
- [packages/web/src/components/DslRulesBuilder/ScaleResolutionRule.stories.tsx](../../packages/web/src/components/DslRulesBuilder/ScaleResolutionRule.stories.tsx) (or wherever 0c put the stories — verify) — cover linked + unlinked states; remove the dual-lock story.
- Existing tests at `ruleMutations.test.ts` (or sibling) — update the `setScaleResolutionDimensionPaired` cases; add a `to`-edit-while-linked case asserting the ratio comes from `from`, not `to`'s prior pair.

## Design choice — single function or two?

Two reasonable shapes. Pick one and document it in the PR description:

- **(A) One function with an explicit source group:** `setScaleResolutionDimensionPaired({ rules, ruleIndex, sourceGroup: "from", targetGroup: "to", dimension, value })`. Generalizes if the link is ever inverted (link "to" → "from"). Slightly more parameters at every call site.
- **(B) Two narrow functions:** `setScaleResolutionFromDimension` (always free) and `setScaleResolutionToDimensionLinked` (always pairs against `from`). Smaller call sites, but if the link semantics ever flip you write a third function.

Lean **(A)** — the registry already has one paired-mutation helper, and the source/target generalization keeps the surface area the same. But (B) is fine if it reads cleaner at the call site.

## TDD steps

1. **Failing test for the new linked semantic** (`ruleMutations.test.ts`):
   - Given rule with `from: { width: 1920, height: 1080 }` and `to: { width: 1280, height: 720 }`, linked, edit `to.width = 3840`. Assert `to.height === 2160` (preserves *from's* 16:9, not to's existing 16:9 — though here they coincidentally match; use mismatched aspects for a clearer test).
   - Stronger case: `from: { width: 1920, height: 800 }` (2.4:1), `to: { width: 1280, height: 720 }` (16:9), linked, edit `to.width = 3840`. Assert `to.height === 1600` (preserves *from*'s 2.4:1). Today's code would emit `2160` (to's own 16:9) — that's the regression we're fixing.
2. **Failing test for legacy migration**: a rule object with `{ isFromAspectLocked: false }` (no `isAspectLinked`) should read as unlinked; a rule with `{ isToAspectLocked: false }` should read as unlinked; a rule with neither key should read as linked. After any write, the legacy keys are absent from the next state and only `isAspectLinked` (or its omission) remains.
3. **Failing test for `from`-edit while linked**: editing `from.width` should write through and NOT touch `to.*`. This is the simplification that makes the user's mental model click — the "source" can be redefined freely; the "target" follows.
4. **Failing component test** (`ScaleResolutionRule.test.tsx`): render the rule; assert exactly one `AspectLockButton` exists (was two). Assert it sits as a sibling of both clusters, not inside either. (Use `screen.getAllByRole('button', { name: /aspect/i })` and assert length 1, plus a structural assertion via `closest` or a wrapping `data-testid`.)
5. **Implement** the mutation changes, the type addition, and the component rewire.
6. **Run gates**: `yarn lint → typecheck → test`. Then build `web/dist` and run `yarn e2e` per [feedback_test_failures_environmental.md](file:///C:/Users/satur/.claude/projects/d--Projects-Personal-mux-magic/memory/feedback_test_failures_environmental.md) — `yarn e2e` is the trust gate.

## Constraints

- **Do not delete `isFromAspectLocked` / `isToAspectLocked` from the `ScaleResolutionRule` type** — keep them as readable-but-deprecated so older saved YAML round-trips through `yamlCodec`. The read-time migration is the contract; a `legacyFieldRenames`-style approach in the codec is **not** the right tool here because the migration is a many-to-one OR (either old key being `false` flips the new key off).
- **Do not change `setScaleResolutionDimension`** (the free-edit version). It still applies to `from.*` writes and to either dimension while unlinked.
- **Do not pull source-file aspect ratio from a runtime probe.** Worker 0c explicitly scoped that out; 46 inherits the same scope. The link uses *the current `from.*` values* as the ratio.
- **Do not regress the worker 0c default-on behavior.** New rules and unmigrated rules with no relevant keys are linked.
- Follow [feedback_no_array_mutation.md](file:///C:/Users/satur/.claude/projects/d--Projects-Personal-mux-magic/memory/feedback_no_array_mutation.md) — no `.push`, prefer `concat`/spread builders.

## Verification checklist

- [ ] Worktree at `.claude/worktrees/46_scale-resolution-aspect-link-fix/` created
- [ ] [MANIFEST.md](MANIFEST.md) row 46 flipped to `in-progress` at start
- [ ] Failing test first (mutation + component)
- [ ] Exactly one `AspectLockButton` in `ScaleResolutionRule`
- [ ] Linked: editing `to.*` preserves `from`'s aspect; editing `from.*` is free
- [ ] Unlinked: all four fields edit independently
- [ ] Default-on preserved (undefined `isAspectLinked` ≡ linked)
- [ ] Legacy migration: `{ isFromAspectLocked: false }` and `{ isToAspectLocked: false }` both read as unlinked; both keys are absent after any subsequent write
- [ ] Stories updated to cover linked + unlinked states (one each, no dual-lock story)
- [ ] `yarn lint`, `yarn typecheck`, `yarn workspace @mux-magic/web test --run` clean
- [ ] `yarn e2e` clean after a fresh `web/dist` build
- [ ] Manual smoke: open a sequence with a Scale Resolution rule → toggle the new link → with link ON, type a new "to" width and watch "to" height auto-update to preserve "from"'s aspect → with link OFF, both `to` fields edit independently
- [ ] PR opened against `feat/mux-magic-revamp` documenting the design choice (A or B above)
- [ ] [MANIFEST.md](MANIFEST.md) row 46 flipped to `done` AFTER the PR is merged (per [feedback_workers_flip_own_done.md](file:///C:/Users/satur/.claude/projects/d--Projects-Personal-mux-magic/memory/feedback_workers_flip_own_done.md))

## Out of scope

- Pulling source-file aspect ratio from a live ffmpeg/mediainfo probe.
- Inverting the link direction (allowing `from` to be the constrained side).
- Preset aspect dropdown (16:9 / 4:3 / freeform). The link uses the *current* `from` pair as the ratio source.
- Refactoring `DimensionInput` — it stays as-is.
