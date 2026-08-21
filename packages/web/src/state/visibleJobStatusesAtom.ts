import { atom } from "jotai"

import {
  DEFAULT_HIDDEN_JOB_STATUSES,
  isJobStatus,
  JOB_STATUSES,
} from "../jobs/jobStatuses"
import type { JobStatus } from "../jobs/types"

export const VISIBLE_JOB_STATUSES_STORAGE_KEY =
  "mux-magic:jobs:visible-statuses"

export const DEFAULT_VISIBLE_JOB_STATUSES: readonly JobStatus[] =
  JOB_STATUSES.filter(
    (status) =>
      !DEFAULT_HIDDEN_JOB_STATUSES.includes(status),
  )

/**
 * Reads the remembered filter, and is deliberately forgiving: a
 * hand-edited key, a value from a build where a status has since
 * been renamed, or anything that is not an array of strings all
 * fall back to the default rather than throwing on first paint.
 *
 * An empty stored array is honoured — "show me nothing" is a choice
 * somebody can make and un-make, and silently replacing it with the
 * default would make the filter feel broken rather than empty.
 */
export const readStoredVisibleJobStatuses = (
  storage:
    | Pick<Storage, "getItem">
    | undefined = globalThis.localStorage,
): readonly JobStatus[] => {
  const raw = storage?.getItem(
    VISIBLE_JOB_STATUSES_STORAGE_KEY,
  )

  if (raw === null || raw === undefined) {
    return DEFAULT_VISIBLE_JOB_STATUSES
  }

  try {
    const parsed: unknown = JSON.parse(raw)

    if (!Array.isArray(parsed)) {
      return DEFAULT_VISIBLE_JOB_STATUSES
    }

    return parsed.filter(
      (value): value is JobStatus =>
        typeof value === "string" && isJobStatus(value),
    )
  } catch {
    return DEFAULT_VISIBLE_JOB_STATUSES
  }
}

export const writeStoredVisibleJobStatuses = ({
  statuses,
  storage = globalThis.localStorage,
}: {
  statuses: readonly JobStatus[]
  storage?: Pick<Storage, "setItem"> | undefined
}): void => {
  try {
    storage?.setItem(
      VISIBLE_JOB_STATUSES_STORAGE_KEY,
      JSON.stringify(statuses),
    )
  } catch {
    // A full or blocked localStorage costs the user the memory of
    // their filter, not the filter itself. Nothing to report.
  }
}

const storedVisibleJobStatusesAtom = atom<
  readonly JobStatus[]
>(readStoredVisibleJobStatuses())

/**
 * Which job statuses the Jobs view shows. `exited` starts off —
 * see `DEFAULT_HIDDEN_JOB_STATUSES`.
 *
 * Kept in the canonical `JOB_STATUSES` order rather than in click
 * order, so the value that reaches the SSE URL is stable and a
 * re-tick of the same set does not reconnect the stream.
 */
export const visibleJobStatusesAtom = atom(
  (get) => get(storedVisibleJobStatusesAtom),
  (_get, set, nextStatuses: readonly JobStatus[]): void => {
    const ordered = JOB_STATUSES.filter((status) =>
      nextStatuses.includes(status),
    )

    set(storedVisibleJobStatusesAtom, ordered)
    writeStoredVisibleJobStatuses({ statuses: ordered })
  },
)
