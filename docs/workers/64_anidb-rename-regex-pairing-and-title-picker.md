# Worker 64 (remaining) — anidb `seriesName` title-picker + `seriesFolderName` output

**Model:** Sonnet · **Thinking:** ON · **Effort:** High
**Base branch:** `master` (see [Base-branch flux](#base-branch-flux) — `feat/mux-magic-revamp` is being retired by PR #173)
**Worktree:** create your own with native `git worktree add` off `master`. The Agent
`isolation: "worktree"` mode does **not** work in this environment; native worktrees do.
**Phase:** 4 (follow-up)
**Status:** Part **(A) is SHIPPED** (this doc covers the remaining **(B)** and **(C)**).

## What already shipped — do NOT redo part (A)

Part **(A)** of this worker — the `filenameRegex` (pair files to AniDB episodes by an
`(?<episodeNumber>…)` named group) **plus** a `startEpisodeNumber` index-offset — landed
in **PR #170** (`feat(anidb): name partial episode sets via filenameRegex / startEpisodeNumber`),
merged to `master`. It's live in production (Sequence Builder shows *Filename Regex* /
*Start Episode Number* fields). The exported, unit-tested helpers live in
[`packages/core/src/app-commands/nameAnimeEpisodesAniDB.ts`](../../packages/core/src/app-commands/nameAnimeEpisodesAniDB.ts):
`compileFilenameRegex`, `extractEpisodeNumberFromFilename`, `pairEpisodeToFileIndex`
(tests in the sibling `nameAnimeEpisodesAniDB.test.ts`).

## STOP — before writing any code

1. **Confirm nobody's already on B/C.** As of **2026-08-03 ~06:00Z** there was no branch,
   PR, or code for it — but re-check at pickup:
   - `gh pr list --repo Sawtaytoes/mux-magic --state open`
   - `git ls-remote --heads origin | grep -iE '64|series|title|picker'`
   - `git grep -iE 'AnidbTitlePicker|seriesFolderName|lookups/anidb/.*titles' origin/master`
   - MANIFEST row 64 status column.
   If any of these hit, coordinate with that session — don't duplicate.
2. Read [AGENTS.md](../../AGENTS.md) and the pre-merge gate below.

## Base-branch flux (read this)

The branching/deploy model is changing **right now**:
- **PR #173** (`docs: master is the only base branch; retire feat/mux-magic-revamp`) is
  open. Historically workers merged into `feat/mux-magic-revamp` and **production ran the
  `ghcr.io/sawtaytoes/mux-magic:feat-mux-magic-revamp` image**, NOT `:latest`.
- Confirm the current state at pickup: if #173 is merged, base off `master`, target
  `master`, and prod tracks `:latest`. If not yet, you may still need to land on
  `feat/mux-magic-revamp` to deploy. **Check before you deploy** — don't assume `:latest`
  is prod.
- **Redeploying the app** (after CI's Docker Deploy pushes the image): on the TrueNAS host,
  `ssh root@storeman.octen` then
  `midclt call app.pull_images mux-magic '{"redeploy": true}'` (returns a job id; poll
  `core.get_jobs`). Verify afterward: `docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' ix-mux-magic-mux-magic-1 | grep GIT_SHA`
  should match your commit, and `docker exec … grep -rl <newSymbol> /app` should find your
  code in the running bundle. **Production deploy is owner-gated — confirm before cutover.**

## Your mission (parts B + C)

Both extend `nameAnimeEpisodesAniDB` — see the MANIFEST row 64 for the original framing.

### (B) `seriesName` override + AniDB title-picker UI

- **New optional `seriesName` param** overrides AniDB's auto-picked title. Today the series
  name comes from `pickAnidbSeriesName`
  ([`packages/core/src/tools/searchAnidb.ts:66`](../../packages/core/src/tools/searchAnidb.ts#L66));
  when `seriesName` is provided, use it verbatim instead. Thread it through the same five
  layers part (A) touched:
  - schema: `nameAnimeEpisodesAniDBRequestSchema` in
    [`packages/api/src/api/schemas.ts`](../../packages/api/src/api/schemas.ts) (~the block
    that now has `filenameRegex`/`startEpisodeNumber`).
  - core: the `nameAnimeEpisodesAniDB` param destructure + where `seriesName` is derived.
  - API route: `nameAnimeEpisodesAniDB` entry in
    [`packages/api/src/api/routes/commandRoutes.ts`](../../packages/api/src/api/routes/commandRoutes.ts).
  - CLI: [`packages/cli/src/cli-commands/nameAnimeEpisodesAniDBCommand.ts`](../../packages/cli/src/cli-commands/nameAnimeEpisodesAniDBCommand.ts).
  - web form: the AniDB block in [`packages/web/src/commands/commands.ts`](../../packages/web/src/commands/commands.ts).
- **New `AnidbTitlePickerField` web component.** A free-text input (editable — it is the
  source of truth) paired with a **"Load titles from AniDB"** button that fetches the
  candidate titles into a dropdown; picking one drops it into the input, then the user
  can character-clean it. Preserve AniDB's actual form verbatim (e.g. its backtick
  apostrophe in `Hell\`s Paradise Season 2`) — the user edits from there. Filter out the
  synthetic `(aXXXXX)` title form. Model it on the existing `anidbId` lookup pattern
  (`type: "numberWithLookup"`, `lookupType: "anidb"`, `companionNameField: "anidbName"` in
  `commands.ts`) — this new field is that pattern's sibling for titles.
- **New server route `GET /api/lookups/anidb/:id/titles`** returning the anime's title
  candidates (there is no lookup-titles route yet — the existing lookup is search-by-name).
  Reuse `lookupAnidbById` (`searchAnidb.ts:139`) and the title shape it already parses.

### (C) `seriesFolderName` extractable output + graceful degrade

- **Emit `seriesFolderName: "{seriesName} [anidb-{anidbId}]"`** (Sonarr/Plex convention) as
  an **extractable/linkable output** of the command, so a downstream `copyFiles`/`moveFiles`
  step can consume it via `linkedTo`. Study how existing commands surface linkable outputs
  (the sequence runner's output resolution + `outputFolderName` pattern in
  [`addSubtitles.ts`](../../packages/core/src/app-commands/addSubtitles.ts); and the
  ID-variable/output plumbing from Worker 35 — `docs/workers/35_*.md`).
- **Tolerate missing episode titles when `filenameRegex` is in use** (currently-airing
  series whose AniDB titles aren't published yet): emit `Series - sXXeYY.mkv` **without**
  the ` - <title>` segment instead of skipping the file, and make it re-runnable later once
  titles exist. Today the index-paired branch does `logInfo("NO EPISODE TITLE", …)` and
  drops the file — change that to name-without-title when a title is absent.
- **Preserve any `versionNumber` capture** in the output filename (don't regress it).

## Pre-merge gate (must pass)

```
yarn install --immutable
yarn build:tools            # REQUIRED first, or typecheck/tests die on ERR_MODULE_NOT_FOUND
yarn lint:biome && yarn lint:eslint
yarn typecheck
yarn vitest run             # note: local storybook/browser tests need `yarn playwright install`
                            # (that one browser-launch failure is env-only; CI has the browser)
```

CI (`.github/workflows/ci.yml`) also runs **e2e**, **storybook-build**, and **build-budget**.
TDD: write the failing test first. Biome enforces `test(` not `it(` (Worker 56). Use
single-quoted strings when a literal contains escaped `"` (Biome will rewrite otherwise).

Web guards to satisfy: `packages/web/src/commands/commands.test.ts` (every server
`commandName` must have a `COMMANDS` entry) and the "every non-hidden field has a
description" regression test — a new field's description comes from its Zod `.describe()`.

## When done

- Add tests: extend `nameAnimeEpisodesAniDB.test.ts` (seriesName override, seriesFolderName
  formatting, name-without-title path) and a web test for the new field/component.
- Regenerate command descriptions if needed: `yarn build:command-descriptions`.
- Update MANIFEST row 64 status.
- Open a PR to `master` (or the confirmed base branch). Deploy is owner-gated.

## Cross-repo note

A user-facing anime-ingest runbook that uses this command lives in the **private** `agentic`
workspace repo at `docs/runbooks/mux-magic-anime-ingest-runbook.md` (it carries
homelab-specific paths, so it is intentionally NOT in this public repo). The generic
`examples/ingest-anime-episodes.yaml` here is the shareable version. If B/C change the
command's usage, update that runbook too.
