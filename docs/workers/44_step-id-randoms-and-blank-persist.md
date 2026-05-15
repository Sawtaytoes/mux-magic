# Worker 44 — step-id-randoms-and-blank-persist

**Model:** Opus · **Thinking:** ON · **Effort:** High
**Branch:** `feat/mux-magic-revamp` (landed directly; ad-hoc plan, no dedicated worktree branch)
**Phase:** 1B web (bug-fix follow-up)
**Depends on:** 01, b4a88123 (collision-walking fix this supersedes)

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Yarn only. See [AGENTS.md](../../AGENTS.md).

## Context

When cards were added/removed rapidly in the Builder — especially after a paste — the console filled with `Encountered two children with the same key, "step9"` and `Unexpected duplicate view-transition-name: step-step9`, and some blank cards became undeletable (React reconciliation collapsed two siblings sharing a `key` into one logical node, so a delete request targeted the wrong element).

Two root causes were tangled together:

1. **Counter-based step IDs (`stepCounterAtom`)** — insert paths used `step${counter+1}` as identity. The counter was part of every undo snapshot, so undo rewound it. The codec re-derived it from YAML ids on load. `useAutoClipboardLoad` fully replaced it. Any of those rewinds, combined with state from a different counter value, could leave two cards sharing the same `stepN` id. Worker `b4a88123` had previously patched this with a "walk past existing ids" fallback, but the underlying counter coupling remained and produced new edge cases.
2. **Blank steps were dropped on YAML serialize** ([yamlCodec.ts](../../packages/web/src/jobs/yamlCodec.ts)) — they lived in `stepsAtom` and undo history but not in YAML, so any save/load, copy-step, or paste path silently disagreed with the in-memory model about which cards existed.

## Mission

Replace counter-based step IDs with random short ids, and persist blank steps in YAML. Server runner skips blanks as no-ops.

### 1. Random short step IDs

Format: `step_${4 base36 chars}` (e.g. `step_a3f9`). Birthday-paradox collision in a 100-step sequence is ~1 in 335, so a regen-on-collision loop is mandatory and wraps every mint site.

New helper [packages/web/src/state/idAllocator.ts](../../packages/web/src/state/idAllocator.ts):

- `collectExistingIds(items)` — walks top-level steps, groups, and group children.
- `makeStepId(existing)` — `while (true)` regen-on-collision loop.

Mint sites converted: `insertStepAtom`, `addStepToGroupAtom` ([stepAtoms.ts](../../packages/web/src/state/stepAtoms.ts)); `insertGroupAtom` inner blank step ([groupAtoms.ts](../../packages/web/src/state/groupAtoms.ts)); codec `createStep` ([yamlCodec.ts](../../packages/web/src/jobs/yamlCodec.ts)). Counter wiring deleted entirely: `stepCounterAtom`, `Snapshot.stepCounter`, all paste/auto-load/load-modal/builder-page references.

The codec keeps a `seenIds`-based collision suffix for back-compat when YAML pins a literal `id:`.

### 2. Persist blank steps in YAML

Drop the `hasContent` filter in `groupToYaml` and `toYamlStr`. Emit blanks as `- { id: <random>, command: "" }`. The explicit empty-string command is self-describing — readers can tell the slot is intentional rather than corrupt.

### 3. Server-side blank handling

The server schema previously enforced `command: z.enum(commandNames)` and would 400-reject any blank-bearing YAML before the runner saw it. Relax to `z.union([z.literal(""), z.enum(commandNames)])`.

In [sequenceRunner.ts](../../packages/server/src/api/sequenceRunner.ts):

- `flattenItems` filters out steps where `command === ""` so no child job is allocated.
- The outer iteration loop also `continue`s past blank top-level steps and strips blank inner steps from groups (groups left with zero real steps are skipped entirely).

Blank steps are intentionally a no-op at runtime; they exist only as Builder UI placeholders.

## Files

### New

- [packages/web/src/state/idAllocator.ts](../../packages/web/src/state/idAllocator.ts)
- [packages/web/src/state/idAllocator.test.ts](../../packages/web/src/state/idAllocator.test.ts) — `makeStepId` returns valid format; non-colliding even with 5000 pre-seeded ids; regen loop terminates when forced via `Math.random` mock; `collectExistingIds` walks groups + children.
- [packages/web/src/state/stepAtoms.collision.test.ts](../../packages/web/src/state/stepAtoms.collision.test.ts) — 200 random insert/remove operations + a 5000-id pre-seeded stress test. Asserts every id is unique at every step. (Replaces an earlier same-named test for the now-deleted counter-walking helper.)

### Modified

**Web state:**
- [packages/web/src/state/stepAtoms.ts](../../packages/web/src/state/stepAtoms.ts)
- [packages/web/src/state/groupAtoms.ts](../../packages/web/src/state/groupAtoms.ts)
- [packages/web/src/state/stepsAtom.ts](../../packages/web/src/state/stepsAtom.ts) — drop `stepCounterAtom`
- [packages/web/src/state/historyAtoms.ts](../../packages/web/src/state/historyAtoms.ts) — drop `stepCounter` from `Snapshot`

**Web jobs:**
- [packages/web/src/jobs/yamlCodec.ts](../../packages/web/src/jobs/yamlCodec.ts) — random ids in `createStep`; `loadYamlFromText` signature loses `currentStepCounter`; `LoadYamlResult` loses `stepCounter`; `LoadContext` loses `currentStepCounter`; serializer emits blanks
- [packages/web/src/jobs/sequenceUtils.ts](../../packages/web/src/jobs/sequenceUtils.ts) — delete obsolete `collectStepAndGroupIds` (replaced by `collectExistingIds`)
- [packages/web/src/jobs/yamlCodec.test.ts](../../packages/web/src/jobs/yamlCodec.test.ts) — flip "blank step filtering" assertions to round-trip preservation; add round-trip case for blank inside a group; drop `0` counter argument from every `loadYamlFromText` call
- [packages/web/src/jobs/buildBuilderUrl.test.ts](../../packages/web/src/jobs/buildBuilderUrl.test.ts) — round-trip a blank step through `?seq=`

**Web hooks/components:**
- [packages/web/src/hooks/useBuilderActions.ts](../../packages/web/src/hooks/useBuilderActions.ts) — drop counter; paste path no longer passes/sets the counter
- [packages/web/src/hooks/useAutoClipboardLoad.ts](../../packages/web/src/hooks/useAutoClipboardLoad.ts) — drop counter
- [packages/web/src/hooks/useScrollToAffectedStep.test.tsx](../../packages/web/src/hooks/useScrollToAffectedStep.test.tsx) — assertions read the new id from `stepsAtom` rather than asserting `step6`/`step7`/etc.; paste-then-insert race assertion uses `/^step-step_[a-z0-9]{4}$/`
- [packages/web/src/hooks/useBuilderActions.test.tsx](../../packages/web/src/hooks/useBuilderActions.test.tsx) — drop `stepCounter: 0` from `emptySnapshot`
- [packages/web/src/hooks/useBuilderKeyboard.test.tsx](../../packages/web/src/hooks/useBuilderKeyboard.test.tsx) — same
- [packages/web/src/components/LoadModal/LoadModal.tsx](../../packages/web/src/components/LoadModal/LoadModal.tsx) + [LoadModal.mdx](../../packages/web/src/components/LoadModal/LoadModal.mdx) — drop counter
- [packages/web/src/pages/BuilderPage/BuilderPage.tsx](../../packages/web/src/pages/BuilderPage/BuilderPage.tsx) + [BuilderPage.stories.tsx](../../packages/web/src/pages/BuilderPage/BuilderPage.stories.tsx) — drop counter

**Server:**
- [packages/server/src/api/routes/sequenceRoutes.ts](../../packages/server/src/api/routes/sequenceRoutes.ts) — `command` schema accepts `""` plus `enum(commandNames)`
- [packages/server/src/api/sequenceRunner.ts](../../packages/server/src/api/sequenceRunner.ts) — blank-step skip at `flattenItems` and at top-level/inner-group iteration
- [packages/server/src/api/routes/sequenceRoutes.test.ts](../../packages/server/src/api/routes/sequenceRoutes.test.ts) — new test: blank + real + blank → only the real step runs; umbrella completes

## View-transition-name (verification only)

[StepCard.tsx](../../packages/web/src/components/StepCard/StepCard.tsx) sets `viewTransitionName: \`step-${step.id}\``. With unique step ids, the `duplicate view-transition-name` warning is impossible by construction. CSS idents allow `[a-zA-Z_-][a-zA-Z0-9_-]*` — `step-step_a3f9` is valid.

## Out of scope

- Compressing the `?seq=` query string (handed off to worker 43 — `?seqJson=` minified-JSON + base64url).
- Re-tuning `group_*` / `pathVariable_*` id formats — they remain at 6 base36 chars.
- Serializing the undo/redo stacks across page loads.

## Verification

- [x] `yarn workspace @mux-magic/web typecheck`
- [x] `yarn workspace @mux-magic/server typecheck`
- [x] Web tests: 77 files / 701 tests pass
- [x] Server tests: 51 files / 564 tests pass
- [x] Commit `b8a340a2` pushed to `feat/mux-magic-revamp`
