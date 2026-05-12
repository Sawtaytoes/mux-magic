# Worker 19 — yaml-codec-merge

**Model:** Sonnet · **Thinking:** ON · **Effort:** Medium
**Branch:** `feat/mux-magic-revamp/19-yaml-codec-merge`
**Worktree:** `.claude/worktrees/19_yaml-codec-merge/`
**Phase:** 1B other
**Depends on:** 01
**Parallel with:** all other 1B workers

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Yarn only. See [AGENTS.md](../../AGENTS.md).

## Your Mission

Merge the two YAML-handling modules in web into a single `yamlCodec.ts`:
- [packages/web/src/jobs/yamlSerializer.ts](../../packages/web/src/jobs/yamlSerializer.ts) — 79 lines, exports `toYamlStr()`
- [packages/web/src/jobs/loadYaml.ts](../../packages/web/src/jobs/loadYaml.ts) — 277 lines, exports `loadYamlFromText()`

They share import surface and conceptual cohesion (both encode/decode the same sequence types). Combining them reduces import paths and surface ambiguity.

### Decision tree

1. **Read both files in full.** Note exports, internal helpers, dependencies.
2. **Move both into `packages/web/src/jobs/yamlCodec.ts`.** Preserve all exports (callers should not need to change imports beyond the module name).
3. **Re-export from old paths for backward compat?** Decide: clean break (rename, force all callers to update) OR backward-compat shim (old files re-export from new path). Clean break is fewer files; shim is safer if external code imports these.
4. **Update all call sites** if clean-break. Grep `from "./yamlSerializer"` and `from "./loadYaml"` (and variants).
5. **Update tests** — both files have associated tests; merge them too if they share fixtures.

### Don't change behavior

This is purely a file consolidation. Public API of `toYamlStr` and `loadYamlFromText` stays identical. Internal helpers can be co-located but no functional changes.

## TDD steps

1. Ensure existing tests for both modules pass on master (baseline).
2. Move code to `yamlCodec.ts`.
3. Update imports.
4. Re-run all tests; verify zero regressions.
5. If you discover any test was testing the file path (unlikely), update.

## Files

- [packages/web/src/jobs/yamlSerializer.ts](../../packages/web/src/jobs/yamlSerializer.ts) → moved/deleted
- [packages/web/src/jobs/loadYaml.ts](../../packages/web/src/jobs/loadYaml.ts) → moved/deleted
- New: `packages/web/src/jobs/yamlCodec.ts`
- All callers (grep)
- Associated test files (merge if appropriate)

## Verification checklist

- [ ] Worktree created
- [ ] Manifest row → `in-progress`
- [ ] All exports preserved (no signature changes)
- [ ] All imports updated (grep clean: no `from "./yamlSerializer"` or `from "./loadYaml"` if clean-break)
- [ ] Tests pass (no regressions in YAML round-trip tests)
- [ ] PR documents whether clean-break or shim was chosen
- [ ] Standard gate clean
- [ ] PR opened
- [ ] Manifest row → `done`

## Out of scope

- Changing YAML schema or output format
- Adding new YAML features (multi-doc, comments, etc.)
- Migrating to a different YAML library
