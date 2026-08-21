import type { JobStatus } from "./types.js"

/**
 * Every `JobStatus`, in the order a filter UI should offer them:
 * in-flight first, then the terminal outcomes by how much they
 * matter, with the two "nothing happened" ones last.
 *
 * The union in `types.js` is the source of truth for the *type*;
 * this is the source of truth for the *list*, because a union
 * cannot be iterated at runtime. `jobStatuses.test.ts` asserts the
 * two agree — a `readonly JobStatus[]` on its own type-checks fine
 * while missing a member, which is exactly the failure that would
 * silently drop a status out of the filter.
 */
export const JOB_STATUSES: readonly JobStatus[] = [
  "running",
  "pending",
  "paused",
  "failed",
  "completed",
  "cancelled",
  "skipped",
  "exited",
]

export const isJobStatus = (
  value: string,
): value is JobStatus =>
  (JOB_STATUSES as readonly string[]).includes(value)
