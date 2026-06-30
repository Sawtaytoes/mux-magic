# 2026-05-16 — Per-file pipelining is Shape 2 (rxjs operator); no `forEachFiles` group

- **Status:** Accepted
- **Date decided:** 2026-05-16 (design rewrite `6e2226db`); worker 38 (implementation `ready`)
- **Area:** core
- **Source:** worker 38 (`per-file-pipelining`), `docs/workers/38-sketches/`; memory `project_worker38_design.md`

## Decision

Every command handler is an **rxjs operator** over `Observable<FileContext>`: `(params, upstream$) => Observable<FileContext>`. The sequence runner is one `reduce → mergeMap` chain, so files stream through the sequence independently (file 1 can be on step 3 while file 2 is on step 1). Per-file pipelining is **always on** — there is no opt-in flag and no group construct. Each step has an optional `sourcePath`: set → start a fresh stream via `getFilesAtDepth`; omitted → inherit upstream. Solo HTTP/CLI callers reach the operator via the `wrapAsSourcePath` adapter. Order-dependent / duplicate-aware commands (`nameTvShowEpisodes`, `nameAnimeEpisodes*`, `nameSpecialFeaturesDvdCompareTmdb`, `nameMovieCutsDvdCompareTmdb`) internally `toArray()` (stream-breakers) — same signature, they just buffer first.

## What we rejected — DO NOT revert to this

- **Shape 1** — two coexisting handler contracts per command (folder-level + per-file). Rejected: dual maintenance, two code paths to test.
- **Shape 3** — an opt-in `forEachFiles` group kind. Rejected because it forces users to manage pipelining boundaries; the user explicitly does **not** want that. Note the near-miss: the AI first picked Shape 3 because a user message ended *"number 3 looks the best,"* but the user's actual reasoning (*"I like shape 2 the best," "I don't want users to manage this"*) meant **Shape 2**. Do not resurrect a `forEachFiles` construct, and do not conflate it with worker 42's unrelated `forEachFolder`.

## Why it must not be re-litigated

The single-contract, always-on model is the core architectural bet of Phase 4 — it eliminates the fork between solo-command and pipelined-sequence code paths and multiplies the value of the per-job thread budget. Re-introducing a second contract or an opt-in boundary undoes exactly that.
