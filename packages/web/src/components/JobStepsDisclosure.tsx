import { useAtomValue, useSetAtom } from "jotai"
import {
  useCallback,
  useEffect,
  useRef,
} from "react"

import { stepsOpenByJobIdAtom } from "../state/stepsOpenByJobIdAtom"
import type { Job } from "../types"
import { JobStepRow } from "./JobStepRow"

export const JobStepsDisclosure = ({
  jobId,
  jobs,
  jobStatus,
}: {
  jobId: string
  jobs: Job[]
  jobStatus: string
}) => {
  const stepsOpenByJobId = useAtomValue(
    stepsOpenByJobIdAtom,
  )
  const setStepsOpen = useSetAtom(stepsOpenByJobIdAtom)

  const defaultOpen =
    jobStatus === "running" || jobStatus === "pending"
  const isOpen = stepsOpenByJobId.get(jobId) ?? defaultOpen

  const detailsRef = useRef<HTMLDetailsElement>(null)
  const skipNextToggleRef = useRef(isOpen)

  useEffect(() => {
    if (detailsRef.current) detailsRef.current.open = isOpen
  }, [isOpen])

  const handleToggle = useCallback(
    (event: React.SyntheticEvent<HTMLDetailsElement>) => {
      if (skipNextToggleRef.current) {
        skipNextToggleRef.current = false
        return
      }
      setStepsOpen((prev) =>
        new Map(prev).set(jobId, event.currentTarget.open),
      )
    },
    [jobId, setStepsOpen],
  )

  return (
    <details ref={detailsRef} onToggle={handleToggle}>
      <summary className="cursor-pointer text-xs font-medium text-slate-400 hover:text-slate-200 py-1">
        Steps ({jobs.length})
      </summary>
      <div className="mt-1 space-y-2">
        {jobs.map((child, index) => (
          <JobStepRow
            key={child.id}
            child={child}
            index={index}
          />
        ))}
      </div>
    </details>
  )
}
