# Worker 3e — gallery-downloader-task-pools

**Model:** Sonnet · **Thinking:** ON · **Effort:** High
**Branch (mux-magic):** `worker-3e-task-pools`
**Branch (gallery-downloader):** `feat/gallery-downloader-revamp/3e-task-pools`
**Worktree (mux-magic):** `.claude/worktrees/3e_gallery-downloader-task-pools/`
**Worktree (gallery-downloader):** `.claude/worktrees/3e_task_pools/` (inside the gallery-downloader repo)
**Phase:** 4 (server infrastructure / cross-repo coupling)
**Depends on:**

- `21` (taskScheduler now lives in `@mux-magic/tools`)
- `1d` (Gallery-Downloader already consumes `@mux-magic/tools`)
- A published `@mux-magic/tools` release that includes worker 21's relocated scheduler **plus this worker's new `registerTaskPool` API** (the user tags `shared-vX.Y.Z` once this worker's `@mux-magic/tools` changes land in Mux-Magic's master)

**Parallel with:** Nothing in the same span — touches `@mux-magic/tools` and Gallery-Downloader; doesn't conflict with mux-magic's server/web work.

---

## Universal Rules (TL;DR)

Worktree-isolated in **both** repos (mux-magic for the `@mux-magic/tools` extension, gallery-downloader for adoption). Random PORT/WEB_PORT where applicable. Pre-merge gate per repo: `yarn lint → typecheck → test → e2e (where applicable) → lint`. TDD: failing test first. Tests must cover the change scope. Yarn only. See [AGENTS.md](../../AGENTS.md). Background context in [docs/PLAN.md §2](./PLAN.md).

---

## Your Mission

Gallery-Downloader now runs **multiple sync jobs concurrently**, each spanning several stages (image downloads, chapter metadata lookups, archive extraction, etc.). Each remote service has a different request budget:

- **Image hosts** tolerate ~8 parallel connections (CDN-fronted, low cost per request).
- **Webtoons chapter lookups** must stay at ≤2 parallel (single backend, anti-scrape throttle).
- **DLsite scrape** ≤3 (per their TOS guidance, plus politeness).
- **Pixiv image-set assembly** ≤4 (per-IP rate-limit window).

A single global concurrency cap can't express this — gating image downloads to 2 would crawl, gating Webtoons to 8 would get the IP banned. Per-job claims (worker 11) don't help either: they gate by **jobId**, not by **task type**. Two concurrent jobs both calling Webtoons can still pile 4 lookups onto the same backend.

This worker introduces **named task pools** as a third admission dimension on the shared `@mux-magic/tools` scheduler — orthogonal to global cap and per-job claim — then adopts the new API in Gallery-Downloader so each remote service gets its own pool cap.

### Scope split

| Piece | Where |
|---|---|
| Extend `taskScheduler` API with `registerTaskPool` / `unregisterTaskPool` and a `poolName` option on `runTask` | `@mux-magic/tools` (mux-magic repo) |
| Backwards-compatible `runTask` overload — existing callers (no `poolName`) bypass pool gating | `@mux-magic/tools` |
| Bump `@mux-magic/tools` minor version; tag `shared-vX.Y.0`; user manually publishes | mux-magic repo, published after this PR merges |
| Audit Gallery-Downloader task launches; assign each a pool name | gallery-downloader repo |
| Register each pool at boot with its rate-limit-derived cap | gallery-downloader repo |
| Bump `@mux-magic/tools` dep in each gallery-downloader workspace | gallery-downloader repo |

This is **two PRs**: one in mux-magic (extends `@mux-magic/tools`), one in gallery-downloader (adopts the new API). The mux-magic PR must merge + publish first; gallery-downloader's depends on the new tools version.

---

## Part 1 — `@mux-magic/tools` API extension (mux-magic repo)

### Current scheduler admission logic (post-worker-21)

```ts
// packages/tools/src/taskScheduler.ts (current shape after worker 21)
const canAdmit = ({ jobId }: ScheduledTask): boolean => {
  if (inflight >= maxConcurrency) return false
  if (jobId === null) return true
  const claim = claimByJob.get(jobId) ?? maxConcurrency
  return (inflightByJob.get(jobId) ?? 0) < claim
}
```

### New shape (post-worker-3e)

Add a `claimByPool` map (mirroring `claimByJob`), an `inflightByPool` map, and extend `canAdmit`:

```ts
type ScheduledTask = {
  bridge$: Observable<never>
  jobId: string | null
  poolName: string | null  // NEW
}

const claimByPool = new Map<string, number>()
// ... inside the scheduler operator:
const inflightByPool = new Map<string, number>()

const canAdmit = ({ jobId, poolName }: ScheduledTask): boolean => {
  if (inflight >= maxConcurrency) return false

  if (jobId !== null) {
    const claim = claimByJob.get(jobId) ?? maxConcurrency
    if ((inflightByJob.get(jobId) ?? 0) >= claim) return false
  }

  if (poolName !== null) {
    const poolCap = claimByPool.get(poolName)
    // Unregistered pool names admit freely (debuggable: a missing
    // registerTaskPool() call shouldn't silently throttle to zero).
    if (poolCap !== undefined && (inflightByPool.get(poolName) ?? 0) >= poolCap) {
      return false
    }
  }

  return true
}
```

`admit` and `onComplete` each get an `inflightByPool` increment/decrement matching their existing `inflightByJob` handling.

### New public API

```ts
// Register a pool's max parallelism. Calling registerTaskPool twice with
// the same name overwrites the cap (so tests can re-init at a different
// value after __resetTaskSchedulerForTests).
export const registerTaskPool = (
  poolName: string,
  maxParallel: number,
): void => {
  claimByPool.set(poolName, maxParallel)
}

// Remove a pool's cap. Tasks currently bearing this poolName keep running;
// future admissions for it bypass pool gating (since unregistered pools
// admit freely).
export const unregisterTaskPool = (poolName: string): void => {
  claimByPool.delete(poolName)
}
```

### Backwards-compatible `runTask` signature

The existing `runTask<T>(work$: Observable<T>, explicitJobId?: string | null): Observable<T>` signature is preserved as-is. Add a new overload that accepts an options object:

```ts
export function runTask<T>(
  work$: Observable<T>,
  explicitJobId?: string | null,
): Observable<T>

export function runTask<T>(
  work$: Observable<T>,
  options: {
    jobId?: string | null
    poolName?: string | null
  },
): Observable<T>

export function runTask<T>(
  work$: Observable<T>,
  jobIdOrOptions?:
    | string
    | null
    | { jobId?: string | null; poolName?: string | null },
): Observable<T> {
  // ... unify into { jobId, poolName }, fall through to the existing
  // factory body
}
```

Detection rule for the runtime branch: `typeof jobIdOrOptions === "object" && jobIdOrOptions !== null` → options form; otherwise → positional-string form. Existing callers (`runTask(work$)`, `runTask(work$, "job-abc")`, `runTask(work$, null)`) all stay valid.

`runTasks` and `runTasksOrdered` also get parallel overloads accepting `{ poolName }` so pipeable-form callers don't have to drop down to the cold-form `runTask`.

### `__resetTaskSchedulerForTests`

Extend to clear `claimByPool` as well:

```ts
export const __resetTaskSchedulerForTests = (): void => {
  concurrency = null
  claimByJob.clear()
  claimByPool.clear()  // NEW
  inbox?.complete()
  inbox = null
}
```

### Tests (Part 1)

In `packages/tools/src/taskScheduler.test.ts` (extend or create alongside what worker 21 migrated):

1. **Pool cap respected**: register a pool at cap 2; enqueue 5 tasks for that pool; assert only 2 ever inflight at once.
2. **Pool isolation**: register pool A at cap 2 and pool B at cap 3; enqueue 5 tasks for each; assert A's max inflight is 2 and B's max inflight is 3 (independent).
3. **Unregistered pool name admits freely** (only global cap applies). Sanity guard: a typo in poolName shouldn't strangle a job to zero throughput silently.
4. **Pool + per-job claim compose**: job J has claim 5, pool P has cap 2; J emits 5 tasks all bound to P; only 2 inflight at a time (pool wins). Then add 5 more tasks under the same job J but no pool name; pool tasks share their 2-slot pool, the no-pool tasks fill up to J's claim.
5. **Backwards compatibility**: existing `runTask(work$)` and `runTask(work$, "job-id")` calls keep working — no overload-selection ambiguity, no runtime crash.
6. **Fair scheduling preserved**: head-of-queue task bound to saturated pool P doesn't block downstream tasks bound to a different (non-saturated) pool — the scheduler's `findIndex(canAdmit)` loop already does this for jobs; verify it works for pools too.

### Version bump

After Part 1 merges to Mux-Magic master and the user publishes:

- `packages/tools/package.json`: bump minor (e.g., `0.1.2 → 0.2.0`) since this is a feature addition.
- The user tags `shared-v0.2.0` and pushes; GitHub Actions publishes via the `publish-shared.yml` workflow (see AGENTS.md § npm Publishing).

---

## Part 2 — Adopt named pools in Gallery-Downloader (gallery-downloader repo)

### Audit pass

Inventory every place Gallery-Downloader currently spawns concurrent async work. Likely entry points:

1. Per-sync-job download loops.
2. Per-source scrape pipelines (Webtoons, DLsite, Pixiv, Fakku, etc.).
3. Image-set assembly (group of images per chapter).
4. Archive extraction post-download.

For each: identify the **remote service** it talks to, and decide on a pool cap derived from that service's documented or empirically-observed parallel-request budget.

### Suggested pool catalog (verify against actual code + service behavior)

| Pool name | Cap | What it gates |
|---|---|---|
| `imageDownload` | 8 | Generic image-host downloads (CDN-fronted) |
| `webtoonsChapterLookup` | 2 | Webtoons backend metadata + chapter listing |
| `dlsiteScrape` | 3 | DLsite product-page scrapes |
| `pixivImageSet` | 4 | Pixiv per-IP rate-limit-bound image assembly |
| `fakkuMetadata` | 2 | Fakku backend |
| `archiveExtract` | (cpus().length) | Local CPU-bound work, no remote rate limit — pool cap = cpus, not 2 |

The `archiveExtract` row deliberately uses a higher cap because the constraint is local CPU, not remote rate limit. The pattern generalizes: pool caps should reflect the bottleneck for that task type — remote rate limit for network-bound work, CPU count for compute-bound work, IO depth for disk-bound work.

### Boot registration

At process startup (likely a single `initTaskPools()` function called from the entrypoint, mirroring `initTaskScheduler`):

```ts
import {
  initTaskScheduler,
  registerTaskPool,
} from "@mux-magic/tools"
import { cpus } from "node:os"

initTaskScheduler(Number(process.env.MAX_THREADS) || cpus().length)
registerTaskPool("imageDownload", 8)
registerTaskPool("webtoonsChapterLookup", 2)
registerTaskPool("dlsiteScrape", 3)
registerTaskPool("pixivImageSet", 4)
registerTaskPool("fakkuMetadata", 2)
registerTaskPool("archiveExtract", cpus().length)
```

Caps **should** be tunable via env vars (e.g., `WEBTOONS_PARALLEL=1`) so users can dial them down on slow networks without a rebuild. Document this in Gallery-Downloader's README.

### Call-site updates

For each task launch, wrap with `runTask(..., { poolName })`:

```ts
// Before:
return downloadImageStream(url).pipe(/* ... */)

// After:
return runTask(downloadImageStream(url), { poolName: "imageDownload" })
```

Where Gallery-Downloader already wraps work in `runTask` (likely if it adopted worker 21's API on bump), just add the `poolName` option. Where it doesn't, wrap.

### Tests (Part 2)

- **Integration**: Spin up a fake server with a configurable max-parallel-handler counter. Fire 20 simultaneous Webtoons lookups; assert the server never sees more than 2 concurrent. Repeat for image downloads (cap 8).
- **Cross-pool isolation**: Mix 10 Webtoons lookups + 10 image downloads in the same sync job; verify both pools hit their caps independently and total inflight ≤ global cap.
- **Env-var override**: set `WEBTOONS_PARALLEL=1`, boot, verify only 1 concurrent Webtoons request observed.

---

## TDD steps

### Part 1 (mux-magic)

1. Failing test: pool cap is respected (3 inflight observed when cap is 2). Commit as `test(tools): failing pool-cap admission test`.
2. Implement `registerTaskPool` / `unregisterTaskPool` and extend `canAdmit`. Test goes green.
3. Add tests 2–6 from the test list above; commit each as it passes (or grouped pairs).
4. Bump `@mux-magic/tools` version; PR.

### Part 2 (gallery-downloader)

1. Failing integration test (or unit test against a stubbed downloader) for Webtoons pool cap. Commit.
2. Update boot to register pools; wrap call sites. Test goes green.
3. Add cross-pool isolation test; commit.
4. Add env-var override test; commit.
5. PR.

---

## Files

### Mux-magic (Part 1)

**Modify:**
- [packages/tools/src/taskScheduler.ts](../../packages/tools/src/taskScheduler.ts) — after worker 21 lands; add pool API
- `packages/tools/src/taskScheduler.test.ts` — extend with pool tests
- [packages/tools/src/index.ts](../../packages/tools/src/index.ts) — re-export `registerTaskPool` / `unregisterTaskPool`
- [packages/tools/package.json](../../packages/tools/package.json) — bump minor version

### Gallery-Downloader (Part 2)

**Modify:**
- `<entrypoint>.ts` — add `registerTaskPool` calls at boot
- Each call site that spawns network work — wrap with `runTask(..., { poolName })`
- Each consuming `package.json` — bump `@mux-magic/tools` dep to the new minor

**Possibly create:**
- `<some>/initTaskPools.ts` — colocated registration helper if more than ~5 pools.

---

## Verification checklist

- [ ] Worker 21 ✅ merged into Mux-Magic master before starting Part 1
- [ ] Mux-magic worktree created; failing pool-cap test committed first
- [ ] Pool admission extension lands; existing per-job and global cap tests still pass
- [ ] Worker 1d ✅ already done (Gallery-Downloader consumes `@mux-magic/tools`)
- [ ] `@mux-magic/tools` minor version bumped; Part 1 PR opened against `feat/mux-magic-revamp`
- [ ] After Part 1 merge: user manually tags `shared-vX.Y.0` and pushes; `publish-shared.yml` workflow publishes
- [ ] Gallery-Downloader worktree created; failing Webtoons pool-cap integration test committed first
- [ ] Pool registration at boot; every relevant call site wrapped with `{ poolName }`
- [ ] Env-var overrides documented in Gallery-Downloader's README
- [ ] Both repos' standard gates clean
- [ ] Both PRs opened; merge order: Part 1 (and publish) before Part 2
- [ ] Manifest row → `done` after Part 2 merges

---

## Out of scope

- Replacing the in-process scheduler with a distributed work queue. The per-process singleton is fine for both repos' current scale.
- Adding `poolName` to the public Hono API surface in mux-magic — server-side task pools are infrastructure; they don't need to be UI-configurable yet. A future worker can surface them as Variables (cf. worker 11's per-job thread-count UI).
- Generalizing pool caps into a config file. Env vars are sufficient for v1.

## Why Sonnet/High effort

This is a two-repo coordination plus a public-API extension to a shared package. The risk vectors are:

1. **Overload-resolution accident**: getting the `runTask(work$, jobIdOrOptions)` overload selection right at the TypeScript level so existing callers don't break. Verify with a typecheck pass against every existing call site in mux-magic + gallery-downloader before declaring done.
2. **Pool-cap-zero foot-gun**: a typo in `registerTaskPool("Webtoons", 0)` would silently strangle that pool to never admit. The test "unregistered pool admits freely" guards one direction; consider adding a runtime warning (logInfo) when a pool's cap is 0 to catch the typo direction too.
3. **Publish gating**: Part 2 can't progress without Part 1 published. Worker should explicitly stage the PRs sequentially.

Opus is overkill (no novel design — extends an existing pattern); Haiku is too light (cross-repo work, public API design, multiple tests). Sonnet/High is the right fit.
