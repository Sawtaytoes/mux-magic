# Worker 21 — observables-shared-split

**Model:** Sonnet · **Thinking:** ON · **Effort:** High
**Branch:** `feat/mux-magic-revamp/21-observables-shared-split`
**Worktree:** `.claude/worktrees/21_observables-shared-split/`
**Phase:** 2 (CLI extraction — serial)
**Depends on:** 20 (cli-package-extract)
**Parallel with:** Nothing — blocks Phase 3 and worker 38

---

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Tests must cover the change scope. Yarn only. See [AGENTS.md](../../AGENTS.md). Background context lives in [docs/PLAN.md §2](./PLAN.md).

---

## Your Mission

After worker 20 split the CLI off, three observable concerns still sit in `@mux-magic/server` even though both `@mux-magic/cli` and `@mux-magic/server` (and eventually worker 38's pipelining rewrite) all need them:

1. **`taskScheduler`** ([packages/server/src/tools/taskScheduler.ts](../../packages/server/src/tools/taskScheduler.ts)) — process-wide rxjs concurrency pool (`runTask`, `runTasks`, `runTasksOrdered`). CLI initializes it with concurrency 1; server with `MAX_THREADS`.
2. **Shared rxjs operators** — patterns reused across many app-commands but living in scattered files (e.g. error-handling pipes, the `scan`-counter pattern for de-duping renames, `getFilesAtDepth`-style traversal helpers).
3. **Domain-agnostic observable utilities** — anything that is *not* tied to mux-magic's HTTP layer or app-commands.

This worker **migrates the domain-agnostic observable utilities into `@mux-magic/tools`** so they have one canonical home. After this lands:

- `@mux-magic/tools` exports the task scheduler, the shared operators, and any other reusable rxjs primitives.
- `@mux-magic/server` imports them from `@mux-magic/tools` (no internal duplicates).
- `@mux-magic/cli` imports them from `@mux-magic/tools` directly (no longer routed through server's barrel).
- `Gallery-Downloader` will be able to consume the same scheduler once worker `1d`'s consumption work lands.

---

### What stays where

Per the exploration of the codebase, `@mux-magic/tools` already exports streaming primitives (`getFilesAtDepth`, `makeDirectory`, `logAndRethrowPipelineError`, `logAndSwallowPipelineError`). Do **not** duplicate those — extend the package.

| File | Today | After |
|---|---|---|
| `packages/server/src/tools/taskScheduler.ts` | server-owned | `packages/tools/src/taskScheduler.ts` |
| `packages/server/src/tools/initTaskScheduler.ts` (if separate) | server-owned | move with `taskScheduler` |
| `packages/cli/src/tools/initTaskSchedulerCli.ts` (moved in worker 20) | cli-owned | **stays in CLI** — it's a CLI-specific initialization with concurrency 1 |
| Shared operator chains used in 3+ app-commands | scattered | `packages/tools/src/operators/` |
| Domain-specific operators (e.g. NSF's duplicate-counter `scan`) | scattered | **stay where they're used** — only generalize what's actually reused |

### Audit pass for shared operators

Before moving anything: grep `packages/server/src/app-commands/**/*.ts` for operator imports and identify operators reused in **three or more** command files. The bar for promotion to `@mux-magic/tools` is "reused across multiple commands and domain-agnostic." If an operator is used in only 1–2 places, leave it inline.

Candidates likely worth promoting (verify via grep):

- Whatever wrapper around `tap` is used for per-file progress reporting
- Any shared `defer(async () => ...)` adapter for converting promise-returning calls into observables
- The "task-with-progress" composite if multiple commands use the same shape

**Anti-goal:** moving the entire `nameSpecialFeatures.ts` scan-based duplicate counter — it's domain-specific. Worker 25 may revisit that.

---

### Implementation steps

#### 1. Move `taskScheduler.ts` into `@mux-magic/tools`

```powershell
git mv packages/server/src/tools/taskScheduler.ts packages/tools/src/taskScheduler.ts
```

If there's a colocated init file (e.g. `initTaskScheduler.ts`), move it too. **Do not** move `initTaskSchedulerCli.ts` — it belongs to CLI.

Update imports:

- In `packages/server/`: switch every `import { runTask, runTasks, runTasksOrdered, initTaskScheduler } from "../tools/taskScheduler"` to `import { ... } from "@mux-magic/tools"`.
- In `packages/cli/src/tools/initTaskSchedulerCli.ts`: switch the import of `initTaskScheduler` to come from `@mux-magic/tools` (no longer `@mux-magic/server/tools/taskScheduler`).

Ensure `packages/tools/src/index.ts` re-exports the new names.

#### 2. Audit and promote shared operators

Grep across `packages/server/src/app-commands/` for operator usage. Promote only operators that pass the "3+ commands and domain-agnostic" bar.

```powershell
# Example audit greps:
yarn rg "from \".*tools/(taskScheduler|getFilesAtDepth|makeDirectory|log\w+PipelineError)\"" packages/server/src
yarn rg "^import .* from \".*operators\"" packages/server/src
```

For each promoted operator:

- Create `packages/tools/src/operators/<name>.ts`.
- Add a unit test alongside it.
- Re-export from `packages/tools/src/index.ts`.
- Update all consumer imports.

#### 3. Verify the scheduler still works the same in both contexts

The scheduler is **process-wide singleton state** (a module-level `Subject`/`mergeAll(concurrency)`). Moving the file must not change its identity or initialization semantics:

- CLI process: `initTaskSchedulerCli` calls `initTaskScheduler(1)` from `@mux-magic/tools`.
- Server process: `server.ts` calls `initTaskScheduler(MAX_THREADS)` from `@mux-magic/tools`.
- Both processes have exactly one scheduler instance per process.

Write a test that proves the scheduler respects the configured concurrency (this should already exist; verify it survives the move).

#### 4. Don't break worker 38's dependency

Worker 38 (per-file-pipelining) needs to compose with the scheduler heavily. Make sure the public API of the scheduler — exported function signatures — is **unchanged**. Internal refactors fine; signature changes are out of scope for this worker.

---

## Tests (per test-coverage discipline)

- **Unit:** taskScheduler tests migrate with the file. Concurrency limit honored. Cold subscription semantics preserved (subscribing to the returned observable enqueues; not subscribing doesn't).
- **Unit:** each promoted operator has at least one unit test in `packages/tools/`.
- **Integration:** a server-side app-command that uses `runTasks` (e.g. `copyFiles`) still works against the relocated scheduler. Spawn a small fixture; assert N files processed with concurrency 2.
- **Integration:** CLI invocation of the same command behaves identically (sequential concurrency 1).
- **e2e:** `yarn media --help` still works (CLI imports resolve); `yarn dev:server` boots (server imports resolve).

---

## TDD steps

1. Failing tests committed first (scheduler still respects concurrency from new location; promoted operators behave correctly).
2. `git mv` `taskScheduler.ts` (and any init); update imports across the monorepo.
3. Verify unit tests pass at the new location.
4. Audit + promote shared operators one at a time; commit each promotion separately.
5. Update consumer imports.
6. Run full gate.

---

## Files

**Move via `git mv`:**
- [packages/server/src/tools/taskScheduler.ts](../../packages/server/src/tools/taskScheduler.ts) → `packages/tools/src/taskScheduler.ts`

**Modify (import path updates):**
- All files in [packages/server/src/](../../packages/server/src/) that imported the moved modules
- [packages/cli/src/tools/initTaskSchedulerCli.ts](../../packages/cli/src/tools/initTaskSchedulerCli.ts)
- [packages/tools/src/index.ts](../../packages/tools/src/index.ts) — add new re-exports

**Possibly create (per audit results):**
- `packages/tools/src/operators/<promoted-operator>.ts`

---

## Verification checklist

- [ ] Worker 20 ✅ merged before starting
- [ ] Worktree created
- [ ] Manifest row → `in-progress`
- [ ] Failing tests committed first
- [ ] `taskScheduler` lives in `@mux-magic/tools`; signatures unchanged
- [ ] CLI scheduler init uses concurrency 1; server uses `MAX_THREADS` (env-driven)
- [ ] No remaining `from "../tools/taskScheduler"` imports in server (all go through `@mux-magic/tools`)
- [ ] Promoted operators have unit tests + are re-exported
- [ ] No operators promoted that are used in fewer than 3 places
- [ ] Standard gate clean
- [ ] PR opened
- [ ] Manifest row → `done`

## Out of scope

- Worker 38's per-file pipelining rewrite (separate worker; just preserve the scheduler's public API so 38 can build on it).
- Generalizing nameSpecialFeatures' duplicate-counter scan (worker 25's domain).
- Changing concurrency semantics (e.g. adding per-job claims — that's worker 11).
