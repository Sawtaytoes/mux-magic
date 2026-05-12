interface StatusBadgeProps {
  status: string
}

const statusClassMap: Record<string, string> = {
  pending: "bg-blue-950 text-blue-300",
  running: "bg-blue-950 text-blue-400 animate-pulse",
  completed: "bg-emerald-950 text-emerald-400",
  failed: "bg-red-950 text-red-400",
  cancelled: "bg-slate-700 text-slate-300",
}

export const StatusBadge = ({
  status,
}: StatusBadgeProps) => {
  const statusClass = statusClassMap[status] ?? ""
  return (
    <span
      className={`status-badge shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${statusClass}`}
    >
      {status}
    </span>
  )
}
