# WORKER W8C — Unify Collapse Chevrons + Dry Run Badge Color

**Model:** Haiku · **Thinking:** OFF · **Effort:** Low
**Branch:** `react-migration`
**Parallel with:** W8B W8D W8E W8F W8G W8H W8I W8J

---

## Universal Rules

1. **Branch:** all work on `react-migration`. No new branches.

2. **TDD workflow — mandatory:**
   - Write the test first. The test must fail before you write any fix code.
   - Commit the failing test: `test(<area>): failing test for <bug description>`
   - Write the minimum code to make the test pass.
   - Commit the fix: `fix(<area>): <description>`
   - Do not skip the failing-first step.

3. **Pre-push gate — every push, no exceptions:**
   ```bash
   yarn test run
   yarn typecheck
   yarn lint
   ```

4. **E2E gate — run before marking Done:**
   ```bash
   yarn test:e2e
   ```
   If no e2e suite exists yet, note it in the checklist and continue.

5. **Test rules:** No snapshot tests. No screenshot tests. Assertions must be explicit
   inline values (`expect(x).toBe("literal")` or `expect(x).toEqual({ key: "value" })`).

6. **Commit-and-push as you go.** Small logical chunks.

7. **Update `docs/react-migration-checklist.md`** at start (🔄 In Progress) and end
   (✅ Done) of your worker section. Include one progress-log line per push.

8. **Yarn only.** Never npm or npx.

---

## Bug B5 — Unify Collapse Chevrons

Two collapsible sections use different triangle glyphs at different sizes. Both should
use the `CollapseChevron` SVG icon component.

| Location | Current chevron | Problem |
|----------|-----------------|---------|
| `SubtitleRulesField.tsx` "Default rules" button | Unicode `▸` / `▾` in `text-xs` button | Visually smaller than Predicates |
| `PredicatesManager.tsx` "Predicates" section | Native `<details>` / `<summary>` UA triangle | Larger than Default rules, inconsistent |

### Reuse

`packages/web/src/icons/CollapseChevron/CollapseChevron.tsx`
- Props: `{ isCollapsed: boolean }`
- Renders `w-3.5 h-3.5` SVG, rotates `-rotate-90` when collapsed
- Already used in `StepCard.tsx` and `GroupCard.tsx`

---

## Bug B11 — Dry Run Badge Color

The "DRY RUN" badge in `PageHeader` always renders amber even when Simulate Failures
is ON (`failureMode === true`). It should turn red when failure simulation is active.

---

## TDD steps

1. Write tests that assert:
   - Clicking "Default rules" toggle renders `<svg>` with `-rotate-90` class when
     collapsed, and without when expanded.
   - Clicking "Predicates" button renders `<svg>` with same class pattern.
   - When `failureMode` is true, the "DRY RUN" badge has a red class (e.g. `text-red-400`).
   - When `failureMode` is false, the badge has an amber class (e.g. `text-amber-400`).
   These tests must fail first.
2. **`SubtitleRulesField.tsx`:** import `CollapseChevron`; replace `{isPreviewOpen ? "▾" : "▸"}`
   with `<CollapseChevron isCollapsed={!isPreviewOpen} />`.
3. **`PredicatesManager.tsx`:** import `CollapseChevron`; replace the `<details>`/`<summary>`
   element with a plain `<button>` + `<CollapseChevron isCollapsed={!isOpen} />`. The
   existing `isOpen` state is already present — no new state needed. Wire the `onClick`
   to `() => setIsOpen((prev) => !prev)`. Render children with `{isOpen && <div>...</div>}`.
4. **`PageHeader.tsx`:** the "DRY RUN" badge already reads `failureMode` from
   `useAtom(failureModeAtom)`. Change the badge's className to use red when
   `failureMode === true`, amber otherwise. Example:
   ```tsx
   className={`... ${failureMode
     ? "bg-red-500/20 hover:bg-red-500/35 text-red-400 border-red-500/40"
     : "bg-amber-500/20 hover:bg-amber-500/35 text-amber-400 border-amber-500/40"
   }`}
   ```
   Also update the `title` attribute: `"Dry run ON (failure mode) — click to disable"` vs
   `"Dry run ON — click to disable"`.
5. Verify all tests pass.

## Files

- `packages/web/src/components/SubtitleRulesField/SubtitleRulesField.tsx`
- `packages/web/src/components/DslRulesBuilder/PredicatesManager.tsx` (find via grep for `<details>`)
- `packages/web/src/components/PageHeader/PageHeader.tsx`
- `packages/web/src/icons/CollapseChevron/CollapseChevron.tsx` (read-only reference)

---

## Verification checklist

Before marking Done:

- [ ] Failing test committed before fix code
- [ ] `yarn test run` — all tests pass
- [ ] `yarn typecheck` — clean
- [ ] `yarn lint` — clean
- [ ] `yarn test:e2e` — passes (or noted in checklist if suite absent)
- [ ] New tests cover the exact regression scenario
- [ ] Checklist row updated to ✅ Done in `docs/react-migration-checklist.md`
- [ ] Pushed to `origin/react-migration`
