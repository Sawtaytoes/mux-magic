# Worker 51 — release-date-into-date-tag

**Model:** Sonnet · **Thinking:** ON · **Effort:** Medium
**Branch:** `feat/mux-magic-revamp/51-release-date-into-date-tag`
**Worktree:** `.claude/worktrees/51_release-date-into-date-tag/`
**Phase:** 5
**Depends on:** 01
**Parallel with:** any Phase 5 worker that doesn't touch [packages/server/src/cli-spawn-operations/runMkvPropEdit.ts](../../packages/server/src/cli-spawn-operations/runMkvPropEdit.ts), [packages/server/src/tools/getMkvInfo.ts](../../packages/server/src/tools/getMkvInfo.ts), or [packages/server/src/app-commands/](../../packages/server/src/app-commands/) collisions on the new file.

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Yarn only. See [AGENTS.md](../../AGENTS.md).

## Your Mission

Add a new app-command — working name `copyReleaseDateIntoDateTag` (final command id and label TBD; mirror the casing used by the sibling tag-touching commands once you grep them) — that normalizes legacy MKV files which carry a `Release Date` tag but no canonical `Date` tag. The new command walks a `sourcePath` (recursive flag like the other audio/video sweep commands), reads each `.mkv` file's tags, and when a `Release Date` value is present but `Date` is empty/missing, copies the value into `Date`. This brings older rips into a consistent tag schema so downstream media managers (Jellyfin, Plex, Sonarr/Radarr) sort them correctly.

### Pre-work investigation (load-bearing — record findings in the PR)

1. Read [packages/server/src/cli-spawn-operations/runMkvPropEdit.ts](../../packages/server/src/cli-spawn-operations/runMkvPropEdit.ts). Today it accepts arbitrary `args` and passes them after `filePath` to `mkvpropedit`. Verify by grepping every existing caller (`setOnlyFirstTracksAsDefault`, `updateTrackLanguage`, `setDisplayWidthMkvPropEdit`, `defineLanguageForUndefinedTracks`, `changeTrackLanguages`) whether any of them already pass `--edit info` or `--tags` — and whether the wrapper's success/failure handling assumes the same exit-code contract for tag edits as for track edits (it should, since `mkvpropedit` returns 0/1/2 uniformly, but the buffered-stderr surfacing matters when the failure mode is "tags XML rejected").
2. Decide between two implementation paths and document the chosen one in the PR description:
   - **Path A — direct `--edit info`/`--tags`:** `mkvpropedit` supports targeted tag mutation with `--tags global:tags.xml` (replaces all global tags) or per-track via `--edit track:N --tags …`. If the source-of-truth here is "set the global `Date` tag value," confirm whether `mkvpropedit` can do it as a single CLI invocation without round-tripping the existing tag set. The "Release Date" tag is a SimpleTag under a Targets element, not a property on `info`, so `--edit info` alone is probably insufficient — you almost certainly need the `--tags` form.
   - **Path B — `mkvextract tags` round-trip:** extract the existing tags XML via `mkvextract tags <file> -` (stdout) — there's already a stdout-capturing wrapper at [packages/server/src/cli-spawn-operations/runMkvExtractStdOut.ts](../../packages/server/src/cli-spawn-operations/runMkvExtractStdOut.ts) — parse the XML, set `<SimpleTag><Name>DATE</Name>` from the `RELEASE_DATE` value when missing, write a temp XML, then `mkvpropedit <file> --tags global:tempXmlPath`. Cleanly delete the temp file on success and on error.
3. If Path A doesn't compose with the existing `runMkvPropEdit` contract (e.g. it needs a different stderr-tolerance posture for the `--tags` form, or temp-file lifecycle), prefer Path B. Either way, **do not duplicate `runMkvPropEdit`** — extend it with a focused, optional config knob, or wrap it with a thin tag-aware helper alongside it.

### Implementation

New app-command file: `packages/server/src/app-commands/copyReleaseDateIntoDateTag.ts`. Follow the shape of [packages/server/src/app-commands/hasDuplicateMusicFiles.ts](../../packages/server/src/app-commands/hasDuplicateMusicFiles.ts) and [packages/server/src/app-commands/changeTrackLanguages.ts](../../packages/server/src/app-commands/changeTrackLanguages.ts) for streaming and tag-mutation patterns respectively:

- Inputs: `sourcePath`, `isRecursive`, `recursiveDepth` (match the canonical `sourcePath` shape per the [sourcePath canonical convention](../../AGENTS.md)).
- Use `getFilesAtDepth` to walk, filter for `.mkv`.
- For each file, parse tags (Path A or B above) and detect the `Release Date` → `Date` gap. Tag names are case-sensitive in Matroska; the on-disk SimpleTag name is conventionally upper-case (`DATE`, `DATE_RELEASED`, `RELEASE_DATE`) — verify against real fixtures and handle the common casings.
- When a copy is needed, invoke `mkvpropedit` (via Path A or B) to set the `Date` tag value.
- Emit a log line per file: `<path> — copied Release Date "<value>" → Date` on success; `<path> — already has Date "<value>", skipped` on no-op; surface errors via the standard `logAndRethrowPipelineError` pattern so the SSE log stream shows them.
- Respect the per-job thread budget (worker 11 / taskScheduler) — this is a cheap metadata edit, but it still spawns `mkvpropedit` (and possibly `mkvextract`), so wire it through the same pipeline `mergeMap` shape that other tag-touching commands use.

### Wire-up

- CLI: `packages/cli/src/cli-commands/copyReleaseDateIntoDateTagCommand.ts` (mirror [hasDuplicateMusicFilesCommand.ts](../../packages/cli/src/cli-commands/hasDuplicateMusicFilesCommand.ts)).
- Web command registry: register the new command id + label in [packages/web/src/commands/commands.ts](../../packages/web/src/commands/commands.ts) and [packages/web/src/jobs/commandLabels.ts](../../packages/web/src/jobs/commandLabels.ts). Add a description in [packages/web/public/command-descriptions.js](../../packages/web/public/command-descriptions.js).
- API schema: register in [packages/server/src/api/schemas.ts](../../packages/server/src/api/schemas.ts) and [packages/server/src/api/routes/commandRoutes.ts](../../packages/server/src/api/routes/commandRoutes.ts).
- Fake data: add an entry in [packages/server/src/fake-data/index.ts](../../packages/server/src/fake-data/index.ts) so dry-run scenarios cover it.
- Parity fixture: add `hasDuplicateMusicFiles`-style fixtures under `packages/web/tests/fixtures/parity/` if the new command participates in the parity sweep.
- Docs: update [docs/api.md](../../docs/api.md) and [docs/cli.md](../../docs/cli.md).

## Tests (per test-coverage discipline)

- Unit: the tags-XML diff helper — given a parsed tag set with `Release Date` but no `Date`, the helper produces the expected mutation; given both present, it produces a no-op signal; given neither, no-op.
- Unit: case-insensitivity / spelling-variant handling for tag names (`DATE_RELEASED` vs `RELEASE_DATE` vs `Release Date`).
- Integration (with a temp dir of real-or-faked MKV fixtures or via the existing dry-run scaffolding): run the command, assert the expected `mkvpropedit` invocation shape is produced for the gap-files and no invocation for the already-tagged files.
- CLI: `hasDuplicateMusicFilesCommand`-style argv parsing test.
- Web: command registry entry roundtrips through the parity fixture.

## TDD steps

1. **Red** — `test(srv): failing tests for copyReleaseDateIntoDateTag tag-gap detection`. Cover the helper-level cases above plus one integration case that fails because the command doesn't exist.
2. **Green** — implement the chosen path (A or B), the wrapper extension if needed, the app-command, and the CLI binding.
3. **Wire web/api** — separate commit registering the command in schemas/registry/labels/descriptions.
4. **Docs + fixtures** — separate commit for `docs/api.md`, `docs/cli.md`, fake-data, parity fixture.
5. **Manifest** — `chore(manifest): worker 51 done`.

## Files

### New

- [packages/server/src/app-commands/copyReleaseDateIntoDateTag.ts](../../packages/server/src/app-commands/copyReleaseDateIntoDateTag.ts)
- [packages/server/src/app-commands/copyReleaseDateIntoDateTag.test.ts](../../packages/server/src/app-commands/copyReleaseDateIntoDateTag.test.ts)
- [packages/cli/src/cli-commands/copyReleaseDateIntoDateTagCommand.ts](../../packages/cli/src/cli-commands/copyReleaseDateIntoDateTagCommand.ts)
- Possibly a small helper file alongside `runMkvPropEdit.ts` if you extract a tag-XML round-trip helper (Path B). Use a dotted-suffix sibling per the [no-barrel-for-single-command-splits convention](../../AGENTS.md), e.g. `runMkvPropEdit.tags.ts`.

### Extend

- [packages/server/src/cli-spawn-operations/runMkvPropEdit.ts](../../packages/server/src/cli-spawn-operations/runMkvPropEdit.ts) — only if Path A requires a config knob; otherwise leave untouched.
- [packages/server/src/api/schemas.ts](../../packages/server/src/api/schemas.ts)
- [packages/server/src/api/routes/commandRoutes.ts](../../packages/server/src/api/routes/commandRoutes.ts)
- [packages/server/src/fake-data/index.ts](../../packages/server/src/fake-data/index.ts)
- [packages/web/src/commands/commands.ts](../../packages/web/src/commands/commands.ts)
- [packages/web/src/jobs/commandLabels.ts](../../packages/web/src/jobs/commandLabels.ts)
- [packages/web/public/command-descriptions.js](../../packages/web/public/command-descriptions.js)
- [packages/cli/src/cli.ts](../../packages/cli/src/cli.ts) — register the new yargs command module
- [docs/api.md](../../docs/api.md)
- [docs/cli.md](../../docs/cli.md)

### Reuse — do not reinvent

- `runMkvPropEdit` (or `runMkvExtractStdOut` if Path B) is the only sanctioned way to spawn the binaries. Do not call `spawn(mkvPropEditPath, ...)` from the new app-command directly.
- `getFilesAtDepth` from `@mux-magic/tools` is the canonical directory walker; mirror its usage from `hasDuplicateMusicFiles.ts`.
- The taskScheduler perJobClaim wiring from worker 11 governs concurrency — do not invent a parallel limiter.

## Verification checklist

- [ ] Investigation findings (Path A vs Path B, with rationale) documented in PR description
- [ ] Failing-test commit landed before the green commit
- [ ] Standard gate clean (`lint → typecheck → test → e2e → lint`)
- [ ] Manual smoke against at least one real legacy MKV with a `Release Date` tag — verify the resulting file has `Date` set and `mkvinfo` round-trips cleanly
- [ ] `chore(manifest): worker 51 done` is a separate commit
- [ ] PR opened against `feat/mux-magic-revamp`
- [ ] [docs/workers/MANIFEST.md](MANIFEST.md) row updated to `done`

## Out of scope

- Inventing new tag-name normalization beyond the documented `Release Date` → `Date` copy. Don't also normalize `RELEASE_DATE`, `DATE_RELEASED`, or other related fields in this worker — that's a separate command if needed.
- Re-encoding or remuxing the file. This is metadata-only.
- Backporting the tag copy into the NSF/edition-organizer pipelines (workers 25/26). Those have their own tag posture.
- A web/UI configuration surface beyond the standard command-with-sourcePath card the registry produces automatically.
