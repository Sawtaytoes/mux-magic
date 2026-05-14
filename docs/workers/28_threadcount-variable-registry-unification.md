# Worker 28 — threadcount-variable-registry-unification

**Model:** Sonnet · **Thinking:** ON · **Effort:** Medium
**Branch:** `feat/mux-magic-revamp/28-threadcount-variable-registry-unification`
**Worktree:** `.claude/worktrees/28_threadcount-variable-registry-unification/`
**Phase:** 1B web (cleanup follow-up)
**Depends on:** 11 ✅ (per-job thread cap), 36 ✅ (Variables foundation), 37 ✅ (Edit Variables modal/sidebar)
**Parallel with:** any worker that doesn't touch [packages/web/src/components/VariableCard/](../../packages/web/src/components/VariableCard/), [packages/web/src/components/VariablesPanel/](../../packages/web/src/components/VariablesPanel/), [packages/web/src/components/ThreadCountVariableCard/](../../packages/web/src/components/ThreadCountVariableCard/), [packages/web/src/state/threadCountAtom.ts](../../packages/web/src/state/threadCountAtom.ts), or [packages/web/src/types.ts](../../packages/web/src/types.ts)

> **Why this worker exists:** worker 11 shipped a working per-job thread cap but **did not** register `threadCount` as a Variable type in the registry from worker 36. Instead, it built a parallel side-channel: a dedicated `threadCountAtom` + standalone `ThreadCountVariableCard`. The YAML codec is the only place threadCount and the path Variables meet (they share the on-disk `variables:` block but are two separate atoms in memory). The user-visible symptom is that the Edit Variables modal's TypePicker shows only "Path" — `threadCount` doesn't appear because it was never registered. This worker finishes what worker 11's spec called for: a single unified Variable type registry, with `threadCount` registered as a singleton.

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Tests must cover the change scope. Yarn only. See [AGENTS.md](../../AGENTS.md). Background context lives in [docs/PLAN.md §5.A](../PLAN.md).

---

## Your Mission

Bring `threadCount` into the unified Variables registry so:

1. The `VariableType` union in [packages/web/src/types.ts](../../packages/web/src/types.ts) includes `"threadCount"`.
2. `threadCount` is registered with `registerVariableType({...})` at bootstrap time with `cardinality: "singleton"`, `isLinkable: false`.
3. `TypePicker` in [packages/web/src/components/VariablesPanel/TypePicker.tsx](../../packages/web/src/components/VariablesPanel/TypePicker.tsx) **derives** its options from the registry — no more hardcoded `AVAILABLE_TYPES = ["path"]`.
4. The Edit Variables modal renders `ThreadCountVariableCard` (worker 11's existing component) when `variable.type === "threadCount"` via `VariableCard.tsx`'s dispatch.
5. `threadCount` state lives in the unified `variablesAtom` — `threadCountAtom` is either removed or becomes a derived/selector atom over `variablesAtom`.
6. YAML round-trip behavior is **preserved exactly** (the on-disk format already uses `variables: { tc: { type: "threadCount", value: "..." } }`).

### The single biggest design decision

You must decide: **fold `threadCountAtom` into `variablesAtom`, or keep `threadCountAtom` as a derived selector**?

- **Fold (recommended):** delete `threadCountAtom`; threadCount is a Variable with `id: "tc"` (or similar canonical id) inside `variablesAtom`. Any consumer of `threadCountAtom` switches to either a derived atom (`threadCountValueAtom = atom(get => get(variablesAtom).find(v => v.type === "threadCount")?.value ?? null)`) or reads from `variablesAtom` directly. Simpler long-term; matches worker 11's original spec; matches worker 35's pattern for `dvdCompareId`.
- **Wrap (fallback):** keep `threadCountAtom` but mirror it bidirectionally with `variablesAtom`. More code, more invariants to keep in sync, more chances for drift. Only do this if Fold turns out to break SSR/hydration or breaks too many call sites.

**Prefer Fold.** Choose Wrap only with a written reason in the PR.

### Singleton cardinality enforcement

`threadCount` is **singleton** — at most one `threadCount`-typed Variable per sequence. Two places enforce this:

1. `TypePicker.tsx` already filters singleton types whose definition is already present in `variablesAtom`. That stays.
2. The reducer/setter for `variablesAtom` should reject adding a second `threadCount`. Add a guard with a clear console.warn (or throw — match the project's style; grep for how worker 36 handles invalid state).

### TypePicker becomes registry-driven

Today [TypePicker.tsx:6](../../packages/web/src/components/VariablesPanel/TypePicker.tsx#L6) is:

```ts
const AVAILABLE_TYPES: VariableType[] = ["path"]
```

Replace with a registry call. Add to [registry.ts](../../packages/web/src/components/VariableCard/registry.ts):

```ts
export const getAllRegisteredTypes = (): VariableType[] =>
  Array.from(registry.keys())
```

And in `TypePicker.tsx`:

```ts
const availableTypes = getAllRegisteredTypes().filter((type) => {
  const definition = getVariableTypeDefinition(type)
  if (!definition) return false
  if (definition.cardinality === "singleton") {
    return !variables.some((variable) => variable.type === type)
  }
  return true
})
```

This is the bug fix that makes the TypePicker **future-proof**: worker 35's `dvdCompareId`, plus any future Variable type, will appear automatically without touching TypePicker again.

### VariableCard dispatch

`VariableCard.tsx` today dispatches on `variable.type === "path"`. Add a branch for `threadCount` that renders `ThreadCountVariableCard` (or inlines its input, your call — but reuse the existing component if its props line up).

Note: `ThreadCountVariableCard` today reads `threadCountAtom` directly. After Fold, it should accept the variable + an `onChange` callback as props (matching `renderValueInput`'s signature in `VariableTypeDefinition`) instead of reading the atom itself. The registry's `renderValueInput` is the right injection point.

### Registration location

Per worker 36's pattern (verify after reading worker 36's bootstrap setup): create a registration module that imports `registerVariableType` and is imported at app bootstrap so the side-effect runs once.

Suggested file: `packages/web/src/state/variableTypes/threadCount.ts`. This mirrors the path worker 35 will use for `dvdCompareId.ts` — keep the directory consistent so worker 35 fits in naturally.

Bootstrap import: wherever worker 36 set up the registry bootstrap (likely `App.tsx`, `main.tsx`, or a dedicated `variableTypes/index.ts`).

---

## YAML codec: do not change behavior

The YAML codec (post-worker-19 lives in `packages/web/src/jobs/yamlCodec.ts`) already round-trips `threadCount` correctly inside the `variables:` block. After this worker:

- **Reading** YAML still produces a single Variable list including the threadCount entry (post-Fold, threadCount lives in the same `variablesAtom` as paths).
- **Writing** YAML still emits `variables: { tc: { type: "threadCount", value: "4" }, basePath: { type: "path", ... } }`.

Worker 19's recent merge already unified the codec; verify the round-trip tests in `yamlCodec.test.ts` still pass without modification (and add a new round-trip test through the unified `variablesAtom`).

---

## Tests (per test-coverage discipline)

Required test coverage:

- **Unit:** `registerVariableType({ type: "threadCount", ... })` makes `getVariableTypeDefinition("threadCount")` return the definition.
- **Unit:** `getAllRegisteredTypes()` returns both `"path"` and `"threadCount"` after bootstrap.
- **Unit:** `variablesAtom` setter rejects (or de-duplicates to) a second `threadCount` Variable.
- **Component:** `TypePicker` rendering — shows both "Path" and "Max threads (per job)" (or whatever label the registration uses) when no threadCount Variable exists; hides "Max threads (per job)" when one already exists.
- **Component:** `VariableCard` renders `ThreadCountVariableCard`'s input when `variable.type === "threadCount"`.
- **Integration:** YAML round-trip: load a YAML with a `threadCount` variable → it appears in `variablesAtom` → serialize → produces an equivalent YAML.
- **e2e:** open Edit Variables modal → click "Add Variable" → see "Max threads (per job)" in the picker → select it → numeric input appears → set value → close → reopen → value persists; second "Add Variable" no longer offers threadCount (singleton).

---

## TDD steps

1. Failing tests (commit each):
   - `test(registry): getAllRegisteredTypes returns registered types`
   - `test(types): VariableType union includes "threadCount"` (this is a compile-time test; equivalent: write a test that asserts `registerVariableType` accepts `type: "threadCount"` without `as never` casts)
   - `test(TypePicker): renders all registered non-singleton-already-claimed types`
   - `test(variablesAtom): rejects duplicate singleton threadCount`
   - `test(VariableCard): renders threadCount input for threadCount variable`
   - `test(yamlCodec round-trip): threadCount via unified variablesAtom`
   - `test(e2e): add threadCount Variable via Edit Variables modal`
2. Implement:
   - Extend `VariableType` union.
   - Add `getAllRegisteredTypes()` to registry.
   - Create `state/variableTypes/threadCount.ts` registration module.
   - Wire bootstrap import.
   - Refactor `TypePicker` to use registry.
   - Fold `threadCountAtom` into `variablesAtom` (the big move).
   - Update `ThreadCountVariableCard` to accept props from `renderValueInput`.
   - Update all `threadCountAtom` consumers to read from `variablesAtom` (or a derived selector).
   - Update `VariableCard.tsx` dispatch.
3. Verify all tests pass.
4. Standard gate (`yarn lint → typecheck → test → e2e → lint`).

---

## Files

**Modify:**
- [packages/web/src/types.ts](../../packages/web/src/types.ts) — extend `VariableType` union
- [packages/web/src/components/VariableCard/registry.ts](../../packages/web/src/components/VariableCard/registry.ts) — add `getAllRegisteredTypes()`
- [packages/web/src/components/VariablesPanel/TypePicker.tsx](../../packages/web/src/components/VariablesPanel/TypePicker.tsx) — registry-driven options
- [packages/web/src/components/VariableCard/VariableCard.tsx](../../packages/web/src/components/VariableCard/VariableCard.tsx) — dispatch branch for `threadCount`
- [packages/web/src/components/ThreadCountVariableCard/ThreadCountVariableCard.tsx](../../packages/web/src/components/ThreadCountVariableCard/ThreadCountVariableCard.tsx) — accept variable + onChange props instead of reading atom
- [packages/web/src/state/variablesAtom.ts](../../packages/web/src/state/variablesAtom.ts) (post-worker-36 location; grep if unsure) — singleton guard for `threadCount`
- All call sites of `threadCountAtom` — switch to derived selector or `variablesAtom`
- [packages/web/src/jobs/yamlCodec.ts](../../packages/web/src/jobs/yamlCodec.ts) — verify round-trip; minimal/no changes expected

**Create:**
- `packages/web/src/state/variableTypes/threadCount.ts` — registration module
- Bootstrap import update (`packages/web/src/state/variableTypes/index.ts` or wherever worker 36 placed it)

**Delete (if Fold path taken):**
- [packages/web/src/state/threadCountAtom.ts](../../packages/web/src/state/threadCountAtom.ts) — or convert to a thin derived selector that reads from `variablesAtom`

**Tests:** alongside each modified/created module.

---

## Verification checklist

- [ ] Workers 11 ✅, 36 ✅, 37 ✅ confirmed merged before starting (check manifest)
- [ ] Worktree created at `.claude/worktrees/28_threadcount-variable-registry-unification/`
- [ ] Manifest row → `in-progress` (this worker should be added to the manifest table; pick the appropriate phase 1B web row)
- [ ] Failing tests committed first
- [ ] `VariableType` includes `"threadCount"`
- [ ] `getAllRegisteredTypes()` exported from registry
- [ ] `TypePicker` shows BOTH "Path" and "Max threads (per job)" when neither is claimed; hides singleton "Max threads (per job)" when one exists
- [ ] `VariableCard` renders the threadCount input via dispatch
- [ ] `threadCountAtom` either deleted or now derived from `variablesAtom`
- [ ] All previous `threadCountAtom` consumers still work (sequenceRunner, useBuilderActions, LoadModal, etc. — grep `threadCountAtom` for the full list before starting)
- [ ] YAML round-trip preserves threadCount through the unified atom
- [ ] e2e: add threadCount Variable through the modal end-to-end
- [ ] Standard gate clean
- [ ] PR opened into `feat/mux-magic-revamp`
- [ ] Manifest row → `done`

---

## Out of scope

- Registering `dvdCompareId` (that's worker 35; this worker only does `threadCount` and the registry-driven TypePicker plumbing that makes worker 35 a copy-paste)
- Changing the on-disk YAML format (the codec already emits the correct shape)
- Changing the `/system/threads` endpoint or the server-side scheduler quota logic
- UX redesign of the Edit Variables modal (worker 37's domain)
- Adding a "remove threadCount" affordance separate from the generic Variable-remove button (the existing Variable-remove flow should handle it once threadCount lives in `variablesAtom`)

---

## Notes for the implementing worker

- **Read worker 11's PR ([#98](https://github.com/Sawtaytoes/mux-magic/pull/98))** to understand the existing threadCount data flow. The diff for `sequenceRunner`, `useBuilderActions`, and `LoadModal` is your map of all the consumers you need to migrate.
- **Read worker 36's foundation** for the registry's bootstrap pattern. Do not invent a new bootstrap location — match what worker 36 set up.
- **Read worker 35's spec** ([docs/workers/35_dvd-compare-id-variable.md](35_dvd-compare-id-variable.md)) to make sure your registry-driven TypePicker change works for `dvdCompareId` too. Worker 35 should not need to touch `TypePicker.tsx` at all after this worker lands. If your design requires worker 35 to touch TypePicker, your design is wrong — go back.
- **Singleton enforcement**: worker 11's spec called for "Cardinality: exactly one per sequence (or zero, falling back to server's defaultThreadCount)". Match that.
- **Default value**: worker 11's spec called for `defaultValue: () => fetch("/system/threads").then(...)`. Plumb this through `VariableTypeDefinition.defaultValue` if worker 36's registry honors it; otherwise have the "Add Variable" flow seed the value from `/system/threads`.
- The `id` of the singleton threadCount Variable in the unified atom: worker 11's YAML used `tc`. Keep `tc` as the canonical id for backwards compatibility with already-saved YAML.
