# 2026-05-19 — NSF state lives in the filesystem, not a JSON cache

- **Status:** Accepted
- **Date decided:** 2026-05-19 (design locked); shipped 2026-05-20 in merge `0b93d1c8` (PR #140)
- **Area:** core / web
- **Source:** worker 25, commits `6806ed66` (doc rewrite), `3bc676b7` (auto-route leftovers + dupes). Depends on worker 59 fast-rename. Re-asserted by the user 2026-06-29/30 (this is the conversation that prompted writing it down).
- **Verified in code:** `packages/core/src/app-commands/nameSpecialFeaturesDvdCompareTmdb.buckets.ts` (`BUCKET_NAMES` — exactly two), `packages/web/src/components/SmartMatchModal/SmartMatchModal.tsx` (move-back-on-Apply).

## Decision

For Name Special Features (NSF), **the location of a file on disk IS its state.** There is no JSON metadata sidecar. The user's local rips directory (they call it **"Disc-Rips"**; the code calls it `sourcePath`) holds exactly **two** state-bucket subfolders that NSF reads and writes via fast `fs.rename`:

```text
Disc-Rips/  (= sourcePath, the main directory)            STATE = LOCATION
│
├── <final-named feature>.mkv     ← "named / done": every successfully matched
│                                   and renamed feature lives in the main dir.
│
├── UNNAMED-FEATURES/             ← "still needs a name": leftovers NSF couldn't
│   └── <unresolved>.mkv            pin to a DVDCompare cut / TMDB extra (filename
│                                   + duration too weak). The Smart Match modal
│                                   reads from HERE.
│
└── DUPLICATES/                   ← "dropped": files the user discarded at the
    └── <dropped dupe>.mkv          duplicate-detection prompt ("this other one
                                    is the real match").
```

Rules that make this work, all confirmed in the shipped code:

- **Only two buckets** (`BUCKET_NAMES = { UNNAMED-FEATURES, DUPLICATES }`). Editions are worker 26; paused-job persistence is worker 27 — both out of scope for *this* model.
- **Buckets are created lazily** — they never appear on a fully-matched run.
- **Buckets are auto-populated via `fs.rename` after the rename pass completes**, not before.
- **On re-run, the bucket folders are logged and skipped** (`getFilesAtDepth` at depth 0 is files-only, plus an explicit name guard), so they don't get re-ingested as if they were fresh input.
- **A refresh / crash / "I'll finish tomorrow" loses nothing** — the buckets are right there on disk; re-open and the location of each file tells the whole story, with **no prompts needed**.

**Resolution — the one allowed "move back":** when the user picks a name in the Smart Match modal (which reads candidates from `UNNAMED-FEATURES/`), Apply is a **single atomic `fs.rename`** via the existing `/files/rename` route:

```text
oldPath: sourcePath/UNNAMED-FEATURES/<file>
newPath: sourcePath/<finalName>.<ext>     (SmartMatchModal: newPath = joinPath(state.sourcePath, finalName))
```

That is rename-and-relocate in one operation — the file is **moved, not duplicated**, and only once it has earned its final name.

## What we rejected — DO NOT revert to this

- **DO NOT copy/move files back into the main directory wholesale.** Only the *single resolved, final-named file* returns to `Disc-Rips`, and only via the atomic rename above. Still-unresolved leftovers stay in `UNNAMED-FEATURES/`; dropped duplicates stay in `DUPLICATES/`. Do **not** bulk-copy a bucket back, do **not** round-trip unresolved files into the main dir, and do **not** "restore" or "reconstruct" state by copying files around. This is the exact behavior that prompted writing this record — an agent kept copying things back into the main directory and breaking the resume-from-filesystem model. In the user's words:
  > "We'd agreed to use `UNNAMED-FEATURES/` and some other directories under Disc-Rips as a way to know the 'state' of the special features when renaming. … We shouldn't have to copy stuff back into the main directory because we chose **not** to use JSON metadata files and instead use the filesystem itself."
- **DO NOT reintroduce a JSON cache.** The original worker-25 prompt proposed `unnamed-cache.json`, `dvdCompareReleaseId` cache keying, a `--clear-unnamed-cache` flag, and an Edit-Variables-modal "clear cache" button. All dropped: the cache is `UNNAMED-FEATURES/`, the key is the filesystem, "clear" is `rm -r UNNAMED-FEATURES`, and no cache exists to wire a button to. **The filesystem IS the cache.**
- **DO NOT move ranking to the client** — see [Smart Match scoring runs server-side](2026-05-19-smartmatch-scoring-server-side.md).

## Why it must not be re-litigated

We chose the filesystem over JSON metadata specifically for crash/refresh recoverability *without* prompts: the bucket a file sits in tells the whole story, and the user can inspect pending work directly in their file explorer. A JSON cache splits state across two places (disk + JSON) so a crash/refresh/close-out orphaned in-flight Smart Match decisions — the precise bug PR #140 removed. Copying buckets back into the main dir, or layering a JSON cache on top "for performance," destroys exactly that property and silently reintroduces the un-resumable state the redesign deleted. The bucket moves rely on worker 59's fast same-volume `fs.rename`.
