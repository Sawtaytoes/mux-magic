export const ProgressFileRow = ({
  path,
  ratio,
}: {
  path: string
  ratio?: number
}) => {
  const fileName = path.split(/[\\/]/).pop() ?? path
  const isIndeterminate = typeof ratio !== "number"
  const pct = !isIndeterminate
    ? `${(Math.max(0, Math.min(1, ratio)) * 100).toFixed(1)}%`
    : null
  return (
    <div className="flex items-center gap-2 text-xs text-slate-400">
      <div className="truncate flex-1 min-w-0" title={path}>
        {fileName}
      </div>
      <div className="shrink-0 w-8 text-right">
        {typeof ratio === "number"
          ? `${(ratio * 100).toFixed(0)}%`
          : ""}
      </div>
      <div className="shrink-0 w-20 h-1 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full bg-blue-400 rounded-full ${isIndeterminate ? "animate-pulse w-full" : ""}`}
          style={pct !== null ? { width: pct } : undefined}
        />
      </div>
    </div>
  )
}
