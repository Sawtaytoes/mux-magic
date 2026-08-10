import { Button } from "@charcuterie/ui"
import { useState } from "react"
import { apiBase } from "../../apiBase"

export const CancelJobButton = ({
  jobId,
}: {
  jobId: string
}) => {
  const [isDisabled, setIsDisabled] = useState(false)

  const handleClick = async () => {
    setIsDisabled(true)
    try {
      await fetch(`${apiBase}/jobs/${jobId}`, {
        method: "DELETE",
      })
    } catch {
      setIsDisabled(false)
    }
  }

  return (
    <Button
      intent="danger"
      appearance="soft"
      size="sm"
      onClick={handleClick}
      isDisabled={isDisabled}
      title={`Cancel this job (DELETE /jobs/${jobId})`}
    >
      ⏹ Cancel
    </Button>
  )
}
