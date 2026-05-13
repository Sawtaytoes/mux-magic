# Worker 11 — limit-execution-threads-ui

**Model:** Sonnet · **Thinking:** ON · **Effort:** High
**Branch:** `feat/mux-magic-revamp/11-limit-execution-threads-ui`
**Worktree:** `.claude/worktrees/11_limit-execution-threads-ui/`
**Phase:** 1B web
**Depends on:** 01
**Parallel with:** all other 1B web workers (but **coordinates with worker 14** dry-run-to-query-string — both touch sequence-level "Run Settings"; sequence them or carefully merge)

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Tests must cover the change scope (see [feedback_test_coverage_required.md](C:\Users\satur\.claude\projects\d--Projects-Personal-media-tools\memory\feedback_test_coverage_required.md)). Yarn only. See [AGENTS.md](../../AGENTS.md).

## Your Mission

Add a **per-job** execution-thread cap. Today, an env var (find the current name — likely `MAX_THREADS` or similar — grep the server code) caps thread count server-wide. The new model: the env var stays as the **ceiling**, but the user picks a per-sequence value within `[1, ceiling]` from the UI. Stored in the sequence template (YAML) and the query string.

### Design summary

| Layer | What it does |
|---|---|
| Server | Existing env var defines the **system ceiling** (e.g. `os.cpus().length`-derived or explicit `MAX_THREADS`). Server exposes `GET /system/threads` → `{ maxConfigured: number, totalCpus: number }`. JobRunner clamps any per-job override to the ceiling. |
| YAML template | New top-level `runSettings` object with `maxThreads?: number`. Co-located with `isDryRun?: boolean` (worker 14's migration target). |
| URL query string | `?maxThreads=4` (and the dry-run params from worker 14). Reads on load; writes on change via `history.replaceState`. |
| Web UI | New "Run Settings" panel (similar visual treatment to the existing "Path Variables" section) showing: current sequence value, system ceiling, total CPUs. Slider or number input clamped to `[1, maxConfigured]`. |

### Behavior contract

- Server starts up; computes `maxConfigured` from env var OR (if env absent) from `os.cpus().length`. Stores it.
- Server `GET /system/threads` returns `{ maxConfigured, totalCpus }` for the UI to display ("This machine has 16 CPUs; max configured is 12; pick a value 1–12").
- User sets `runSettings.maxThreads = 8` in the UI. Persisted in YAML + URL.
- When sequence runs, server reads `runSettings.maxThreads`. If absent: use `maxConfigured`. If present: clamp `min(value, maxConfigured)`.
- Loading a YAML with `runSettings.maxThreads = 1000` (from a different machine): clamp at run time to current `maxConfigured`. Don't error; just clamp + log.

### Why "like path variables"

Path variables in this app are user-configurable sequence-level data that affects how steps run. The thread cap is conceptually the same: a sequence-level setting that influences runtime behavior. Reuse the visual + state patterns from the existing Path Variables UI.

Look at:
- [packages/web/src/components/PathVarCard/PathVarCard.tsx](../../packages/web/src/components/PathVarCard/PathVarCard.tsx) — visual pattern
- [packages/web/src/state/pathsAtom.ts](../../packages/web/src/state/pathsAtom.ts) — state pattern

The "Run Settings" panel doesn't need full add/remove/rename of variables — it has a fixed set of fields (`maxThreads`, `isDryRun`). But the styling and panel placement should look like a sibling to Path Variables.

### Co-existence with dry-run (worker 14)

Worker 14 is migrating dry-run state to the query string. After both 14 and 11 land, the `runSettings` object holds both:

```yaml
runSettings:
  isDryRun: false      # from worker 14
  failureMode: false   # from worker 14
  maxThreads: 8        # from worker 11
steps:
  - ...
```

And URL: `?isDryRun=false&maxThreads=8` (or nested form — pick a flat scheme that's URL-encoding-friendly).

Whichever worker lands second should ensure they both end up in the same `runSettings` object structure, not in two different state buckets. Coordinate via PR descriptions if you're running in parallel.

### Tests

Per the test-coverage feedback memory:
- Unit test: `GET /system/threads` returns the right shape.
- Unit test: JobRunner clamps an overshooting `maxThreads` value at runtime.
- Unit test: YAML codec round-trips `runSettings.maxThreads`.
- Unit test: query string reads/writes `maxThreads`.
- Component test: Run Settings panel renders, shows system ceiling, clamps input.
- e2e test: full flow — set `maxThreads=2` in UI → run a sequence → server logs show concurrency capped at 2.

## TDD steps

1. Write all the failing tests above. Commit incrementally:
   - `test(server): /system/threads endpoint`
   - `test(runner): maxThreads clamping`
   - `test(codec): runSettings round-trip`
   - `test(ui): RunSettingsPanel renders + clamps`
   - `test(e2e): maxThreads cap respected`
2. Implement server endpoint.
3. Implement JobRunner clamp.
4. Extend YAML codec.
5. Build Run Settings panel.
6. Wire query string sync.
7. Verify all tests pass.

## Files

- New: `packages/server/src/api/routes/systemRoutes.ts` (or extend an existing system/health module) — `GET /system/threads`
- [packages/server/src/api/jobRunner.ts](../../packages/server/src/api/jobRunner.ts) — clamp logic
- [packages/web/src/jobs/yamlCodec.ts](../../packages/web/src/jobs/yamlCodec.ts) (post-worker-19 merge; if 19 hasn't merged yet, edit the two source files) — add `runSettings` encoding
- New: `packages/web/src/components/RunSettingsPanel/` (component + stories + test)
- Web atoms — new `runSettingsAtom` (or extend whatever holds dry-run after worker 14)
- Tests for all of the above

## Verification checklist

- [ ] Worktree created
- [ ] Manifest row → `in-progress`
- [ ] Failing tests committed first (per test-coverage feedback)
- [ ] Server endpoint returns `{ maxConfigured, totalCpus }`
- [ ] JobRunner clamps per-job override
- [ ] YAML round-trip preserves `runSettings.maxThreads`
- [ ] Query string sync works
- [ ] UI shows ceiling + accepts user input clamped to ceiling
- [ ] Stories cover: at ceiling, below ceiling, above ceiling (clamped)
- [ ] Coordination with worker 14 documented in PR (both should write to the same `runSettings` shape)
- [ ] e2e proves cap is enforced at runtime
- [ ] Standard gate clean
- [ ] PR opened
- [ ] Manifest row → `done`

## Out of scope

- Adding new `runSettings` fields beyond `maxThreads` (other workers add their own fields)
- Per-step thread cap (overrides per step) — sequence-level is enough
- Changing the env var name or behavior — it stays as the ceiling
- GPU thread cap (different resource; covered by worker 30)
