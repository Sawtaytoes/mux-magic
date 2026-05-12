# Worker 1f — mux-magic-anime-manga-commands

**Model:** Sonnet · **Thinking:** ON · **Effort:** High
**Branch:** `feat/mux-magic-revamp/1f-anime-manga-commands`
**Worktree:** `.claude/worktrees/1f_mux-magic-anime-manga-commands/`
**Phase:** 1B cross-repo
**Depends on:** 01
**Parallel with:** all other 1B workers

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Yarn only. See [AGENTS.md](../../AGENTS.md).

## Your Mission

Add new commands to Mux-Magic for **copying / renaming anime + manga files with "delete originals only if sequence succeeded" semantics**. The user's task list noted: *"We'll need a way to copy over anime/manga and rename files as we don't currently have that. Deleting the original files only if all the other tasks completed should be easy."*

HA orchestrates the full flow:
1. HA triggers Gallery-Downloader → downloads new anime/manga
2. Gallery-Downloader webhooks completion to HA
3. HA triggers Mux-Magic with a sequence that includes the new commands → copies + renames into final library
4. Mux-Magic sequence completes successfully → originals deleted as the last step

### New commands

Two new commands (or one with options — discuss):
- `copyAnime` / `copyManga` — copy files from staging dir to library dir with anime/manga-specific renaming heuristics
- `cleanupOriginals` — runs only if previous steps succeeded; deletes the source files

Or a unified `transferMedia` command with `type: "anime" | "manga"` and `shouldDeleteOriginals: boolean` (which has built-in dependency on prior steps succeeding).

**Open question for user:** prefer separate commands or a unified one? Default to two separate (`copyAnime`, `copyManga`) plus a single `cleanupOriginalsIfSucceeded` that any sequence can append.

### Renaming heuristics

Anime files often need:
- Episode number normalization (`E01` vs `Episode 1` vs `S01E01`)
- Source-tag stripping (e.g. `[Group] Title - 01 [BD 1080p].mkv` → `Title - 01.mkv`)

Manga files often need:
- Volume / chapter consistency (`Vol 1 Ch 1` → `v01c001`)
- Series-name normalization

**This worker scope:** structural commands + interface. Heuristics can be minimal v1 (use existing naming patterns from `nameSpecialFeatures` or `nameAnimeEpisodes` as reference). Aggressive heuristics improvement is out of scope for this worker (file followup workers).

### Sequence-success gating

`cleanupOriginalsIfSucceeded` reads the running sequence's prior step states. If any prior step failed, it's a no-op (and logs why). If all succeeded, it deletes.

Implementation: query the sequence's step state from the job-runner observable chain. Or — simpler — add a sequence-level "on success" hook and run cleanup there.

### Files

- New: `packages/server/src/cli-commands/copyAnimeCommand.ts`
- New: `packages/server/src/app-commands/copyAnime.ts`
- New: `packages/server/src/cli-commands/copyMangaCommand.ts`
- New: `packages/server/src/app-commands/copyManga.ts`
- New: `packages/server/src/cli-commands/cleanupOriginalsIfSucceededCommand.ts`
- New: `packages/server/src/app-commands/cleanupOriginalsIfSucceeded.ts`
- Possibly: sequence-runner hook for on-success steps in `packages/server/src/api/sequenceRunner.ts`
- Web UI: command cards auto-render from schema
- Tests for each

## TDD steps

1. Failing tests for each new command (round-trip: schema parse, handler with fixture files, output verification).
2. Implement commands.
3. Implement (or extend) the success-gating mechanism.
4. Verify e2e: a full sequence (download → copy → cleanup) completes correctly; intentionally failing a middle step blocks cleanup.

## Verification checklist

- [ ] Worktree created
- [ ] Manifest row → `in-progress`
- [ ] User decided on separate-vs-unified commands (default: separate)
- [ ] Failing tests first
- [ ] New commands implemented + schemas registered
- [ ] Success-gating works (test: middle step fails → cleanup is no-op)
- [ ] Web UI auto-renders new command cards (run `yarn build:command-descriptions`)
- [ ] Standard gate clean
- [ ] PR opened
- [ ] Manifest row → `done`

## Out of scope

- Smart heuristics for anime/manga naming (v1 = minimal; followup workers tune)
- Integration with TheTVDB / AniDB beyond what already exists
- Library-management UI (separate concern)
- Implementing the HA-side YAML that orchestrates this (user does that)
