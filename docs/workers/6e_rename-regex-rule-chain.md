# Worker 6e — rename-regex-rule-chain

**Model:** Sonnet · **Thinking:** ON · **Effort:** Medium
**Branch:** `feat/mux-magic-revamp/6e-rename-regex-rule-chain`
**Worktree:** `.claude/worktrees/6e_rename-regex-rule-chain/`
**Phase:** 4
**Depends on:** 66 (`renameFiles` standalone + `applyRenameRegex` extracted to `@mux-magic/tools` — done)
**Soft-depends on:** 65 (regex flags + sample tester — done; rule rows reuse the same per-rule UI)
**Parallel with:** any worker that doesn't touch [packages/tools/src/applyRenameRegex.ts](../../packages/tools/src/applyRenameRegex.ts), [packages/api/src/api/schemas.ts](../../packages/api/src/api/schemas.ts), or [packages/web/src/components/RenameRegexField/](../../packages/web/src/components/RenameRegexField/).

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Yarn only. See [AGENTS.md](../../AGENTS.md).

## Context

`renameRegex` today is a **single** `{ pattern, replacement, flags?, sample? }` rule applied to each filename via `String.replace` ([applyRenameRegex.ts:13-22](../../packages/tools/src/applyRenameRegex.ts#L13-L22)). That's exactly one substitution per file. Real-world rename pipelines almost always want a chain — the canonical motivating example, lifted straight from `gallery-downloader`'s `adjustDownloadedFileName`:

```js
name
  .replace(/^Dandadan/, "Dan Da Dan")
  .replace(/(Centuria) (\d+)/i, "$1 c$2")
  .replace(/\.([^.]+)$/, "")   // strip ext for downstream processing
```

Today, expressing that requires three back-to-back `renameFiles` steps in the sequence, which clutters the builder, costs three full directory listings, and triples the chance of one rule's regex breaking against the previous rule's output without you noticing. The user's framing: *"each `copyFiles` allows a single regex"* — that single-rule cap is the constraint to remove.

This worker extends `renameRegex` to accept either a single rule (current shape) **or** an ordered array of rules. `copyFiles`, `moveFiles`, and `renameFiles` all inherit it for free because worker 66 already centralized the helper.

## Your Mission

### 1. Helper extension — `applyRenameRegex`

Extend [packages/tools/src/applyRenameRegex.ts](../../packages/tools/src/applyRenameRegex.ts) to accept a chain. Single-rule callers stay valid unchanged:

```ts
export type RenameRegexRule = {
  pattern: string
  replacement: string
  flags?: string
  sample?: string  // UI hint, runtime ignores
}

export type RenameRegex = RenameRegexRule | RenameRegexRule[]

export const applyRenameRegex = (
  name: string,
  renameRegex: RenameRegex | undefined,
): string => {
  if (!renameRegex) return name
  const rules = Array.isArray(renameRegex)
    ? renameRegex
    : [renameRegex]
  return rules.reduce(
    (current, rule) =>
      current.replace(
        new RegExp(rule.pattern, rule.flags),
        rule.replacement,
      ),
    name,
  )
}
```

Use `.reduce` (NOT array mutation, NOT `.push`). The empty-array case (`rules.length === 0`) naturally falls through to return `name` unchanged.

Pre-compile rules **once per command run**, not once per file: extend `copyFiles`/`moveFiles`/`renameFiles` to compile every rule's `RegExp` at handler start (same pattern as the single-rule compile that exists today) and pass the compiled list into the rename loop. This keeps the surface error-checking front-loaded (an invalid pattern fails the run synchronously, not on file 723).

### 2. Schema extension — `renameRegexSchema`

In [packages/api/src/api/schemas.ts](../../packages/api/src/api/schemas.ts) (around line 107), broaden `renameRegexSchema` to a union:

```ts
const renameRegexRuleSchema = regexFilterValueSchema.extend({
  replacement: z.string().describe(...),
})

export const renameRegexSchema = z.union([
  renameRegexRuleSchema,
  z.array(renameRegexRuleSchema).min(1),
])
```

Rationale for `.min(1)` on the array: an empty rules array is meaningless (the field would still be present but apply nothing); requiring at least one rule keeps the YAML self-documenting. **Bare-string back-compat** — every existing template authored against worker 65's schema continues to validate because the single-rule object form is still the first union member.

OpenAPI doc generation: confirm the generated schema renders sensibly for both forms (the existing `regexFilterFieldSchema` already uses a `union + transform` for bare-string back-compat, so this is a known-supported pattern in the project).

### 3. UI — `RenameRegexField`

Extend [packages/web/src/components/RenameRegexField/RenameRegexField.tsx](../../packages/web/src/components/RenameRegexField/RenameRegexField.tsx) to render an ordered list of rule rows. Each row is the same input block worker 65 already ships (`pattern`, `replacement`, `flags`, optional `sample` for the live-tester preview) — extracted into a per-row sub-component so the chain UI doesn't duplicate the single-row UI.

Row controls:

- Drag handle on the left for reorder (use the existing dnd-kit setup that the step list already uses; if it's heavyweight to thread in here, fall back to ↑ / ↓ buttons in MVP).
- ❌ delete on the right.
- **Add rule** button below the list.

Value-shape rule:

- Field starts as a single rule (current behavior — no UI churn for existing sequences).
- Clicking **Add rule** converts the field's value to the array form on the next change. The first rule's data is preserved; the second rule starts empty.
- If the user deletes down to one rule, **keep** the array form — switching back to the single-object form on the fly would surprise the user and complicate the value-shape state machine. The wire format is fine with either; one-element arrays serialize cleanly.

Live preview (worker 65's `RegexLivePreview`):

- Per-rule preview rows continue to work unchanged for the single-rule case.
- For chains, also render a **final output** row at the bottom showing the result of applying every rule to the `sample` of the first rule (or to an opt-in chain-level sample field — start without, add if users ask). The chain preview makes "rule 3 was the one that broke" debuggable.

### 4. Per-handler integration

`copyFiles`, `moveFiles`, `renameFiles` all import `applyRenameRegex` from `@mux-magic/tools` already (worker 66's centralization). Audit each handler's pre-flight pattern compile (today it's `new RegExp(renameRegex.pattern, renameRegex.flags)` once at start) and replace with an array compile pass that errors fast on the first invalid rule, reporting which rule index broke. Same shape worker 65 used for the single-rule case.

`renameFiles` has a **collision-detection pass** (worker 66) that compares every source→target pair for case-insensitive duplicates. That pass already runs `applyRenameRegex` per file, so it naturally inherits chained-rule semantics with no change.

### 5. YAML codec

Read/write should already work — the YAML serializer doesn't care whether `renameRegex` is an object or array. Verify with a round-trip test (object form round-trips; array form round-trips; bare-string `fileFilterRegex` companion still loads). Add the test to [yamlCodec.test.ts](../../packages/web/src/jobs/yamlCodec.test.ts).

### 6. Out of scope (explicit)

- **Conditional rules** (e.g. "only run rule 2 if rule 1 matched"). Stays linear apply-all-rules. The motivating case is regex-chain word substitution; conditional matching is the user's choice of pattern, not a separate composition feature.
- **Cross-rule capture-group references** (e.g. rule 2 references `$<title>` captured by rule 1). Each rule runs in isolation against the previous rule's output — same as raw `String.prototype.replace` chaining in JS. No new mechanism.
- **Bare-string array** (`["a", "b"]`) as a shorthand. Stays object-rules-only; the single-string form was always object-pattern-plus-empty-replacement which is a footgun to encode without a flag.
- **Per-rule `sample`** vs. one chain-level sample. Start with the existing per-rule sample (each row has its own); a future polish worker can add the chain-level sample if the per-rule view confuses users for the chained case.
- **Migrating other regex fields** (`fileFilterRegex`, `folderFilterRegex`) to chains. Different semantics — filters are pass/fail predicates, not transformations. Skip.

## TDD steps

1. **Helper unit — single rule (regression)**: existing single-rule callers still produce identical output. Snapshot or value-equality against the pre-worker test fixtures.
2. **Helper unit — chain order**: `[ {Dandadan → Dan Da Dan}, {Dan Da Dan → DDD} ]` applied to `"Dandadan Vol 1"` produces `"DDD Vol 1"` — proves rules run left-to-right, not parallel.
3. **Helper unit — flags propagate per-rule**: rule 1 with `flags: "i"` and rule 2 without flags both apply with their own flags; case-insensitive match in rule 1 doesn't bleed into rule 2.
4. **Helper unit — empty / one-element array**: `[]` → no change; `[singleRule]` → identical output to the object form.
5. **Schema validation**: object form valid; non-empty array valid; empty array rejected; mixed-array (object + nested array) rejected.
6. **Compile-fast unit**: `copyFiles` handler invoked with an array containing one invalid rule → the run errors at start naming the rule index; no files processed.
7. **YAML codec round-trip**: array form round-trips byte-stable (within YAML formatting tolerances).
8. **`RenameRegexField` component test**: add-rule button creates a second row; reorder swaps rules; delete removes a row; final-output preview reflects the chain output.
9. **`RenameRegexField` story coverage**: stories for "single rule (existing)", "chain of 3 rules", "chain with one invalid rule shows error inline".
10. **E2E (Playwright)**: drive the builder UI to construct a `renameFiles` step with a 3-rule chain, run against a 5-file seeded dir, verify the renames match the expected chain output.

## Files

### Modify

- [packages/tools/src/applyRenameRegex.ts](../../packages/tools/src/applyRenameRegex.ts) — union type + reduce-based chain apply.
- [packages/tools/src/applyRenameRegex.test.ts](../../packages/tools/src/applyRenameRegex.test.ts) — TDD steps 1–4.
- [packages/api/src/api/schemas.ts](../../packages/api/src/api/schemas.ts) — `renameRegexSchema` becomes a union; document the new shape in the leading comment.
- [packages/core/src/app-commands/copyFiles.ts](../../packages/core/src/app-commands/copyFiles.ts) — pre-flight compile pass over the rule array.
- [packages/core/src/app-commands/moveFiles.ts](../../packages/core/src/app-commands/moveFiles.ts) — same.
- [packages/core/src/app-commands/renameFiles.ts](../../packages/core/src/app-commands/renameFiles.ts) — same; verify collision detection still works.
- [packages/web/src/components/RenameRegexField/RenameRegexField.tsx](../../packages/web/src/components/RenameRegexField/RenameRegexField.tsx) — chain UI.
- [packages/web/src/components/RenameRegexField/RenameRegexField.stories.tsx](../../packages/web/src/components/RenameRegexField/RenameRegexField.stories.tsx) — story matrix.
- [packages/web/src/components/RenameRegexField/RenameRegexField.test.tsx](../../packages/web/src/components/RenameRegexField/RenameRegexField.test.tsx) — add-rule, reorder, delete, chained preview.
- [packages/web/src/components/RenameRegexField/RenameRegexField.mdx](../../packages/web/src/components/RenameRegexField/RenameRegexField.mdx) — document the chain.
- [packages/web/src/jobs/yamlCodec.test.ts](../../packages/web/src/jobs/yamlCodec.test.ts) — round-trip the array form.

### Reuse — do not reinvent

- Per-rule input block — same `pattern + replacement + flags + sample` row worker 65 ships; extract into a sub-component instead of cloning.
- `RegexLivePreview` (worker 65) — runs per-rule unchanged; chain-level final-output row is a thin composition.
- `applyRenameRegex` is **already** the only canonical helper (worker 66) — every handler picks up the chain support by importing the updated version. Don't fork a per-handler chain helper.

## Verification checklist

- [ ] Worktree created
- [ ] Manifest row → `in-progress`
- [ ] Failing tests committed first (helper chain, schema union, RenameRegexField add-rule)
- [ ] `applyRenameRegex` accepts both shapes; existing callers unmodified
- [ ] `renameRegexSchema` union validates both shapes; empty array rejected
- [ ] `copyFiles` / `moveFiles` / `renameFiles` compile rules pre-flight; rule-index error surfaces
- [ ] Collision detection in `renameFiles` still correct after chain rules apply
- [ ] `RenameRegexField` adds, reorders, deletes; chain final-output preview correct
- [ ] YAML round-trips array form
- [ ] E2E green
- [ ] Standard pre-merge gate clean: `yarn lint → typecheck → test → e2e → lint`
- [ ] PR opened against `feat/mux-magic-revamp`
- [ ] [End-of-PR "plain English what now happens" trace](../agents/workflows.md) using the Dandadan + Centuria + ext-strip chain
- [ ] Manifest row → `done`

## Notes for the runner

- The user prefers **no comments unless WHY is non-obvious** (see [docs/agents/code-rules.md](../agents/code-rules.md)).
- **No `.push`/array mutation** — use `.reduce`, `.concat`, immutable updates in the React component for rule add/remove/reorder.
- Booleans get `is` / `has` prefix.
- `.toBeVisible()` over `.toBeInTheDocument()` in component tests.
- Final-output preview is the part that converts a "regex chain that subtly breaks at rule 4" debugging session into a "I can see rule 4 broke" reading session — please don't skip it.
