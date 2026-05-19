# Worker 6d — foreach-template-group-kind

**Model:** Sonnet · **Thinking:** ON · **Effort:** High
**Branch:** `feat/mux-magic-revamp/6d-foreach-template-group-kind`
**Worktree:** `.claude/worktrees/6d_foreach-template-group-kind/`
**Phase:** 5
**Depends on:** 36 (Variables foundation — done), 42 (`forEachFolder` — establishes the group-kind discriminator + `InsertDivider` dropdown; should land first so the type union and the dropdown don't have to merge)
**Soft-depends on:** 6e (chained `renameRegex` — composes with substring interpolation; 6d ships without it)
**Parallel with:** any Phase 5 worker that doesn't touch [packages/api/src/api/sequenceRunner.ts](../../packages/api/src/api/sequenceRunner.ts), [packages/api/src/api/resolveSequenceParams.ts](../../packages/api/src/api/resolveSequenceParams.ts), [packages/api/src/api/schemas.ts](../../packages/api/src/api/schemas.ts), [packages/web/src/types.ts](../../packages/web/src/types.ts), or [packages/web/src/components/InsertDivider/InsertDivider.tsx](../../packages/web/src/components/InsertDivider/InsertDivider.tsx).

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Yarn only. See [AGENTS.md](../../AGENTS.md).

## Context

The user wants to run the same sequence body (e.g. `copyFiles` + `renameFiles`) across a **literal list of items** — typical case: a Home Assistant cron that fans out an anime-series sync over the 8 series currently airing. Today the only way to express this is to author 8 copies of the same step pair, hand-editing the paths each time. Worker 42's `forEachFolder` doesn't help because the iteration domain isn't "subfolders of X" — it's "this hand-curated list of titles, mapped into path templates."

The user's exact framing: *"It's like a string replacement variable that you can insert into each path variable… read a set of files once and pass that through to multiple loops of jobs using string replacement."*

This worker introduces the **list-driven iteration primitive** + the **substring template interpolation** that makes path variables composable into per-iteration string substitutions. Together they cover the anime-list case end-to-end. (The longer-horizon "directory-listing capture" and "directory-join" sources are explicitly **out of scope** — see §6.)

### Why not just extend `forEachFolder`?

`forEachFolder` iterates whatever real subfolders exist under a parent path; the iteration variable (`currentFolder`) is a single resolved string consumed wholesale via `'@currentFolder'`. `forEachTemplate` iterates a **declared list** (objects, not just strings) and binds **named fields** the user references inside arbitrary string params via `${name}` substring interpolation. Different iteration source + different reference mechanism → different group kind.

### Conceptual diff vs. today's resolver

[resolveSequenceParams.ts:1-15](../../packages/api/src/api/resolveSequenceParams.ts#L1-L15) currently resolves two whole-string link forms:

- `'@pathId'` → `paths[pathId].value`
- `{ linkedTo, output }` → prior-step output

Neither does substring substitution. This worker adds a third form: any string value containing `${name}` segments gets each segment replaced from the iteration's scoped binding map. Whole-string `'@iterationVar'` continues to work as a thin special case (because most pathfields are pure path expressions, not templates).

## Your Mission

### 1. New group kind — `forEachTemplate`

Schema lives in:

- Server: [packages/api/src/api/schemas.ts](../../packages/api/src/api/schemas.ts) (alongside existing sequence-step schema)
- Web type: [packages/web/src/types.ts](../../packages/web/src/types.ts) — extend the `Group` discriminator so `kind` accepts `"forEachTemplate"` alongside the `"forEachFolder"` worker 42 added.

A `forEachTemplate` group carries this config:

| Field | Type | Default | Notes |
|---|---|---|---|
| `items` | `Array<Record<string, string>>` OR `string[]` | required | Literal array of iteration objects. Bare strings auto-promote to `{ value: "<the-string>" }`. |
| `as` | `string` | required | Name to bind each item to inside the loop (e.g. `currentTitle`). User-chosen, like a list-comprehension variable. Must be a valid identifier (`[a-zA-Z_][a-zA-Z0-9_]*`); validated on save. |
| `concurrency` | `number` | `1` | Per-iteration concurrency. Defaults to serial. |
| `onItemFailed` | `"halt" \| "continue"` | `"continue"` | If a sub-job fails, halt the whole bulk or move on. Matches user intent of "don't let one broken series kill the cron." |

`items` is **literal-only** in this worker. A future worker can add a `source: "step-output"` discriminator that pulls `items` from a prior step's output (e.g. a directory-listing capture step). The schema should be shaped so that addition is non-breaking — model `items` as one variant of a discriminated union (`{ kind: "literal"; items: [...] }` even if "literal" is the only kind today), so future kinds slot in without a schema break.

### 2. Substring template interpolation in `resolveSequenceParams`

Extend [resolveSequenceParams.ts](../../packages/api/src/api/resolveSequenceParams.ts) to support a third resolution form: any **string-typed** param value (at any nesting depth — `sourcePath`, `destinationPath`, `fileFilterRegex.pattern`, `renameRegex.pattern`, `renameRegex.replacement`, and so on) is scanned for `${name}` segments. Each segment is replaced from a new `scopedBindings: Record<string, string>` arg that the runner passes per iteration.

```ts
// pseudo-shape
const interpolate = (input: string, scopedBindings: Record<string, string>): string =>
  input.replace(/\$\{([a-zA-Z_][a-zA-Z0-9_.]*)\}/gu, (full, key) =>
    key in scopedBindings ? scopedBindings[key] : full,
  )
```

Dotted keys (`${currentTitle.value}`, `${currentItem.folderName}`) let the user reference object fields when `items` contains objects. Resolution is shallow — only one dot supported (`<bindingName>.<objectField>`) so we don't accidentally invite full expression evaluation.

**Unmatched segments** (`${nope}` with no binding) pass through unchanged — same defensive behavior `resolveSequenceParams` uses for unknown `@pathId` references today (it emits an error in the `errors[]` array but doesn't crash the run). Add the missing-binding case to the same `errors[]` collector so the UI surfaces it.

**Order of resolution** matters: substring interpolation runs **before** `'@pathId'` / `{ linkedTo }` resolution, so a user can write `'@${currentTitle}_libraryPath'` to dispatch on iteration. Document the resolution order in the function's leading block comment.

### 3. Sequence-runner extension

Extend [sequenceRunner.ts](../../packages/api/src/api/sequenceRunner.ts) (where the existing group-expansion logic lives) to handle `forEachTemplate`:

1. Read the resolved `items` array (after the runner's own resolution pass — `items` itself can be a `@pathId`-resolved or step-output-linked Variable in the future, though MVP only requires literal).
2. For each entry, build the scoped binding map:
   - Bare-string entry `"Daemons"` → `{ [as]: "Daemons" }`.
   - Object entry `{ title: "Daemons", id: "12345" }` → `{ [as]: <object>, [`${as}.title`]: "Daemons", [`${as}.id`]: "12345" }`. The whole-object form is bound at the bare name so `'@currentTitle'` (if `currentTitle` were a `path`-type binding) keeps working for the simple case; dotted accesses pick fields.
3. Spawn a sub-job per iteration under the bulk parent (same machinery worker 42 uses — sub-jobs are first-class jobs the UI can already render).
4. Resolve each child step's params with the scoped bindings passed through to `resolveSequenceParams`. Outside the loop, the bindings are absent and `${currentTitle}` references pass through unchanged + emit an error.
5. Honor `concurrency` (default `1` → serial) and `onItemFailed` (default `"continue"` → mark sub-job failed, continue the bulk; `"halt"` → bulk job fails, remaining iterations are `skipped`).

Worker 38's per-file pipelining composes naturally — each per-iteration sub-job is its own pipeline — but **is not a hard dependency**.

### 4. UI changes

#### 4a. `InsertDivider` — add the third group kind

Worker 42 collapsed `InsertDivider` to `[Step | Group ▾ | Paste]` and made `Group ▾` a dropdown of group kinds. This worker adds **For each template** to that dropdown (third entry after Sequential and Parallel; *For each folder* sits above it). Single-line addition; no API change to `onInsertGroup(kind)`.

If worker 42 has not merged yet, **stop and ask the user before proceeding** — the InsertDivider collapse is load-bearing for this worker's UI piece. (Soft-depends on 42 is listed at the top.)

#### 4b. New card — `ForEachTemplateCard`

New file: `packages/web/src/components/ForEachTemplateCard/ForEachTemplateCard.tsx`. Composes the existing [GroupCard](../../packages/web/src/components/GroupCard/) (so dnd-kit nesting + drag-drop logic is inherited). Renders:

- An **Items** editor — accept either: a textarea taking newline-separated bare strings (auto-promoted to objects on save), or a JSON-ish key/value table for object items. Start with the textarea; add the table later if users hit it.
- An **As (binding name)** text input with inline validation against the identifier regex; shows a hint *"Reference inside child steps as `${" + value + "}`"* with the current name interpolated live.
- A **Concurrency** number input (1+).
- An **On item failed** select (`continue` | `halt`).

Add the new card to the story matrix + a single `.test.tsx` covering: items round-trip, `as` validation rejects invalid identifiers, hint string reacts to typing.

#### 4c. Variables sidebar — scope the iteration binding

When the user is editing a child step inside a `forEachTemplate` group, the bound name (and its dotted fields, if `items` contains objects) shows up as a read-only entry in [VariablesSidebar.tsx](../../packages/web/src/components/VariablesSidebar/VariablesSidebar.tsx) under a *"In-loop"* heading. Clicking the entry inserts the `${name}` token at the cursor. Mirror worker 42's `currentFolder` rendering — do not build a new sidebar.

#### 4d. Link-picker awareness (optional polish)

If [LinkPicker](../../packages/web/src/components/) is reachable from a step field while it's nested inside a `forEachTemplate`, surface the in-loop binding name as a pick-target with a *"Interpolate"* affordance that inserts `${name}` rather than the `@id` link form. Skip if it's more than ~50 lines of UI; an existing-text-field cursor-insert from the sidebar (§4c) is sufficient for MVP.

### 5. YAML codec — read + write the new group shape

[yamlCodec.ts](../../packages/web/src/jobs/yamlCodec.ts) needs to round-trip the new group kind. The shape on disk:

```yaml
- group:
    kind: forEachTemplate
    as: currentTitle
    concurrency: 1
    onItemFailed: continue
    items:
      kind: literal
      values:
        - "Daemons of the Shadow Realm"
        - "Hell's Paradise"
        - { title: "Centuria", aniDbId: 18642 }
    steps:
      - command: copyFiles
        params:
          sourcePath: "G:\\Downloads\\${currentTitle}"
          destinationPath: "Z:\\Library\\${currentTitle}\\Season 1"
```

The `legacyFieldRenames` pattern (see the [yamlCodec memory](../agents/code-rules.md) — it's the read-time back-compat hook) is the right place if any names shift between this PR's drafts and final landing.

### 6. Out of scope (explicit)

- **`items` sourced from a prior step's output.** The schema's `items: { kind: "literal", values: [...] }` discriminator is shaped so that adding `{ kind: "stepOutput", linkedTo: <stepId>, output: <name> }` later is non-breaking, but the second kind is not implemented here.
- **Directory-listing capture step + directory-join step.** These are the other halves of the original plan (sync-manga-style join). They each warrant their own worker; this one is the iteration + interpolation primitive in isolation.
- **Variable interpolation inside `@pathId` Variable values** (i.e. globally-stored Variable values that themselves contain `${...}`). Stays literal for now — only step params get interpolated. Prevents one-Variable-edit-cascades-N-places surprises.
- **Nesting `forEachTemplate` inside `forEachFolder` (or vice versa).** The runner should handle it as a happy accident if the existing group recursion supports it, but no special-cased test or UI. If it doesn't compose, document the limitation and don't fight the runner to make it work; a follow-up worker can address.
- **Expression evaluation** (`${currentTitle.toUpperCase()}`, `${currentTitle + "_dub"}`). Substring substitution only; one shallow dot for object access. If users hit this, the right answer is a chained-renameRegex step (worker 6e), not an expression language here.

## TDD steps

1. **Schema validation** — `forEachTemplate` group with valid config round-trips; invalid `as` identifier rejected; `concurrency: 0` rejected; missing `items` rejected.
2. **`resolveSequenceParams` interpolation unit** — string with one `${name}` resolves; two segments resolve; unknown name passes through + error emitted; dotted access (`${currentItem.title}`) resolves from object binding; resolution order verified (`${name}` happens before `@pathId`).
3. **YAML codec round-trip** — write a YAML doc with a `forEachTemplate` group, read it back, deep-equal.
4. **Runner expansion (integration)** — seed a tmp dir with three named subfolders (`Daemons`, `Hells-Paradise`, `Centuria`); construct a sequence containing a single `forEachTemplate` group with `items` set to those names, child step is `copyFiles` with `sourcePath: "<seed>/${currentTitle}"`, `destinationPath: "<dest>/${currentTitle}"`. Assert:
   - Three sub-jobs spawned, one per item.
   - Each sub-job's resolved `sourcePath`/`destinationPath` contains the right title.
   - Files copied to the right destination subfolders.
   - When one sub-job fails (point a destination at a read-only path) with `onItemFailed: "continue"`, the other two still complete.
   - With `onItemFailed: "halt"`, remaining sub-jobs end as `skipped`.
5. **Concurrency** — 6 items, `concurrency: 3` → at any moment ≤ 3 sub-jobs in `running`.
6. **`ForEachTemplateCard` story + test** — items round-trip, `as` validation, hint string interpolation.
7. **`InsertDivider` regression** — adding the third group kind to the dropdown doesn't break the existing `onInsertGroup(kind)` dispatch from worker 42.
8. **E2E (Playwright)** — drive the builder UI to construct a `forEachTemplate` group with 2 items and a `copyFiles` child, run against a seeded tmp directory, verify both items execute and produce the expected files.

## Files

### New

- [packages/web/src/components/ForEachTemplateCard/](../../packages/web/src/components/ForEachTemplateCard/) — card + story + test + mdx (triple).

### Extend

- [packages/api/src/api/schemas.ts](../../packages/api/src/api/schemas.ts) — schema for the new group kind + items discriminator.
- [packages/api/src/api/sequenceRunner.ts](../../packages/api/src/api/sequenceRunner.ts) — `forEachTemplate` expansion + scoped-bindings construction + concurrency + onItemFailed.
- [packages/api/src/api/resolveSequenceParams.ts](../../packages/api/src/api/resolveSequenceParams.ts) — third resolution form (substring interpolation); update the leading block comment listing the resolution forms; thread `scopedBindings` arg through.
- [packages/api/src/api/resolveSequenceParams.test.ts](../../packages/api/src/api/resolveSequenceParams.test.ts) — cover the new resolution form.
- [packages/web/src/types.ts](../../packages/web/src/types.ts) — extend `Group.kind` union.
- [packages/web/src/jobs/yamlCodec.ts](../../packages/web/src/jobs/yamlCodec.ts) — read + write the new group shape.
- [packages/web/src/components/InsertDivider/InsertDivider.tsx](../../packages/web/src/components/InsertDivider/InsertDivider.tsx) — add the third dropdown entry.
- [packages/web/src/components/VariablesSidebar/VariablesSidebar.tsx](../../packages/web/src/components/VariablesSidebar/VariablesSidebar.tsx) — render in-loop binding.
- [packages/web/src/pages/BuilderSequenceList/BuilderSequenceList.tsx](../../packages/web/src/pages/BuilderSequenceList/BuilderSequenceList.tsx) — dispatch `forEachTemplate` in `onInsertGroup`.

### Reuse — do not reinvent

- Group dragging / nesting → existing `GroupCard` + dnd-kit (`ForEachTemplateCard` composes it).
- Variable type registry (worker 36) → no new variable type is registered; the iteration binding is purely runtime-scoped, not stored in `variablesAtom`. (Iterating an `@pathId`-stored array of strings is a future capability under the `items.kind: "stepOutput"` discriminator.)
- Sub-job orchestration → whatever worker 42 used for its `forEachFolder` sub-jobs; same code path.

## Verification checklist

- [ ] Worker 42 merged (or user-confirmed to proceed without it — see §4a)
- [ ] Worktree created
- [ ] Manifest row → `in-progress`
- [ ] Failing tests committed first (schema, interpolation, codec, runner integration, concurrency)
- [ ] `resolveSequenceParams` interpolation covered + leading comment updated with all three resolution forms
- [ ] `forEachTemplate` schema accepts the discriminated `items` shape so future `stepOutput` kind is non-breaking
- [ ] Card + sidebar + InsertDivider all updated; stories pass
- [ ] YAML round-trips
- [ ] E2E green
- [ ] Standard pre-merge gate clean: `yarn lint → typecheck → test → e2e → lint`
- [ ] PR opened against `feat/mux-magic-revamp`
- [ ] Manual smoke: build a 3-item `forEachTemplate` with a `copyFiles` body against a real scratch dir; confirm the directory listing is **NOT** re-scanned per iteration (each sub-job scans its own source path once, which is the win we're claiming)
- [ ] [End-of-PR "plain English what now happens" trace](../agents/workflows.md) using the user's anime-list values
- [ ] Manifest row → `done`

## Notes for the runner

- The user prefers **no comments unless WHY is non-obvious** (see [docs/agents/code-rules.md](../agents/code-rules.md)). The leading comment on `resolveSequenceParams` documenting the three resolution forms is an exception — it's a contract description, not a what-comment.
- **No `.push`/array mutation** anywhere — build collections via map/filter/reduce, concat for appends.
- Plain English trace at the end of any behavior-change response (per [docs/agents/workflows.md](../agents/workflows.md)).
- Booleans get `is` / `has` prefix (per the ESLint rule from worker 05).
- Worker 42's prompt references `packages/server/src/api/...` paths from before workers 2d + 29 split server → core + api + server. The current location is `packages/api/src/api/...` — use those paths.
