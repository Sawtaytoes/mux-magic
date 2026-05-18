# Worker 2d — split `@mux-magic/server` into `@mux-magic/core` + `@mux-magic/api`

**Model:** Sonnet · **Thinking:** ON · **Effort:** High
**Branch:** `feat/mux-magic-revamp/2d-split-server-into-core-and-api`
**Worktree:** `.claude/worktrees/2d_rename-server-package-to-api/`
**Phase:** 4
**Depends on:** — (mechanical refactor; no logical prerequisites)
**Parallel with:** any worker that doesn't import from `@mux-magic/server/src/...` or touch `packages/server/`. **Block any in-flight worker that's adding new imports of `@mux-magic/server/...` during this rename window.** Coordinate via the MANIFEST.

**Blocks:** worker [29](29_merge-web-into-api-server.md) — that worker introduces a new `packages/server/` (single-port front-door) and consumes both packages this worker produces.

> **Filename note.** This file is `2d_rename-server-package-to-api.md` for ID-stability reasons (workers never renumber, never re-slug). The actual scope is a two-package split; the filename slug is stale. Read the worker title above for the real scope.

## Universal Rules (TL;DR)

Worktree-isolated. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. No new tests required, but every gate must stay green after each commit. Yarn only. Worker flips its own MANIFEST row at start (`in-progress`) and after merge (`done`).

---

## Your Mission

Split today's `packages/server/` into two workspace packages with honest layering:

- **`packages/core/`** (`@mux-magic/core`) — pure mux-magic-specific domain logic. No HTTP framework deps. Contains everything from today's `packages/server/src/` EXCEPT the `api/` subdir. CLI depends on this package and nothing else mux-magic-specific (except `@mux-magic/tools`).
- **`packages/api/`** (`@mux-magic/api`) — Hono routes, OpenAPI config, CORS, route handlers. Depends on `@mux-magic/core`. Exports the `OpenAPIHono app`. NO listener / no `serve()` call / no `bin`.

The new `packages/server/` package introduced by worker 29 will depend on both. The CLI depends on `core` only (no transitive Hono in its bundle).

### Target file movement

| Today | New home | Notes |
|---|---|---|
| `packages/server/src/api/**` | `packages/api/src/api/**` | Stays under `api/` subdir for path stability; this IS the HTTP layer |
| `packages/server/src/app-commands/**` | `packages/core/src/app-commands/**` | The pure command implementations |
| `packages/server/src/tools/**` | `packages/core/src/tools/**` | Mux-magic-specific helpers (envVars, pathSafety, iso6392, subscribeCli, …) |
| `packages/server/src/cli-spawn-operations/**` | `packages/core/src/cli-spawn-operations/**` | ffmpeg/mkvtoolnix wrappers |
| `packages/server/src/types/**` | `packages/core/src/types/**` | Domain types |
| `packages/server/src/index.ts` (the `serve()` call) | **Deleted entirely** — worker 29's new `packages/server/` owns the listener | Or: temporary `packages/api/src/legacy-listener.ts` bridge IF this worker needs to ship before 29 in a runnable state |

**Important — listener bridge decision.** If you can land worker 2d and worker 29 in immediate succession (same session, two PRs), delete the listener entirely in 2d and let worker 29 introduce the new front-door. If 2d must merge with a runnable container between 2d and 29, create a temporary `packages/api/src/legacy-listener.ts` with a header comment marking it as worker-29-fodder. Default: **delete entirely** and pair the worker spawns.

### Why the split (not just a rename)

The maintainer chose this option over a plain rename because the CLI today transitively pulls in Hono + OpenAPIHono + Zod-OpenAPI + `@hono/node-server` just because they live in the same workspace package as the command logic. Splitting makes the dep graph match reality:

- CLI's package.json after the split lists `@mux-magic/core` + `@mux-magic/tools` — no HTTP framework deps.
- API's package.json after the split lists `@mux-magic/core` + Hono — it's clear from the manifest that this package's job is "wrap core with HTTP."
- Future-proofs publishing `@mux-magic/core` to npm so external tools could drive mux-magic non-interactively without spinning up the HTTP layer.

`@mux-magic/tools` (cross-tool reusable helpers, published to npm per worker 39) stays untouched. The boundary becomes:

```text
@mux-magic/tools  ← cross-tool reusable, published, no mux-magic awareness
@mux-magic/core   ← mux-magic-specific domain logic, no HTTP
@mux-magic/api    ← Hono routes wrapping core
@mux-magic/cli    ← consumes core (+ tools)
@mux-magic/web    ← consumes core (for types) + api (via HTTP)
@mux-magic/server ← new in worker 29; consumes core + api
```

---

## Step-by-step

### Phase A — Stand up `packages/core/` (commits 1–3)

1. **Create `packages/core/` skeleton.**
   - `packages/core/package.json` with `"name": "@mux-magic/core"`, `"type": "module"`, deps mirroring today's `packages/server/package.json` MINUS Hono / `@hono/*` / Zod-OpenAPI / anything else that exists only to support the HTTP layer.
   - `packages/core/tsconfig.json` mirroring `packages/server/tsconfig.json`.
   - `packages/core/vitest.config.ts` mirroring server's.
   - Update root `package.json` if workspaces glob doesn't auto-include `packages/*` (it should).

2. **Move the four non-api subdirs.**
   > **NOTE:** Like worker 39, the user performs the actual directory moves in VSCode (smart-rename auto-updates many import paths). After the user's move pass, this worker resumes.
   - `packages/server/src/app-commands/` → `packages/core/src/app-commands/`
   - `packages/server/src/tools/` → `packages/core/src/tools/`
   - `packages/server/src/cli-spawn-operations/` → `packages/core/src/cli-spawn-operations/`
   - `packages/server/src/types/` → `packages/core/src/types/`
   - Move co-located test files too (`*.test.ts`, `*.spec.ts`).

3. **Fix imports + verify.**
   - Grep for `packages/server/src/(app-commands|tools|cli-spawn-operations|types)/` — fix anything VSCode missed.
   - `yarn install` → `yarn typecheck`. The `packages/server/src/api/` files still reference the moved modules; they now need to import them as `@mux-magic/core/src/...` instead of relative paths. This is the main churn of Phase A.

Commit: `feat(core): extract pure domain layer from packages/server/ into packages/core/`

### Phase B — Rename remaining `packages/server/` → `packages/api/` (commits 4–5)

4. **Rename the now-thinned package directory.**
   - `packages/server/` (now containing only `src/api/` + the `serve()` entry point) → `packages/api/`.
   - `packages/api/package.json#name`: `@mux-magic/server` → `@mux-magic/api`. Add `"dependencies": { "@mux-magic/core": "workspace:*", "@mux-magic/tools": "workspace:*" }`.
   - `packages/api/tsconfig.json` paths block if any.
   - Grep for `packages/server/` anywhere in repo (TS, JSON, MD, CI workflows, scripts) → fix.

5. **Sweep import paths.**
   - `@mux-magic/server/src/api/` → `@mux-magic/api/src/api/` (the routes themselves)
   - `@mux-magic/server/src/(app-commands|tools|cli-spawn-operations|types)/` → `@mux-magic/core/src/$1/`
   - This is ~50+ import sites in `packages/cli/src/cli-commands/` alone (grep summary from worker 29's design thread). Use `Edit --replace_all` per file or a scripted multi-Edit pass for batches >10.
   - Update consumer package.json deps:
     - `packages/cli/package.json` — drop `@mux-magic/server`, add `@mux-magic/core`.
     - `packages/web/package.json` — `@mux-magic/server` → `@mux-magic/core` (web imports types) and `@mux-magic/api` (web may import OpenAPI client types).
     - Root `package.json` — anywhere `@mux-magic/server` is listed.
   - `yarn install` → `yarn typecheck` → `yarn test`. All green before commit.

Commit: `refactor: split server imports — @mux-magic/server/src/* → @mux-magic/{core,api}/src/*`

### Phase C — Listener removal (commit 6)

6. **Drop the `serve()` listener from `@mux-magic/api`.**
   - Today the listener lives somewhere like `packages/server/src/index.ts` (verify path). After Phase B it's `packages/api/src/index.ts`.
   - **Default: delete the file entirely.** Worker 29 introduces the new `packages/server/` front-door that owns the listener. If 2d and 29 land back-to-back, deletion is the right move.
   - **Alternative: write `packages/api/src/legacy-listener.ts`** if a runnable interim state is needed. Header comment:
     > Temporary listener bridge between worker 2d (core+api split) and worker 29 (single-port front-door). Worker 29 deletes this file when the new @mux-magic/server takes over the listener role. Do not extend this file.
   - Update [scripts/start-prod.cjs](../../scripts/start-prod.cjs) and the Dockerfile CMD to whatever path is current. **Note:** worker 29 deletes `start-prod.cjs` entirely, so any path-fixup you do here is short-lived.

Commit: `refactor(api): drop listener — @mux-magic/api exports app only (worker 29 takes over the listener)`

### Phase D — Scripts / Docker / docs (commits 7–8)

7. **Build scripts / Docker / orchestration.**
   - Root [package.json](../../package.json) — script names:
     - `build:server-bundle` → `build:api-bundle` (path stays at the renamed dir).
     - `dev:api-server` — name stays (it really means "API HTTP server"); update underlying path to `packages/api/`.
     - Add `build:core-bundle` only if a separate bundle is needed; usually `core` ships as TypeScript source consumed by the bundlers of its dependents.
   - [Dockerfile](../../Dockerfile) — any `COPY packages/server/` or path references.
   - [scripts/start-prod.cjs](../../scripts/start-prod.cjs) — update API bundle path to the new location. Worker 29 will then delete this file outright; do not invest effort polishing it.
   - `.github/workflows/*` — grep for `packages/server`.

8. **Docs sweep.**
   - [AGENTS.md](../../AGENTS.md) + `docs/agents/*.md` — every `packages/server/` and `@mux-magic/server` reference. Push detail into focused docs under `docs/agents/*.md` rather than inflating AGENTS.md (per the loaded-into-every-conversation rule).
   - [docs/workers/MANIFEST.md](MANIFEST.md) Tracks table — current row: `srv` owns `packages/server/**`. Update to: `srv` owns `packages/core/**` and `packages/api/**`. (Track abbreviation `srv` stays — renaming it across hundreds of worker rows is churn for its own sake.)
   - [docs/workers/PLAN.md](PLAN.md) if it mentions the package by name.
   - [README.md](../../README.md) — package list, surface-area paths, any `@mux-magic/server` mentions.

Commit: `chore: sweep packages/server / @mux-magic/server references in scripts, Dockerfile, docs`

### Phase E — Final gate sweep (commit 9 if needed)

- `yarn lint → typecheck → test → e2e → lint` from a clean checkout. Each gate must pass.
- Spot-check the CLI bundle (`yarn build:cli` then `du -sh packages/cli/dist/`) — should shrink noticeably now that Hono isn't in its transitive deps. If it doesn't, dig into why (probably tree-shaking was already eliminating it; the dep-graph honesty win stands either way).
- If any in-flight worker landed new `@mux-magic/server` imports during 2d's window, fix them.

Commit (only if needed): `fix: catch up imports landed during 2d in-flight window`

---

## Files

**Created**

- [packages/core/package.json](../../packages/core/package.json)
- [packages/core/tsconfig.json](../../packages/core/tsconfig.json)
- [packages/core/vitest.config.ts](../../packages/core/vitest.config.ts)
- [packages/core/src/app-commands/](../../packages/core/src/app-commands/) (moved)
- [packages/core/src/tools/](../../packages/core/src/tools/) (moved)
- [packages/core/src/cli-spawn-operations/](../../packages/core/src/cli-spawn-operations/) (moved)
- [packages/core/src/types/](../../packages/core/src/types/) (moved)
- [packages/api/](../../packages/api/) — directory renamed from `packages/server/` minus the moved subdirs

**Modified**

- [packages/api/package.json](../../packages/api/package.json) — new name, new deps on `@mux-magic/core`.
- [packages/api/src/api/**](../../packages/api/src/api/) — every internal import that pointed at `../app-commands/...` etc. now points at `@mux-magic/core/src/...`.
- [packages/cli/src/cli-commands/*.ts](../../packages/cli/src/cli-commands/) — every `@mux-magic/server/src/...` import.
- [packages/cli/package.json](../../packages/cli/package.json), [packages/web/package.json](../../packages/web/package.json), [package.json](../../package.json) — dep entries.
- [Dockerfile](../../Dockerfile), [scripts/start-prod.cjs](../../scripts/start-prod.cjs), `.github/workflows/*`.
- [docs/workers/MANIFEST.md](MANIFEST.md) tracks table.
- [AGENTS.md](../../AGENTS.md) + `docs/agents/*.md`.
- [README.md](../../README.md).

**Deleted**

- `packages/server/` (no longer exists — split between `packages/core/` and `packages/api/`).
- The `serve()` listener file from the old package (deleted entirely; worker 29 owns the new listener).

## Out of scope

- Any behavioral / architectural change. Strictly a structural refactor.
- CORS comment rewrites referencing split-host posture — worker 29 owns that since the posture itself changes there.
- `REMOTE_SERVER_URL` rename, `WEB_PORT` removal, etc. — all owned by worker 29.
- Renaming the `srv` MANIFEST track abbreviation.
- Bundling `@mux-magic/core` for npm publish — possible follow-up if external consumers materialize, but no consumer asks for it today.

## Why this exists

Two reinforcing reasons:

1. **Honest layering for the CLI.** The CLI today transitively bundles Hono and `@hono/zod-openapi` purely because they sit in the same workspace package as the command logic it actually uses. Splitting forces the dep graph to match reality — CLI depends only on `@mux-magic/core` (+ `@mux-magic/tools`). Bundle-size win is bonus; the architectural clarity is the goal.
2. **Unblocks worker 29 cleanly.** Worker 29 introduces a new `packages/server/` as the single-port front-door. The workspace can't have two `server` packages. Splitting first means worker 29 consumes `core` + `api` and adds the front-door process without any naming collision or transitional state. Worker 29 also gets to delete the listener file outright instead of routing around it.

The user picked split-over-rename specifically to get CLI out of the HTTP-framework dep graph and to leave room for publishing `core` to npm in the future. This worker delivers that structure; worker 29 then mounts the new architecture on a single port.
