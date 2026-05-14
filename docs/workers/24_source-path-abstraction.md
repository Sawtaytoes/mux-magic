# Worker 24 — source-path-abstraction

**Model:** Opus · **Thinking:** ON · **Effort:** High
**Branch:** `feat/mux-magic-revamp/24-source-path-abstraction`
**Worktree:** `.claude/worktrees/24_source-path-abstraction/`
**Phase:** 3 (Name Special Features overhaul — but applies to all commands)
**Depends on:** All Phase 1 done
**Parallel with:** 22, 23, 25, 26, 27, 34, 35 (different files)

---

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Tests must cover the change scope. Yarn only. See [AGENTS.md](../../AGENTS.md). Background context lives in [docs/PLAN.md §9](./PLAN.md).

---

## Your Mission

Unify the **source path** concept across every command in the codebase.

### Today's state

Per the exploration of [packages/server/src/api/schemas.ts](../../packages/server/src/api/schemas.ts), every command independently declares its input directory field. Some use `sourcePath`. Others use `subtitlesPath`, `mediaFilesPath`, `inputFolder`, `destinationPath`, etc. There's no enforced naming convention, no shared `SourcePath` type, no shared validation, and no shared UI rendering beyond what each command's `FieldOverrides` happens to do.

The result is a series of small problems that add up:

- The Variables system (worker 36) treats path variables as a single Variable type, but step→variable linking has to discover which fields are path-like by inspecting `CommandField.type === "path"`, which is set field-by-field.
- Per-file pipelining (worker 38) and the trace.moe split (worker 2e) want to ask a step "what is your input directory?" generically. Today there's no canonical answer.
- New commands (workers 23 and 34) have to re-litigate the same question every time.

### Goal

Introduce a **canonical "Source Path" concept**:

- **Internal field name:** `sourcePath` (already the convention in most commands; codify it).
- **User-facing label:** `"Source Path"`.
- Every command that takes a primary input directory uses this field name.
- A new `SourcePath` type/constant in `@mux-magic/tools` (or wherever shared types live post-worker-21) serves as the canonical definition.
- The web field-builder renders a unified `SourcePathField` component for any field named `sourcePath` (or matching the canonical shape) — file picker, link-to-variable picker, validation.

### Migration scope

For each command in [packages/server/src/api/schemas.ts](../../packages/server/src/api/schemas.ts):

1. If the command already uses `sourcePath`: nothing to do.
2. If the command uses a differently-named field for its primary input directory (e.g. `mediaFilesPath`, `inputFolder`):
   - **If safe to rename outright** (no persisted YAML templates likely to break, or YAML codec back-compat is in place): rename the field to `sourcePath`. Update Zod schema, CLI command, web field-builder, app-command parameter destructuring.
   - **If multiple input directories exist** (e.g. a command that takes both a media folder and a subtitles folder): the **primary** one becomes `sourcePath`; the secondary keeps its descriptive name. Pick the primary based on which is logically "the thing the command operates on."
3. If the command takes **no** primary input directory (rare): skip.

### YAML back-compat

User YAML templates likely use the old field names. The YAML codec (post-worker-19: `yamlCodec.ts`) must:

- On **read**: when a known legacy field name appears (e.g. `mediaFilesPath`), map it to `sourcePath` and emit a one-time deprecation warning per template-load.
- On **write**: always serialize as `sourcePath`.

Maintain a small **legacy-field map** in the codec:

```ts
const legacyFieldRenames: Record<string, Record<string, string>> = {
  // command -> { oldFieldName: newFieldName }
  extractSubtitles: { mediaFilesPath: "sourcePath" },
  // ...etc per-command
}
```

This map should be exhaustive — enumerate every renamed field for every affected command. Worker 24's PR description must list each remapping for review.

### Web field rendering

The existing `PathField` component already renders path-like fields. Confirm or create a thin wrapper: every field named `sourcePath` (or with `type: "sourcePath"`) renders via the unified component. If the existing `PathField` already handles this well, just ensure `sourcePath` always maps to it via the field-builder.

The user-facing label `"Source Path"` should come from the field-builder's default-label logic (camelCase → Title Case → "Source Path"). Verify this works; if not, add an explicit `label: "Source Path"` override in the field-builder's centralized defaults rather than per-command.

### Shared type

Create a canonical type in `@mux-magic/tools` (or `@mux-magic/server` shared types — depending on where worker-21 landed shared types):

```ts
// packages/tools/src/types/sourcePath.ts
export const SOURCE_PATH_FIELD_NAME = "sourcePath"
export const SOURCE_PATH_LABEL = "Source Path"
export type SourcePath = string  // canonical: an absolute filesystem path
```

Export from the tools package barrel. Both schemas and the field-builder can import the constant rather than hardcoding the string `"sourcePath"` everywhere.

---

## Tests (per test-coverage discipline)

- **Unit:** Zod schemas for every affected command have a `sourcePath` field (and no legacy-named primary input field).
- **Unit:** YAML codec read with legacy field name → emits warning + maps to `sourcePath`.
- **Unit:** YAML codec write always uses `sourcePath`.
- **Unit:** field-builder renders `sourcePath` as a path picker with the label "Source Path".
- **Integration:** load a legacy YAML fixture for each renamed command → loads cleanly, runs successfully.
- **e2e:** create a sequence with two different commands that both use `sourcePath`; link both to the same path variable; both resolve correctly.

---

## TDD steps

1. Audit phase: list every command's primary input field name (table in PR description).
2. Failing tests above (one fixture per renamed command).
3. Add the `SOURCE_PATH_FIELD_NAME` constant + shared type.
4. Rename fields in Zod schemas one command at a time. Commit per command.
5. Update each app-command's parameter destructuring to match.
6. Update CLI command files to reflect new field names.
7. Add YAML codec legacy-field map + read-time remapping.
8. Verify field-builder renders the label correctly.
9. Run full gate.

---

## Files

**Audit results determine specifics.** Likely modified:

- [packages/server/src/api/schemas.ts](../../packages/server/src/api/schemas.ts) — every command's request schema
- [packages/server/src/api/routes/commandRoutes.ts](../../packages/server/src/api/routes/commandRoutes.ts) — if any defaults referenced old field names
- Many files in [packages/server/src/app-commands/](../../packages/server/src/app-commands/) — destructuring updates
- Many files in [packages/cli/src/cli-commands/](../../packages/cli/src/cli-commands/) — yargs option naming
- [packages/web/src/commands/buildFields.ts](../../packages/web/src/commands/buildFields.ts) — field-builder defaults
- YAML codec (post-worker-19 location)

**Create:**

- `packages/tools/src/types/sourcePath.ts` (or wherever shared types live)

---

## Verification checklist

- [ ] All Phase 1 workers ✅ merged before starting
- [ ] Worktree created
- [ ] Manifest row → `in-progress`
- [ ] Failing tests committed first
- [ ] PR description includes the full audit table: command → old field name → new field name (or "unchanged")
- [ ] Every command's primary input directory uses `sourcePath`
- [ ] User-facing label is "Source Path" everywhere
- [ ] YAML codec accepts legacy field names with deprecation warning; writes only new names
- [ ] e2e: a legacy YAML fixture per renamed command loads + runs successfully
- [ ] Standard gate clean
- [ ] PR opened
- [ ] Manifest row → `done`

## Why Opus

Per the plan's model-recommendation confidence table: this worker is in the "Low — model uncertain" bucket. Opus is chosen because:

1. **Codebase-wide audit + rename** — easy to miss one command and ship a half-migration. Failure mode is "field renamed in schema but app-command still destructures the old name" → silent param-loss bug.
2. **YAML codec back-compat** — getting the legacy-field map right requires understanding every command's input shape; a missed entry breaks a user's saved templates.
3. **Field-builder integration** — the web UI's field-builder has FieldOverrides, default labels, type dispatch; getting the unified `sourcePath` rendering right without breaking other path-like fields is fiddly.

## Out of scope

- Renaming non-primary input fields (e.g. `subtitlesPath` stays `subtitlesPath`). Only the **primary** input directory is unified.
- Adding a path-validation layer (e.g. "path must exist before run" — could be a follow-up worker).
- Migrating `destinationPath` to a similar abstraction — separate concern, separate worker if needed.
