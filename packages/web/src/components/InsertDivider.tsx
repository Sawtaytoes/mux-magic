interface InsertDividerProps {
  index: number
  onInsertStep: () => void
  onInsertSequentialGroup: () => void
  onInsertParallelGroup: () => void
  onPaste: (
    event: React.MouseEvent<HTMLButtonElement>,
  ) => void
}

export const InsertDivider = ({
  index: _index,
  onInsertStep,
  onInsertSequentialGroup,
  onInsertParallelGroup,
  onPaste,
}: InsertDividerProps) => (
  <div className="col-span-full flex items-center group -my-0.5">
    <div className="flex-1 h-px bg-slate-700/50 group-hover:bg-slate-600 transition-colors" />
    <div className="flex items-center gap-1 mx-1">
      {/** biome-ignore lint/a11y/useButtonType: suppressed during react-migration */}
      <button
        onClick={onInsertStep}
        title="Insert a step here"
        className="flex items-center gap-1 px-2.5 py-0.5 text-xs text-slate-600 hover:text-blue-400 rounded-full border border-transparent hover:border-blue-500/40 hover:bg-slate-800 transition-all whitespace-nowrap"
      >
        ➕ Step
      </button>
      {/** biome-ignore lint/a11y/useButtonType: suppressed during react-migration */}
      <button
        onClick={onInsertSequentialGroup}
        title="Insert a sequential group here"
        className="flex items-center gap-1 px-2.5 py-0.5 text-xs text-slate-600 hover:text-blue-400 rounded-full border border-transparent hover:border-blue-500/40 hover:bg-slate-800 transition-all whitespace-nowrap"
      >
        ➕ Group
      </button>
      {/** biome-ignore lint/a11y/useButtonType: suppressed during react-migration */}
      <button
        onClick={onInsertParallelGroup}
        title="Insert a parallel group here"
        className="flex items-center gap-1 px-2.5 py-0.5 text-xs text-slate-600 hover:text-blue-400 rounded-full border border-transparent hover:border-blue-500/40 hover:bg-slate-800 transition-all whitespace-nowrap"
      >
        ➕ Parallel
      </button>
      {/** biome-ignore lint/a11y/useButtonType: suppressed during react-migration */}
      <button
        onClick={onPaste}
        title="Paste a copied step or group here"
        className="flex items-center gap-1 px-2.5 py-0.5 text-xs text-slate-600 hover:text-emerald-400 rounded-full border border-transparent hover:border-emerald-500/40 hover:bg-slate-800 transition-all whitespace-nowrap"
      >
        📋 Paste
      </button>
    </div>
    <div className="flex-1 h-px bg-slate-700/50 group-hover:bg-slate-600 transition-colors" />
  </div>
)
