import { getSteps } from '../state.js'
import { isGroup } from './yaml-modal.js'

// SortableJS wiring for the sequence builder. The library is loaded as
// a vendor script in index.html; we assume `window.Sortable` exists.
//
// Each render destroys the previous Sortable instances and re-creates
// fresh ones. That's the simplest pattern given the inline `renderAll`
// already replaces the entire steps subtree via `innerHTML =`. The
// alternative (incremental DOM patching) would let Sortable instances
// outlive a render, but the codebase doesn't have that infrastructure.
//
// Cross-container moves: the top-level `#steps-el` and every group's
// inner body share the same `group: { name: 'sequence' }` so a step
// can drag across containers (top ↔ inside group). Groups themselves
// are rejected from dropping inside another group via onMove (the
// schema bans nesting; matches the load-modal error).
const bridge = () => window.mediaTools

const SORTABLE_OPTIONS_BASE = {
  group: { name: 'sequence', pull: true, put: true },
  handle: '[data-drag-handle]',
  draggable: '[data-sortable-item]',
  // animation: 0 — items snap to their new position instead of
  // tweening for 150ms. The tweening was the source of the
  // "drag-down-then-up-fast" duplicate-step / ghost-overlap bug:
  // if a second drag started while the first's tween was still
  // running, Sortable's internal index calculations raced with
  // the in-flight animation and committed the array splice based
  // on stale DOM positions, producing two copies of the same step
  // in the data array. The user characterized this as the
  // difference between "stop tweening" (cancel mid-animation,
  // start fresh — what we want) and "finish tweening" (block new
  // drags until the current one settles — what Sortable was
  // doing). animation: 0 = no tween to interrupt = no race.
  animation: 0,
  ghostClass: 'drag-ghost',
  chosenClass: 'drag-chosen',
  fallbackOnBody: true,
  forceFallback: false,
}

function destroyExistingInstances() {
  const containers = document.querySelectorAll('#steps-el, [data-group-body]')
  containers.forEach((container) => {
    const instance = window.Sortable?.get?.(container)
    if (instance) {
      instance.destroy()
    }
  })
}

// Reject drops that would nest a group inside another group. Steps can
// move freely between any two sequence containers. Sortable invokes
// onMove for every hover step; returning false during a group-into-
// group hover keeps the placeholder out of the inner container.
function onMove(event) {
  const draggedIsGroup = event.dragged?.dataset?.group !== undefined
  const targetIsGroupBody = event.to?.matches?.('[data-group-body]')
  if (draggedIsGroup && targetIsGroupBody) {
    return false
  }
  return true
}

// Resolve a Sortable container element to either the top-level steps
// array or a specific group's `steps` array. Mutating the right
// container is what makes the visual drop translate into in-memory
// state.
function getStepsArrayFor(containerElement) {
  if (containerElement?.id === 'steps-el') {
    return { kind: 'top', steps: getSteps() }
  }
  const groupId = containerElement?.dataset?.groupBody
  if (groupId) {
    const group = getSteps().find((item) => isGroup(item) && item.id === groupId)
    if (group) {
      return { kind: 'group', steps: group.steps, group }
    }
  }
  return null
}

// Translates Sortable's `oldIndex` / `newIndex` (which count among the
// container's children that match `draggable`) into actual splice
// positions. Sortable already exposes `oldDraggableIndex` /
// `newDraggableIndex` for this exact purpose, so we use those.
// Defer the post-drag re-render to the next animation frame.
// Sortable finishes its own DOM cleanup (removes the drag-ghost
// clone, strips chosenClass/ghostClass) AFTER onEnd returns —
// queueMicrotask was too eager (ran before the browser painted
// Sortable's cleanup), so the renderAll could still wipe DOM that
// Sortable was mid-modifying. requestAnimationFrame waits for the
// next paint window, after Sortable's cleanup has actually
// committed visually. Bypassing the view-transition wrapper too:
// Sortable already animates the move so the view-transition was
// just race fuel for nothing visual we weren't already getting.
const scheduleRender = () => window.requestAnimationFrame(() => bridge().renderAll())

function onEnd(event) {
  const sourceContainer = getStepsArrayFor(event.from)
  const targetContainer = getStepsArrayFor(event.to)
  if (!sourceContainer || !targetContainer) {
    scheduleRender()
    return
  }
  const sourceArray = sourceContainer.steps
  const targetArray = targetContainer.steps
  const oldIndex = event.oldDraggableIndex
  const newIndex = event.newDraggableIndex
  if (oldIndex === undefined || newIndex === undefined) {
    scheduleRender()
    return
  }
  // Same container, no move? Bail before mutating anything.
  if (sourceArray === targetArray && oldIndex === newIndex) {
    return
  }
  const [movedItem] = sourceArray.splice(oldIndex, 1)
  if (!movedItem) {
    scheduleRender()
    return
  }
  // After the source-array splice, the target array's insertion index
  // is unchanged when source and target are different arrays. When
  // they're the same array AND the source position was before the
  // target, every element after the splice shifted left by one — so
  // newIndex still lands at the user-visible drop position.
  targetArray.splice(newIndex, 0, movedItem)

  // Source-group cleanup: dragging the last step out of a group leaves
  // the group empty, which the schema rejects. Match removeStep's
  // existing behavior and drop the now-empty group.
  if (sourceContainer.kind === 'group' && sourceArray.length === 0) {
    const topSteps = getSteps()
    const groupIndex = topSteps.indexOf(sourceContainer.group)
    if (groupIndex >= 0) {
      topSteps.splice(groupIndex, 1)
    }
  }

  bridge().clearStaleStepLinksAfterMove()
  scheduleRender()
}

// Public entry point invoked by `renderAll` after the DOM has been
// rebuilt. Idempotent: each call destroys any prior Sortable instances
// before re-attaching, so calling it on every render is safe.
export function attachSortables() {
  if (typeof window.Sortable !== 'function') {
    return
  }
  destroyExistingInstances()
  const containers = document.querySelectorAll('#steps-el, [data-group-body]')
  containers.forEach((container) => {
    new window.Sortable(container, {
      ...SORTABLE_OPTIONS_BASE,
      onMove,
      onEnd,
    })
  })
}
