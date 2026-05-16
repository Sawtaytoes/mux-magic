# Worker 25 — nsf-fix-unnamed-overhaul

**Model:** Sonnet · **Thinking:** ON · **Effort:** High
**Branch:** `feat/mux-magic-revamp/25-nsf-fix-unnamed-overhaul`
**Worktree:** `.claude/worktrees/25_nsf-fix-unnamed-overhaul/`
**Phase:** 3 (Name Special Features overhaul)
**Depends on:** 22 (rename) ✅, 3a (NSF pipeline split) ✅, **58 (NSF restoration sweep)** — 25 *upgrades* the modal 58 brings back; 58 must land first.
**Parallel with:** 26 (different module), 27 (different module), 23, 34 (different commands)

> **Pre-history note (2026-05-16):** A previous exploration discovered the modal this worker was originally written to "extend" doesn't exist in the React app. It was built in vanilla JS by commit `a7fef431` (2026-05-08), then deleted by commit `28534ec5` (2026-05-10) when the legacy `packages/web/public/builder/` tree was removed on the false assumption the React app had equivalents. Worker [58](58_promptmodal-cancel-and-play-fix.md) is the restoration sweep (PromptModal fixes + Smart Match port + fake-mode prompts); **this worker (25) builds on 58's restored modal and adds the upgrades below**. Don't start 25 until 58 has merged — the changes overlap on `UnnamedFileCandidate`, `buildUnnamedFileCandidates`, the result-card trigger button, and the modal component itself.

---

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Tests must cover the change scope. Yarn only. See [AGENTS.md](../../AGENTS.md). Background context lives in [docs/PLAN.md §9](./PLAN.md).

---

## Your Mission

Overhaul how `nameSpecialFeaturesDvdCompareTmdb` handles **unnamed files** — files that arrived in the source folder without a clear filename hint and whose duration doesn't match any DVD Compare cut or extra precisely enough.

### Today's behavior

Per the exploration of the existing pipeline:

- `buildUnnamedFileCandidates()` scores possible target names using **lexicographic word overlap** between the unnamed file's filename and known special-feature names from DVD Compare.
- Files that fail to match cleanly emit a summary event:
  ```
  { unrenamedFilenames, possibleNames, allKnownNames, unnamedFileCandidates? }
  ```
- The user then interacts via a prompt (when `nonInteractive: false`) to pick a target name per unnamed file.
- The fuzzy matching is **simplistic** — pure word-overlap scoring without considering duration proximity, file order in the folder, or the user's previous choices for this DVD Compare release.

### What's wrong

The user's report: too many false-matches and too many misses. Specifically:

1. **Duration is ignored when ranking candidates.** A file with a 12-minute duration scoring high against a 2-minute "Theatrical Trailer" candidate is obvious noise; today the system still surfaces it.
2. **Filesystem order is ignored.** When DVD Compare lists features in a known order (Disc 1: trailer, behind-the-scenes, deleted scenes; Disc 2: …), files often arrive in that same order on disk. Today the matcher doesn't use this signal.
3. **No memory between runs.** Re-running the command on the same folder with one or two file additions repeats all the prompts.

### Scope of this overhaul

Improve the `unnamed/` module (post-worker-3a) along three axes:

#### 1. Duration-aware candidate ranking

When ranking candidates for an unnamed file, factor in the absolute duration delta:

```
score(file, candidate) = (
  wordOverlapScore(file.name, candidate.name) * 1.0
  - min(abs(file.duration - candidate.duration) / 60, 5) * 0.3
)
```

(Tune weights against fixture data; the principle is "duration matters but doesn't dominate.") A candidate whose duration is wildly different from the file's gets demoted; one whose duration is within ~30 seconds gets a small boost.

The function signature should be:

```ts
type CandidateScore = {
  candidate: KnownFeature
  score: number
  wordOverlap: number
  durationDeltaSeconds: number
}

const rankCandidatesForFile = (
  file: { name: string; duration: number },
  knownFeatures: KnownFeature[],
): CandidateScore[]
```

Return sorted descending by `score`. Expose the breakdown (`wordOverlap`, `durationDeltaSeconds`) so the prompt can show the user *why* the top candidate is the top candidate.

#### 2. Order-based weak hint

When DVD Compare lists features in a defined order and the source folder's files (sorted by name) align with that order, give a small boost to candidates at matching positions:

```
if file is at index N in sortedFolder AND candidate is at index N in dvdCompareOrder:
  score += 0.5
```

This is a **weak** boost — it shouldn't override duration or word-overlap evidence, only break ties.

#### 3. Per-release memory (cache)

Persist user choices keyed by `(dvdCompareReleaseId, fileBaseName) → chosenCandidateName` in a JSON file on disk (location: `<userDataDir>/mux-magic/unnamed-cache.json` or whatever the existing cache convention is — coordinate with worker 27 which is adding persistent job state in parallel).

On subsequent runs against the same release:

- If a file matches a cached entry (same `dvdCompareReleaseId` + same `fileBaseName`): use the cached choice without prompting.
- The user can still override interactively; an override updates the cache.

Cache invalidation:

- A `--clear-unnamed-cache` CLI flag clears the cache.
- The Edit Variables modal (worker 37) exposes a "Clear unnamed-file cache" button (out of scope here; just make sure the cache file is readable so 37 can wire the button).

#### 4. Prompt UX

When the user is prompted to pick a candidate for an unnamed file, the prompt should show:

```
Unnamed file: behind_the_scenes_clip.mkv (3m 24s)

Suggested matches:
  1. Behind the Scenes (3m 30s) — word match 0.9, duration delta 6s   [recommended]
  2. Director's Featurette (3m 12s) — word match 0.4, duration delta 12s
  3. (none — skip this file)

Choice:
```

Today's prompt likely just lists candidates without the breakdown. The UI prompt event payload should carry the `CandidateScore[]` so the web UI can render rich choices, not just strings.

### Coordination with worker 27

Worker 27 is adding `paused` job state + on-disk job persistence. Coordinate on cache file location: both should probably live under a single `<userDataDir>/mux-magic/` directory with separate files (`unnamed-cache.json`, `jobs.json`, etc.). If worker 27 hasn't landed yet, propose the directory layout in this PR and let 27 follow the convention.

---

## Tests (per test-coverage discipline)

- **Unit:** `rankCandidatesForFile` — boost for close-duration candidates; demote for distant-duration candidates.
- **Unit:** order-based tie-break works when two candidates have equal word-overlap.
- **Unit:** cache read/write round-trip through the JSON file.
- **Unit:** cache hit skips the prompt; cache miss fires the prompt.
- **Integration:** run the NSF command against a fixture with 3 unnamed files + a pre-populated cache for 1 of them → only 2 prompts fire.
- **e2e:** the prompt UI in the web app shows the candidate breakdown (word match, duration delta) — assert the DOM contains the expected score columns.

---

## TDD steps

1. Failing tests above.
2. Add `rankCandidatesForFile` with duration weighting.
3. Add order-based tie-break.
4. Add cache module (read/write JSON; `~/mux-magic/unnamed-cache.json` or platform-appropriate dir).
5. Wire cache lookup into the prompt-firing logic in the `unnamed/` module.
6. Update the prompt-event payload shape to include `CandidateScore[]`.
7. Update the web UI prompt component to render the new fields.
8. Full gate.

---

## Files (post-worker-3a layout)

- `packages/server/src/app-commands/nameSpecialFeaturesDvdCompareTmdb/unnamed/buildUnnamedFileCandidates.ts` (rewrite per new scoring)
- `packages/server/src/app-commands/nameSpecialFeaturesDvdCompareTmdb/unnamed/rankCandidatesForFile.ts` (new)
- `packages/server/src/app-commands/nameSpecialFeaturesDvdCompareTmdb/unnamed/unnamedCache.ts` (new)
- `packages/server/src/app-commands/nameSpecialFeaturesDvdCompareTmdb/unnamed/promptForUserChoice.ts` (extend payload)
- Prompt-event types — possibly [packages/server/src/api/types.ts](../../packages/server/src/api/types.ts)
- Web UI prompt component (search for it under [packages/web/src/components/](../../packages/web/src/components/))
- Tests for all of the above

---

## Verification checklist

- [ ] Workers 22 ✅ and 3a ✅ merged before starting
- [ ] Worktree created
- [ ] Manifest row → `in-progress`
- [ ] Failing tests committed first
- [ ] Duration-aware ranking shows demotion of far-duration candidates in unit tests
- [ ] Order-based tie-break works in unit tests
- [ ] Cache read/write round-trips through disk
- [ ] Cache hit skips the prompt; cache miss fires it
- [ ] Prompt event carries `CandidateScore[]` with breakdown fields
- [ ] Web UI renders the breakdown
- [ ] Cache file location coordinated with worker 27
- [ ] Standard gate clean
- [ ] PR opened
- [ ] Manifest row → `done`

## Out of scope

- ML-based fuzzy matching (word-overlap + duration is the bar; no embeddings or model calls).
- Auto-resolving without user confirmation when the top score crosses some threshold — could be a follow-up worker. Today's behavior is "always prompt for unnamed"; keep that for safety.
- Editing edition-folder organization (worker 26).
- Persistent job state (worker 27).
