# Worker 35 — dvd-compare-id-variable

**Model:** Sonnet · **Thinking:** ON · **Effort:** Medium
**Branch:** `feat/mux-magic-revamp/35-dvd-compare-id-variable`
**Worktree:** `.claude/worktrees/35_dvd-compare-id-variable/`
**Phase:** 3 (Name Special Features overhaul)
**Depends on:** 22 (rename), 36 (Variables foundation)
**Parallel with:** 23, 24, 25, 26, 27, 34 (different files; this is a small targeted addition)

---

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Tests must cover the change scope. Yarn only. See [AGENTS.md](../../AGENTS.md). Background context lives in [docs/PLAN.md §5.A](./PLAN.md).

---

## Your Mission

Register `dvdCompareId` as a **Variable type** in the new typed Variables system (worker 36).

### Why a Variable, not just a step field

A user often runs **multiple steps** in a sequence against the same DVD Compare release. For example:

1. Step 1: `nameMovieCutsDvdCompareTmdb` (worker 23) — rename + nest movie cuts
2. Step 2: `nameSpecialFeaturesDvdCompareTmdb` — rename special features in the same folder

Both steps need the **same** DVD Compare ID/URL. Today, the user would have to type or paste it twice. By registering `dvdCompareId` as a Variable type:

- The user creates a single Variable: `{ type: "dvdCompareId", label: "Spider-Man 2002", value: "spider-man-2002" }`.
- Both step's `dvdCompareId` fields link to that variable via `step.links.dvdCompareId = <variableId>`.
- Editing the variable's value in the Edit Variables modal (worker 37) updates both steps.

This is the **generic pattern** for future ID-style variables (TMDB ID, AniDB ID, MAL ID, etc.) — register a new type, ship.

### Cardinality

`dvdCompareId` is **multi-instance, named** — same shape as path variables. A sequence might have multiple DVD Compare IDs (one for a director's-cut release, another for a theatrical release). Both can exist concurrently; the user names them.

### Implementation

Per worker 36's [registerVariableType API](../../packages/web/src/components/VariableCard/registry.ts) (post-worker-36 location):

```ts
// packages/web/src/state/variableTypes/dvdCompareId.ts
import { registerVariableType } from "@/components/VariableCard/registry"

registerVariableType({
  type: "dvdCompareId",
  label: "DVD Compare ID",
  cardinality: "multi",
  defaultValue: () => "",
  validate: (value) => {
    if (!value.trim()) {
      return { isValid: false, message: "Required" }
    }
    // soft validation: warn if it doesn't look like a DVDCompare slug
    if (!/^[a-z0-9-]+$/i.test(value.trim()) && !value.includes("dvdcompare.net")) {
      return { isValid: false, message: "Looks like neither a DVD Compare slug nor URL" }
    }
    return { isValid: true }
  },
  renderValueInput: (variable, onChange) => (
    <DvdCompareIdInput value={variable.value} onChange={onChange} />
  ),
  isLinkable: true,
})
```

The `renderValueInput` component:

- Accepts both raw IDs (`spider-man-2002`) and full URLs (`https://dvdcompare.net/comparisons/film.php?fid=...`).
- Could include a "Resolve via search" button that opens a small dialog hitting `/api/dvd-compare/search?q=...` (out of scope for this worker; can be a follow-up).

Register the type by importing the module from a central type-registry bootstrap location (per worker 36's pattern; the foundation worker establishes this).

### Step field integration

Workers 22's renamed command, 23, and 34 all have `dvdCompareId` as a Zod field. Per worker 36's field-builder pattern, fields named `dvdCompareId` (or with explicit `type: "dvdCompareId"` override) should:

- Render the link-picker for Variables of type `dvdCompareId`.
- Resolve at run time via `step.links.dvdCompareId` → variable lookup → variable's `.value`.

The worker 36 link resolver's dispatch on `variable.type` already handles this; this worker just registers the type and adds the input renderer.

### YAML codec

Worker 36's YAML codec writes `variables:` blocks with a `type:` field per variable. This worker's variable type round-trips through that codec naturally (no codec changes needed). Add a test fixture that round-trips a YAML template containing a `dvdCompareId` variable.

---

## Tests (per test-coverage discipline)

- **Unit:** `registerVariableType({ type: "dvdCompareId", ... })` registers and is retrievable via `getVariableTypeDefinition("dvdCompareId")`.
- **Unit:** `validate` rejects empty values and warns on non-slug, non-URL strings.
- **Unit:** YAML codec round-trips a `dvdCompareId` variable.
- **Component:** `DvdCompareIdInput` renders and emits on change.
- **e2e:** create a Variable of type `dvdCompareId`; link two steps' `dvdCompareId` fields to it; both resolve to the same value at run time.

---

## TDD steps

1. Failing tests above.
2. Create the type-definition module + register.
3. Build the `DvdCompareIdInput` component.
4. Wire registration into the bootstrap import location (per worker 36).
5. Verify the Edit Variables modal (post-worker-37) recognizes the new type and renders its input.
6. e2e: link two steps to one variable; both resolve correctly.
7. Full gate.

---

## Files

**Create:**
- `packages/web/src/state/variableTypes/dvdCompareId.ts` (registration)
- `packages/web/src/components/DvdCompareIdInput/DvdCompareIdInput.tsx`
- Tests for both

**Modify:**
- Wherever worker 36 set up the type-registry bootstrap (import the new registration there)
- [packages/web/src/components/VariableCard/registry.ts](../../packages/web/src/components/VariableCard/registry.ts) — no edits, just consumed

---

## Verification checklist

- [ ] Workers 22 ✅ and 36 ✅ merged before starting
- [ ] Worktree created
- [ ] Manifest row → `in-progress`
- [ ] Failing tests committed first
- [ ] `dvdCompareId` type registered + retrievable
- [ ] Edit Variables modal recognizes the type
- [ ] Steps with `dvdCompareId` field show the Variable link-picker
- [ ] Two steps linked to the same variable resolve identically
- [ ] YAML round-trip preserves the variable + its type
- [ ] Standard gate clean
- [ ] PR opened
- [ ] Manifest row → `done`

## Out of scope

- A "Resolve via search" button hitting the DVD Compare API (separate worker or just inline within the input later).
- Per-release auto-fill of canonical title/year from DVD Compare (separate concern; could integrate with TMDB later).
- Migrating any existing in-template raw `dvdCompareId` field values into Variables (users do this manually via the Edit Variables modal post-worker-37).
- Registering other ID types (TMDB, AniDB, MAL) — separate workers as needed.
