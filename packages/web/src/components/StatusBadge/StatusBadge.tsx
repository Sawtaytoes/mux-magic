interface StatusBadgeProps {
  status: string
}

const statusClassMap: Record<string, string> = {
  pending: "bg-blue-950 text-blue-300",
  running: "bg-blue-950 text-blue-400 animate-pulse",
  // "paused" is a UI-only derived status — set by StepCard when an
  // interactive prompt for this step's jobId is sitting in the prompt
  // atom (minimized or not). Amber matches the modal's "pipeline is
  // paused" banner so the colour reads continuously across both
  // surfaces. The badge is rendered inside a <button> in StepCard so
  // the user can re-open the minimized modal.
  paused: "bg-amber-950 text-amber-300",
  completed: "bg-emerald-950 text-emerald-400",
  failed: "bg-red-950 text-red-400",
  cancelled: "bg-slate-700 text-slate-300",
  skipped: "bg-slate-800 text-slate-400",
  // Planned early-exit (exitIfEmpty etc.). Neutral indigo reads as
  // "informational terminal" — not green-success, not red-fail, not
  // grey-skipped — distinct enough at a glance that a /jobs row marked
  // exited is recognisably different from one marked skipped.
  exited: "bg-indigo-950 text-indigo-300",
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
