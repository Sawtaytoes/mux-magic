# Worker 54 — bare-console-log-to-structured-loginfo

**Model:** Sonnet · **Thinking:** ON · **Effort:** Medium
**Branch:** `worker-54-bare-console-log-to-structured-loginfo`
**Worktree:** `.claude/worktrees/54_bare-console-log-to-structured-loginfo/`
**Phase:** 4 (Server infrastructure cleanup follow-up)
**Depends on:** 41 (structured-logging foundation)
**Parallel with:** anything that doesn't touch the same files (most of Phase 4/5)

---

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Tests must cover the change scope. Yarn only. See [AGENTS.md](../../AGENTS.md). Background context lives in [docs/PLAN.md §9](./PLAN.md).

---

## Your Mission

Replace every **production-code** bare `console.log`/`console.warn`/`console.error`/`console.info`/`console.debug` call in `packages/server/**`, `packages/tools/**`, and `packages/cli/**` with the appropriate structured logger (`logInfo` / `logWarning` / `logError`) from `@mux-magic/tools`. Worker 41 wired those helpers as the OTEL-style structured-logging front door; bare `console.*` bypasses the logger (no level, no trace correlation, not emitted on the `/logs/structured` SSE feed). Worker 23 caught one CLI command + one app-command; this worker handles the rest.

**Out of scope:**
- `packages/web/**` — the frontend is a different beat: no structured-logging bridge exists yet, and Vite captures `console.*` for the dev terminal differently than the server logger does. A future worker can add a `@mux-magic/tools/web` sink that posts to `/logs/structured`, but that's a design choice, not a sweep.
- **Build / maintenance scripts** in any package (`packages/*/scripts/**`, `packages/*/.storybook/**`, `packages/server/src/generateInternalApiSchemas.ts`, `packages/server/src/generateExternalApiSchemas.ts`). These run at build time, outside the structured-logging pipeline — their `console.*` goes straight to the developer's terminal and doesn't need a trace ID.

### Why this worker exists

Worker 41 was a foundation worker — it added `logInfo` / `logWarning` / `logError` but did **not** sweep existing call sites. Most of the server code predates 41 and still uses raw `console.*`. Worker 23 was the first new code written after 41; reviewer flagged the bare `console.log` in worker 23's CLI handler, which surfaced the broader cleanup as overdue.

Symptoms today:
- The `/logs/structured` SSE feed has gaps wherever bare `console.*` is on the hot path (e.g. mid-pipeline progress, spawn-op stderr/stdout).
- Log levels are guessed from the `console` method name rather than carried as structured data.
- Trace correlation (`AsyncLocalStorage`-backed `startSpan`) is silently dropped for any line that goes through bare `console.*`.

### Scope — exact rule

**Replace** in:
- `packages/server/src/app-commands/**/*.ts` — mid-pipeline progress (excluding tests).
- `packages/server/src/cli-spawn-operations/**/*.ts` — spawn `stdout`/`stderr` forwarding.
- `packages/server/src/api/**/*.ts` — routes + jobRunner + logCapture (excluding tests).
- `packages/server/src/tools/**/*.ts` — `getMkvInfo`, `webhookReporter`, `searchDvdCompare`, `searchMovieDb`, `resolutionHelpers`, etc. (excluding tests).
- `packages/tools/src/**/*.ts` — survey first; current state of the tree has **zero** in-scope hits here (`logMessage.ts` is the logger itself, `captureConsoleMessage.test.ts` is a test). Re-survey at session start in case new code landed.
- `packages/cli/src/cli-commands/**/*.ts` — CLI command handlers (worker 23 already converted `nameMovieCutsDvdCompareTmdbCommand.ts`; the rest follow the same precedent).
- `packages/cli/src/cli.ts` — the top-level uncaught-exception handler's `console.error(exception)` (`logError("UNCAUGHT", exception)` or similar). `console.time`/`console.timeEnd` stay — see exemptions below.

**Do NOT touch** (bare `console.*` is correct here):
- `packages/server/scripts/**`, `packages/tools/scripts/**`, `packages/web/scripts/**`, `packages/*/.storybook/**` — build / maintenance scripts (`seedAnidbFixtures.ts`, `build-command-descriptions.ts`, `screenshots.ts`, `capture-parity-fixtures.ts`, `mock-server-plugin.ts`). These run at build time outside the structured-logging pipeline — their output goes straight to the developer's terminal.
- `packages/server/src/generateInternalApiSchemas.ts`, `packages/server/src/generateExternalApiSchemas.ts` — schema-generation scripts that happen to live under `src/`. Treat as scripts.
- `**/*.test.ts`, `**/*.bench.test.ts` — test assertions on captured console output (`captureConsoleMessage.test.ts`, `searchMovieDb.test.ts`, `sequenceRoutes.test.ts`, `logCapture.test.ts`, etc.) deliberately use bare `console.*`.
- `packages/server/src/logBuildBanner.ts` — the literal startup banner. It runs **before** the logger is initialized and must stay as `console.*`.
- `packages/tools/src/logMessage.ts` — the logger implementation itself ultimately calls `console.*`. Don't change it.
- `console.time` / `console.timeEnd` (the pair in `packages/cli/src/cli.ts`) — these are a Console-only API with no logger equivalent. Leave the pair alone; revisit only if the team adds a `logger.timer()` helper.
- `packages/web/**` (runtime UI code) — see "Out of scope" above.

### Conversion convention

The repo has an established `logInfo("UPPERCASE_TAG", ...content)` pattern. Examples already in tree:
- `logInfo("DELETED", path)`
- `logInfo("RENAMED", oldPath, newPath)`
- `logInfo("NO SUBTITLES", fileInfo.fullPath)`
- `logInfo("REMOVED OUTPUT FOLDER", sourcePath)`
- `logInfo("LOADING", "DVDCompare page")` — worker 23's convention for "starting an operation"
- `logInfo("PARSED CUTS", String(cuts.length))` — counts as content
- `logInfo("TIMECODE", filename, timecode)` — per-item progress

**Rules:**
- First argument is an uppercase tag (≤ ~24 chars, space-separated, OTEL-style). Pick from existing tags where one fits; coin new ones where needed.
- Subsequent arguments are the content lines (typically the file path, count, or rationale).
- For multi-item summaries (e.g. NSF's "Unnamed files with DVDCompare candidate associations:" + a per-file list), use the `multipleItems` template: `logInfo("UNNAMED FILES", "<description>", arrayOfDetailStrings)`.
- `console.warn` → `logWarning("…", …)`. `console.error` → `logError("…", …)`.
- **Drop the trailing `…` ellipsis** from existing strings — the logger adds its own formatting and trailing punctuation is noise.

### Per-file expectations (counts as of plan-time; verify before starting)

| File | Calls |
|---|---|
| `packages/server/src/app-commands/nameSpecialFeaturesDvdCompareTmdb.ts` | 11 |
| `packages/cli/src/cli-commands/nameSpecialFeaturesDvdCompareTmdbCommand.ts` | 9 |
| `packages/server/src/api/routes/queryRoutes.ts` | 8 |
| `packages/server/src/api/logCapture.ts` | 4 |
| `packages/server/src/cli-spawn-operations/runMkvPropEdit.ts` | 3 |
| `packages/server/src/cli-spawn-operations/runMkvMerge.ts` | 3 |
| `packages/server/src/cli-spawn-operations/runMkvExtract.ts` | 3 |
| `packages/server/src/cli-spawn-operations/runFfmpeg.ts` | 3 |
| `packages/server/src/cli-spawn-operations/runAudioOffsetFinder.ts` | 3 |
| `packages/server/src/cli-spawn-operations/runReadlineFfmpeg.ts` | 2 |
| `packages/server/src/cli-spawn-operations/runMkvExtractStdOut.ts` | 2 |
| `packages/server/src/tools/webhookReporter.ts` | 2 |
| `packages/server/src/tools/getMkvInfo.ts` | 2 |
| `packages/server/src/cli-spawn-operations/setOnlyFirstTracksAsDefault.ts` | 1 |
| `packages/server/src/cli-spawn-operations/runFfmpegAudioTranscode.ts` | 1 |
| `packages/server/src/api/routes/transcodeRoutes.ts` | 1 |
| `packages/server/src/api/jobRunner.ts` | 1 |
| `packages/server/src/app-commands/nameSpecialFeaturesDvdCompareTmdb.resolveUrl.ts` | 1 |
| `packages/server/src/app-commands/isMissingSubtitles.ts` | 1 |
| `packages/server/src/app-commands/hasBetterVersion.ts` | 1 |
| `packages/server/src/app-commands/hasWrongDefaultTrack.ts` | 1 |
| `packages/server/src/app-commands/hasManyAudioTracks.ts` | 1 |
| `packages/server/src/app-commands/hasImaxEnhancedAudio.ts` | 1 |
| `packages/server/src/app-commands/hasDuplicateMusicFiles.ts` | 1 |
| `packages/server/src/app-commands/mergeTracks.ts` | 1 |
| `packages/server/src/tools/searchMovieDb.ts` | 1 |
| `packages/server/src/tools/searchDvdCompare.ts` | 1 |
| `packages/server/src/tools/resolutionHelpers.ts` | 1 |
| `packages/cli/src/cli-commands/modifySubtitleMetadataCommand.ts` | 1 |
| `packages/cli/src/cli-commands/getSubtitleMetadataCommand.ts` | 1 |
| `packages/cli/src/cli.ts` (the `console.error` only — `console.time`/`console.timeEnd` stay) | 1 |

Approximately **69 calls across 31 files**. Re-run the survey at session start — counts may have shifted since the plan was written. Anything not in this table should be cross-checked against the "Do NOT touch" list.

Quick re-survey command (production code only, all three in-scope packages):

```bash
rg -c "console\.(log|warn|error|info|debug)" \
  packages/server/src packages/tools/src packages/cli/src \
  --type ts \
  --glob "!**/*.test.ts" --glob "!**/*.bench.test.ts" \
  --glob "!**/scripts/**" --glob "!**/.storybook/**"
```

Then strip these expected-to-remain hits before working from the list: `logMessage.ts`, `logBuildBanner.ts`, `generateInternalApiSchemas.ts`, `generateExternalApiSchemas.ts`, and `cli.ts`'s `console.time`/`console.timeEnd` pair.

### Suggested commit shape

Group commits by concern so review stays readable:
1. `chore(server): app-commands → structured logInfo`
2. `chore(server): cli-spawn-operations → structured log helpers`
3. `chore(server): tools → structured log helpers`
4. `chore(server): api routes + jobRunner + logCapture → structured log helpers`
5. `chore(cli): cli-commands + uncaughtException handler → structured log helpers`

That keeps reviewers from drowning in a 60+ call diff.

---

## Tests (per test-coverage discipline)

This is a **refactor-only** sweep — no behavior change. Coverage discipline still applies:

- **No new functional tests** required. The behavior under test (rendered log strings) is incidental to the cleanup.
- **Update any test that asserts the literal `console.log` call** with `captureConsoleMessage` or `vi.spyOn(console, "log")`. After conversion the call goes through the structured logger, so the spy target changes. Common pattern: a test in `*.test.ts` that does `expect(consoleLogSpy).toHaveBeenCalledWith(...)` — switch the spy to the structured-logging test helper added in worker 41 (or capture via `vi.spyOn` on the logger's sink).
- The pre-merge gate (`yarn test`) must stay green. If a test was asserting against a tag-stripped console line, it should now assert against the structured `{ tag, content }` shape.
- The `captureConsoleMessage` helper itself stays — it captures console output, which the structured logger still ultimately calls. Don't rewrite the helper.

---

## TDD steps

1. Run the survey first to confirm the per-file counts. Generate a fresh table; if a file moved counts, the plan is stale, not the work.
2. Pick one bucket (e.g. cli-spawn-operations). For each file:
   - Read the file to understand what each `console.*` is reporting.
   - Pick (or coin) an uppercase tag that matches the action being logged.
   - Run `yarn workspace @mux-magic/server test` after each file's batch — the spawn-op tests are the most likely to assert on console capture.
3. Repeat for app-commands, then tools, then api routes.
4. After each bucket, commit + push so review can start incrementally.
5. Full gate at the end.

---

## Files

**Modify:** all files listed in the per-file counts table above (~31 files across `packages/server/src/`, `packages/tools/src/` (if any survey hits), and `packages/cli/src/`).

**Do not modify:** anything in the "Do NOT touch" list. If you find a borderline case (e.g. a `console.error` inside a script that wraps a long-running process and you think the developer would benefit from structured output), call it out in the PR description rather than deciding unilaterally.

---

## Verification checklist

- [ ] Worker 41 ✅ merged before starting (it is — worker 41 is done)
- [ ] Worktree created
- [ ] Manifest row → `in-progress`
- [ ] Survey re-run; per-file counts confirmed
- [ ] Each bucket landed as its own commit
- [ ] `rg "console\.(log|warn|error|info|debug)" packages/server/src packages/tools/src packages/cli/src --type ts --glob "!**/*.test.ts" --glob "!**/*.bench.test.ts" --glob "!**/scripts/**" --glob "!**/.storybook/**"` returns ONLY files on the "Do NOT touch" list (`logMessage.ts`, `logBuildBanner.ts`, `generateInternalApiSchemas.ts`, `generateExternalApiSchemas.ts`) plus the `console.time`/`console.timeEnd` pair in `cli.ts`
- [ ] Existing tests still pass; spy targets updated where they asserted on `console.*` directly
- [ ] Standard gate clean
- [ ] PR opened
- [ ] Manifest row → `done`

## Out of scope

- `packages/web/**` (runtime UI) — see "Out of scope" up top. The frontend needs its own structured-logging bridge before a sweep is meaningful.
- Build / maintenance scripts in any package (see "Out of scope" up top). They print straight to the developer's terminal at build time; no trace ID needed.
- Removing `captureConsoleMessage` or its tests. The helper still has a legitimate role in capturing the logger's eventual `console.*` output for assertion.
- Changing the structured-logging implementation itself (worker 41 owns that).
- The startup banner (`logBuildBanner.ts`, runs pre-logger-init) and the `console.time`/`console.timeEnd` pair in `cli.ts` (no logger equivalent yet — call them out as a follow-up if they bug you).
