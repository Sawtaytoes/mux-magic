# Worker 63 — copy-and-move-files-regex-ui

**Model:** Sonnet · **Thinking:** ON · **Effort:** Medium
**Branch:** `feat/mux-magic-revamp/63-copy-and-move-files-regex-ui`
**Worktree:** `.claude/worktrees/63_copy-and-move-files-regex-ui/`
**Phase:** 4
**Depends on:** 01 (done)
**Parallel with:** any worker that doesn't touch [packages/web/src/commands/commands.ts](../../packages/web/src/commands/commands.ts), [packages/web/src/components/RenderFields/FieldDispatcher.tsx](../../packages/web/src/components/RenderFields/FieldDispatcher.tsx), or [packages/web/public/command-descriptions.js](../../packages/web/public/command-descriptions.js).

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Yarn only. See [AGENTS.md](../../AGENTS.md).

## Context

The Mux-Magic revamp moved the anime-sync orchestration out of Gallery-Downloader and into a generalized `copyFiles` / `moveFiles` model with regex-based file filtering and renaming. The **server-side schema and implementation already support** all the knobs needed:

| Field | copyFiles | moveFiles | Where defined |
| --- | :---: | :---: | --- |
| `sourcePath` | ✓ | ✓ | [schemas.ts:69-72](../../packages/server/src/api/schemas.ts#L69-L72), [schemas.ts:114-119](../../packages/server/src/api/schemas.ts#L114-L119) |
| `destinationPath` | ✓ | ✓ | [schemas.ts:73-78](../../packages/server/src/api/schemas.ts#L73-L78), [schemas.ts:120-125](../../packages/server/src/api/schemas.ts#L120-L125) |
| `fileFilterRegex` | ✓ | ✓ | [schemas.ts:79-84](../../packages/server/src/api/schemas.ts#L79-L84), [schemas.ts:126-131](../../packages/server/src/api/schemas.ts#L126-L131) |
| `folderFilterRegex` | ✓ | — | [schemas.ts:85-90](../../packages/server/src/api/schemas.ts#L85-L90) |
| `includeFolders` | ✓ | — | [schemas.ts:91-96](../../packages/server/src/api/schemas.ts#L91-L96) |
| `renameRegex: { pattern, replacement }` | ✓ | ✓ | [schemas.ts:52-67](../../packages/server/src/api/schemas.ts#L52-L67) (shared `renameRegexSchema`), [schemas.ts:97](../../packages/server/src/api/schemas.ts#L97), [schemas.ts:132](../../packages/server/src/api/schemas.ts#L132) |

The implementations honor them — see `applyRenameRegex` at [copyFiles.ts:38-47](../../packages/server/src/app-commands/copyFiles.ts#L38-L47), the file-filter at [copyFiles.ts:86-95](../../packages/server/src/app-commands/copyFiles.ts#L86-L95), and the folder-filter + folder-copy pipeline at [copyFiles.ts:203-254](../../packages/server/src/app-commands/copyFiles.ts#L203-L254). The CLI exposes these via `--fileFilterRegex` / `--folderFilterRegex` / `--includeFolders` / `--renameRegex` already.

**The gap:** the Web Sequence Builder cards for `copyFiles` and `moveFiles` only render `sourcePath` and `destinationPath`. The five other fields are reachable only by hand-authoring YAML or POSTing JSON directly. See:

- [packages/web/src/commands/commands.ts:76-93](../../packages/web/src/commands/commands.ts#L76-L93) — copyFiles card definition (2 of 6 fields)
- [packages/web/src/commands/commands.ts:117-134](../../packages/web/src/commands/commands.ts#L117-L134) — moveFiles card definition (2 of 4 fields)

## Your Mission

Surface the hidden `copyFiles` and `moveFiles` knobs in the Sequence Builder UI so the user can author per-series anime sync flows (and any other regex-filtered copy/move) directly in the GUI. **Pure UI work — no schema or handler changes.** The wire format (`{ pattern, replacement }` for `renameRegex`) and field names stay identical so existing YAML/API consumers and the parity fixtures keep round-tripping.

### Field plan

#### `copyFiles` card

Render fields in this order:

1. **Source Path** (`sourcePath`, existing, `type: "path"`)
2. **Destination Path** (`destinationPath`, existing, `type: "path"`)
3. **File Filter Regex** (`fileFilterRegex`, new, `type: "string"`, placeholder: `\\.mkv$`, optional)
4. **Include Folders** (`includeFolders`, new, `type: "boolean"`)
5. **Folder Filter Regex** (`folderFilterRegex`, new, `type: "string"`, placeholder: `^Season\\s\\d+`, optional, `visibleWhen: { fieldName: "includeFolders", value: true }`)
6. **Rename Regex** (`renameRegex`, new, `type: "renameRegex"`, optional — see "Nested-object field type" below)

#### `moveFiles` card

Render fields in this order:

1. **Source Path** (`sourcePath`, existing)
2. **Destination Path** (`destinationPath`, existing)
3. **File Filter Regex** (`fileFilterRegex`, new, same as copyFiles)
4. **Rename Regex** (`renameRegex`, new, same as copyFiles)

### Nested-object field type — `renameRegex`

`renameRegex` is a Zod object `{ pattern: string, replacement: string }`. Today's `FieldDispatcher` ([packages/web/src/components/RenderFields/FieldDispatcher.tsx](../../packages/web/src/components/RenderFields/FieldDispatcher.tsx)) maps each `field.type` to a single component that reads/writes `step.params[field.name]` as one value. Add a new field type that does the same for an object value.

**Add a new component** `RenameRegexField` at `packages/web/src/components/RenameRegexField/RenameRegexField.tsx`:

- Reads `step.params.renameRegex` as `{ pattern: string; replacement: string } | undefined`.
- Renders two text inputs side by side: "Pattern" (regex) and "Replacement" (with capture-group hint `$1, $2, …`).
- Writes back atomically: when either input changes, dispatch the full object. When both fields are blank, write `undefined` so `buildParams` strips the field cleanly (this matches the existing "empty value → omit" semantics in [buildParams.ts:43-52](../../packages/web/src/commands/buildParams.ts#L43-L52)).
- Add a one-line helper text under the inputs: "Applied to each entry's filename (or folder name) via `String.replace`." Plain `<small>` styled like other field hints.

**Wire it into the dispatcher** at [FieldDispatcher.tsx:30-81](../../packages/web/src/components/RenderFields/FieldDispatcher.tsx#L30-L81): add a `case "renameRegex": return <RenameRegexField field={field} step={step} />` arm. Mirror the import-block alphabetical order from the existing imports.

**Stories + tests** ship with the component per [docs/agents/code-rules.md](../agents/code-rules.md) (the standard MDX + stories + test triple required for new web components).

### Why a dedicated field type instead of flattening

Two options were considered:

- **Flatten** — expose `renameRegex.pattern` and `renameRegex.replacement` as two virtual fields, then have `buildParams` re-pack them. Requires a special-case in `buildParams` for one nested field shape, drifts the in-memory `step.params` shape from the wire shape, and breaks the parity-fixture round-trip without compensating logic.
- **Dedicated field type (chosen)** — one `step.params.renameRegex` key holds the object; one component manages the two inputs internally. No `buildParams` change. The wire format is exactly what the schema expects with no marshaling step.

The chosen approach is consistent with how `SubtitleRulesField` ([packages/web/src/components/SubtitleRulesField/SubtitleRulesField.tsx](../../packages/web/src/components/SubtitleRulesField/SubtitleRulesField.tsx)) owns its complex object value — same pattern at a smaller scale.

### `visibleWhen` for `folderFilterRegex`

The server already enforces that folder copying is opt-in via `includeFolders` ([copyFiles.ts:80-81](../../packages/server/src/app-commands/copyFiles.ts#L80-L81)). The UI should mirror this: `folderFilterRegex` is meaningless unless `includeFolders` is true, so hide it behind `visibleWhen: { fieldName: "includeFolders", value: true }` exactly like `deleteFilesByExtension`'s `recursiveDepth` does today at [commands.ts:185-194](../../packages/web/src/commands/commands.ts#L185-L194).

## Files

### New

- `packages/web/src/components/RenameRegexField/RenameRegexField.tsx` — the nested-object input component.
- `packages/web/src/components/RenameRegexField/RenameRegexField.test.tsx` — read/write coverage + the "both blank → write undefined" rule.
- `packages/web/src/components/RenameRegexField/RenameRegexField.stories.tsx` — Storybook story (per repo convention: empty, partially filled, fully filled states).
- `packages/web/src/components/RenameRegexField/RenameRegexField.mdx` — MDX page (per repo convention).

### Modified

- `packages/web/src/commands/commands.ts` — extend the `copyFiles` field list at lines 76-93 (add the four new field calls + `visibleWhen` on folder regex) and the `moveFiles` field list at lines 117-134 (add `fileFilterRegex` and `renameRegex`).
- `packages/web/src/components/RenderFields/FieldDispatcher.tsx` — add the `renameRegex` case + import.
- `packages/web/public/command-descriptions.js` — extend the `copyFiles` and `moveFiles` entries so the command-card help text mentions the new fields. (Regenerate via `yarn build:command-descriptions` if available; otherwise hand-edit following the existing pattern.)
- `packages/web/src/commands/commands.test.ts` — extend the existing copyFiles / moveFiles assertions to cover the new field names and the `visibleWhen` rule.
- `docs/workers/MANIFEST.md` — flip this worker's row to `in-progress` at start, `done` after PR merge.

### Pattern templates to mirror

- Nested-object owning component → [SubtitleRulesField.tsx](../../packages/web/src/components/SubtitleRulesField/SubtitleRulesField.tsx)
- Field type case in dispatcher → existing `case "subtitleRules"` arm at [FieldDispatcher.tsx:69-72](../../packages/web/src/components/RenderFields/FieldDispatcher.tsx#L69-L72)
- `visibleWhen` field gating in commands.ts → `deleteFilesByExtension` at [commands.ts:185-194](../../packages/web/src/commands/commands.ts#L185-L194)
- Component triple (component + stories + mdx) layout → any existing `packages/web/src/components/*Field/` directory

## TDD steps

1. **Failing test first**: extend `commands.test.ts` to assert that `COMMANDS.copyFiles.fields` contains entries named `fileFilterRegex`, `folderFilterRegex`, `includeFolders`, `renameRegex` with the right `type` and that `folderFilterRegex` has the `visibleWhen` rule. Same for `COMMANDS.moveFiles.fields` (without the two folder-related ones). Run — confirm red.
2. **Failing component test**: write `RenameRegexField.test.tsx` for the read/write contract: empty step renders blank inputs; setting `pattern` only writes `{ pattern: "x", replacement: "" }`; clearing both fields writes `undefined`. Run — confirm red (component doesn't exist yet).
3. **Implement** `RenameRegexField.tsx` + stories + mdx. Confirm component test green.
4. **Wire** the new case into `FieldDispatcher.tsx`. Confirm no other dispatcher tests break.
5. **Extend** the `copyFiles` and `moveFiles` entries in `commands.ts` with the new field calls. Confirm `commands.test.ts` green.
6. **Regenerate / hand-edit** `command-descriptions.js` for the new fields.
7. **Manual web smoke**: `yarn dev`, open the builder, drop a `copyFiles` step. Verify the five new controls appear, `folderFilterRegex` hides until `includeFolders` is checked, and a filled-in `renameRegex` round-trips through "Copy YAML" → "Load YAML" with the exact `{ pattern, replacement }` shape on the wire.
8. **Parity fixture check**: existing parity fixtures use only the two old fields, so they must still pass unchanged. If any fail, the change broke the wire format — revisit the field-type approach.

## Verification checklist

- [ ] Worktree created at `.claude/worktrees/63_copy-and-move-files-regex-ui/`
- [ ] Manifest row → `in-progress`
- [ ] Failing tests written first (commands.test.ts + RenameRegexField.test.tsx)
- [ ] `RenameRegexField` component + stories + mdx implemented; component tests green
- [ ] `FieldDispatcher` extended with the new case; existing dispatcher tests still green
- [ ] `commands.ts` extended for both copyFiles and moveFiles; commands.test.ts green
- [ ] `command-descriptions.js` updated (or regenerated)
- [ ] Manual web smoke: all five copyFiles knobs render, `folderFilterRegex` hides until `includeFolders` is true, `renameRegex` round-trips through YAML import/export
- [ ] Parity fixtures still pass without modification (proves wire format unchanged)
- [ ] Standard pre-merge gate clean: `yarn lint → typecheck → test → e2e → lint`
- [ ] PR opened against `feat/mux-magic-revamp`
- [ ] Manifest row → `done`

## Out of scope

- Any change to `copyFiles.ts` / `moveFiles.ts` server-side handlers or their Zod schemas. They already do the work — this worker only renders the existing knobs.
- Adding a `renameRegex` "test the regex against a sample filename" preview pane. Useful, but a follow-up — keep the input minimal here.
- AniDB-aware episode renaming via `seasonAndEpisodeNumberRegex` with named capture groups. That's Worker B (separate prompt, will be drafted after this one ships).
- Manga-side equivalents in `copyFiles` / `moveFiles` for Gallery-Downloader migration. Gallery-Downloader still handles manga today; revisit when that changes.
- Refactoring `RenameRegexField` to share a base with any future nested-object field component. Inline the two text inputs directly; defer DRY-up until a second nested-object field actually shows up.
- Validating the regex string client-side (e.g. catching syntax errors before submit). The server's `new RegExp(pattern)` throw is the source of truth; client-side validation would drift.
- Any change to `forEachFolder` (worker 42) or the per-series orchestration. This worker just exposes the building blocks; the user wires them into per-series sequences elsewhere.
