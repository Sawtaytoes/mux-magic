import { Accordion } from "@charcuterie/ui"
import { useAtomValue, useSetAtom } from "jotai"

import type { Job } from "../../jobs/types"
import { stepsOpenByJobIdAtom } from "../../state/stepsOpenByJobIdAtom"
import { JobStepRow } from "../JobStepRow/JobStepRow"

const STEPS_KEY = "steps"

/**
 * The two-owners bug charcuterie's `Accordion` was written against, closed.
 *
 * This used to be a `<details>`, and `<details>` **owns `open`**. The steps
 * state also lives in a Jotai atom so a job can be expanded from elsewhere,
 * and reconciling the two took three separate mechanisms:
 *
 * ```tsx
 * const detailsRef = useRef<HTMLDetailsElement>(null)
 * const skipNextToggleRef = useRef(isOpen)
 *
 * useEffect(() => {
 *   if (detailsRef.current) detailsRef.current.open = isOpen
 * }, [isOpen])
 *
 * const handleToggle = (event) => {
 *   if (skipNextToggleRef.current) {
 *     skipNextToggleRef.current = false
 *     return          // ← swallow the toggle our own write just fired
 *   }
 *   setStepsOpen(…)
 * }
 * ```
 *
 * A ref to reach past React, an effect to push state into the DOM, and a
 * guard to stop the DOM's echo coming back. All three are gone: `Accordion`
 * is a `<button aria-expanded>` over a `role="group"`, so there is one owner
 * and the atom is written from `onChange` — which is a report, not a
 * reconciliation.
 */
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

  const isDefaultOpen =
    jobStatus === "running" || jobStatus === "pending"
  const isOpen =
    stepsOpenByJobId.get(jobId) ?? isDefaultOpen

  return (
    <Accordion
      // **Initial** only, which is why `key` is the job id: a card
      // recycled onto a different job re-seeds from that job's atom entry
      // rather than inheriting the previous job's expansion.
      expandedKeys={isOpen ? [STEPS_KEY] : []}
      items={[
        {
          content: (
            <div className="space-y-2">
              {jobs.map((child, index) => (
                <JobStepRow
                  child={child}
                  index={index}
                  key={child.id}
                />
              ))}
            </div>
          ),
          key: STEPS_KEY,
          label: `Steps (${jobs.length})`,
        },
      ]}
      key={jobId}
      onChange={(expandedKeys) => {
        setStepsOpen((previous) =>
          new Map(previous).set(
            jobId,
            expandedKeys.includes(STEPS_KEY),
          ),
        )
      }}
    />
  )
}
