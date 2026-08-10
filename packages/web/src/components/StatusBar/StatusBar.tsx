import { useAtomValue } from "jotai"
import type { ConnectionStatus } from "../../state/jobsConnectionAtom"
import { jobsConnectionAtom } from "../../state/jobsConnectionAtom"

const statusConfig: Record<
  ConnectionStatus,
  { label: string; className: string }
> = {
  connecting: {
    label: "Connecting…",
    className: "text-content-secondary",
  },
  connected: {
    label: "Connected",
    className: "text-intent-success-content",
  },
  unstable: {
    label: "Connection unstable — retrying…",
    className: "text-intent-warning-content",
  },
}

export const StatusBar = () => {
  const status = useAtomValue(jobsConnectionAtom)
  const { label, className } = statusConfig[status]
  return (
    <div
      role="status"
      className={`text-xs px-1 py-0.5 ${className}`}
      data-status={status}
    >
      {label}
    </div>
  )
}
