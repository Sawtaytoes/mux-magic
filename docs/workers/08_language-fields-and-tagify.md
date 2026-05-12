# Worker 08 — language-fields-and-tagify

**Model:** Sonnet · **Thinking:** ON · **Effort:** Medium
**Branch:** `feat/mux-magic-revamp/08-language-fields-and-tagify`
**Worktree:** `.claude/worktrees/08_language-fields-and-tagify/`
**Phase:** 1B web
**Depends on:** 01
**Parallel with:** all other 1B web workers

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Yarn only. See [AGENTS.md](../../AGENTS.md).

## Your Mission

Two related improvements to language and tag-style field UIs:

### Part 1: LanguageCodesField → filterable autocomplete

Today's [LanguageCodesField](../../packages/web/src/components/LanguageCodesField/LanguageCodesField.tsx) is a comma-separated text input. Users type `eng, jpn` and hope they remember the ISO 639-3 codes.

New behavior:
- Filterable autocomplete dropdown (similar to existing [FolderMultiSelectField](../../packages/web/src/components/FolderMultiSelectField/FolderMultiSelectField.tsx) tag pattern)
- All ISO 639-3 codes available, alphabetically sorted, with `eng` pinned at the top as a special case
- Each option shows the English name as the primary label with the code as monospace subtext underneath:
  ```
  English
  eng
  ```
- Filter matches BOTH the English name and the code (typing "eng" matches both)
- Selected languages render as removable tags (`X` to delete)

ISO 639-3 codes data: include as a static array `packages/web/src/data/iso639-3.ts` (~7000 entries; if too large, use ISO 639-2 ~500 entries, or 639-1 ~180 entries — pick the smallest set that covers the codes you've seen in real fixtures).

### Part 2: extractSubs.folder → same tag pattern

The `extractSubs.folder` field today is a single-path text input. It's actually used as a set of folder names that subtitles can be extracted to (per the user's task list, "unknown extensions" handling). Apply the FolderMultiSelectField tag pattern: type a folder name → enter → becomes a tag with X to remove. No autocomplete needed (folder names are user-defined), just typed tags.

### Reuse strategy

Both parts share the tag-rendering UI. Either:
- **Option A:** Extract a `<TagInputBase>` primitive from FolderMultiSelectField, use it for both Language and extractSubs.folder. Most reuse.
- **Option B:** Two separate field components sharing similar internals via a `<TagList>` sub-component.

Pick Option A if FolderMultiSelectField's internals lend themselves to clean extraction; pick B if extraction would force awkward generics.

## TDD steps

1. Write failing tests:
   - LanguageCodesField filters by name + code, pins `eng`, renders tags with `X` removal.
   - extractSubs.folder accepts typed tags with `X` removal.
   Commit `test(language-fields): failing tests for autocomplete + tagify`.
2. Add ISO 639 data.
3. Implement the shared primitive (Option A) or twin components (Option B).
4. Update call sites.
5. Verify tests pass.

## Files

- [packages/web/src/components/LanguageCodesField/LanguageCodesField.tsx](../../packages/web/src/components/LanguageCodesField/LanguageCodesField.tsx)
- [packages/web/src/components/FolderMultiSelectField/FolderMultiSelectField.tsx](../../packages/web/src/components/FolderMultiSelectField/FolderMultiSelectField.tsx) (reference pattern)
- New: `packages/web/src/data/iso639-3.ts` (or 639-1/2)
- New (Option A): `packages/web/src/components/TagInputBase/TagInputBase.tsx`
- `extractSubs.folder` call site (grep)
- Stories + tests for all of the above

## Verification checklist

- [ ] Worktree created
- [ ] Manifest row → `in-progress`
- [ ] Failing tests committed first
- [ ] ISO data committed (note: large file — verify it's not bloating bundle size; use `yarn build` and check chunk sizes)
- [ ] LanguageCodesField has filterable autocomplete with `eng`-pinned top
- [ ] extractSubs.folder is tagified
- [ ] Tag pattern shared (Option A) or cleanly separated (Option B) — document choice in PR
- [ ] Stories cover all states (empty, one tag, many tags, filtering)
- [ ] Standard gate clean
- [ ] PR opened
- [ ] Manifest row → `done`

## Out of scope

- Adding RTL languages or non-ISO codes
- Persisting recently-selected languages to localStorage
- Changing the underlying YAML serialization of the language list (still comma-separated string in the YAML output)
