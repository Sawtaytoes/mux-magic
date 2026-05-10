import { useSetAtom } from "jotai"
import { CollapseChevron } from "../icons/CollapseChevron"
import { CopyIcon } from "../icons/CopyIcon"
import { DoubleChevron } from "../icons/DoubleChevron"
import {
  addStepToGroupAtom,
  moveGroupAtom,
  removeGroupAtom,
  setGroupChildrenCollapsedAtom,
  toggleGroupCollapsedAtom,
  updateGroupLabelAtom,
} from "../state/sequenceAtoms"
import type { Group, Step } from "../types"
import { StepCard } from "./StepCard"

interface GroupCardProps {
  group: Group
  itemIndex: number
  startingFlatIndex: number
  isFirst: boolean
  isLast: boolean
}

export const GroupCard = ({
  group,
  itemIndex: _itemIndex,
  startingFlatIndex,
  isFirst,
  isLast,
}: GroupCardProps) => {
  const toggleCollapsed = useSetAtom(
    toggleGroupCollapsedAtom,
  )
  const updateLabel = useSetAtom(updateGroupLabelAtom)
  const setChildrenCollapsed = useSetAtom(
    setGroupChildrenCollapsedAtom,
  )
  const addStep = useSetAtom(addStepToGroupAtom)
  const moveGroup = useSetAtom(moveGroupAtom)
  const removeGroup = useSetAtom(removeGroupAtom)

  const stepCount = group.steps.length
  const parallelBadge = group.isParallel ? (
    <span className="text-[10px] uppercase tracking-wide font-semibold text-blue-300 bg-blue-950/60 border border-blue-700/50 rounded px-1.5 py-0.5">
      parallel
    </span>
  ) : (
    <span className="text-[10px] uppercase tracking-wide font-semibold text-slate-400 bg-slate-800 border border-slate-600 rounded px-1.5 py-0.5">
      sequential
    </span>
  )

  const containerClasses = group.isParallel
    ? "parallel-group flex flex-row flex-wrap gap-3"
    : "serial-group flex flex-col gap-3"

  return (
    <div
      data-group={group.id}
      data-sortable-item
      className={`group-card ${group.isParallel ? "group-card-parallel" : "group-card-serial"} bg-slate-900/50 rounded-xl border border-slate-700/70 overflow-hidden`}
    >
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-slate-700/70 bg-slate-900/70">
        <button
          type="button"
          data-drag-handle
          title="Drag to reorder"
          className="w-5 h-5 flex items-center justify-center rounded text-slate-500 hover:text-slate-200 hover:bg-slate-700 select-none"
        >
          ⠿
        </button>
        <button
          type="button"
          onClick={() => toggleCollapsed(group.id)}
          title={
            group.isCollapsed
              ? "Expand group"
              : "Collapse group"
          }
          className="w-5 h-5 flex items-center justify-center rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700"
        >
          <CollapseChevron
            isCollapsed={group.isCollapsed}
          />
        </button>
        <input
          type="text"
          defaultValue={group.label}
          placeholder={`${group.isParallel ? "Parallel group" : "Group"} (${stepCount} step${stepCount === 1 ? "" : "s"})`}
          data-group-label={group.id}
          onChange={(event) =>
            updateLabel({
              groupId: group.id,
              label: event.currentTarget.value,
            })
          }
          className="flex-1 min-w-0 bg-transparent text-sm font-medium text-slate-200 px-1.5 py-0.5 rounded border-0 focus:outline-none focus:bg-slate-900/40 placeholder:text-slate-300 placeholder:font-medium"
        />
        {parallelBadge}
        <button
          type="button"
          onClick={() =>
            setChildrenCollapsed({
              groupId: group.id,
              collapsed: true,
            })
          }
          title="Collapse all inner steps"
          className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700"
        >
          <DoubleChevron isCollapsed={true} />
        </button>
        <button
          type="button"
          onClick={() =>
            setChildrenCollapsed({
              groupId: group.id,
              collapsed: false,
            })
          }
          title="Expand all inner steps"
          className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700"
        >
          <DoubleChevron isCollapsed={false} />
        </button>
        <button
          type="button"
          onClick={() => addStep(group.id)}
          title="Add a step inside this group"
          className="text-[10px] text-slate-400 hover:text-slate-200 px-2 py-0.5 rounded border border-slate-700 hover:border-slate-500"
        >
          + Step
        </button>
        <button
          type="button"
          onClick={() =>
            window.pasteCardAt?.({
              parentGroupId: group.id,
            })
          }
          title="Paste a copied step into this group"
          className="text-[10px] text-slate-400 hover:text-emerald-400 px-2 py-0.5 rounded border border-slate-700 hover:border-emerald-500/40"
        >
          📋 Paste
        </button>
        <button
          type="button"
          onClick={() =>
            moveGroup({ groupId: group.id, direction: -1 })
          }
          title="Move group up"
          disabled={isFirst}
          className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700 disabled:opacity-30 text-xs"
        >
          ↑
        </button>
        <button
          type="button"
          onClick={() =>
            moveGroup({ groupId: group.id, direction: 1 })
          }
          title="Move group down"
          disabled={isLast}
          className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700 disabled:opacity-30 text-xs"
        >
          ↓
        </button>
        <button
          type="button"
          onClick={() => window.copyGroupYaml?.(group.id)}
          title="Copy this group's YAML"
          className="w-6 h-6 flex items-center justify-center rounded text-slate-500 hover:text-emerald-400 hover:bg-slate-700 text-xs border border-transparent"
        >
          <CopyIcon />
        </button>
        <button
          type="button"
          onClick={() => window.runGroup?.(group.id)}
          title="Run this group via /sequences/run"
          className="text-[10px] text-emerald-500 hover:text-emerald-300 px-2 py-0.5 rounded border border-emerald-700/50 hover:border-emerald-500 hover:bg-emerald-950/30"
        >
          ▶ Run
        </button>
        <button
          type="button"
          onClick={() => removeGroup(group.id)}
          title="Remove this group (its inner steps go too)"
          className="text-[10px] text-slate-500 hover:text-red-400 px-2 py-0.5 rounded border border-slate-700 hover:border-red-500/40"
        >
          ✕
        </button>
      </div>
      {!group.isCollapsed && (
        <div
          className={`${containerClasses} p-3`}
          data-group-body={group.id}
        >
          {group.steps.map((step, idx) => (
            <StepCard
              key={step.id}
              step={step as Step}
              index={startingFlatIndex + idx}
              isFirst={idx === 0}
              isLast={idx === group.steps.length - 1}
              parentGroupId={group.id}
            />
          ))}
        </div>
      )}
    </div>
  )
}
