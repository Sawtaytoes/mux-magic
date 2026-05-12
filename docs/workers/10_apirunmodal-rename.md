# Worker 10 — apirunmodal-rename

**Model:** Haiku · **Thinking:** OFF · **Effort:** Low
**Branch:** `feat/mux-magic-revamp/10-apirunmodal-rename`
**Worktree:** `.claude/worktrees/10_apirunmodal-rename/`
**Phase:** 1B web
**Depends on:** 01
**Parallel with:** all other 1B web workers (but **blocks worker 17** — run 10 first if 17 is queued)

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Yarn only. See [AGENTS.md](../../AGENTS.md).

## Your Mission

Rename `ApiRunModal` → `SequenceRunModal`. The modal handles BOTH step-level and sequence-level runs but the name says "Api" (because it posts to `/sequences/run`). The new name reflects the user-visible behavior, not the implementation.

### What to rename

- Component file: `packages/web/src/components/ApiRunModal/ApiRunModal.tsx` → `packages/web/src/components/SequenceRunModal/SequenceRunModal.tsx`
- All sibling files in that directory: `ApiRunModal.test.tsx` → `SequenceRunModal.test.tsx`, `ApiRunModal.stories.tsx` → `SequenceRunModal.stories.tsx`, `ApiRunModal.mdx` → `SequenceRunModal.mdx`, `types.ts` (folder-level, keep filename)
- Directory: `ApiRunModal/` → `SequenceRunModal/`
- Component export name: `ApiRunModal` → `SequenceRunModal`
- Atom: `apiRunModalAtom` → `sequenceRunModalAtom` (in [uiAtoms.ts](../../packages/web/src/state/uiAtoms.ts) or wherever it lives)
- All imports across `packages/web/src/`

### Don't rename

- The API route `/sequences/run` — public API contract
- Any internal `source: "step" | "sequence"` field (existing behavior switch)

## TDD steps

1. Write failing test: import `SequenceRunModal` from new path — should fail because file doesn't exist. Commit `test(SequenceRunModal): failing import for renamed component`.
2. Move directory (`git mv` to preserve history).
3. Rename component export.
4. Rename atom.
5. Update all imports.
6. Verify test passes; existing tests still pass.

## Files

- [packages/web/src/components/ApiRunModal/](../../packages/web/src/components/ApiRunModal/) (whole directory)
- [packages/web/src/state/uiAtoms.ts](../../packages/web/src/state/uiAtoms.ts) — `apiRunModalAtom` rename
- All `import.*ApiRunModal` call sites (grep)
- All `apiRunModalAtom` usages (grep)

## Verification checklist

- [ ] Worktree created
- [ ] Manifest row → `in-progress`
- [ ] Used `git mv` for directory rename (history preserved)
- [ ] Component, file, dir, atom names all updated
- [ ] No `ApiRunModal` references remain anywhere (grep clean)
- [ ] Standard gate clean (including e2e — the modal is featured in step-run + sequence-run e2e tests)
- [ ] PR opened
- [ ] Manifest row → `done`

## Out of scope

- Behavior changes (rename only)
- Renaming `source: "step" | "sequence"` field
- Renaming the underlying `/sequences/run` route
