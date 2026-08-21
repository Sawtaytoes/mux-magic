import {
  FOCUS_RING_CLASS,
  INTENT_APPEARANCE_CLASS,
} from "@charcuterie/ui"
import { useAtom } from "jotai"

import { api } from "../../api/api"
import { JOB_STATUSES } from "../../jobs/jobStatuses"
import type { JobStatus } from "../../jobs/types"
import { visibleJobStatusesAtom } from "../../state/visibleJobStatusesAtom"
import { getStatusIntent } from "../StatusBadge/StatusBadge"

const countFormatter = new Intl.NumberFormat()

/**
 * The status chips above the jobs grid. One per status, pressed
 * when that status is showing, and carrying how many top-level
 * jobs are in it.
 *
 * ## Why the counts come off the server
 *
 * The obvious source is `jobsAtom` — except the stream deliberately
 * does not send a hidden status's jobs, so counting there would
 * render `exited 0` with thousands sitting on disk. A chip that
 * lies about the thing it is hiding is worse than one with no
 * number at all, so the count comes from `/jobs/status-counts`,
 * which reads the store rather than the wire.
 *
 * It polls rather than refetching per job event: the number is
 * orientation — "how much am I not looking at" — and not something
 * anyone reads a transition off, so a request per event during a
 * busy sequence would cost more than the filter saves.
 *
 * ## Why these are chips and not a picker
 *
 * `Listbox`/`Picker` is the fleet's picker and this is not a pick:
 * it is eight independent toggles whose whole job is to show their
 * own state and their own count at a glance. Folding that into a
 * dropdown would hide both behind a click, and the count is the
 * part that answers "why is this list so short."
 */
export const JobStatusFilter = () => {
  const [visibleStatuses, setVisibleStatuses] = useAtom(
    visibleJobStatusesAtom,
  )

  const { data: counts } = api.useQuery(
    "get",
    "/jobs/status-counts",
    {},
    { refetchInterval: 10_000 },
  )

  const toggleStatus = (status: JobStatus) => {
    setVisibleStatuses(
      visibleStatuses.includes(status)
        ? visibleStatuses.filter(
            (visible) => visible !== status,
          )
        : visibleStatuses.concat(status),
    )
  }

  return (
    <fieldset className="flex flex-wrap items-center gap-1.5">
      {/* A real <legend>, because it is what names the fieldset —
          Charcuterie's VisuallyHidden renders a <span>, which inside
          a fieldset is just hidden text and names nothing. */}
      <legend className="sr-only">
        Filter jobs by status
      </legend>
      {JOB_STATUSES.map((status) => {
        const isVisible = visibleStatuses.includes(status)
        const count = counts?.[status]

        return (
          <button
            // Named explicitly rather than left to the content: a
            // screen reader reading "exited 3,412" off two adjacent
            // spans gets no separator at all, and a bare number
            // beside a word says nothing about what it counts.
            aria-label={
              count === undefined
                ? status
                : `${status}, ${countFormatter.format(count)} jobs`
            }
            aria-pressed={isVisible}
            className={[
              "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium capitalize transition-opacity",
              FOCUS_RING_CLASS,
              INTENT_APPEARANCE_CLASS[
                getStatusIntent(status)
              ][isVisible ? "soft" : "outline"],
              // Off reads as "turned down", not "disabled" — the
              // chip keeps its colour so the row is still scannable
              // as a legend of what the statuses look like.
              isVisible
                ? ""
                : "opacity-50 hover:opacity-75",
            ].join(" ")}
            key={status}
            onClick={() => {
              toggleStatus(status)
            }}
            type="button"
          >
            <span>{status}</span>
            {count !== undefined && (
              <span className="tabular-nums opacity-70">
                {countFormatter.format(count)}
              </span>
            )}
          </button>
        )
      })}
    </fieldset>
  )
}
