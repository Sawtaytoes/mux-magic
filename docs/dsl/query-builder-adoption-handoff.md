# HANDOFF — adopt `@charcuterie/ui` `QueryBuilder` for the DSL rules builder

**Date:** 2026-08-11
**Status:** Ready to start — **blocked only on a Charcuterie release** (see
[Prerequisite](#prerequisite)).
**Owner action:** decide the combinator-mapping question in
[Open decisions](#open-decisions) before a worker starts.

## TL;DR

Charcuterie now ships a **generic, arbitrarily-nestable group editor** —
`QueryBuilder` (`@charcuterie/ui`) backed by a headless `createTree` state core
(`@charcuterie/logic`). It was built to be shared by two fleet apps: Mail
Sifter's nested mail rules **and mux-magic's subtitle-DSL rules**. The leaf
value **and** the group combinator are fully opaque/generic, so mux-magic keeps
its own leaf UIs and its own clause vocabulary while dropping the hand-rolled
tree plumbing.

This doc is the map for replacing the homegrown
[`DslRulesBuilder`](../../packages/web/src/components/DslRulesBuilder/) with it.
It does **not** change any runtime DSL semantics — `packages/core` (`applyAssRules.ts`,
`assTypes.ts`) is untouched; only the web editor changes.

Charcuterie side: **PR [#84](https://github.com/Sawtaytoes/charcuterie/pull/84)**
(`feat(ui,logic): QueryBuilder + createTree`).

## Prerequisite

`QueryBuilder`/`createTree` land in Charcuterie's next release. mux-magic
currently depends on `@charcuterie/ui@^2.11.0` and `@charcuterie/logic`
(`packages/web/package.json`). **Do not start integration until:**

1. Charcuterie PR #84 is merged to `master`, and
2. a new `@charcuterie/ui` **and** `@charcuterie/logic` version is published, then
3. mux-magic bumps both deps to that version.

Until then the import doesn't exist in the registry package.

## The shipped API (accurate to #84)

### `createTree` / `useTree` (`@charcuterie/logic`)

Normalized, stable-id tree. Root is always a group.

```ts
type TreeLeafNode<Leaf>        = { id: string; kind: "leaf";  value: Leaf }
type TreeGroupNode<Combinator> = { id: string; kind: "group"; combinator: Combinator; childIds: readonly string[] }
type TreeState<Combinator, Leaf> = { rootId: string; nodesById: ReadonlyMap<string, TreeNode<Combinator, Leaf>> }

// Nested plain-JSON form for persistence (round-trips YAML / step.params):
type SerializedGroup<C, L> = { kind: "group"; combinator: C; children: readonly SerializedNode<C, L>[] }
type SerializedLeaf<L>     = { kind: "leaf"; value: L }
type SerializedTree<C, L>  = SerializedGroup<C, L>
```

`useTree<C, L>({ defaultCombinator, initialTree?, createId?, onChange?, ...storeOptions })`
returns a value that is **both** the `Tree` instance a `QueryBuilder` subscribes
to **and** a live reactive snapshot:

```ts
const rules = useTree<Combinator, Leaf>({
  defaultCombinator: "allStyle",
  initialTree: paramsToSerializedTree(step.params),   // your adapter
  onChange: (state) => setParam(step.id, "rules", serializedTreeToParams(state)),
})
// rules.state            → reactive TreeState
// rules.addLeaf / addGroup / removeNode / moveNode / patchLeaf / setCombinator
// rules.serialize()      → SerializedTree
```

Selectors: `selectRootGroup`, `selectNode`, `selectChildNodes`.

### `QueryBuilder` (`@charcuterie/ui`)

```ts
<QueryBuilder
  tree={rules}                                    // the useTree return value
  combinatorOptions={[                            // one "Match …" select per group
    { value: "allStyle", label: "ALL styles" },
    { value: "anyStyle", label: "ANY style" },
    { value: "noneStyle", label: "NO style" },
  ]}
  createLeafValue={() => ({ mode: "kv", key: "", value: "" })}   // default new leaf
  renderLeaf={({ nodeId, value, onChange }) => <YourLeafEditor .../>}
  labels={{ addLeaf: "Add condition", addGroup: "Add clause" }}
/>
```

`QueryBuilder` owns the group **structure** (cards, the Match/combinator select,
"Add condition"/"Add group", delete buttons, depth rail). mux-magic owns each
**leaf** via `renderLeaf` — the tree treats `Leaf` as opaque.

## What it replaces in mux-magic

The whole `packages/web/src/components/DslRulesBuilder/` tree:

| Current file | Fate under QueryBuilder |
| --- | --- |
| `DslRulesBuilder.tsx` (WeakMap UUID keys, `openDetailsKeys`) | Replaced by `useTree` + `<QueryBuilder>`; id-keying and add/remove/move plumbing deleted |
| `RuleCard.tsx`, `WhenBuilder.tsx`, `WhenClauseRow.tsx` | Replaced by QueryBuilder's group rendering |
| `ApplyIfBuilder.tsx`, `ApplyIfClauseRow.tsx` | Replaced by QueryBuilder's group rendering |
| `WhenSlotEditor.tsx`, `WhenEntryRow.tsx`, `ApplyIfEntryRow.tsx` | Become the **`renderLeaf`** body (kept — this is mux-magic-owned leaf UI) |
| `ruleMutations.ts`, `conditionMutations.ts`, `styleMutations.ts`, `computeMutations.ts` | Deleted — `createTree` owns immutable add/remove/move/patch |
| `types.ts` (`WhenMap`, `ApplyIfMap`, `DslRule`, `WHEN_CLAUSE_NAMES`, `COMPARATOR_VERBS`) | Kept as the **leaf/combinator value types** you feed into the generic params |

Wiring stays via `SubtitleRulesField` /
`FieldDispatcher` (`"subtitleRules"` field type) — only its internals change.

## Concept mapping

| mux-magic DSL | QueryBuilder |
| --- | --- |
| A rule's predicate block (`when` / `applyIf`) | the root **group** of a `useTree` |
| Clause bucket (`anyStyle`, `allScriptInfo`, `noneStyle`, `notAllScriptInfo`, …) | a group's **`combinator`** value (opaque `Combinator`) |
| `matches` / `excludes` inside a clause | either nested groups, or part of the leaf value — see below |
| A `key = value` entry (`when`) | a **leaf** whose `value` is `{ mode:"kv", key, value }` |
| A `field op number` entry (`applyIf`) | a **leaf** whose `value` is `{ mode:"cmp", field, op, value }` |
| A `$ref: predicateName` slot | a **leaf** whose `value` is `{ mode:"ref", ref }` |
| `step.params.predicates` (named predicate library) | **stays app-side**, unchanged — not part of the tree |

## Impedance mismatches (call these out to the worker)

These are real differences my research surfaced; none block adoption, but each
needs a deliberate choice.

1. **Fixed clause vocabulary vs free recursion.** Today mux-magic's clauses are a
   closed set (`WHEN_CLAUSE_NAMES`), each usable at most once per rule, at fixed
   depth (rule → clause → slot → entry). `QueryBuilder` allows *arbitrary* nesting
   of *any* combinator. Two ways to reconcile — this is the
   [main open decision](#open-decisions):
   - **(a) Clause-as-combinator:** map the 7 clause names to `Combinator`, keep
     depth shallow by convention (don't offer "Add group" beyond one level, or
     hide it). Preserves the exact current model; the serialized tree maps 1:1 to
     `WhenMap`.
   - **(b) Flatten to `all`/`any`/`none` + `matches`/`excludes` leaves:** treat the
     scriptInfo-vs-style axis as a leaf field instead of a clause name, and use
     three generic combinators. More expressive, but the serialized tree no longer
     maps 1:1 to today's `WhenMap` — needs a translation layer to/from
     `assTypes.ts` and a compatibility pass on existing saved sequences.
   Recommendation: **(a)** first — it's a like-for-like swap that deletes the
   plumbing without touching `packages/core` or saved-sequence compatibility.
   Revisit (b) only if you actually want deeper nesting.

2. **Non-uniform leaves.** `when` entries are `key=value` (two strings, no
   operator); `applyIf` entries are `field/op/number`; `$ref` is a third mode.
   Model `Leaf` as a **discriminated union** (`{mode:"kv"|"cmp"|"ref", …}`) and
   `switch` on `value.mode` inside `renderLeaf`. The existing `WhenEntryRow` /
   `ApplyIfEntryRow` / `WhenSlotEditor` become the render bodies for each mode.
   Field names stay free-text (ASS property names) — do **not** assume a closed
   field enum.

3. **Persistence + Jotai.** mux-magic stores rules as plain data on
   `step.params.rules` that round-trips to YAML/URL (`buildParams.ts`), and global
   state is **Jotai**. Two integration styles:
   - **Mirror (simplest):** use the React `useTree`, and in `onChange` write
     `serialize()` (adapted to your params shape) via `useBuilderActions().setParam`.
     Jotai stays the source of truth for the step; the tree is editor-local. **Start
     here.**
   - **Jotai-native:** back `createTree` with `@charcuterie/logic`'s
     `createStoreFromJotai(jotaiStore)` (the store adapter is per-instance, works
     with any core) if you want the tree itself to live in an atom. More plumbing;
     only worth it if editor state must be shared across components.
   Either way, write two adapters: `paramsToSerializedTree(params)` and
   `serializedTreeToParams(state)`, and **delete** the `WeakMap<DslRule,string>`
   UUID keying — `createTree` mints stable ids.

4. **`matches`/`excludes` sub-buckets.** A clause today has two slots
   (`matches`, `excludes`). Either (i) make them two child **groups** under the
   clause group (combinators `matches`/`excludes`), or (ii) carry the slot on the
   leaf value (`{…, slot:"matches"|"excludes"}`). (ii) keeps the tree shallow and
   maps more directly to `WhenSlot`; recommended with mapping-option (a).

## Recommended incremental path

1. **`applyIf` first.** It's the clean `field/op/number` leaf (uniform, closed
   operator set `COMPARATOR_VERBS`) and has no `matches`/`excludes` split — the
   lowest-risk first adopter. Prove the `useTree` + `QueryBuilder` + params-adapter
   loop there.
2. **Then `when`**, adding the `kv`/`ref` leaf modes and the `matches`/`excludes`
   handling from decision (4).
3. Delete the `*Mutations.ts` helpers and the bespoke row/clause components once
   both are migrated.

## Gates (mux-magic house set — all must pass before the PR)

Per [`docs/2026-07-31-m6b-charcuterie-ui.md`](../2026-07-31-m6b-charcuterie-ui.md):
`yarn lint:biome` + `yarn lint:eslint`, `yarn typecheck`, `yarn vitest run`,
`yarn e2e`, `yarn workspace @mux-magic/web build:storybook`, and
`test:build-budget` (watch the bundle budget — QueryBuilder replaces more code
than it adds, so this should *help*). PRs base on **`master`**
([the revamp-branch rule was superseded 2026-08-03](../decisions/2026-08-03-master-is-the-only-base-branch.md));
`master` merges are CI-gated by a ruleset.

## Open decisions

- **Combinator mapping (a) vs (b)** from mismatch #1 — the one real fork. Default
  recommendation: **(a) clause-as-combinator**, like-for-like, no `packages/core`
  or saved-sequence changes.
- Whether to keep `matches`/`excludes` as leaf-carried slots (recommended) or as
  nested groups.
- Mirror vs Jotai-native tree (recommended: **mirror** to start).

## Cross-references

- Charcuterie component + core: PR
  [Sawtaytoes/charcuterie#84](https://github.com/Sawtaytoes/charcuterie/pull/84);
  source under `packages/ui/src/QueryBuilder/` and
  `packages/logic/src/core/createTree.ts`.
- Current DSL editor: [`docs/dsl/subtitle-rules.md`](./subtitle-rules.md),
  [`packages/web/src/components/DslRulesBuilder/`](../../packages/web/src/components/DslRulesBuilder/).
- Runtime semantics (unchanged): `packages/core/src/tools/applyAssRules.ts`,
  `assTypes.ts`.
