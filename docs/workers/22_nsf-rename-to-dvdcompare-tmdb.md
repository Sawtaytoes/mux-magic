# Worker 22 — nsf-rename-to-dvdcompare-tmdb

**Model:** Sonnet · **Thinking:** ON · **Effort:** Medium
**Branch:** `feat/mux-magic-revamp/22-nsf-rename-to-dvdcompare-tmdb`
**Worktree:** `.claude/worktrees/22_nsf-rename-to-dvdcompare-tmdb/`
**Phase:** 3 (Name Special Features overhaul)
**Depends on:** 21 (observables-shared-split)
**Parallel with:** 24 (source-path-abstraction — different files)

---

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Tests must cover the change scope. Yarn only. See [AGENTS.md](../../AGENTS.md). Background context lives in [docs/PLAN.md §9](./PLAN.md).

---

## Your Mission

**Rename only. No behavior changes.**

The existing command `nameSpecialFeatures` is the canonical "rename movie special-features files using DVD Compare timecodes + TMDB canonical title" command. Two new sibling commands are coming (workers 23 and 34) that target narrower workflows. To make the family of commands legible, rename the existing one to spell out what it does.

Rename: `nameSpecialFeatures` → `nameSpecialFeaturesDvdCompareTmdb`

This is a **mechanical, codebase-wide rename**. The 1,325-line implementation stays exactly as-is. The user wants the existing command preserved so it can be compared against the two new siblings before any deprecation decision.

---

### What to rename

The identifier `nameSpecialFeatures` appears in:

- **Server app-command:** [packages/server/src/app-commands/nameSpecialFeatures.ts](../../packages/server/src/app-commands/nameSpecialFeatures.ts) — file rename via `git mv` to preserve history → `nameSpecialFeaturesDvdCompareTmdb.ts`
- **CLI adapter:** `packages/cli/src/cli-commands/nameSpecialFeaturesCommand.ts` (post-worker-20 location) — rename file to `nameSpecialFeaturesDvdCompareTmdbCommand.ts`; yargs command name string updated
- **Zod schemas:** [packages/server/src/api/schemas.ts](../../packages/server/src/api/schemas.ts) — `nameSpecialFeaturesRequestSchema` → `nameSpecialFeaturesDvdCompareTmdbRequestSchema` (and any response schema)
- **API route registration:** [packages/server/src/api/routes/commandRoutes.ts](../../packages/server/src/api/routes/commandRoutes.ts) — the `commandConfigs.nameSpecialFeatures = { ... }` block becomes `commandConfigs.nameSpecialFeaturesDvdCompareTmdb`
- **Web UI:** wherever the command name string is referenced in [packages/web/src/](../../packages/web/src/) (command picker labels, field builders, YAML serializer/loader, etc.)
- **Tests:** every test file that references the old name
- **YAML fixtures:** any test YAML that uses `command: nameSpecialFeatures` → update to the new name. Add a **back-compat read** in the YAML codec: if a template uses the old name, log a deprecation warning and treat it as the new name. (Coordinate with worker 19 if its codec merge has shipped.)
- **Documentation:** any README/docs that mention the command

### What does NOT change

- The command's behavior — every line of `nameSpecialFeatures.ts` is preserved verbatim in the renamed file.
- The command's input fields, output shape, prompts, error messages — identical.
- The visible UI label can stay as "Name Special Features" or update to "Name Special Features (DVD Compare + TMDB)" — pick whichever fits the picker's existing label conventions. Default: update the label to match the new internal name (more legible alongside workers 23 and 34's labels).

### Back-compat read for old YAML templates

Users may have saved YAML templates referencing `nameSpecialFeatures`. The YAML codec (post-worker-19: `yamlCodec.ts`) should:

- On **read**: accept either `command: nameSpecialFeatures` (legacy) or `command: nameSpecialFeaturesDvdCompareTmdb` (new). For legacy, emit a one-time console warning per session.
- On **write**: always serialize the new name.

This is a small change — one map lookup before resolving the command — but it prevents user templates from breaking silently.

---

## Tests (per test-coverage discipline)

- **Unit:** existing tests for `nameSpecialFeatures` still pass after the rename (identical assertions, just new import path).
- **Unit:** YAML codec accepts legacy `command: nameSpecialFeatures` and resolves to the new command. Emits a deprecation warning.
- **Unit:** YAML codec writes only `command: nameSpecialFeaturesDvdCompareTmdb`.
- **Integration:** API route `POST /commands/nameSpecialFeaturesDvdCompareTmdb` responds identically to what `POST /commands/nameSpecialFeatures` used to respond with (legacy route 404s or returns a redirect — decide based on existing API conventions, but lean toward 404; legacy URL is short-lived).
- **e2e:** create a sequence with the renamed command in the web UI; runs successfully end-to-end.
- **e2e:** load a legacy YAML template (fixture); the picker shows the renamed command; the run succeeds.

---

## TDD steps

1. Failing tests covering the back-compat read + new-name routes. Commit.
2. `git mv` the app-command file. Update its export.
3. Rename CLI command file + yargs registration.
4. Update Zod schemas + API route config block.
5. Codebase-wide find/replace of `nameSpecialFeatures` → `nameSpecialFeaturesDvdCompareTmdb` (string identifier only; do not rename CSS classes, etc., that share the substring).
6. Add legacy YAML read support.
7. Update fixtures and UI labels.
8. Run full gate.

---

## Files

**Move via `git mv`:**
- [packages/server/src/app-commands/nameSpecialFeatures.ts](../../packages/server/src/app-commands/nameSpecialFeatures.ts) → `nameSpecialFeaturesDvdCompareTmdb.ts`
- CLI command file (post-worker-20 location in `packages/cli/src/cli-commands/`)

**Modify:**
- [packages/server/src/api/schemas.ts](../../packages/server/src/api/schemas.ts) — rename schema constants
- [packages/server/src/api/routes/commandRoutes.ts](../../packages/server/src/api/routes/commandRoutes.ts) — rename config key + import
- YAML codec (per-worker-19 merge state: either two files or `yamlCodec.ts`)
- Any web UI files referencing the command name (CommandPicker, field-builders, etc.)
- All tests
- Any docs/README

---

## Verification checklist

- [ ] Worker 21 ✅ merged before starting
- [ ] Worktree created
- [ ] Manifest row → `in-progress`
- [ ] Failing tests committed first
- [ ] No content changes in the renamed file beyond the rename itself (`git diff` shows only renames + import paths)
- [ ] All grep results for `nameSpecialFeatures` updated (except CSS/styling identifiers that legitimately share the substring)
- [ ] Legacy YAML templates still load and emit a deprecation warning
- [ ] All tests pass with new names
- [ ] e2e: legacy YAML fixture loads and runs successfully
- [ ] Standard gate clean
- [ ] PR opened
- [ ] Manifest row → `done`

## Out of scope

- Any behavior change to the renamed command (workers 25, 26, 27 do targeted improvements after this rename lands).
- Worker 23, 34 (new sibling commands) — they depend on this rename but are separate workers.
- Worker 35 (dvdCompareId Variable type) — uses the new command name but is registered independently.

---

## What shipped (PR #109, merged 2026-05-15, squash commit `b61a4067`)

Three deviations from this prompt are worth recording for successor workers (3a, 23, 25, 26, 27, 34, 35) so they don't reverse-engineer them from commit messages:

1. **YAML back-compat — hard reject, not soft warn.** User overrode the prompt's "accept legacy `command: nameSpecialFeatures` with deprecation warning" guidance. Legacy YAML now throws a rename-aware error: `Command "nameSpecialFeatures" was renamed to "nameSpecialFeaturesDvdCompareTmdb". Update your template.` Implementation: a generic `RENAMED_COMMANDS` map at the top of [packages/web/src/jobs/yamlCodec.ts](../../packages/web/src/jobs/yamlCodec.ts), consulted before the existing "Unknown command" throw. The map is structured to grow — successor workers that rename commands should append entries here rather than adding new bespoke error paths.

2. **Branch name deviation.** Prompt specified `feat/mux-magic-revamp/22-nsf-rename-to-dvdcompare-tmdb`, but git can't create a branch nested under an existing ref while `feat/mux-magic-revamp` exists as a leaf branch (`refs/heads/feat/mux-magic-revamp` is a file, can't become a directory containing another ref). Worker used `worker-22-nsf-rename-to-dvdcompare-tmdb` instead (matches the AGENTS.md convention and recent merges like `worker-20-cli-package-extract`). Future workers should follow the `worker-<id>-<slug>` pattern.

3. **AGENTS.md PowerShell UTF-8 trap guard.** The first attempt at the bulk identifier replace used `Get-Content -Raw` + `Set-Content -Encoding utf8`, which on Windows PowerShell 5.1 reads via the system code page (Windows-1252) and corrupts UTF-8 multi-byte characters into double-mojibake (`─` → `â"€`). The user had spent hours fixing this same class of bug the night before (commit `e7a8a4b1`), caught my repeat immediately, and asked for a reset + reapply. The fix uses `[System.IO.File]::ReadAllText/WriteAllText` with explicit UTF-8 (no BOM), bypassing PowerShell's encoding pipeline. A guard documenting this trap was added to [AGENTS.md](../../AGENTS.md) under the Code Rules section.

### UI label

Visible picker label is **"Name Special Features (DVD Compare + TMDB)"** (the legible default from the prompt's two options), set in [packages/web/src/jobs/commandLabels.ts](../../packages/web/src/jobs/commandLabels.ts).

### API surface

- `POST /commands/nameSpecialFeaturesDvdCompareTmdb` is the only registered route. Legacy `POST /commands/nameSpecialFeatures` returns 404 (clean break — the route registration is data-driven, so unregistering the old key naturally drops the URL).
- Zod schema renamed to `nameSpecialFeaturesDvdCompareTmdbRequestSchema`. No response-schema rename needed (the command uses the shared `createJobResponseSchema`).

### Pre-merge gate

All green: typecheck (5.6s) · 1498 unit tests passing · lint (8 formatting auto-fixes on first pass, 0 on final) · 52 e2e tests passing (38.7s).
