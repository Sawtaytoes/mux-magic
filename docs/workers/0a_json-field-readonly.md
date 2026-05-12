# Worker 0a — json-field-readonly

**Model:** Haiku · **Thinking:** OFF · **Effort:** Low
**Branch:** `feat/mux-magic-revamp/0a-json-field-readonly`
**Worktree:** `.claude/worktrees/0a_json-field-readonly/`
**Phase:** 1B web
**Depends on:** 01 (rename)
**Parallel with:** all other 1B web workers

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Yarn only. See [AGENTS.md](../../AGENTS.md).

## Your Mission

`JsonField` currently has implicit read-only behavior when used as a "Linked → [stepId].[output]" display. Make read-only an **explicit** prop and audit usages.

Most JsonField call sites display data (not entry). Make the read-only state a first-class prop so callers must opt in/out.

### Implementation

1. Add `isReadOnly?: boolean` prop to [JsonField](../../packages/web/src/components/JsonField/JsonField.tsx).
2. When `isReadOnly` is true, render as a styled `<pre>` (or non-editable `<textarea readonly>`) — not the standard editable textarea. Keep visual parity with the existing linked-state display.
3. Audit all callers (grep for `<JsonField`); mark each as `isReadOnly={true}` or `false` based on its usage. Most data-display call sites become read-only.
4. Add a story showing the read-only state in [JsonField.stories.tsx](../../packages/web/src/components/JsonField/JsonField.stories.tsx).

## TDD steps

1. Write a failing test: renders `<JsonField isReadOnly={true} value="..." onChange={spy} />`; type into it; assert `onChange` was NOT called. Commit `test(JsonField): isReadOnly suppresses onChange`.
2. Implement the prop.
3. Audit + update callers in a separate commit.

## Files

- [packages/web/src/components/JsonField/JsonField.tsx](../../packages/web/src/components/JsonField/JsonField.tsx)
- [packages/web/src/components/JsonField/JsonField.stories.tsx](../../packages/web/src/components/JsonField/JsonField.stories.tsx)
- [packages/web/src/components/JsonField/JsonField.test.tsx](../../packages/web/src/components/JsonField/JsonField.test.tsx) (may need to create)
- All `<JsonField` call sites (grep)

## Verification checklist

- [ ] Worktree created
- [ ] Manifest row → `in-progress`
- [ ] Failing test committed first
- [ ] `isReadOnly` prop implemented
- [ ] All callers audited and explicitly opt-in or opt-out
- [ ] New story shows read-only state
- [ ] Standard gate clean
- [ ] PR opened
- [ ] Manifest row → `done`

## Out of scope

- Adding any other JsonField features (validation, schema enforcement, syntax highlighting)
- Renaming the component
