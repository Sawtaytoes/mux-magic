# W7F spawn prompt — DnD drop indicator + group droppable zone + tests/stories

Paste the block below into a fresh Claude Code session opened in `d:\Projects\Personal\media-tools`.

---

You are Worker W7F in the React Migration Recovery for media-tools.

**Working directory:** worktree at `.claude/worktrees/w7f` (set up below).
**Branch:** new `fix/dnd-drop-indicator` off `react-migration`; merges back to `react-migration` when done.
**Your model:** Sonnet 4.6, medium effort
**Your role:** Fix three DnD UX gaps and add comprehensive test + story coverage for drag-and-drop and the builder sequence list.

W7F is parallel with W7A/B/C/D/E (disjoint files):
- W7A: modal primitives + Storybook reorg
- W7B: LinkPicker bugs
- W7C: sequence runner Content-Type fix
- W7D: PathField typing + PathPicker wiring
- W7E: SubtitleRulesField default-rules preview
- W7F: `BuilderSequenceList.tsx`, `GroupCard.tsx`, `sequenceAtoms.ts` (DnD only), new test + story files

All issues are **[PARITY]** or **[COVERAGE]** — the legacy builder had visible drop indicators; the React test suite has zero DnD unit tests or `BuilderSequenceList` stories.

## Required reading

1. [docs/react-migration-recovery-handout.md](../react-migration-recovery-handout.md) — Universal Rules (especially #4 no snapshot/VRT).
2. [docs/react-migration-checklist.md](../react-migration-checklist.md) — current state.
3. `packages/web/src/pages/BuilderSequenceList/BuilderSequenceList.tsx` — full DnD context setup.
4. `packages/web/src/components/GroupCard/GroupCard.tsx` — inner `SortableContext` for group steps.
5. `packages/web/src/state/sequenceAtoms.ts` — `dragReorderAtom` (lines ~606–760); understand the four cases: same-container top-level, same-container group, cross-container to group, cross-container from group.
6. `packages/web/src/components/StepCard/StepCard.tsx` — `isDragOverlay` prop, how it skips `setNodeRef` / listeners.

## Worktree setup

```bash
git worktree add .claude/worktrees/w7f -b fix/dnd-drop-indicator react-migration
cd .claude/worktrees/w7f
yarn install
```

## Stream 1 — Visual drop indicator

### Problem
While dragging, there is no highlight showing where the item will land. The legacy builder showed a colored highlight on the target row or group border.

### Fix
`@dnd-kit` exposes the `over` property on its drag context. The pattern is:

1. Add `onDragOver` to `<DndContext>` in `BuilderSequenceList.tsx`:
   ```tsx
   const [overId, setOverId] = useState<string | null>(null)
   // in DndContext:
   onDragOver={(event) => setOverId(event.over?.id as string ?? null)}
   onDragEnd={(event) => { setOverId(null); handleDragEnd(event) }}
   onDragCancel={() => setOverId(null)}
   ```

2. Pass `isDropTarget={overId === item.id}` down to `<StepCard>` and `<GroupCard>`.

3. In `StepCard.tsx`, when `isDropTarget` is true (and not `isDragOverlay`), add a ring highlight to the outer container:
   ```
   className={`step-card ... ${isDropTarget ? "ring-2 ring-blue-500/60" : ""}`}
   ```

4. In `GroupCard.tsx`, when `isDropTarget` is true (overId is the group's id), add a ring highlight to the outer container similarly.

Keep the prop optional (`isDropTarget?: boolean`) so existing stories and tests pass without change.

Commit: `fix(dnd): add visual drop-target highlight ring to StepCard and GroupCard`

## Stream 2 — Group droppable zone when empty / sparsely-populated

### Problem
Dropping a step **into a group** requires landing precisely between two existing steps. If a group has zero or one step, the drop zone is very small. The user reported: "it's really tough to get rid. The old one let you drop anywhere in the group."

### Root cause
`@dnd-kit`'s `SortableContext` only creates hit areas for existing items. An **empty** group has zero items → zero hit areas → you can't drop into it at all.

### Fix
Use `useDroppable` (from `@dnd-kit/core`) on the group's inner container div to make the entire group body a fallback drop target:

```tsx
import { useDroppable } from "@dnd-kit/core"

// Inside GroupCard, alongside useSortable:
const { setNodeRef: setDroppableRef, isOver } = useDroppable({
  id: `${group.id}-droppable`,  // distinct ID from the group drag handle
})
```

Then apply `setDroppableRef` to the inner `<div className={containerClasses}>` that wraps the step cards:

```tsx
<div
  ref={setDroppableRef}
  className={`${containerClasses} p-3 min-h-[3rem] ${isOver ? "bg-blue-900/20" : ""}`}
>
```

The `min-h-[3rem]` ensures even an empty group has a clickable drop area.

Now wire the `dragReorderAtom` handler. When `overId` is `"<groupId>-droppable"`, treat it as "append to end of this group". Update `handleDragEnd` in `BuilderSequenceList.tsx`:

```tsx
const handleDragEnd = (event: DragEndEvent) => {
  setActiveId(null)
  setOverId(null)
  const { active, over } = event
  if (!over || active.id === over.id) return

  const sourceContainerId = ...  // same as before
  let targetContainerId = (over.data.current?.sortable?.containerId as string) ?? "top-level"

  // Droppable group-body zones emit their own ID, not a sortable containerId.
  // Map "<groupId>-droppable" → targetContainerId = groupId, overId = ""
  let resolvedOverId = over.id as string
  if (resolvedOverId.endsWith("-droppable")) {
    const groupId = resolvedOverId.replace(/-droppable$/, "")
    targetContainerId = groupId
    resolvedOverId = "" // signals "append to end"
  }

  dragReorder({
    activeId: active.id as string,
    overId: resolvedOverId,
    sourceContainerId,
    targetContainerId,
  })
}
```

`dragReorderAtom` already handles `overId = ""` by inserting at `cloned.length` / `targetGroup.steps.length` (the cross-container branch at line ~710: `overIndex < 0 ? targetGroup.steps.length : overIndex`). So no atom changes needed.

Commit: `fix(dnd): make group body a droppable fallback zone for empty groups`

## Stream 3 — GroupCard DragOverlay

### Problem
Dragging a **group** shows no floating overlay — the `DragOverlay` in `BuilderSequenceList.tsx` only handles `StepCard`. The active item goes translucent (opacity 0.3) with nothing floating.

### Fix
Extend `BuilderSequenceList.tsx` to also track the active group:

```tsx
const activeGroup = activeId
  ? (steps.find(
      (item) => isGroup(item) && item.id === activeId,
    ) as Group | undefined) ?? null
  : null
```

Then in `<DragOverlay>`:
```tsx
<DragOverlay>
  {activeStep ? (
    <div className="opacity-90 rotate-1 shadow-2xl">
      <StepCard step={activeStep} index={...} isFirst={false} isLast={false} isDragOverlay />
    </div>
  ) : activeGroup ? (
    <div className="opacity-90 rotate-1 shadow-2xl">
      <GroupCard
        group={activeGroup}
        itemIndex={0}
        startingFlatIndex={0}
        isFirst={false}
        isLast={false}
        isDragOverlay
      />
    </div>
  ) : null}
</DragOverlay>
```

Add `isDragOverlay?: boolean` prop to `GroupCard` (parallel to `StepCard`). When `isDragOverlay` is true:
- Do NOT attach `sortable.setNodeRef` — pass `undefined` (same pattern as `StepCard`)
- Do NOT spread `sortable.attributes` or `sortable.listeners` on the drag handle
- Still render the full group card content (header + inner steps) at normal opacity

Commit: `fix(dnd): add GroupCard DragOverlay so dragging a group shows a floating preview`

## Stream 4 — Tests for dragReorderAtom

Create `packages/web/src/state/dragReorderAtom.test.ts` (or add to an existing `sequenceAtoms.test.ts` if it exists — check first).

Test cases (use `getDefaultStore()` from jotai or the jotai test utilities pattern already used in the codebase — grep for `createStore` or `getDefaultStore` to find the pattern):

1. **Top-level reorder** — `[A, B, C]` → drag A to after C → `[B, C, A]`
2. **Intra-group reorder** — group with steps `[s1, s2, s3]` → drag s1 to index 2 → `[s2, s3, s1]`
3. **Cross-container: step to group** — top-level `[stepX, group1]` where `group1.steps = [s1]` → drag stepX into group1 (overId = s1.id) → top-level becomes `[group1]`, `group1.steps = [stepX, s1]` OR `[s1, stepX]` depending on position
4. **Cross-container: step OUT of group** — `group1.steps = [s1, s2]`, top-level `[group1, stepY]` → drag s1 out to top-level position before stepY → top-level becomes `[group1, s1, stepY]`, `group1.steps = [s2]`
5. **Append to empty group** — top-level `[stepX, group1]` where `group1.steps = []` ... wait, groups can't be empty. Instead test: `group1.steps = [s1]`, drag `stepX` → `overId = ""`, `targetContainerId = group1.id` → appends → `group1.steps = [s1, stepX]`
6. **Guard: group cannot be dragged into a group** — top-level `[group1, group2]` → attempt to drag group1 into group2 → sequence unchanged

No snapshot tests. Assert the resulting `stepsAtom` state directly.

Commit: `test(dnd): unit tests for dragReorderAtom — 6 cases covering all move paths`

## Stream 5 — BuilderSequenceList story

Create `packages/web/src/pages/BuilderSequenceList/BuilderSequenceList.stories.tsx`.

The story file needs to **seed Jotai atoms** with fixture steps. Follow the pattern from `BuilderPage.stories.tsx` (W5A) — use a decorator that wraps in a custom Jotai provider or use `useHydrateAtoms`.

Story variants:
1. **Empty** — `stepsAtom = []`; should show "No steps yet." + InsertDivider
2. **Sequential steps** — 3 plain steps (different commands), no groups
3. **With serial group** — 2 top-level steps + 1 serial group containing 2 steps
4. **With parallel group** — 1 parallel group with 2 steps side-by-side
5. **Mixed** — 1 top-level step, 1 serial group (2 steps), 1 parallel group (2 steps)

Do NOT test drag-drop interactions in stories — stories are visual-only. The unit tests (Stream 4) cover the logic.

Commit: `feat(stories): BuilderSequenceList — 5 stories covering empty/sequential/group/parallel/mixed layouts`

## Stream 6 — GroupCard story variants (collapse + parallel)

`GroupCard.stories.tsx` likely already exists. Audit it and add missing variants if absent:
- `ParallelGroup` — `group.isParallel = true`, 2 inner steps
- `CollapsedGroup` — `group.isCollapsed = true`
- `EmptyGroup` — `group.steps = []` (well, a group needs at least one step; use a single blank step)

If the file doesn't exist, create it.

Commit: `feat(stories): GroupCard — add parallel/collapsed/single-step variants`

## Pre-push gate (Universal Rule #2)

Before every commit:

```bash
yarn test run
yarn typecheck
yarn lint
```

All three green. Do NOT skip tests.

## Forbidden (Universal Rule #4)

No `toMatchSnapshot`, no `toMatchInlineSnapshot`, no `toHaveScreenshot`.

## Checklist updates (Universal Rule #8)

- At start: mark W7F 🔄 In Progress in [docs/react-migration-checklist.md](../react-migration-checklist.md).
- Per commit: append to Progress Log.
- At end: mark W7F ✅ Done with a one-line summary per stream.

## Handoff

```bash
cd .claude/worktrees/w7f
yarn test run && yarn typecheck && yarn lint
git push origin fix/dnd-drop-indicator
```

Open a PR `fix/dnd-drop-indicator` → `react-migration`.

## When done

Reply with:
- Commit SHAs grouped by stream
- Test count before → after
- Whether the GroupCard stories file already existed
- Any stream you skipped and why
- Pre-push gate state
