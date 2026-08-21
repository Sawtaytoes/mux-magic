import type { JobStatus } from "./types"

/**
 * Every job status, in the order the filter offers them: in-flight
 * first, then the terminal outcomes worth reading, then the two
 * that mean "nothing ran."
 *
 * ## Why this is not imported from the server
 *
 * `JobStatus` — the type — comes from `@mux-magic/api/api-types`
 * and is the contract. The *list* cannot: a union has no runtime
 * form, and `@mux-magic/api` is a **devDependency** while
 * `@mux-magic/core` is not a dependency of this package at all, so
 * importing either for a value would put an undeclared,
 * Node-flavoured edge into the browser bundle to save eight
 * strings.
 *
 * The duplication is made safe rather than avoided:
 * `jobStatuses.test.ts` holds a `Record<JobStatus, true>`, which
 * stops compiling the moment the server adds a status. A plain
 * `readonly JobStatus[]` would not — it type-checks fine while
 * missing a member, and the only symptom would be a status the
 * filter can never show.
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

/**
 * Statuses the Jobs view hides until asked.
 *
 * `exited` is a planned early exit (`exitIfEmpty` and friends), so
 * a sequence that found nothing to do writes one umbrella job plus
 * one per remaining step, none of which anybody needs to read.
 * They run to the thousands and bury the handful of jobs that
 * actually did something.
 */
export const DEFAULT_HIDDEN_JOB_STATUSES: readonly JobStatus[] =
  ["exited"]

export const isJobStatus = (
  value: string,
): value is JobStatus =>
  (JOB_STATUSES as readonly string[]).includes(value)
