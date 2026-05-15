# Worker 45 — id-variable-types-and-field-link-awareness

**Model:** Sonnet · **Thinking:** ON · **Effort:** Medium-High
**Branch:** `worker/45-id-variable-types-and-field-link-awareness`
**Worktree:** `.claude/worktrees/45_id-variable-types-and-field-link-awareness/`
**Phase:** 3 (follow-up to the Variables system rollout)
**Depends on:** 35 (dvdCompareId pattern), 36 (Variables foundation), 37 (Edit Variables modal — for manual relink)
**Parallel with:** any worker that doesn't touch `NumberWithLookupField` or `commands.ts` lookup fields

---

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Tests must cover the change scope. Yarn only. See [AGENTS.md](../../AGENTS.md). Background context lives in [docs/PLAN.md §5.A](./PLAN.md) and [docs/workers/35_dvd-compare-id-variable.md](./35_dvd-compare-id-variable.md).

---

## Context

Worker 35 registered `dvdCompareId` as a Variable type, made `TypePicker` registry-driven, and auto-creates a `dvdCompareId` Variable when a step picks a command with that field (e.g. `nameSpecialFeaturesDvdCompareTmdb`). What's still **manual** after worker 35:

1. **Three sibling ID types are unregistered.** `tmdbId`, `anidbId`, `malId` all live on real commands today but only exist as `step.params[...]` literals — there's no Variable type so users can't share them across steps or rename them. PLAN.md calls these out as "future types following worker 35's pattern."
2. **The step field doesn't honor the link.** Worker 35 auto-creates `dvdCompareId` Variables and pre-links `step.links.dvdCompareId`, but `NumberWithLookupField` still reads from `step.params[field.name]` and writes via `setParam`. So typing in the step's "DVDCompare Film ID" field doesn't update the linked Variable, and the Variable's value stays empty unless edited through the Variables panel. The link is correct in YAML but disconnected in the UI.
3. **Auto-create is hard-coded to `dvdCompareId`.** `ensureDvdCompareIdVariable` in [stepAtoms.ts](../../packages/web/src/state/stepAtoms.ts) only checks for that one field name. It needs to generalize to any registered linkable type.

This worker closes those three gaps in one focused PR.

---

## Mission

Make every supported ID type behave the same way `dvdCompareId` does after worker 35: registered Variable type, auto-created on step add, and the step's `NumberWithLookupField` reads/writes through the linked Variable transparently.

### 1. Register `tmdbId`, `anidbId`, `malId` Variable types

Copy worker 35's pattern verbatim. For each type, create:

- `packages/web/src/state/variableTypes/<type>.ts` — exports `<TYPE>_VARIABLE_DEFINITION` constant (multi cardinality, `isLinkable: true`, type-appropriate `validate`).
- Extend the `VariableType` union in [packages/web/src/types.ts](../../packages/web/src/types.ts).
- Register each definition in [packages/web/src/components/VariableCard/registry.ts](../../packages/web/src/components/VariableCard/registry.ts).
- A type-specific input component in `packages/web/src/components/VariableCard/`:
  - `TmdbIdInput.tsx` — accepts numeric id (`74759`) or `themoviedb.org/movie/...` URL.
  - `AnidbIdInput.tsx` — accepts numeric id or `anidb.net/anime/...` URL.
  - `MalIdInput.tsx` — accepts numeric id or `myanimelist.net/anime/...` URL.
- Add the type-dispatch branch in [VariableCard.tsx](../../packages/web/src/components/VariableCard/VariableCard.tsx) alongside the existing `path` and `dvdCompareId` branches.
- Storybook stories per type (mirror `VariableCard.stories.tsx`'s `DvdCompareIdSlug` / `Numeric` / `Url` / `Empty` set).

`validate` per type — reject empty, accept numeric or recognized URL host, warn on free-text. Keep the logic narrow; this isn't reverse-lookup territory.

### 2. Generalize `ensureDvdCompareIdVariable` → `ensureLinkableIdVariables`

The hard-coded `"dvdCompareId"` check in [stepAtoms.ts](../../packages/web/src/state/stepAtoms.ts) becomes a registry-driven scan. For every field on the new command whose `name` matches a registered linkable Variable type, auto-create a fresh Variable of that type and seed `step.links[field.name]` with the new id.

Suggested signature:

```ts
const ensureLinkableIdVariables = (
  get, set, commandName,
): Record<string, string> => {
  // Returns { fieldName: newVariableId } for every auto-created link.
}
```

Mapping is `field.name === variableType.type`. Both sides happen to share these strings today (`dvdCompareId` field name === `dvdCompareId` variable type), and that's the contract: a field becomes auto-linkable purely by sharing its name with a registered Variable type. No new metadata required on the command schema.

Update `changeCommandAtom` to spread the returned map into `step.links` instead of seeding only `{ dvdCompareId: ... }`.

### 3. Make `NumberWithLookupField` link-aware

The hardest part. The field currently:

- Reads `step.params[field.name]` as `number | undefined`.
- Writes via `useBuilderActions().setParam(step.id, field.name, value)`.
- Cascades clears (`dvdCompareName`, `dvdCompareReleaseLabel`, `tmdbId`, `tmdbName`) on id change.
- Runs a debounced reverse-lookup (slug/URL → numeric id + display name) that writes back into the companion name field.

The cascade is the booby trap. Threading link-awareness through every write site naively risks orphaned companion fields (because the companion lives in `step.params` but the id is in a Variable, so the two get out of sync). Recommended structure:

- Introduce a small **effective-value helper** (`packages/web/src/commands/effectiveFieldValue.ts`):
  - `getEffectiveValue(step, field, variables)` → returns the resolved value: variable-value if `step.links[field.name]` is a string variable id, else `step.params[field.name]`.
  - `setEffectiveValue(store, step, field, nextValue)` → atomic write that picks the right destination atom (`setVariableValueAtom` if linked, `setParamAtom` if not).
- `NumberWithLookupField` reads its `rawValue` through `getEffectiveValue` and writes its main-id change through `setEffectiveValue`. Companion writes (`dvdCompareName`, etc.) stay as `setParam` calls — companions are still step-local (they're per-step display caches, not shared identity).
- Variable values are strings. When the field expects a number, parse on read (`Number(variable.value)` → `NaN` shows as empty input) and stringify on write (`String(nextValue)` → variable.value).
- The reverse-lookup write target (the companion name) is NOT linked — keep it in `step.params` unchanged.

The cascade clears (lines ~190–217 of [NumberWithLookupField.tsx](../../packages/web/src/components/NumberWithLookupField/NumberWithLookupField.tsx)) should ALSO route through `setEffectiveValue` so clearing a linked `tmdbId` clears the linked Variable, not just step.params. Document this carefully — it's easy to leave one cascade write going to the wrong place.

### 4. Update `commands.ts` lookup-field definitions

Today `tmdbId` / `anidbId` / `malId` are declared as `numberWithLookup` fields on various commands but aren't flagged as auto-linkable. Audit [packages/web/src/commands/commands.ts](../../packages/web/src/commands/commands.ts) and confirm every lookup-bearing field whose name matches a registered Variable type is correctly picked up by the generalized auto-create scan.

No new field metadata should be needed — the name-matching contract in §2 means existing fields participate automatically once their type is registered.

---

## Tests (per test-coverage discipline)

- **Unit (`state/variableTypes/*.test.ts`):** one test file per new type; mirror `dvdCompareId.test.ts`'s shape (definition shape + `validate` cases + registry presence).
- **Unit (`state/stepAtoms.changeCommand.test.ts`):** extend with cases that pick a command containing `tmdbId`, `anidbId`, `malId` — each auto-creates the right variable type and pre-links it. Picking a command with multiple ID fields (e.g. `nameSpecialFeaturesDvdCompareTmdb` has both `dvdCompareId` and `tmdbId`) auto-creates BOTH variables and links both.
- **Unit (`commands/effectiveFieldValue.test.ts`):** new helper's read and write paths — linked vs. unlinked field, number↔string conversion, NaN handling.
- **Component (`NumberWithLookupField.test.tsx`):** linked field displays the linked Variable's value as the input's rawValue; onChange writes to the variable, not to step.params; cascade clears affect the linked Variable.
- **e2e (`e2e/variables-modal.spec.ts`):** create a step with `tmdbId` field; verify a `tmdbId` Variable auto-appears; type a value into the step's field; verify the Variable's value updates in the panel; YAML round-trip preserves the linked Variable's value.

---

## TDD steps

1. Failing tests above (commit before any implementation).
2. Register each new type + input renderer + Storybook stories.
3. Add `effectiveFieldValue` helper with full test coverage.
4. Wire `NumberWithLookupField` through the helper.
5. Generalize `ensureLinkableIdVariables` and update `changeCommandAtom`.
6. Verify the existing `dvdCompareId` flow still works (regression check against worker 35's tests).
7. Browser test: walk through the full flow for each new ID type in the dev server.
8. Full pre-merge gate.

---

## Files

**Create:**
- `packages/web/src/state/variableTypes/tmdbId.ts` + test
- `packages/web/src/state/variableTypes/anidbId.ts` + test
- `packages/web/src/state/variableTypes/malId.ts` + test
- `packages/web/src/components/VariableCard/TmdbIdInput.tsx`
- `packages/web/src/components/VariableCard/AnidbIdInput.tsx`
- `packages/web/src/components/VariableCard/MalIdInput.tsx`
- `packages/web/src/commands/effectiveFieldValue.ts` + test

**Modify:**
- [packages/web/src/types.ts](../../packages/web/src/types.ts) — extend `VariableType` union with `"tmdbId" | "anidbId" | "malId"`
- [packages/web/src/components/VariableCard/registry.ts](../../packages/web/src/components/VariableCard/registry.ts) — register the three new definitions
- [packages/web/src/components/VariableCard/VariableCard.tsx](../../packages/web/src/components/VariableCard/VariableCard.tsx) — three new type-dispatch branches
- [packages/web/src/components/VariableCard/VariableCard.stories.tsx](../../packages/web/src/components/VariableCard/VariableCard.stories.tsx) — Storybook stories per type
- [packages/web/src/state/stepAtoms.ts](../../packages/web/src/state/stepAtoms.ts) — rename + generalize `ensureDvdCompareIdVariable` → `ensureLinkableIdVariables`
- [packages/web/src/state/stepAtoms.changeCommand.test.ts](../../packages/web/src/state/stepAtoms.changeCommand.test.ts) — new cases per type + multi-field command
- [packages/web/src/components/NumberWithLookupField/NumberWithLookupField.tsx](../../packages/web/src/components/NumberWithLookupField/NumberWithLookupField.tsx) — route reads/writes through `effectiveFieldValue` helper
- [packages/web/src/components/NumberWithLookupField/NumberWithLookupField.test.tsx](../../packages/web/src/components/NumberWithLookupField/NumberWithLookupField.test.tsx) — linked-field cases

---

## Verification checklist

- [ ] Workers 35, 36, 37 merged before starting
- [ ] Worktree created
- [ ] Manifest row → `in-progress`
- [ ] Failing tests committed first
- [ ] All three new types registered + retrievable via `getVariableTypeDefinition`
- [ ] Storybook renders each type's stories without errors
- [ ] TypePicker shows all four ID types (path stays under singleton-/multi-aware filtering)
- [ ] Adding a step with a `tmdbId` field auto-creates a `tmdbId` Variable; same for `anidbId`, `malId`
- [ ] A command with multiple ID fields auto-creates one Variable per field
- [ ] Typing in the step's linked field updates the Variable's value (visible in Variables panel immediately)
- [ ] Editing the Variable's value in the panel updates the step field's display
- [ ] DVDCompare reverse-lookup cascade (slug → numeric id + companion name) still works; the companion name stays in step.params, not on the variable
- [ ] tmdbId cascade clears the linked Variable (not just step.params) when the user changes the dvdCompareId
- [ ] YAML round-trip preserves each Variable + its type
- [ ] Worker 35's regression tests all still pass
- [ ] Standard gate clean
- [ ] PR opened
- [ ] Manifest row → `done`

---

## Out of scope

- Adding NEW ID types beyond the three named above. Once the pattern is generalized via §2, registering a fourth (e.g. `imdbId`) is a copy-paste in a future worker.
- Server-side validation of ID format / actual lookup-API resolution — this worker only standardizes the client-side data model.
- Linking-across-steps UX in the link-picker — that's worker 36/37's territory; this worker only guarantees the auto-created Variable EXISTS and the field reads/writes through it.
- "Resolve via search" buttons inside the new input renderers (mirrors worker 35's deferral).
- Migrating existing in-template raw `tmdbId` / `anidbId` / `malId` field values (literal `step.params`) into Variables on YAML load. Users manually consolidate via the Edit Variables modal, same policy as worker 35.

---

## Design notes (for the implementer)

**Why one worker instead of three?** The §2 generalization is the load-bearing change — once it lands, adding each new type is a ~15-line registration. Splitting would create three workers that all wait on §2 to land first, then duplicate the §3 review. One worker per "atomic UX feature" matches the repo convention.

**Why a separate `effectiveFieldValue` helper instead of inlining the link check?** The same read/write split applies to PathField and any future linkable field. Generalizing now means PathField can adopt it later for free, and the test surface stays in one place. (Don't migrate PathField in THIS worker — it's working; just leave the helper general enough to absorb it later.)

**Why pre-link in `changeCommandAtom` instead of on-first-edit?** Two reasons: (1) worker 35 established this pattern and breaking from it for the new types would be inconsistent UX; (2) it makes the Variable visible in the panel immediately, which is the friction the user reported during worker 35.
