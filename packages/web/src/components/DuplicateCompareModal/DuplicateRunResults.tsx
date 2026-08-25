import { Button } from "@charcuterie/ui"
import { useSetAtom } from "jotai"

import { duplicateCompareModalAtom } from "./duplicateCompareModalAtom"
import {
  countRedundantCopies,
  type DuplicateGroup,
} from "./duplicateCompareTypes"

// Post-run report for a `findDuplicateAudioFiles` job, and the only door
// into the duplicate compare table. Mirrors `MusicMatchRunResults`
// exactly: counts, then a trigger that seeds the modal atom with the
// server's already-ranked groups.
//
// The command writes nothing, and neither does this panel. Everything it
// offers is a review step — the standing rule is that nothing leaves the
// library without a confirmed row, and even a confirmed row MOVES the
// copy rather than deleting it.

type Props = {
  groups: DuplicateGroup[]
  jobId: string
  sourcePath: string | null
  stepId: string
}

export const DuplicateRunResults = ({
  groups,
  jobId,
  sourcePath,
  stepId,
}: Props) => {
  const setDuplicateCompare = useSetAtom(
    duplicateCompareModalAtom,
  )

  if (groups.length === 0) {
    return null
  }

  const redundantCount = countRedundantCopies(groups)

  const openDuplicateCompare = () => {
    if (sourcePath === null) {
      return
    }
    setDuplicateCompare({
      groups,
      jobId,
      sourcePath,
      stepId,
    })
  }

  return (
    <div
      id="duplicate-run-results"
      className="flex flex-col gap-2"
    >
      <div
        data-duplicate-counts
        className="flex flex-wrap items-center gap-2 text-xs text-content-secondary"
      >
        <span>
          {groups.length} duplicate group
          {groups.length === 1 ? "" : "s"}. {redundantCount}{" "}
          redundant cop
          {redundantCount === 1 ? "y" : "ies"} — nothing has
          been moved.
        </span>
        {sourcePath !== null && (
          <Button
            id="duplicate-compare-trigger"
            intent="accent"
            appearance="solid"
            size="sm"
            onClick={openDuplicateCompare}
            title="Compare each set of copies before anything leaves the library"
          >
            🗂 Review Duplicates
          </Button>
        )}
      </div>
    </div>
  )
}
