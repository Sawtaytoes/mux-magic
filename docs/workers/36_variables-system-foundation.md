# Worker 36 — variables-system-foundation

**Model:** Sonnet · **Thinking:** ON · **Effort:** High
**Branch:** `feat/mux-magic-revamp/36-variables-system-foundation`
**Worktree:** `.claude/worktrees/36_variables-system-foundation/`
**Phase:** 1B foundation sub-chain (serial; blocks 11, 35, 37)
**Depends on:** 01 (rename)
**Parallel with:** Phase 1B web workers that don't depend on Variables (08, 09, 0a, 0b, 0c, 0d, 0e, 0f, 10, 12, 13, 14, 15, 16, 17), Phase 1B other workers (18, 19, 1a), Phase 1B cross-repo workers (1b, 1c, 1d, 1e, 1f)

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Tests must cover the change scope. Yarn only. See [AGENTS.md](../../AGENTS.md). Background context lives in [docs/PLAN.md §5.A](../PLAN.md).

## Your Mission

Generalize today's path-variables into a **typed shared-variables system**. Today, `PathVariable = { id, label, value }` lives in `pathsAtom`. New: `Variable = { id, label, value, type }` with a discriminator that lets the system hold multiple value types (paths, DVD Compare IDs, thread count, future TMDB/AniDB IDs).

This is a **foundational refactor** — workers 11, 35, and 37 all depend on it. **Back-compat is required**: existing YAML templates with `paths:` blocks must still load correctly.

### What stays the same

- The basic shape `{ id, label, value }` — same fields, just gain a `type` field.
- Step linking semantics: `step.links[fieldName] = variableId` (string ID). The YAML `@<id>` reference prefix.
- The delete-with-usage-scan flow (already excellent in `removePathVariableAtom` / `confirmPathVariableDeleteAtom` — preserve it for the generalized version).

### What changes

#### 1. Type & atom rename + extension

**Today:**

```ts
// packages/web/src/types.ts (or similar)
type PathVariable = { id: string; label: string; value: string }

// packages/web/src/state/pathsAtom.ts
const pathsAtom = atom<PathVariable[]>([])
```

**New:**

```ts
// packages/web/src/types.ts
type VariableType = "path"  // workers 11, 35 register more types
type Variable<T extends VariableType = VariableType> = {
  id: string
  label: string
  value: string
  type: T
}

// packages/web/src/state/variablesAtom.ts (new file)
const variablesAtom = atom<Variable[]>([])
```

Provide a **back-compat re-export** so the old `pathsAtom` name still works during the migration:

```ts
// packages/web/src/state/pathsAtom.ts  (kept as thin alias)
import { variablesAtom } from "./variablesAtom"
import { selectAtom } from "jotai/utils"
export const pathsAtom = selectAtom(
  variablesAtom,
  (variables) => variables.filter((variable) => variable.type === "path"),
)
```

This lets existing callers continue to work while the migration is in progress. Audit callers and switch them to `variablesAtom` opportunistically; full removal of the alias is a follow-up.

#### 2. CRUD atoms generalized

Existing write atoms (`addPathAtom`, `addPathVariableAtom`, `setPathValueAtom`, `removePathVariableAtom`, `setPathVariableResolutionAtom`, `confirmPathVariableDeleteAtom` per the exploration of [pathsAtom.ts](../../packages/web/src/state/pathsAtom.ts)) become typed:

```ts
// New variablesAtom.ts
const addVariableAtom = atom(null, (get, set, args: { type: VariableType; label?: string; value?: string }) => {
  // generate id; insert; respecting cardinality rules from the type registration
})
const setVariableValueAtom = atom(null, (get, set, args: { variableId: string; value: string }) => { ... })
const removeVariableAtom = atom(null, (get, set, variableId: string) => { ... })
// ... preserve delete-with-usage-scan flow generalized
```

#### 3. UI: `PathVariableCard` → `VariableCard`

Today: [PathVariableCard.tsx](../../packages/web/src/components/PathVariableCard/PathVariableCard.tsx) renders label + value inputs with a file-picker for paths.

New: `VariableCard` dispatches on `variable.type` to render the right value input:

- `type: "path"` → existing path input + file picker (preserved logic).
- Future types render via a small type-registry: each type registers `renderValueInput(variable, onChange)`.

```ts
// New: packages/web/src/components/VariableCard/registry.ts
type VariableTypeDefinition<T extends VariableType> = {
  type: T
  label: string
  cardinality: "singleton" | "multi"
  defaultValue?: () => Promise<string> | string
  validate?: (value: string, system: SystemContext) => { isValid: boolean; message?: string }
  renderValueInput: (variable: Variable<T>, onChange: (value: string) => void) => JSX.Element
  isLinkable: boolean  // can step fields link to this type?
}

const registry = new Map<VariableType, VariableTypeDefinition<VariableType>>()
export const registerVariableType = (definition: VariableTypeDefinition<VariableType>) => {
  registry.set(definition.type, definition)
}
export const getVariableTypeDefinition = (type: VariableType) => registry.get(type)
```

Workers 11 and 35 use `registerVariableType` to register `threadCount` and `dvdCompareId` respectively. Worker 37 uses `getVariableTypeDefinition` to render the right input in the Edit Variables modal.

This worker registers the `path` type as the migration baseline.

#### 4. YAML codec (back-compat)

YAML write target — new `variables:` block, replacing `paths:`:

```yaml
# OLD format (still readable)
paths:
  pathVariable_abc:
    label: My base path
    value: D:\Anime
steps:
  - command: copyFiles
    links:
      sourceFolder: "@pathVariable_abc"

# NEW format (what we write going forward)
variables:
  pathVariable_abc:
    label: My base path
    value: D:\Anime
    type: path
steps:
  - command: copyFiles
    links:
      sourceFolder: "@pathVariable_abc"
```

The YAML codec ([yamlSerializer.ts](../../packages/web/src/jobs/yamlSerializer.ts) + [loadYaml.ts](../../packages/web/src/jobs/loadYaml.ts), to be merged by worker 19 into `yamlCodec.ts`):

- **Read:** accept both `paths:` (legacy, fill `type: "path"`) and `variables:` (new). If both present, merge with `variables:` winning per-id.
- **Write:** always write `variables:` (with `type` field on each). Stop writing `paths:`.

Coordinate with worker 19 if it's still in flight — your YAML changes touch the same files.

#### 5. Link resolution

[links.ts](../../packages/web/src/commands/links.ts) `getLinkedValue` looks up a path variable by ID and returns its `.value`. Extend to dispatch on type:

```ts
const getLinkedValue = (step, fieldName, variables, ...) => {
  const link = step.links[fieldName]
  if (!link) return undefined
  const variable = variables.find((v) => v.id === link)
  if (!variable) return undefined
  // For now, all current types return .value as a string.
  // Future: if (variable.type === "tmdbId") return formatId(variable.value)
  return variable.value
}
```

A step field can only link to a Variable whose `isLinkable: true`. Worker 36 ensures the field-link picker filters by this flag (today it shows all paths; new behavior: show all linkable variables across types).

### Out-of-scope migration items (left for follow-up)

- **Removing the `pathsAtom` alias entirely.** Keep as a thin compat layer. A future cleanup worker can grep for callers and remove.
- **UI surface for centralized editing.** That's worker 37's job (Edit Variables modal + right-sidebar). Worker 36 keeps the inline `VariableCard` working as-is so the app keeps functioning between 36 landing and 37 landing.

## Tests (per test-coverage discipline)

- **Unit:** Variable type round-trips through YAML codec (read legacy `paths:`; read+write new `variables:`; mixed both → new wins).
- **Unit:** `addVariableAtom` respects cardinality (singleton refuses second-add).
- **Unit:** `removeVariableAtom` scans for usages across step links (same flow as today's path variable).
- **Unit:** `getLinkedValue` resolves typed variables.
- **Unit:** `registerVariableType` / `getVariableTypeDefinition` round-trip.
- **Component:** `VariableCard` renders a path variable identically to today's `PathVariableCard` (visual parity check via existing stories).
- **e2e:** existing path-variable e2e tests still pass after the refactor.

## TDD steps

1. Failing tests above. Commit each.
2. Introduce `Variable` type + `variablesAtom`; keep `pathsAtom` as an alias.
3. Migrate CRUD atoms.
4. Implement type registry.
5. Migrate YAML codec for back-compat read + new write.
6. Migrate `links.ts`.
7. Refactor `PathVariableCard` → `VariableCard` with type-dispatched value input.
8. Register `path` type.
9. Verify all tests pass + visual parity in Storybook.

## Files

- [packages/web/src/types.ts](../../packages/web/src/types.ts) — Variable type + VariableType union
- [packages/web/src/state/pathsAtom.ts](../../packages/web/src/state/pathsAtom.ts) — convert to thin alias
- New: `packages/web/src/state/variablesAtom.ts`
- [packages/web/src/jobs/yamlSerializer.ts](../../packages/web/src/jobs/yamlSerializer.ts) and [loadYaml.ts](../../packages/web/src/jobs/loadYaml.ts) — back-compat read + new write (or `yamlCodec.ts` if worker 19 has landed)
- [packages/web/src/commands/links.ts](../../packages/web/src/commands/links.ts) — type-aware resolution
- [packages/web/src/components/PathVariableCard/](../../packages/web/src/components/PathVariableCard/) — rename to `VariableCard` (consider `git mv` to preserve history); split type-specific value inputs
- New: `packages/web/src/components/VariableCard/registry.ts`
- Stories + tests for all of the above

## Verification checklist

- [ ] Worker 01 ✅ merged before starting
- [ ] Worktree created
- [ ] Manifest row → `in-progress`
- [ ] Failing tests committed first
- [ ] `Variable` type added with discriminator
- [ ] `variablesAtom` is the new source of truth; `pathsAtom` is a thin alias
- [ ] Existing path-variable e2e tests still pass (visual + behavioral parity)
- [ ] YAML reads both legacy `paths:` and new `variables:` blocks
- [ ] YAML writes only the new `variables:` block
- [ ] `registerVariableType` / `getVariableTypeDefinition` exported for workers 11, 35, 37 to consume
- [ ] Type registry includes `path` (registered by this worker)
- [ ] PR description lists which downstream workers (11, 35, 37) can now spawn
- [ ] Standard gate clean
- [ ] PR opened
- [ ] Manifest row → `done`

## Out of scope

- Edit Variables modal + sidebar UI (worker 37)
- Registering `threadCount` (worker 11) or `dvdCompareId` (worker 35) type definitions
- Removing the `pathsAtom` back-compat alias (future cleanup)
- Migrating call sites away from `pathsAtom` aggressively (only update what's adjacent to your refactor)
