# Worker 69 — link-picker-type-tagged-outputs

**Model:** Sonnet · **Thinking:** ON · **Effort:** Medium
**Branch:** `feat/mux-magic-revamp/69-link-picker-type-tagged-outputs`
**Worktree:** `.claude/worktrees/69_link-picker-type-tagged-outputs/`
**Phase:** 4
**Depends on:** 01 (done)
**Parallel with:** any worker that doesn't touch [packages/web/src/components/LinkPicker/LinkPicker.tsx](../../packages/web/src/components/LinkPicker/LinkPicker.tsx), [packages/web/src/commands/commands.ts](../../packages/web/src/commands/commands.ts), [packages/web/src/commands/types.ts](../../packages/web/src/commands/types.ts), or the server-side `extractOutputs` declarations in [packages/server/src/api/routes/commandRoutes.ts](../../packages/server/src/api/routes/commandRoutes.ts).

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Yarn only. See [AGENTS.md](../../AGENTS.md).

## Context

Sequence steps connect to each other through the LinkPicker UI: a field on step N picks a source (path variable or a named output of an earlier step) and the runner inlines that source's value at run time. The picker currently treats every output as type-compatible with every field — so `deleteCopiedOriginals.pathsToDelete` (server schema `z.array(z.string())`) is offered the `folder` output of every preceding step (a single path string) and every path variable (a single string). Selecting either of those produces a YAML that fails Zod validation at the API boundary; the user has no way to know that ahead of time from the UI.

A temporary opt-in fix landed during the conversation that surfaced this: `CommandField.acceptedOutputs?: ReadonlyArray<string>` ([packages/web/src/commands/types.ts](../../packages/web/src/commands/types.ts)), used only on `deleteCopiedOriginals.pathsToDelete` to whitelist `["copiedSourcePaths"]`. LinkPicker honors it by filtering step rows by output name and hiding all path variables when the whitelist is set ([LinkPicker.tsx buildItems](../../packages/web/src/components/LinkPicker/LinkPicker.tsx)). That solves the one field whose mismatch was loud, but:

- Every other field that takes an array (`audioLanguages`, `subtitlesLanguages`, `extensions`, `chapterSplits`, `videoTrackIndexes`, the `…Indexes` family, `offsets`) would have the exact same mismatch if a future command publishes an array output — and there's nothing telling them which outputs are compatible.
- Every field that takes a scalar path can still link to any *named* output regardless of type. The hard case `folder` is fine (it's always a path string), but as soon as anything publishes a non-path scalar (e.g. a count, a duration) the picker will offer it to `sourcePath` and break Zod the same way.
- The opt-in mechanism is name-based (whitelist of output *names*), which means every new command that publishes `copiedSourcePaths`-shaped data has to be enumerated by every consumer field that accepts it. That's quadratic and rots.

User's exact ask (in conversation, after the `acceptedOutputs` workaround landed): *"This is a real refactor and worth doing across the codebase; tag every output and field with its value type and filter on compatibility."*

This worker does that refactor.

## Your Mission

Replace the name-based `acceptedOutputs` whitelist with a **value-type system** that both producers (named outputs) and consumers (fields) declare, so LinkPicker can filter purely on type compatibility — no per-field name lists, no manual cross-referencing.

### Value-type taxonomy

The minimum set, derived from a survey of every existing field type in [packages/web/src/commands/commands.ts](../../packages/web/src/commands/commands.ts) and every `extractOutputs` shape in [packages/server/src/api/routes/commandRoutes.ts](../../packages/server/src/api/routes/commandRoutes.ts):

```ts
type FieldValueType =
  | "path"           // a single absolute path string ("@workDir", folder output)
  | "pathArray"      // a list of paths (copiedSourcePaths)
  | "string"         // an opaque scalar string (language code, extension)
  | "stringArray"    // a list of opaque strings (audioLanguages, extensions)
  | "number"         // a numeric scalar
  | "numberArray"    // a list of numbers (offsets, …Indexes)
  | "boolean"        // a flag (rare for outputs; currently no field consumes one)
```

`path` and `pathArray` are intentionally distinct from `string`/`stringArray` because path variables and `folder` outputs are *only* assignable to `path` consumers — wiring `@workDir` into `audioLanguages` is the same kind of type error as wiring `folder` into `pathsToDelete`.

### Schema changes

**1. `CommandField` gains `valueType: FieldValueType`.** Required, not optional — every field declares its consumer type. Migrate every existing field declaration in [commands.ts](../../packages/web/src/commands/commands.ts) to set it (most are mechanical: `type: "path"` → `valueType: "path"`, `type: "stringArray"` → `valueType: "stringArray"`, etc.; double-check the regex/lookup variants).

**2. `CommandDefinition.outputs[].valueType: FieldValueType`.** Same field on the producer side. The synthesized `folder` output is implicit and always `path`. Named outputs declare their type explicitly. Today `copyFiles` and `moveFiles` are the only commands with a non-`folder` output (`copiedSourcePaths`); both get `valueType: "pathArray"`.

**3. Path variables are always `path`.** No declaration needed — the UI treats them as a single typed source.

### LinkPicker filter rule

`buildItems` (already rewritten with `flatMap` last commit, so this is mostly a one-liner per filter):

- A step's `folder` row is offered only when the anchor field's `valueType === "path"`.
- A step's named-output row is offered only when `output.valueType === anchor.valueType`.
- A path variable row is offered only when `anchor.valueType === "path"`.

Delete `acceptedOutputs` entirely — the type filter subsumes it. Update the `deleteCopiedOriginals.pathsToDelete` field to drop the whitelist; `valueType: "pathArray"` alone correctly produces a picker that lists only `copyFiles → copiedSourcePaths` (and any future `pathArray` output).

### Footer-hint and "type a path directly"

Today the picker shows *"Don't see what you need? Close this and type a path directly into the field…"* always. After this refactor it only makes sense when the anchor's `valueType === "path"` (the only case where typing a literal can synthesize a new path variable). Hide it otherwise. The follow-on free-typing in [PathField.tsx](../../packages/web/src/components/PathField/PathField.tsx) (the `addPathVariable` branch) is already path-specific, so no changes there — just the hint.

### Tests

- LinkPicker: rewrite the existing `acceptedOutputs whitelist hides folder rows and path variables` test as `valueType: pathArray field shows only pathArray sources` (same assertion, different mechanism).
- New: `valueType: path field offers folder + path variables but not pathArray named outputs`.
- New: `valueType: stringArray field excludes path variables AND folder` (defensive: makes sure path-typed sources don't bleed into opaque-string consumers).
- buildFields helper: if `valueType` is derived from the Zod schema kind, add a unit test that asserts the derivation for the seven types above; otherwise keep `valueType` as a hand-written override and document the convention.

### Out of scope

- Promoting `valueType` to the server-side schemas (Zod already provides this via `_def.typeName`; the web side doesn't need to roundtrip it). The server-side `extractOutputs` declaration just needs the type on `outputs[]` so the web can read it via the existing `/commands` endpoint.
- Adding new value types beyond the seven listed. `json`/`subtitleRules`/`regexWithFlags` are *not* linkable today and shouldn't become so under this worker.
- The `isLinkable: false` opt-out that already exists on some fields stays as-is — it's a coarser switch (this field can't be linked at all) and is orthogonal to type filtering.

### Migration of the existing `acceptedOutputs` consumer

Exactly one call site: `deleteCopiedOriginals.pathsToDelete` in [commands.ts](../../packages/web/src/commands/commands.ts). Replace `acceptedOutputs: ["copiedSourcePaths"]` with `valueType: "pathArray"` and delete the `acceptedOutputs?: …` line from [types.ts](../../packages/web/src/commands/types.ts). Verify the test that covers this field still passes after the rewrite.

## Worker checkout & commit

1. Flip MANIFEST row 69 → `in-progress` before any code.
2. Worktree `.claude/worktrees/69_link-picker-type-tagged-outputs/`, branch as named above.
3. TDD: write the new LinkPicker tests first (they should fail because filtering still uses `acceptedOutputs`). Then ship the refactor.
4. Standard pre-merge gate.
5. Flip MANIFEST row 69 → `done` after merge — see [feedback_workers_flip_own_done.md] in agent memory.
