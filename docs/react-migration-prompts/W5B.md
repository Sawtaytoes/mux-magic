# W5B spawn prompt — Restore missing builder UI controls + drag-and-drop fix

Paste the block below into a fresh Claude Code session opened in `d:\Projects\Personal\media-tools`.

---

You are Worker W5B in the React Migration Recovery for media-tools.

**Working directory:** worktree at `.claude/worktrees/w5b` (set up below; isolates you from W5A which runs in the main checkout).
**Branch:** new `feat/restore-builder-controls` off `react-migration`; merges back to `react-migration` when done.
**Your model:** Sonnet 4.6, **high effort**
**Your role:** Fix the regression and missing-control gaps the user found during manual verification of the React app. Wave D shipped the *atoms* + drag hook but the **UI affordances** users click are gone or broken. This is real feature work, not polish.

W5B runs **in parallel with W5A** (cleanup worker, in the main checkout). Both target `react-migration` eventually, but you work on a feature branch in a worktree to avoid filesystem races on the same files.

## Worktree setup

```bash
git worktree add .claude/worktrees/w5b -b feat/restore-builder-controls react-migration
cd .claude/worktrees/w5b
yarn install
```

All your work happens in this worktree. When you finish, merge `feat/restore-builder-controls` back to `react-migration` (the user will handle the final master merge separately).

## Required reading before doing anything

1. [docs/react-migration-recovery-handout.md](../react-migration-recovery-handout.md) — Universal Rules apply (especially #2 pre-push gate, #4 no snapshot/VRT, #8 keep checklist honest).
2. [docs/react-migration-checklist.md](../react-migration-checklist.md) — current state. Master was rewound back to pre-migration so the user can verify; everything is on `react-migration`.
3. The legacy implementations (deleted from disk but reachable in git history) for reference:
   - `git show 7b92c62^:packages/web/public/builder/js/components/step-card.js` — pre-W3 StepCard
   - `git show 7b92c62^:packages/web/public/builder/js/components/group-card.js` — pre-W3 GroupCard
   - `git show 7b92c62^:packages/web/public/builder/js/components/drag-and-drop.js` — pre-W3 drag-and-drop wiring
   These tell you what controls existed and where they wired to.

## The gaps (from user verification)

### Critical (blocks "100% parity" claim)

1. **Drag-and-drop is broken.** Wave D's `packages/web/src/hooks/useDragAndDrop.ts` exists and Wave D was marked done, but dragging step cards in the React builder does nothing. Either:
   - The hook is unwired (StepCard / GroupCard doesn't call it)
   - The hook is wired but the Sortable.js handle markers are missing from the JSX
   - W3's cleanup accidentally removed a dependency
   Read `useDragAndDrop.ts` first to understand the contract, then walk StepCard/GroupCard to see whether the hook's required props/refs are in place.

2. **Up/down arrow buttons are missing** on step cards. These were the *alternative* reorder UX (when you don't want to drag). Add buttons that call existing reorder logic in `sequenceAtoms.ts` (look for `moveStepUp`/`moveStepDown` or similar action atoms — port them if absent).

3. **Play button (per-step run) is missing.** Wires to `runOrStopStep` — currently a `window.foo?.()` graceful-degradation stub per W4A's audit (in `types.window.d.ts`). You own this: create an action atom + hook function, wire the button, remove the entry from `types.window.d.ts`. **Coordinate with W5A:** W5A originally had `runOrStopStep` in its 5-bridge-globals list; W5A's prompt has been (or will be) updated to drop it from their list since W5B owns this one.

4. **X (delete step) button is missing.** Wires to existing `removeStepAtom` or similar in `sequenceAtoms.ts`. If the action atom doesn't exist, add it (mirroring `insertStepAtom`).

### Medium (test/story polish — could split out)

5. **YamlModal doesn't show up in Storybook.** Investigate: is it `YamlPasteModal` (input) vs `YamlDisplayModal` (output)? If it's display-only, the story needs to feed it YAML via atom state in the decorator. Read the component to confirm direction, then either rename or fix the story.

6. **PathVarCard story has no file-lookup dropdown.** Check whether the dropdown is part of `PathVarCard` itself or a sibling/portal. If it's part of the component, ensure the story renders it; if it lives outside, the story may not need it.

7. **`DvdCompareWithResults` story errors** with `"Unexpected token 'N', "Not Found" is not valid JSON"` — backend call isn't mocked. Add MSW handlers to the story decorator returning fixture data.

## Coordination with W5A

Both workers run on `react-migration` simultaneously. Disjoint file ownership keeps merges clean:

| Area | W5A owns | W5B owns |
|---|---|---|
| `JsonField/*` | ✅ | — |
| `PageHeader.mdx` | ✅ | — |
| `pasteCardAt` / `copyGroupYaml` / `runGroup` / `copyStepYaml` atoms | ✅ (4 of original 5) | — |
| `runOrStopStep` atom | — | ✅ |
| `StepCard/*`, `GroupCard/*`, `PathVarCard/*` | — | ✅ |
| `useDragAndDrop.ts` | — | ✅ |
| Page stories (`BuilderPage.stories.tsx`, `JobsPage.stories.tsx`) | ✅ | — |
| Storybook polish (YamlModal/PathVarCard/DvdCompare investigations) | — | ✅ |
| `types.window.d.ts` | Removes 4 entries | Removes 1 entry (`runOrStopStep`) |
| `buildBuilderUrl` format audit | ✅ | — |

If W5A has updated their prompt to drop `runOrStopStep` from their list, the coordination is correct. If not, ping the orchestrator — there's a redundant-port risk.

`git pull --rebase origin react-migration` before every push. Use `Edit` (not `Write`) for any file W5A might also be editing.

## Pre-push gate (Universal Rule #2)

Every commit before push:

```bash
yarn test run
yarn typecheck
yarn lint
```

All three must pass. `yarn e2e` is not in your gate (W4C handles e2e), but if you happen to break a spec by changing UI, surface the conflict and coordinate.

## Commit cadence

One feature per commit. Suggested order:

1. `fix(builder): restore drag-and-drop wiring on StepCard + GroupCard` — get the existing hook working
2. `feat(builder): up/down reorder buttons on StepCard` (+ atom if needed)
3. `feat(builder): X delete button on StepCard` (+ atom if needed)
4. `feat(builder): play/stop button on StepCard wires runOrStopStep atom` — your bridge-global port
5. `chore(types): remove runOrStopStep from types.window.d.ts` (shrinking-inventory pattern)
6. Storybook polish items as separate small commits

Tests inline-assertion only (Universal Rule #4). No snapshots. No VRT.

## Checklist updates (Universal Rule #8)

- At start: mark W5B 🔄 In Progress.
- Per commit: append to Progress Log.
- At end: mark W5B ✅ Done with a one-line summary.

## When done

Reply with:
- Commit SHAs grouped by feature
- Drag-and-drop verdict: was it unwired, broken Sortable usage, or something else? One sentence.
- Test count delta (was 1004 + decodeSeqParam's 8 = 1012 before you started)
- Pre-push gate state for final commit
- Any storybook polish items punted (W5AC candidates)
- Confirmation that W4C can now write e2e specs for the restored controls
