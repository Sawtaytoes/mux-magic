# Worker 14 — dryrun-to-query-string

**Model:** Sonnet · **Thinking:** ON · **Effort:** Medium
**Branch:** `feat/mux-magic-revamp/14-dryrun-to-query-string`
**Worktree:** `.claude/worktrees/14_dryrun-to-query-string/`
**Phase:** 1B web
**Depends on:** 01
**Parallel with:** all other 1B web workers

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Yarn only. See [AGENTS.md](../../AGENTS.md).

## Your Mission

Move dry-run state out of `localStorage` and into the query string. Today, toggling dry-run affects the entire browser globally; the new behavior makes it **per-tab**, scoped to the URL — so the user can have one tab in dry-run mode and another in live mode.

### Current state

[packages/web/src/state/dryRunQuery.ts](../../packages/web/src/state/dryRunQuery.ts) already has the infrastructure to read `?fake=success|failure` from the query string. The migration here is:
- Remove the `localStorage` hydration of `dryRunAtom` and `failureModeAtom`.
- Have those atoms hydrate from the query string instead.
- When the user toggles dry-run, update the query string (via `URLSearchParams` + `history.replaceState`), not localStorage.
- Keep `?fake=success|failure` semantics consistent with what `buildRunFetchUrl()` already produces.

### Atom plumbing

Look at how `dryRunAtom` is currently defined (likely uses `atomWithStorage` or `useLocalStorage`). Replace with a derived atom that:
- Reads from `window.location.search` on initial mount.
- Subscribes to history changes (`popstate` event).
- On write: updates the query string and dispatches a `popstate` (or use `history.replaceState` and broadcast via a custom event).

### Edge cases

- Reload preserves dry-run mode (query string survives reload by default).
- Browser back/forward navigates between dry-run states.
- Two tabs at the same URL with different dry-run states stay independent (each owns its own URL).

## TDD steps

1. Write failing tests:
   - On mount, atom reads `?fake=success` from URL.
   - Toggling atom updates `window.location.search`.
   - Two atom instances (different test windows) don't share state.
   Commit.
2. Refactor `dryRunAtom` and `failureModeAtom` to be URL-driven.
3. Remove all `localStorage.isDryRun` and `localStorage.dryRunScenario` references.
4. Update consumers if their subscribe-rerender pattern differs.

## Files

- [packages/web/src/state/dryRunQuery.ts](../../packages/web/src/state/dryRunQuery.ts)
- The dry-run atoms file (grep for `dryRunAtom`, `failureModeAtom`)
- All consumers (grep)

## Verification checklist

- [ ] Worktree created
- [ ] Manifest row → `in-progress`
- [ ] Failing tests first
- [ ] No `localStorage` references for dry-run remain
- [ ] Atom hydrates from URL
- [ ] Toggle updates URL
- [ ] E2E: dry-run banner appears when URL has `?fake=`, doesn't when URL doesn't
- [ ] Standard gate clean
- [ ] PR opened
- [ ] Manifest row → `done`

## Out of scope

- Adding new dry-run scenarios beyond `success`/`failure`
- Server-side dry-run logic (query string is read client-side, passed to server via existing `fake` param on requests)
- Migrating other localStorage state to the URL
