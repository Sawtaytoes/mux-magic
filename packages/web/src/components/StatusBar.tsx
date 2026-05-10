import { useAtomValue } from "jotai"
import type { ConnectionStatus } from "../state/jobsConnectionAtom"
import { jobsConnectionAtom } from "../state/jobsConnectionAtom"

const statusConfig: Record<ConnectionStatus, { label: string; className: string }> = {
  connecting: {
    label: "Connecting…",
    className: "text-slate-400",
  },
  connected: {
    label: "Connected",
    className: "text-emerald-400",
  },
  unstable: {
    label: "Connection unstable — retrying…",
    className: "text-amber-400",
  },
}

export const StatusBar = () => {
  const status = useAtomValue(jobsConnectionAtom)
  const { label, className } = statusConfig[status]
  return (
    <div
      className={`text-xs px-1 py-0.5 ${className}`}
      data-testid="status-bar"
      data-status={status}
    >
      {label}
    </div>
  )
}
