# Worker 2c — pure-functions-sweep

**Model:** Sonnet · **Thinking:** ON · **Effort:** High
**Branch:** `worker-2c-pure-functions-sweep` (flat name; `feat/mux-magic-revamp/...` collides with the base ref)
**Worktree:** `.claude/worktrees/2c_pure-functions-sweep/`
**Phase:** 4 (server infrastructure)
**Depends on:** 20 (CLI extract — finalizes the split between business logic and process I/O)
**Parallel with:** 41, 2a, 3b, 3c, 3e, 40. **NOT parallel with 38 (per-file-pipelining)** — that worker rewrites the same command handlers this one touches; coordinate. **NOT parallel with Phase 3 NSF workers** if this worker reaches into the NSF code paths — keep this sweep out of `nameSpecialFeatures*` files entirely (Phase 3 owns that surface). When this lands first: Phase 3 rebases trivially. When Phase 3 lands first: this worker excludes those files.

> **Why this worker exists:** "Pure" in this codebase means **no mutation** — not "no env reads / no I/O." [AGENTS.md](../../AGENTS.md) §"The Four Most-Violated Rules" already bans `.push` / `.splice` / `.pop` / `.shift` / `.unshift` / in-place `.sort` / `.reverse` / `let` mutation / `for` loops over arrays. But the rule was added incrementally — older helpers in `packages/server/src/tools/` predate it and still use mutation-as-accumulator patterns (`const xs = []; for (...) xs.push(...)`). This sweep finds those holdouts and rewrites them via `map` / `filter` / `reduce` / `concat` / `Array.from` / `.toSorted()`. The body shape changes; the exported signatures don't.

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: existing tests should stay green through every rewrite (that's the regression check). Yarn only. Manifest row update lands as its own `chore(manifest):` commit. See [AGENTS.md](../../AGENTS.md).

## ⚠️ This is NOT a sweep for…

Past attempts on this worker misread the title. To be unambiguous, **this worker does NOT**:

- Extract `process.env.X` reads into parameter objects so callers can "test without env tricks." Reading env once at the edge is fine. The existing `resolveDefaultThreadCount` is already pure in the sense this codebase cares about — it doesn't mutate anything. Wrapping the `??` operator in a named helper is indirection-without-value.
- Split files into "pure core + thin wrapper" purely to satisfy referential transparency. `Date.now()`, `Math.random()`, `process.env.X` are fine in the function body as long as the body isn't mutating arrays/objects.
- Wrap single operators (`??`, `||`, `&&`, ternary) in named pure functions. If the body is one operator, you've extracted a name, not a function.
- Add 4-key parameter-object signatures to functions that don't need them.

If you find yourself thinking "I'll thread X in as a parameter so the test doesn't need to mock it," **stop**. That's the wrong sweep. Reading env / time / RNG at the edge is fine. Mutating arrays in the middle is the bug.

## Your Mission

Scan [packages/server/src/tools/](../../packages/server/src/tools/) for **mutation-as-accumulator** patterns and rewrite them functionally. The five concrete signals:

1. **`.push` into a `const xs = []` accumulator** — rewrite via `map` / `filter` / `reduce` / `concat` or `flatMap`.
2. **In-place `.sort()` / `.reverse()` / `.splice()`** — replace with `.toSorted()` / `.toReversed()` / `.toSpliced()`, or build a new array via `[...xs]` + the in-place method on the copy if the immutable twin is unavailable.
3. **`arr[index] = value` index assignment** building a result array — rewrite as `map` with index argument.
4. **`obj.field = value` mutation of a freshly-constructed object** — fold the field into the original object literal, or build via spread.
5. **`let` reassignment in a loop body** — almost always wants `reduce` (numeric accumulator) or `map` / `filter` (collection accumulator).

If a file already uses functional accumulation throughout, **leave it alone** — don't rewrite for stylistic preference.

### Scope

In: [packages/server/src/tools/](../../packages/server/src/tools/) — utilities that are not command handlers.

Out of scope (do NOT touch):

- **Command handlers under [packages/server/src/app-commands/](../../packages/server/src/app-commands/)** — worker 38 is rewriting them.
- **`nameSpecialFeatures*` files** — Phase 3 owns them.
- **`schema.generated/`**, `loadEnv.ts`, `server.ts`, top-level bootstrap files.
- **rxjs operator pipelines** — wired by worker 21; touching them invites merge pain.
- **Stateful modules where mutation IS the point** — e.g., `transcodeTempStore.ts` (refcounted LRU cache), `progressEmitter.ts` (throttle state machine), `isNetworkPath.ts` (module-level enumeration cache). Their job is to manage mutable state at the edge. Replacing the state with immutable data structures is a redesign, not a sweep.

### What counts as "pure" here

Same as everywhere else in this codebase:

- No `.push` / `.splice` / `.pop` / `.shift` / `.unshift` / in-place `.sort` / `.reverse` ([AGENTS.md](../../AGENTS.md) rule 5).
- No `for` / `for...of` / `while` over arrays ([code-rules.md](../agents/code-rules.md) rule 1).
- No `let` reassignment for accumulation ([code-rules.md](../agents/code-rules.md) rule 2).
- No `arr[i] = …` or `obj.field = …` mutation of values you don't own.

Note what's **not** on this list: env reads, `Date.now()`, `Math.random()`, `existsSync`, `spawn`. Those are fine. The codebase's purity rule is about mutation, not referential transparency.

### Example rewrites

```ts
// Before — index assignment building a results array
const results: string[] = new Array(items.length)
items.forEach((item, index) => {
  results[index] = transform(item)
})

// After — .map
const results = items.map((item, index) => transform(item, index))
```

```ts
// Before — in-place sort
entries.sort(
  (entryA, entryB) => entryA.name.localeCompare(entryB.name),
)

// After — .toSorted (ES2023) returns a new array
const sortedEntries = entries.toSorted(
  (entryA, entryB) => entryA.name.localeCompare(entryB.name),
)
```

```ts
// Before — .push accumulator inside forEach
const matchingIds: number[] = []
records.forEach((record) => {
  if (record.isMatch) matchingIds.push(record.id)
})

// After — .filter + .map (or .flatMap if the filter+transform composes)
const matchingIds = records
  .filter((record) => record.isMatch)
  .map((record) => record.id)
```

```ts
// Before — obj.field = ... after object construction
const result: SomeType = { ...base }
if (hasExtra) {
  result.extra = computeExtra()
}

// After — fold into the literal
const result: SomeType = {
  ...base,
  ...(hasExtra ? { extra: computeExtra() } : {}),
}
```

### What NOT to do

- Do NOT extract `process.env` reads into parameter objects. See the ⚠️ section above.
- Do NOT change exported function signatures. Call sites don't move.
- Do NOT redesign stateful modules (`transcodeTempStore`, `progressEmitter`, `isNetworkPath`'s cache). Those are out of scope.
- Do NOT collapse files (`getOutputPath` + `getDemoName` → "helper.ts"). File-per-function structure stays.
- Do NOT migrate every file in one PR if the diff balloons. **Target ~10–20 files per PR.** Split into follow-up PRs with `<id>-followup-N` suffix branches if the sweep is larger.
- Do NOT change behavior. If you find a bug while sweeping, file a separate issue or open a separate PR.
- Do NOT add tests just to assert that the new functional version equals the old imperative version. Existing tests passing unchanged IS the regression check. Only add new tests when the rewrite uncovers a previously-untested branch worth pinning down.

### Definition of "done" per file

1. Grep the file for the mutation signals (`\.push\(|\.splice\(|\.pop\(|\.shift\(|\.unshift\(|\.sort\(|\.reverse\(|for \(|for \w+ of|let \w+ =`) to find sites.
2. Decide site-by-site whether each is mutation-as-accumulator (rewrite) or mutation-as-state (out of scope — leave).
3. Rewrite via the functional equivalents. Exported signatures unchanged.
4. Existing tests pass without modification. If a test had to change, the rewrite probably altered behavior — revisit.
5. The file's diff should be shorter or roughly the same size as before. If it grew significantly, you may have over-engineered.

### Coordination with worker 38

Worker 38 rewrites command handlers, not the helpers in scope here. Helpers' external signatures stay stable so worker 38's rewrite doesn't need to know about this sweep.

- If worker 38 lands first: this worker rebases trivially.
- If this lands first: worker 38 benefits from cleaner helper bodies but isn't blocked either way.

## Tests (per test-coverage discipline)

- **Regression:** all existing tests still pass with no signature changes at the call sites. **This is the primary safety net.**
- **New tests:** only when the rewrite surfaces a branch that wasn't covered before. Inline expected values per existing pattern (no snapshots — project rule).
- **No mock-shaving for its own sake:** if a test was using mocks to handle the mutation pattern, the rewrite may make those mocks unnecessary as a side effect, but don't go on a mock-removal crusade.

## TDD steps

This sweep is refactor-only, so TDD is mostly "existing tests stay green":

1. Pick a file. Grep for mutation patterns.
2. Run that file's tests, confirm green pre-rewrite. (If a file has no tests AND has mutation, consider whether the rewrite is safe at all — fall back to a tiny smoke test before refactoring.)
3. Rewrite mutation sites. Re-run tests; they must stay green with no test edits.
4. Commit `refactor(pure-sweep): remove mutation from <file>` once per file (or per coherent group of related files).
5. Repeat until the PR diff feels reviewable (~10–20 files).
6. Manifest row → `done` only when the planned scope is complete. Otherwise sub-status with follow-up branches.

## Files

Likely targets (audit confirms which actually have rewritable mutation, vs. mutation-as-state):

- `listFilesWithMetadata.ts` — `results[index] = …`, in-place `.sort()`, `.forEach` with mutation through closure
- `animeOfflineDatabase.ts` — `index.push(…)` in `parseAnimeIndex`
- `getMkvInfo.ts` — `chunks.push(chunk)`, `stderrChunks.push(text)` (chunk-accumulator pattern)
- `applyAssRules.ts` — `entries[existingIndex] = …` + `entries.splice(…)` inside the AssFile mutators (its own comment says "functional — never mutate" yet mutates `entries` arrays)
- `assFileTools.ts` — audit
- `getFiles.ts` — audit

Audit the rest of `packages/server/src/tools/**` before committing. List touched files in the PR description.

Stateful modules to **skip** (mutation is the point, not a holdover):

- `transcodeTempStore.ts` — refcounted LRU cache.
- `progressEmitter.ts` — throttle state machine.
- `isNetworkPath.ts` — module-level enumeration cache (the `cachedNetworkDriveLetters` singleton).

## Verification checklist

- [ ] Worker 20 ✅ merged before starting
- [ ] Coordinated with worker 38 (or 38 not yet started)
- [ ] No `nameSpecialFeatures*` files touched (Phase 3 territory)
- [ ] No `app-commands/**` files touched (worker 38 territory)
- [ ] Worktree created
- [ ] Manifest row → `in-progress` (own commit)
- [ ] Each swept file has mutation sites rewritten via functional equivalents
- [ ] No exported signatures changed
- [ ] No `process.env` reads extracted into parameter objects (this is the explicit anti-pattern — see ⚠️ section)
- [ ] No single-operator wrappers added (no functions whose body is one `??` / `||` / `&&` / ternary)
- [ ] Existing tests pass unchanged
- [ ] Stateful modules (`transcodeTempStore`, `progressEmitter`, `isNetworkPath` cache) untouched
- [ ] PR description lists every file touched + the mutation pattern that was removed for each
- [ ] No behavior changes (find a bug? file separately)
- [ ] Standard gate clean
- [ ] PR opened
- [ ] Manifest row → `done` (or sub-status if split into multiple PRs)

## Why High effort

The judgement isn't "is this mutating?" — that's a grep. The judgement is **"is this mutation a holdover that should be rewritten, or intentional stateful design (cache, refcount, throttle) that should be left alone?"** The blast radius is broad (call sites in many places); the test safety net is the existing test suite passing unchanged. Be conservative on what you classify as "should be rewritten" — when in doubt, leave it.

## Prior-attempt note (2026-05-16)

A prior session misread this worker as a referential-transparency sweep — it extracted `process.env` reads into parameter objects and wrapped single operators in named pure functions. PR #121 was closed without merging. The new framing in this doc is to prevent the same dead-end:

- "Pure" here = no mutation. Always. The codebase has codified this in [AGENTS.md](../../AGENTS.md) rule 5 and [code-rules.md](../agents/code-rules.md) rules 1-2.
- `resolveDefaultThreadCount` reading `process.env.DEFAULT_THREAD_COUNT` is **not** the kind of impurity this worker cares about — that function is already pure (no mutation).
- The actual target is the `chunks: Uint8Array[] = []; ... chunks.push(chunk)` pattern in `getMkvInfo` and friends.
