# Worker 49 — nsf-dvdcompare-id-direct-release-hash

**Model:** Sonnet · **Thinking:** ON · **Effort:** Medium
**Branch:** `feat/mux-magic-revamp/49-nsf-dvdcompare-id-direct-release-hash`
**Worktree:** `.claude/worktrees/49_nsf-dvdcompare-id-direct-release-hash/`
**Phase:** 3
**Depends on:** 22 (NSF rename), 35 (`dvdCompareId` Variable type), 3a (NSF pipeline split), 45 (link-aware `NumberWithLookupField`)
**Parallel with:** any Phase 3/4 worker that doesn't touch [packages/core/src/app-commands/nameSpecialFeaturesDvdCompareTmdb.resolveUrl.ts](../../packages/core/src/app-commands/nameSpecialFeaturesDvdCompareTmdb.resolveUrl.ts), [packages/core/src/tools/searchDvdCompare.ts](../../packages/core/src/tools/searchDvdCompare.ts), or the NSF entry [packages/core/src/app-commands/nameSpecialFeaturesDvdCompareTmdb.ts](../../packages/core/src/app-commands/nameSpecialFeaturesDvdCompareTmdb.ts).

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Yarn only. See [AGENTS.md](../../AGENTS.md).

## Your Mission

Today, even when the user has already pinned a `dvdCompareId` on the NSF command (via worker 35's Variable link, or by typing the id directly into the step field once worker 45 makes the lookup field link-aware), the runner still walks through the **movie-select / TMDB-lookup** stage before ever reaching the release-hash chooser. That stage exists because the legacy flow has to disambiguate which film the user means — but with a `dvdCompareId` already in hand, the film is unambiguous. The cost is a wasted round-trip plus an unnecessary `getUserSearchInput` prompt on every NSF run that has the id pre-set.

This worker adds the shortcut: **when `dvdCompareId` is set, skip search/TMDB entirely and jump directly to the release-hash chooser for that film id.** The release-hash list is a per-film attribute on DVDCompare.net's `film.php?fid=<id>` page, so the data is one HTTP fetch + one parse — no search query needed.

### 1. Extend `searchDvdCompare` with a release-hash-by-id helper

Add `getReleaseHashesByDvdCompareId(id: number)` to [packages/core/src/tools/searchDvdCompare.ts](../../packages/core/src/tools/searchDvdCompare.ts) (or its co-located helper sibling — match the file's existing factoring). The helper:

- Fetches `https://www.dvdcompare.net/film.php?fid=<id>` via the existing `gotoPage` / `launchBrowser` plumbing the rest of the module already uses.
- Parses the release-hash table from the page HTML. Reuse `parseDvdCompareSearchHtml`'s factoring style — a pure `parseDvdCompareReleasesHtml(html: string): DvdCompareRelease[]` function the test can hit with a fixture without spawning a browser, plus a thin wrapper that does the fetch.
- Returns an `Observable<DvdCompareRelease[]>` (the existing `DvdCompareRelease` type at the top of the file is already the right shape — `{ hash, label }`).

If a function in the file already covers this case (grep before you write), expose it under the new name without duplication. The NSF pipeline split in worker 3a may have already moved related helpers — check `packages/core/src/app-commands/nameSpecialFeaturesDvdCompareTmdb.resolveUrl.ts` first.

### 2. Wire the shortcut in `resolveUrl`

The NSF entry at [packages/core/src/app-commands/nameSpecialFeaturesDvdCompareTmdb.ts](../../packages/core/src/app-commands/nameSpecialFeaturesDvdCompareTmdb.ts) already destructures `dvdCompareId` and `dvdCompareReleaseHash` from its options. Today, the search + movie-select stage runs unconditionally and only after that does the release-hash prompt fire. Reshape [resolveUrl](../../packages/core/src/app-commands/nameSpecialFeaturesDvdCompareTmdb.resolveUrl.ts) (or whichever module worker 3a left in charge of the lookup) so:

- If `dvdCompareReleaseHash` is set → behave exactly as today (already pinned, no prompt).
- Else if `dvdCompareId` is set → call `getReleaseHashesByDvdCompareId(dvdCompareId)`; if one release, auto-select; if many, fire **one** `getUserSearchInput` event with the release list. **Skip** the movie-search + TMDB-disambiguation stage entirely.
- Else → existing flow (search by `searchTerm`, then TMDB, then release-hash prompt).

Preserve the existing event shape and `isNonInteractive` semantics: a non-interactive run with `dvdCompareId` set and multiple releases should error/exit the same way it does today when multiple movies match without a user available.

### 3. CLI surface

The CLI command at [packages/cli/src/cli-commands/nameSpecialFeaturesDvdCompareTmdbCommand.ts](../../packages/cli/src/cli-commands/nameSpecialFeaturesDvdCompareTmdbCommand.ts) already forwards `dvdCompareId`. Verify the shortcut works end-to-end via the CLI — no flag changes needed; this is purely a runtime optimization of an existing input.

### 4. Web side

The link-aware `NumberWithLookupField` from worker 45 already lets the user populate `dvdCompareId` either by linking to a `dvdCompareId` Variable or by typing the id directly. **No web component changes in this worker** — the shortcut is purely server-side behaviour for an input the UI can already supply. Update the parity fixture at [packages/web/tests/fixtures/parity/nameSpecialFeaturesDvdCompareTmdb.yaml](../../packages/web/tests/fixtures/parity/nameSpecialFeaturesDvdCompareTmdb.yaml) only if the new code path requires a new fixture column; otherwise leave it.

## Tests (per test-coverage discipline)

- Pure parse: `parseDvdCompareReleasesHtml` against a captured fixture of `film.php?fid=…` HTML — covers single-release, multi-release, and zero-release pages.
- Unit on the helper: mock the fetch layer, assert `getReleaseHashesByDvdCompareId(123)` resolves to the expected `DvdCompareRelease[]`.
- Pipeline branch in `resolveUrl` (or its split sibling): given `{ dvdCompareId: 42 }` with no `dvdCompareReleaseHash`, the search stage is **not** invoked (assert via spy) and the release-hash list comes from the new helper.
- Auto-select-on-single: when the helper returns exactly one release, the prompt is **not** fired and the run proceeds with that hash.
- Non-interactive: with `isNonInteractive: true`, `dvdCompareId` set, and multiple releases, the run errors with the same shape today's non-interactive movie-disambiguation error has.
- Back-compat: omitting `dvdCompareId` still walks the full legacy flow — covered by ensuring the existing NSF tests at `packages/core/src/app-commands/nameSpecialFeaturesDvdCompareTmdb.*.test.ts` still pass unchanged.

## TDD steps

1. **Red — parser tests.** Add `searchDvdCompare.releaseHashesByFid.test.ts` with HTML fixtures asserting the parse shapes. Commit `test(server): failing tests for getReleaseHashesByDvdCompareId`.
2. **Green — parser + helper.** Add `parseDvdCompareReleasesHtml` + `getReleaseHashesByDvdCompareId` in [searchDvdCompare.ts](../../packages/core/src/tools/searchDvdCompare.ts).
3. **Red — pipeline test.** Add a unit test next to whichever module worker 3a left in charge of NSF lookup that asserts the search stage is skipped when `dvdCompareId` is set.
4. **Green — wire the shortcut** in [resolveUrl](../../packages/core/src/app-commands/nameSpecialFeaturesDvdCompareTmdb.resolveUrl.ts).
5. **Manifest commit.** Dedicated `chore(manifest): flip worker 49 to in-progress` / `done` commits per the conflict-surface convention.

## Files

### New

- HTML fixture(s) under `packages/core/src/tools/__fixtures__/dvdcompare-releases-<case>.html` for the parse tests.
- Test file: `packages/core/src/tools/searchDvdCompare.releaseHashesByFid.test.ts`.
- Pipeline test alongside the touched lookup module.

### Extend

- [packages/core/src/tools/searchDvdCompare.ts](../../packages/core/src/tools/searchDvdCompare.ts) — add `parseDvdCompareReleasesHtml` (pure) + `getReleaseHashesByDvdCompareId` (Observable wrapper).
- [packages/core/src/app-commands/nameSpecialFeaturesDvdCompareTmdb.resolveUrl.ts](../../packages/core/src/app-commands/nameSpecialFeaturesDvdCompareTmdb.resolveUrl.ts) — branch on `dvdCompareId` before search/TMDB.
- [packages/core/src/app-commands/nameSpecialFeaturesDvdCompareTmdb.ts](../../packages/core/src/app-commands/nameSpecialFeaturesDvdCompareTmdb.ts) — only if a callsite needs the new branch wired (likely no-op).

### Reuse — do not reinvent

- `gotoPage` / `launchBrowser` in [packages/core/src/tools/launchBrowser.ts](../../packages/core/src/tools/launchBrowser.ts) — already used by `searchDvdCompare`; the new helper uses the same path.
- The `getUserSearchInput` SSE prompt machinery — unchanged; we just fire it with a release list directly.
- Worker 45's link-aware `NumberWithLookupField` — provides the `dvdCompareId` input. No further UI work here.

## Out of scope (explicit)

- Caching the release-hash list. The existing flow makes a network hit per run; this worker matches that. A separate caching pass can layer on later if usage justifies it.
- Changing the `DvdCompareRelease` shape.
- Auto-selecting a release when there are multiple based on heuristics (resolution, year, region). Multi-release means prompt today, multi-release means prompt under this worker too.
- Migration of the search-by-name fallback when `dvdCompareId` resolves to nothing on DVDCompare's side. If the helper returns an empty list, surface the error rather than silently falling back.

## Verification checklist

- [ ] Worktree created; manifest row → `in-progress` in its own `chore(manifest):` commit
- [ ] All TDD steps land as red-then-green commit pairs
- [ ] Existing NSF test suite at `packages/core/src/app-commands/nameSpecialFeaturesDvdCompareTmdb.*.test.ts` passes unchanged
- [ ] Standard gate clean (`lint → typecheck → test → e2e → lint`)
- [ ] PR opened against `feat/mux-magic-revamp`
- [ ] [docs/workers/MANIFEST.md](MANIFEST.md) row updated to `done`
