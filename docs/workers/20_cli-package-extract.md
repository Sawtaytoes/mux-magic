# Worker 20 — cli-package-extract

**Model:** Opus · **Thinking:** ON · **Effort:** High
**Branch:** `feat/mux-magic-revamp/20-cli-package-extract`
**Worktree:** `.claude/worktrees/20_cli-package-extract/`
**Phase:** 2 (CLI extraction — serial)
**Depends on:** All Phase 1 done (all Phase 1B workers merged)
**Parallel with:** Nothing — worker 21 depends on this one completing

---

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Tests must cover the change scope. Yarn only. See [AGENTS.md](../../AGENTS.md). Background context lives in [docs/PLAN.md §2](../PLAN.md).

---

## Your Mission

Extract the CLI layer out of `@mux-magic/server` into a new first-class monorepo package: `@mux-magic/cli`.

Today `@mux-magic/server` is two products in one: a **Hono HTTP API server** and a **yargs CLI**. They share the same `src/app-commands/` business logic, which is correct — but the CLI adapter layer (`src/cli.ts`, `src/cli-commands/`, `src/tools/initTaskSchedulerCli.ts`) lives alongside HTTP-only code like `src/api/hono-routes.ts`. This conflation makes it impossible to build a standalone CLI binary without dragging in Hono.

After this worker:

- `@mux-magic/cli` owns the CLI entrypoint and yargs adapters.
- `@mux-magic/server` retains `app-commands/` (the business logic) and the full HTTP layer.
- `@mux-magic/cli` declares `@mux-magic/server` as a dependency so it can import from `app-commands/`.
- Root `yarn media` script points to `@mux-magic/cli`.
- SEA build script continues to produce `dist/mux-magic.exe` from the new entry path.
- `@mux-magic/server` no longer lists CLI-only npm deps (yargs, cli-progress) in its `package.json`.

Worker 21 (observables-shared-split) runs after this one and may further redistribute rxjs patterns. Do **not** pre-empt its scope; leave observable utilities in server for now.

---

### Current structure (read before starting)

**Entry points in `packages/server/src/`:**
- [`src/cli.ts`](../../packages/server/src/cli.ts) — yargs entrypoint; imports all 40 CLI commands from `./cli-commands/`; calls `initTaskSchedulerCli()` (concurrency = 1, sequential)
- [`src/server.ts`](../../packages/server/src/server.ts) — Hono HTTP server; calls `initTaskScheduler(MAX_THREADS)` (parallel)

**Files to move into the new package:**
- `packages/server/src/cli.ts` → `packages/cli/src/cli.ts`
- `packages/server/src/cli-commands/` (40 files) → `packages/cli/src/cli-commands/`
- `packages/server/src/tools/initTaskSchedulerCli.ts` → `packages/cli/src/tools/initTaskSchedulerCli.ts`

**Files that stay in server (do not move):**
- `src/app-commands/` — shared business logic imported by both CLI and HTTP layer
- `src/api/` — HTTP-only (Hono routes, jobStore, sequenceRunner, etc.)
- `src/server.ts` — HTTP server entry
- `src/tools/taskScheduler.ts` — shared; imported by both server and (via import chain) CLI

**Root scripts to update (in `package.json`):**
- `yarn media` → currently `yarn workspace @mux-magic/server cli` → change to `yarn workspace @mux-magic/cli cli`
- `yarn cli-app:build` / `yarn cli-app:sea` — update entry path if needed

---

### Implementation steps

#### 1. Create `packages/cli/` scaffold

Create the following files. Verify `packages/` directory exists before creating.

**`packages/cli/package.json`:**

```json
{
  "name": "@mux-magic/cli",
  "version": "1.0.0",
  "description": "Mux-Magic command-line interface for batch media file operations.",
  "type": "module",
  "scripts": {
    "cli": "tsx src/cli.ts",
    "build": "tsc --noEmit"
  },
  "dependencies": {
    "@mux-magic/server": "*",
    "@mux-magic/tools": "*",
    "chalk": "<match server's version>",
    "cli-progress": "<match server's version>",
    "yargs": "<match server's version>"
  },
  "devDependencies": {
    "tsx": "<match server's version>",
    "typescript": "<match server's version>"
  }
}
```

Read `packages/server/package.json` first to copy exact dependency versions for `chalk`, `cli-progress`, `yargs`, `tsx`, and `typescript`. Do not guess version numbers.

**`packages/cli/tsconfig.json`:**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"]
}
```

Verify the root `tsconfig.json` exists and check what the server's `tsconfig.json` extends so the CLI mirrors the same base config.

#### 2. Move CLI files

Use `git mv` (not a plain copy) to preserve history on each file:

```powershell
git mv packages/server/src/cli.ts packages/cli/src/cli.ts
git mv packages/server/src/cli-commands packages/cli/src/cli-commands
git mv packages/server/src/tools/initTaskSchedulerCli.ts packages/cli/src/tools/initTaskSchedulerCli.ts
```

If `packages/cli/src/` or `packages/cli/src/tools/` don't exist yet, create them as empty directories before the `git mv` (git requires the destination to exist for directory moves).

#### 3. Fix imports in moved files

After moving, imports in `packages/cli/src/cli.ts` and each cli-command file will break because they previously used relative paths into the server package. Update them:

- Imports from `../app-commands/` (business logic) → `@mux-magic/server/src/app-commands/` or use the server's exported barrel. **Investigate first:** check whether `packages/server/package.json` has an `exports` field or main entry that exposes `app-commands`. If not, add a barrel export to server before importing from the CLI package.
- Imports from `../tools/taskScheduler` → `@mux-magic/server/src/tools/taskScheduler` (or the barrel).
- Imports from `./initTaskSchedulerCli` (within cli.ts) → `./tools/initTaskSchedulerCli` (updated relative path).
- Imports from `@mux-magic/tools` — unchanged (package reference already correct).

**Add a server barrel export if missing.** If server doesn't already export `app-commands` via its `package.json` `exports` field, add one:

```json
// packages/server/package.json — add or extend "exports":
{
  "exports": {
    ".": "./src/server.ts",
    "./app-commands/*": "./src/app-commands/*.ts",
    "./tools/*": "./src/tools/*.ts"
  }
}
```

Adjust paths to match the actual file layout. Do not add exports that don't exist.

#### 4. Update `initTaskSchedulerCli.ts` import

This file imports `initTaskScheduler` from `../tools/taskScheduler`. After the move it's at `packages/cli/src/tools/initTaskSchedulerCli.ts`, so fix the relative import to go through the package reference:

```ts
import { initTaskScheduler } from "@mux-magic/server/tools/taskScheduler"
```

#### 5. Remove CLI deps from server

In `packages/server/package.json`, remove any dependencies that are now exclusively owned by `@mux-magic/cli`. Specifically:

- `yargs` and its types — check that no server-side file (outside the moved files) imports yargs. Grep: `grep -r "yargs" packages/server/src/` (excluding the now-moved files).
- `cli-progress` — same check.
- `chalk` — check carefully. It may be used in server-side utilities (`@mux-magic/tools` or `packages/server/src/tools/`). Only remove if the grep confirms zero remaining usages in server.

#### 6. Update root scripts

In the root `package.json`:

```diff
-  "media": "yarn workspace @mux-magic/server cli",
+  "media": "yarn workspace @mux-magic/cli cli",
```

For `cli-app:build` and `cli-app:sea`: read the current scripts carefully. If they reference `packages/server/src/cli.ts` as the esbuild entry, update to `packages/cli/src/cli.ts`. Keep everything else (output path `dist/mux-magic.exe`, external flags, etc.) identical.

#### 7. Add `packages/cli` to root workspaces

The root `package.json` likely has `"workspaces": ["packages/*"]` which already includes the new package. Verify this; if it's an allowlist instead, add `packages/cli`.

#### 8. Install and verify linkage

Run `yarn install` from the repo root. This links `@mux-magic/cli`'s dep on `@mux-magic/server` via the workspace protocol. Verify with:

```powershell
yarn workspaces info
```

Confirm `@mux-magic/cli` lists `@mux-magic/server` as a workspace dependency.

---

## Tests (per test-coverage discipline)

This is a **structural refactor** — the business logic doesn't change. Tests should prove the refactored wiring works:

- **Unit (CLI package):** `initTaskSchedulerCli` initializes the scheduler with concurrency `1`. This is already tested in server; migrate the test to `packages/cli/src/tools/initTaskSchedulerCli.test.ts`.
- **Integration (CLI package):** Spawn the CLI entry (`yarn workspace @mux-magic/cli cli --help`) and assert it exits 0 and prints expected command names. Tests the whole import chain from `cli.ts` → `cli-commands` → `@mux-magic/server/app-commands` without a real HTTP server.
- **Integration (server):** `yarn workspace @mux-magic/server dev:server` still starts without error (the server no longer imports anything from cli). This can be a boot-smoke integration test that starts the server, hits `GET /health` (or equivalent), and exits.
- **e2e:** Run `yarn media --help` via the root script; verify exit 0 and command list matches the pre-refactor baseline.

Do **not** add snapshot tests. Assert specific command names inline.

---

## TDD steps

1. Write failing integration test: CLI package `--help` outputs expected command names. Commit as `test(cli): failing bootstrap integration test`.
2. Write failing server smoke test: server starts; `GET /health` returns 200. Commit.
3. Create the `packages/cli/` scaffold (package.json, tsconfig.json).
4. `git mv` the three file groups; fix imports.
5. Add server barrel exports.
6. Run `yarn install`; iterate until `yarn workspace @mux-magic/cli cli --help` passes.
7. Remove CLI-only deps from server package.json; verify server smoke test still passes.
8. Update root scripts; run `yarn media --help` e2e test.
9. Run full gate: `yarn lint → yarn typecheck → yarn test → yarn e2e → yarn lint`.

---

## Files

**Create (new package):**
- `packages/cli/package.json`
- `packages/cli/tsconfig.json`

**Move via `git mv` (source → destination):**
- [packages/server/src/cli.ts](../../packages/server/src/cli.ts) → `packages/cli/src/cli.ts`
- [packages/server/src/cli-commands/](../../packages/server/src/cli-commands/) → `packages/cli/src/cli-commands/`
- [packages/server/src/tools/initTaskSchedulerCli.ts](../../packages/server/src/tools/initTaskSchedulerCli.ts) → `packages/cli/src/tools/initTaskSchedulerCli.ts`

**Modify:**
- [packages/server/package.json](../../packages/server/package.json) — remove CLI-only deps; add `exports` field
- [package.json](../../package.json) — update `yarn media`, `cli-app:build`, `cli-app:sea` scripts

**Possibly modify (if they import yargs or cli-commands):**
- Any file in [packages/server/src/](../../packages/server/src/) that imported the moved files — grep and fix

---

## Verification checklist

- [ ] All Phase 1 workers ✅ merged before starting
- [ ] Worktree created
- [ ] Manifest row → `in-progress`
- [ ] Failing integration tests committed first
- [ ] `packages/cli/package.json` and `tsconfig.json` created
- [ ] `git mv` used (not plain file copy); history preserved
- [ ] Imports in moved files updated to use `@mux-magic/server` package references
- [ ] Server barrel `exports` added for `app-commands/` and `tools/`
- [ ] `yarn install` succeeds; `yarn workspaces info` shows `@mux-magic/cli → @mux-magic/server` link
- [ ] `yarn workspace @mux-magic/cli cli --help` exits 0 and lists all commands
- [ ] `yarn media --help` exits 0 (root script points to new package)
- [ ] Server still boots; `GET /health` returns 200 (server has no CLI imports)
- [ ] `yargs` and `cli-progress` removed from server `package.json` (if grep-confirmed safe)
- [ ] SEA build script (`yarn cli-app:build`) points to new entry and produces `dist/mux-magic.exe`
- [ ] Standard gate clean: `yarn lint → typecheck → test → e2e → lint`
- [ ] PR opened against `feat/mux-magic-revamp`
- [ ] Manifest row → `done`

## Why Opus

Per the plan's model-recommendation confidence table: this worker is in the "Low — model uncertain" bucket. Opus is chosen because:

1. **Import graph rewiring across package boundaries** — getting TypeScript to resolve cross-workspace imports correctly (especially with an `exports` field and path aliases) is fiddly; a wrong assumption silently compiles but fails at runtime.
2. **Dependency removal safety** — incorrectly removing `chalk` or another dep from server could break the HTTP server at runtime in a way that's hard to trace.
3. **git mv + import fixing** — 40+ files with import paths that need updating; the risk of missing one or using the wrong resolution strategy is real.

If the user prefers Sonnet/High, budget extra time for a careful audit pass of every import in the moved files before declaring done.
