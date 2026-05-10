import { useState } from "react"

export const CancelJobButton = ({ jobId }: { jobId: string }) => {
  const [disabled, setDisabled] = useState(false)

  const handleClick = async () => {
    setDisabled(true)
    try {
      await fetch(`/jobs/${jobId}`, { method: "DELETE" })
    } catch {
      setDisabled(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      title={`Cancel this job (DELETE /jobs/${jobId})`}
      className="text-xs px-2 py-0.5 rounded bg-red-900/40 text-red-400 hover:bg-red-900/70 disabled:opacity-40"
    >
      ⏹ Cancel
    </button>
  )
}
