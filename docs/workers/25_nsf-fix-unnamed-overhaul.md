# Worker 25 — nsf-fix-unnamed-overhaul

**Model:** Sonnet · **Thinking:** ON · **Effort:** High
**Branch:** `feat/mux-magic-revamp/25-nsf-fix-unnamed-overhaul`
**Worktree:** `.claude/worktrees/25_nsf-fix-unnamed-overhaul/`
**Phase:** 3 (Name Special Features overhaul)
**Depends on:** 22 ✅, 3a ✅, 58 ✅, **59 (hard)** — 25 calls `moveFiles` / `fs.rename` in tight loops to route files into bucket folders. Worker 59 makes those calls fast (kernel `COPYFILE_FICLONE` block-copy, EXDEV streaming fallback, ZFS `aclmode=restricted` `fchmod`-EPERM treated as success). Without 59 every bucket move streams every byte and the disc-rip flow gets slower than today, not faster.
**Parallel with:** 26 (different module), 27 (different module), 23, 34 (different commands)

> **Doc history:** rewritten 2026-05-19 to drop the JSON-cache scaffolding (cache file, `dvdCompareReleaseId` keying, `--clear-unnamed-cache` flag, Edit-Variables-modal coordination) that the original doc author introduced and which didn't match the user's actual request. The user's model is *"the filesystem is the cache"* — leftovers move into `UNNAMED-FEATURES/` and dropped duplicates into `DUPLICATES/`, both as direct children of `sourcePath`. Approved plan lives at the session record.

---

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Tests must cover the change scope. Yarn only. See [AGENTS.md](../../AGENTS.md). Background context lives in [docs/PLAN.md §9](./PLAN.md).

---

## Your Mission

Overhaul how `nameSpecialFeaturesDvdCompareTmdb` handles **unnamed files** — files in the source folder whose filename hint and duration don't pin them to a DVDCompare cut or extra precisely enough — and **dropped duplicates** — files dropped from the duplicate-detection prompt when the user picks "this one is the real match."

Three live problems:

1. **Re-runs repeat themselves.** No "memory between runs" — NSF asks the same questions every time it processes the same folder.
2. **Server ranking is naive.** Worker 58 ships duration-weighted scoring in the client modal ([packages/web/src/components/SmartMatchModal/smartMatchScoring.ts](../../packages/web/src/components/SmartMatchModal/smartMatchScoring.ts)); the server's `buildUnnamedFileCandidates` still emits word-overlap-ranked strings. Worker 58 left a literal handoff comment at [buildUnnamedFileCandidates.ts:73-78](../../packages/core/src/app-commands/nameSpecialFeaturesDvdCompareTmdb.buildUnnamedFileCandidates.ts#L73-L78) authorizing worker 25 to relocate the scorer server-side.
3. **Filesystem state diverges from what the user can see.** A browser refresh, server crash, or "I'll come back to it tomorrow" close-out loses every in-flight Smart Match decision. The user wants to open Explorer and just *see* what's still pending.

**Solution (from approved plan):** filesystem becomes the source of truth.

- After NSF's rename pass, leftover unrenamed files auto-move into `<sourcePath>/UNNAMED-FEATURES/`.
- Files dropped by the duplicate-detection prompt auto-move into `<sourcePath>/DUPLICATES/`.
- Bucket folders are created lazily (first move creates them; no buckets ever appear on a fully-matched run).
- The Smart Match modal still opens after NSF completes, but it reads from `UNNAMED-FEATURES/` and Apply moves the file back to `sourcePath` with the new name in one operation.
- A refresh / crash / close-without-applying leaves a perfectly recoverable disc folder: the buckets are right there, the user can rename by hand or re-run NSF later.
- The user moving a file *back* into `sourcePath` (e.g. they figured out what `Title_3.mkv` actually is) returns it to the normal NSF pipeline on next run.

---

## Scope

### 1. Relocate scoring server-side

Port [packages/web/src/components/SmartMatchModal/smartMatchScoring.ts](../../packages/web/src/components/SmartMatchModal/smartMatchScoring.ts) to `packages/core/src/app-commands/nameSpecialFeaturesDvdCompareTmdb.rankCandidates.ts`. Identical algorithm — `DURATION_WEIGHT=0.7`, `DURATION_PROXIMITY_TOLERANCE_SECONDS=90`, `FILENAME_ONLY_SCORE_FACTOR=0.6`, `LOW_CONFIDENCE_THRESHOLD=0.6`. The 23-test suite ports verbatim alongside as `nameSpecialFeaturesDvdCompareTmdb.rankCandidates.test.ts`.

`buildUnnamedFileCandidates` then calls `rankCandidatesForFile` instead of its current word-overlap pass and emits `rankedCandidates: ScoredCandidate[]` per file. The obsolete word-overlap pass at [buildUnnamedFileCandidates.ts:50-93](../../packages/core/src/app-commands/nameSpecialFeaturesDvdCompareTmdb.buildUnnamedFileCandidates.ts#L50-L93) (and its `Worker 25` handoff comment) gets deleted.

Update `UnnamedFileCandidate` in [nameSpecialFeaturesDvdCompareTmdb.events.ts](../../packages/core/src/app-commands/nameSpecialFeaturesDvdCompareTmdb.events.ts):

```ts
type UnnamedFileCandidate = {
  filename: string
  extension: string
  durationSeconds: number | null
  rankedCandidates: ScoredCandidate[]  // was: candidates: string[]
}
```

Delete `packages/web/src/components/SmartMatchModal/smartMatchScoring.ts` + `.test.ts`. The modal reads scores from the server payload verbatim — no more client-side `rankSuggestions` call.

### 2. Order-based tie-break

Add to `rankCandidates.ts`:

```ts
export const ORDER_BONUS = 0.05

export const applyOrderBonus = ({
  rankedCandidates,
  fileIndex,
  dvdCompareOrder,
}: {
  rankedCandidates: ScoredCandidate[]
  fileIndex: number
  dvdCompareOrder: string[]
}): ScoredCandidate[]
```

If `fileIndex` matches the candidate's index in `dvdCompareOrder`, add `+ORDER_BONUS` to its `confidence`. The bonus is small enough that it never overrides duration evidence — it only breaks ties between equally-scored candidates. Re-sort afterward.

The caller in `buildUnnamedFileCandidates` threads the file's sorted-folder-listing index and the candidate-order array (from DVDCompare's published feature list) down.

### 3. Auto-route after the rename pass

In [nameSpecialFeaturesDvdCompareTmdb.ts](../../packages/core/src/app-commands/nameSpecialFeaturesDvdCompareTmdb.ts), after the existing rename pass completes:

- **Files matched & renamed** → unchanged (stay in `sourcePath`).
- **Leftover unrenamed files** → `fs.rename` into `<sourcePath>/UNNAMED-FEATURES/<original-filename>`. Folder created lazily on first move.
- **Files dropped by the duplicate-detection prompt** (the array filtered out at [duplicates.ts:124-139](../../packages/core/src/app-commands/nameSpecialFeaturesDvdCompareTmdb.duplicates.ts#L124-L139)) → `fs.rename` into `<sourcePath>/DUPLICATES/<original-filename>`. Same lazy creation.

Both buckets are siblings of the file's parent, so same-volume `fs.rename` always applies. Worker 59's `moveFiles` semantics carry the EXDEV fallback for any edge case, but the buckets themselves never cross volumes.

### 4. Skip bucket folders on re-run

In `nameSpecialFeaturesDvdCompareTmdb.ts`, the source-file enumeration uses `getFiles({ sourcePath })` (already non-recursive — files-only at top level). Add an explicit guard: if a folder named `UNNAMED-FEATURES` or `DUPLICATES` sits directly under `sourcePath`, log a one-line summary of bucket counts and never enumerate into them.

The guard is defense-in-depth — `getFiles`' non-recursion already prevents enumeration today — but it makes intent explicit and survives future changes to `getFiles`.

### 5. SmartMatchModal reads from UNNAMED-FEATURES/

The modal's Apply currently POSTs `/files/rename` with `oldPath: <sourcePath>/<filename>`. New behavior:

- `oldPath: <sourcePath>/UNNAMED-FEATURES/<filename>` (the file lives in the bucket now).
- `newPath: <sourcePath>/<newName>.<ext>` (rename + move-back-to-sourcePath in one operation).

The existing `/files/rename` endpoint already handles cross-folder `fs.rename` — no new route. The modal's rendering reads scores straight from the server-emitted `rankedCandidates` field; the client-side `rankSuggestions` call is deleted along with the file.

### 6. Collision check on Apply

Before firing any rename POSTs, the modal computes `newPath` for every checked row. If two checked rows produce the same `newPath`, halt the Apply and surface inline collision warnings on each conflicting row with a hint to disambiguate (via the worker-6f pencil edit, or by unchecking one). Apply only proceeds when no collisions remain.

Pattern reference: worker 66's pre-flight collision detection in `renameFiles` ([packages/tools/src/applyRenameRegex.ts](../../packages/tools/src/applyRenameRegex.ts)). Same shape — done client-side here because all target names are known before the user clicks.

### 7. Drive-by fix

[duplicates.ts:27](../../packages/core/src/app-commands/nameSpecialFeaturesDvdCompareTmdb.duplicates.ts#L27) uses `existing.push(rename)` — violates [the no-array-mutation rule](../agents/code-rules.md). Replace `groupRenamesByTarget`'s `Map.set + .push` body with a `.reduce` shape that returns a new `Map` per iteration. Since we're editing that file anyway for the DUPLICATES routing, this rides along.

---

## Files

### Modified

- [packages/core/src/app-commands/nameSpecialFeaturesDvdCompareTmdb.ts](../../packages/core/src/app-commands/nameSpecialFeaturesDvdCompareTmdb.ts) — auto-route after rename pass; thread DVDCompare candidate order through to `buildUnnamedFileCandidates`; add bucket-folder enumeration guard.
- [packages/core/src/app-commands/nameSpecialFeaturesDvdCompareTmdb.buildUnnamedFileCandidates.ts](../../packages/core/src/app-commands/nameSpecialFeaturesDvdCompareTmdb.buildUnnamedFileCandidates.ts) — call new `rankCandidatesForFile`; emit `rankedCandidates: ScoredCandidate[]`; delete obsolete word-overlap pass.
- [packages/core/src/app-commands/nameSpecialFeaturesDvdCompareTmdb.buildUnnamedFileCandidates.test.ts](../../packages/core/src/app-commands/nameSpecialFeaturesDvdCompareTmdb.buildUnnamedFileCandidates.test.ts) — replace word-overlap assertions with scored-candidate assertions.
- [packages/core/src/app-commands/nameSpecialFeaturesDvdCompareTmdb.duplicates.ts](../../packages/core/src/app-commands/nameSpecialFeaturesDvdCompareTmdb.duplicates.ts) — kill `.push` mutation; route dropped dupes to `DUPLICATES/`.
- [packages/core/src/app-commands/nameSpecialFeaturesDvdCompareTmdb.events.ts](../../packages/core/src/app-commands/nameSpecialFeaturesDvdCompareTmdb.events.ts) — `UnnamedFileCandidate.rankedCandidates`.
- [packages/web/src/components/SmartMatchModal/SmartMatchModal.tsx](../../packages/web/src/components/SmartMatchModal/SmartMatchModal.tsx) — read scores from server; `oldPath` includes `UNNAMED-FEATURES/`; add Apply-time collision check.
- [packages/web/src/components/SmartMatchModal/SmartMatchModal.test.tsx](../../packages/web/src/components/SmartMatchModal/SmartMatchModal.test.tsx) — new payload shape; collision test cases.
- `packages/api/src/fake-data/scenarios/nameSpecialFeaturesDvdCompareTmdb.ts` — emit the new payload; simulate bucket moves in fake-mode.
- [docs/workers/MANIFEST.md](MANIFEST.md) — flip row to `in-progress` at start, `done` at merge.

### New

- `packages/core/src/app-commands/nameSpecialFeaturesDvdCompareTmdb.rankCandidates.ts`
- `packages/core/src/app-commands/nameSpecialFeaturesDvdCompareTmdb.rankCandidates.test.ts`

### Deleted

- `packages/web/src/components/SmartMatchModal/smartMatchScoring.ts`
- `packages/web/src/components/SmartMatchModal/smartMatchScoring.test.ts`

### Reused (do NOT recreate)

- `@mux-magic/tools` `getFiles`, `renameFileOrFolder`, `makeDirectory`, `FileInfo`
- `packages/api/src/api/routes/filesRoutes.ts` `/files/rename` (existing endpoint handles cross-folder rename via `fs.rename`)
- `packages/core/src/tools/getUserSearchInput.ts` (duplicates prompt — unchanged)
- `packages/tools/src/applyRenameRegex.ts` collision-detection idiom for the modal's pre-flight check

---

## TDD steps

1. Failing test: server-side `rankCandidatesForFile` reproduces all 23 cases from the relocated `smartMatchScoring.test.ts` suite.
2. Port `smartMatchScoring.ts` to `nameSpecialFeaturesDvdCompareTmdb.rankCandidates.ts`; tests green.
3. Failing test: order-based tie-break adds +0.05 at matching positions; never overrides duration evidence.
4. Implement `applyOrderBonus`; tests green.
5. Failing test: `buildUnnamedFileCandidates` emits `rankedCandidates: ScoredCandidate[]` (not `candidates: string[]`).
6. Update `buildUnnamedFileCandidates`; tests green. Delete client-side `smartMatchScoring.ts` + `.test.ts`.
7. Failing test: NSF run with 3 leftovers → after completion, `UNNAMED-FEATURES/` contains exactly those 3 files; `sourcePath` no longer does.
8. Implement bucket-move pass in `nameSpecialFeaturesDvdCompareTmdb.ts`; tests green.
9. Failing test: duplicate prompt drops 2 files → after completion, `DUPLICATES/` contains exactly those 2 files.
10. Update `duplicates.ts` to invoke bucket-move; kill `.push` mutation; tests green.
11. Failing test: NSF re-run on a folder with pre-existing `UNNAMED-FEATURES/` does not enumerate it.
12. Implement bucket-folder skip guard; tests green.
13. SmartMatchModal test: scores render from server payload (no client `rankSuggestions` call); Apply POSTs `oldPath: .../UNNAMED-FEATURES/...`.
14. SmartMatchModal test: two checked rows with same target → Apply halts with inline collision warning; unchecking one resolves it; Apply succeeds.
15. Update fake-data scenario; e2e spec covering the full flow (NSF run → buckets created → modal opens with server scores → Apply moves file back).
16. Full pre-merge gate: `yarn lint → typecheck → test → e2e → lint`.

---

## Verification checklist

- [ ] Worker 59 ✅ merged before starting (hard prereq)
- [ ] Workers 22 ✅ + 3a ✅ + 58 ✅ already merged
- [ ] Worktree created
- [ ] Manifest row → `in-progress`
- [ ] Failing tests committed first
- [ ] Server-side `rankCandidatesForFile` reproduces the 23 legacy scoring tests
- [ ] Order tie-break activates only on equal-score ties
- [ ] `buildUnnamedFileCandidates` returns `rankedCandidates: ScoredCandidate[]` sorted by confidence
- [ ] `UNNAMED-FEATURES/` populated by leftover files after NSF completes; `sourcePath` no longer holds them
- [ ] `DUPLICATES/` populated by dropped-duplicate files after NSF completes
- [ ] Bucket folders created lazily (no buckets after a fully-matched run)
- [ ] Re-run on a folder with pre-existing `UNNAMED-FEATURES/` skips it
- [ ] SmartMatchModal renders scores from server payload (no client-side `rankSuggestions`)
- [ ] SmartMatchModal Apply POSTs `oldPath` under `UNNAMED-FEATURES/`
- [ ] SmartMatchModal Apply halts on cross-row target collisions and surfaces inline warnings
- [ ] `.push` mutation in `duplicates.ts` replaced with non-mutating shape
- [ ] Standard gate clean (`yarn lint → typecheck → test → e2e → lint`)
- [ ] PR opened against `feat/mux-magic-revamp`
- [ ] Manifest row → `done`

---

## Out of scope

- JSON cache file at `<userDataDir>/mux-magic/unnamed-cache.json`. Replaced by `UNNAMED-FEATURES/`.
- `dvdCompareReleaseId` cache keying. The filesystem is the key.
- `--clear-unnamed-cache` CLI flag. Replaced by `rm -r UNNAMED-FEATURES`.
- Edit Variables modal "Clear cache" button. No cache exists.
- A new `/files/rename` endpoint. The existing one already handles cross-folder `fs.rename`.
- Plex-suffix selector / ✏ pencil-edit affordance — worker 6f's scope.
- Auto-resolve when top score crosses a threshold — could be a follow-up worker; for now we keep "always prompt for unnamed."
- Worker 27 coordination on a shared `<userDataDir>/mux-magic/` directory. No overlap remains — 27 is solely `paused`-state job persistence.
- ML-based fuzzy matching. Duration + word-overlap (+ order tie-break) is the bar; no embeddings or model calls.
- Editing edition-folder organization — that's worker 26.
- Persistent job state — that's worker 27.
