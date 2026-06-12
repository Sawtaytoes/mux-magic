# Worker 7b — smartmatch-auto-open-on-nsf-completion

**Model:** Haiku · **Thinking:** OFF · **Effort:** Low
**Branch:** `feat/mux-magic-revamp/7b-smartmatch-auto-open-on-nsf-completion`
**Worktree:** `.claude/worktrees/7b_smartmatch-auto-open-on-nsf-completion/`
**Phase:** 3 (NSF interactive flow)
**Depends on:** 58 (SmartMatchModal + NsfRunResults exist)
**Parallel with:** workers that don't touch `packages/web/src/components/NsfRunResults/` or `packages/web/src/components/SmartMatchModal/`

---

## Universal Rules (TL;DR)

Worktree-isolated. Yarn only. Pre-merge gate: `yarn lint → typecheck → test`. TDD: failing test first. See [AGENTS.md](../../AGENTS.md).

---

## Context

In v1.0.0, the legacy `wireNameSpecialFeaturesResults` function in `public/builder/js/run-sequence/step-results.js` automatically opened the Smart Match modal once per step completion when leftover unnamed files were present AND DVDCompare candidates were available. The relevant code:

```js
// Auto-open once per step completion so the user can't miss unmatched files.
// The flag is reset in runStep so it fires again on the next run.
if (hasSmartMatchDataForAutoOpen && !step._smartMatchAutoOpened) {
  step._smartMatchAutoOpened = true
  openSmartMatchModal()
}
```

The React port (`packages/web/src/components/NsfRunResults/NsfRunResults.tsx`) has a "✨ Fix Unnamed" button but no auto-open. The user who finishes an NSF run and has leftover files can miss the actionable modal entirely if they don't notice the button.

This worker adds a `useEffect` to `NsfRunResults` that fires the auto-open once per unique `(jobId, stepId)` pair when `isSmartMatchAvailable` is true.

---

## Your Mission

In `NsfRunResults`, add a `useEffect` that calls `openSmartMatch()` automatically on the first render where `isSmartMatchAvailable === true`. Guard with a `hasAutoOpened` ref so it fires at most once per `(jobId, stepId)` instance — re-renders don't re-open; the next run resets the guard because the component unmounts and remounts with a new `jobId`.

```tsx
const hasAutoOpenedRef = useRef(false)

useEffect(() => {
  if (!isSmartMatchAvailable || hasAutoOpenedRef.current) {
    return
  }
  hasAutoOpenedRef.current = true
  openSmartMatch()
}, [isSmartMatchAvailable, openSmartMatch])
```

`openSmartMatch` is already defined inside the component; wrap it in `useCallback` to stabilize the reference so the `useEffect` dep array is correct.

---

## Files

### Modified

- `packages/web/src/components/NsfRunResults/NsfRunResults.tsx` — add `useCallback` on `openSmartMatch`, add `useRef<boolean>` guard, add `useEffect` that auto-opens once.
- `packages/web/src/components/NsfRunResults/NsfRunResults.test.tsx` (create if it doesn't exist, or update) — add: (a) `SmartMatchModal` is opened automatically when `isSmartMatchAvailable` is true on first render; (b) it is NOT re-opened on re-render; (c) it is NOT opened when `isSmartMatchAvailable` is false (no leftover files or no sourcePath).
- `docs/workers/MANIFEST.md` — flip to `in-progress` at start, `done` after PR merge.

---

## TDD steps

1. `NsfRunResults` with `summary.unnamedFileCandidates.length > 0` and `sourcePath` set → `smartMatchModalAtom` is set (auto-opened) on first render.
2. `NsfRunResults` re-rendered with the same props → atom is NOT set a second time (guard fires once).
3. `NsfRunResults` with `summary.unnamedFileCandidates` empty → atom is NOT set.
4. `NsfRunResults` with `sourcePath = null` → atom is NOT set.

---

## Verification checklist

- [ ] Worktree created
- [ ] Manifest row → `in-progress`
- [ ] Failing tests written first
- [ ] `openSmartMatch` wrapped in `useCallback`
- [ ] `hasAutoOpenedRef` guard prevents duplicate opens
- [ ] `useEffect` deps are stable (no missing-dep lint warnings)
- [ ] Tests pass: auto-opens once; doesn't open on empty or null-path
- [ ] Standard pre-merge gate clean: `yarn lint → typecheck → test`
- [ ] PR opened against `feat/mux-magic-revamp`
- [ ] Manifest row → `done`

---

## Out of scope

- **Re-opening on next run:** the component unmounts when the job card disappears; a new `jobId` instance gets a fresh ref. No explicit "reset on re-run" logic is needed.
- **User preference to disable auto-open:** not in v1.0.0 behavior; defer if ever requested.
