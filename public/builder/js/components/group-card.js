import { steps } from "../sequence-state.js"
import { esc } from "../util/html-escape.js"
import { renderCollapseChevron } from "./collapse-chevron.js"
import { renderCopyIcon } from "./copy-icon.js"
import { renderDoubleChevron } from "./double-chevron.js"

/** @typedef {import('../step-renderer.js').Step} Step */
/** @typedef {import('../step-renderer.js').Group} Group */

/**
 * @param {{ group: Group, itemIndex: number, startingFlatIndex: number, renderStep: (step: Step, index: number, context: object) => string }} props
 * @returns {string}
 */
export function renderGroupCard({
  group,
  itemIndex,
  startingFlatIndex,
  renderStep,
}) {
  const isParallel = group.isParallel === true
  const stepCount = group.steps.length
  const parallelBadge = isParallel
    ? '<span class="text-[10px] uppercase tracking-wide font-semibold text-blue-300 bg-blue-950/60 border border-blue-700/50 rounded px-1.5 py-0.5">parallel</span>'
    : '<span class="text-[10px] uppercase tracking-wide font-semibold text-slate-400 bg-slate-800 border border-slate-600 rounded px-1.5 py-0.5">sequential</span>'
  const innerStepsHtml = group.isCollapsed
    ? ""
    : group.steps
        .map((step, idx) =>
          renderStep(step, startingFlatIndex + idx, {
            parentGroupId: group.id,
          }),
        )
        .join("")
  const containerClasses = isParallel
    ? "parallel-group flex flex-row flex-wrap gap-3"
    : "serial-group flex flex-col gap-3"
  const isFirstItem = itemIndex === 0
  const isLastItem = itemIndex === steps.length - 1

  return `
<div data-group="${group.id}" data-sortable-item class="group-card ${isParallel ? "group-card-parallel" : "group-card-serial"} bg-slate-900/50 rounded-xl border border-slate-700/70 overflow-hidden">
  <div class="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-slate-700/70 bg-slate-900/70">
    <button data-drag-handle title="Drag to reorder"
      class="w-5 h-5 flex items-center justify-center rounded text-slate-500 hover:text-slate-200 hover:bg-slate-700 select-none">⠿</button>
    <button onclick="toggleGroupCollapsed('${group.id}')" title="${group.isCollapsed ? "Expand group" : "Collapse group"}"
      class="w-5 h-5 flex items-center justify-center rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700">
      ${renderCollapseChevron({ isCollapsed: group.isCollapsed ?? false })}
    </button>
    <input type="text" value="${esc(group.label)}"
      placeholder="${isParallel ? "Parallel group" : "Group"} (${stepCount} step${stepCount === 1 ? "" : "s"})"
      data-group-label="${group.id}"
      oninput="setGroupLabel('${group.id}', this.value)"
      class="flex-1 min-w-0 bg-transparent text-sm font-medium text-slate-200 px-1.5 py-0.5 rounded border-0 focus:outline-none focus:bg-slate-900/40 placeholder:text-slate-300 placeholder:font-medium" />
    ${parallelBadge}
    <button onclick="setGroupChildrenCollapsed('${group.id}', true)" title="Collapse all inner steps"
      class="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700">${renderDoubleChevron({ isCollapsed: true })}</button>
    <button onclick="setGroupChildrenCollapsed('${group.id}', false)" title="Expand all inner steps"
      class="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700">${renderDoubleChevron({ isCollapsed: false })}</button>
    <button onclick="addStepToGroup('${group.id}')" title="Add a step inside this group"
      class="text-[10px] text-slate-400 hover:text-slate-200 px-2 py-0.5 rounded border border-slate-700 hover:border-slate-500">+ Step</button>
    <button onclick="pasteCardAt({parentGroupId: '${group.id}'}, this)" title="Paste a copied step into this group"
      class="text-[10px] text-slate-400 hover:text-emerald-400 px-2 py-0.5 rounded border border-slate-700 hover:border-emerald-500/40">📋 Paste</button>
    <button onclick="moveGroup('${group.id}',-1)" title="Move group up" ${isFirstItem ? "disabled" : ""}
      class="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700 disabled:opacity-30 text-xs">↑</button>
    <button onclick="moveGroup('${group.id}',1)" title="Move group down" ${isLastItem ? "disabled" : ""}
      class="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700 disabled:opacity-30 text-xs">↓</button>
    <button onclick="copyGroupYaml('${group.id}', this)" title="Copy this group's YAML"
      class="w-6 h-6 flex items-center justify-center rounded text-slate-500 hover:text-emerald-400 hover:bg-slate-700 text-xs border border-transparent">${renderCopyIcon()}</button>
    <button onclick="runGroup('${group.id}')" title="Run this group via /sequences/run"
      class="text-[10px] text-emerald-500 hover:text-emerald-300 px-2 py-0.5 rounded border border-emerald-700/50 hover:border-emerald-500 hover:bg-emerald-950/30">▶ Run</button>
    <button onclick="removeGroup('${group.id}')" title="Remove this group (its inner steps go too)"
      class="text-[10px] text-slate-500 hover:text-red-400 px-2 py-0.5 rounded border border-slate-700 hover:border-red-500/40">✕</button>
  </div>
  ${
    group.isCollapsed
      ? ""
      : `<div class="${containerClasses} p-3" data-group-body="${group.id}">
    ${innerStepsHtml}
  </div>`
  }
</div>`
}
