import {
  AdaptiveGrid,
  EmptyState,
  useAdaptiveColumns,
} from "@charcuterie/ui"
import { useAtomValue } from "jotai"

import { JobCard } from "../../components/JobCard/JobCard"
import { jobsAtom } from "../../state/jobsAtom"
import { visibleJobStatusesAtom } from "../../state/visibleJobStatusesAtom"

/**
 * One job card's height in CSS px, measured off a running page at
 * 2560x1440 (~320px from card top to card top, gap included) and
 * rounded UP. Erring high makes the grid reach for its next column
 * slightly early, which is the cheap direction to be wrong in: a
 * page that scrolled when it did not have to is the complaint
 * `AdaptiveGrid` exists to answer.
 */
const JOB_CARD_BLOCK_SIZE_PX = 340

/**
 * The page heading, the status filter row, and the padding around
 * them — everything down the page that is not the grid, subtracted
 * before asking how many cards stack in the window.
 */
const JOBS_PAGE_CHROME_BLOCK_SIZE_PX = 190

/**
 * The narrowest a job-card column may get, in CSS px.
 *
 * Above `AdaptiveGrid`'s 384px default (`cq-sm`) because a `JobCard`
 * is wider than the average tile: under ~430px its footer row
 * ("Open in Sequence Builder", Resume, Cancel) wraps onto a second
 * line and the source path starts truncating mid-word. Two cramped
 * columns are worse than one comfortable one, so the floor is set
 * where the card stops being cramped.
 */
const JOB_CARD_MIN_COLUMN_INLINE_SIZE_PX = 440

const JOBS_COLUMNS_STORAGE_KEY = "mux-magic:jobs:columns"

export const JobsList = () => {
  const jobs = useAtomValue(jobsAtom)
  const visibleStatuses = useAtomValue(
    visibleJobStatusesAtom,
  )

  // Top-level jobs have no parentJobId; prepend newest (Map preserves insertion order).
  //
  // The status filter is applied HERE as well as on the stream, and
  // both are load-bearing. The server's copy keeps thousands of
  // hidden jobs off the wire at connect. This one catches a job
  // that transitions INTO a hidden status while the page is open —
  // those events are always streamed, precisely so the card can
  // disappear rather than sit frozen at its last visible status.
  const topLevel = Array.from(jobs.values())
    .filter((job) => !job.parentJobId)
    .filter((job) => visibleStatuses.includes(job.status))
    .reverse()

  const pausedJobs = topLevel.filter(
    (job) => job.status === "paused",
  )
  const otherJobs = topLevel.filter(
    (job) => job.status !== "paused",
  )

  // Hoisted rather than left to each AdaptiveGrid, because there
  // are two of them and they must agree. Sized independently, the
  // two-card paused section would land on one column at a 56rem cap
  // while the main grid took three at 106rem — two different page
  // widths stacked on top of each other, which reads as a bug. One
  // measurement over every visible card, handed to both.
  const layout = useAdaptiveColumns({
    chromeBlockSize: JOBS_PAGE_CHROME_BLOCK_SIZE_PX,
    itemBlockSize: JOB_CARD_BLOCK_SIZE_PX,
    itemCount: topLevel.length,
    minColumnInlineSize: JOB_CARD_MIN_COLUMN_INLINE_SIZE_PX,
    storageKey: JOBS_COLUMNS_STORAGE_KEY,
  })

  // The measured container is rendered UNCONDITIONALLY, empty state
  // included — the empty state is not a shortcut out of it.
  //
  // Returning early here is a silent one-column bug: the page opens
  // with no jobs, so the early return means `layout.containerRef` is
  // never attached to anything, and a ref landing on an element
  // later does not re-run the effect that observes it. The hook goes
  // on measuring an inline size of zero for the life of the page,
  // `chooseColumns` caps at one column, and the grid renders exactly
  // as it did before any of this — no error, no warning.
  return (
    <div className="space-y-6" ref={layout.containerRef}>
      {topLevel.length === 0 && (
        <EmptyState
          action={
            <a
              className="text-intent-accent-content hover:text-intent-accent-content text-sm"
              href="/builder"
            >
              Sequence Builder ↗
            </a>
          }
          description={
            visibleStatuses.length === 0
              ? "Every status is switched off — turn one back on above."
              : "No jobs match the statuses you're showing. Switch another status on above, or run a command in the Sequence Builder."
          }
          heading="Nothing to show"
          headingLevel={2}
        />
      )}
      {pausedJobs.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-intent-warning-content mb-3 flex items-center gap-2">
            ⏸ Paused Jobs ({pausedJobs.length})
            <span className="font-normal text-intent-warning-content text-xs">
              — awaiting input
            </span>
          </h2>
          <AdaptiveGrid
            columns={layout.columns}
            itemBlockSize={JOB_CARD_BLOCK_SIZE_PX}
            itemCount={pausedJobs.length}
          >
            {pausedJobs.map((job) => (
              <JobCard job={job} key={job.id} />
            ))}
          </AdaptiveGrid>
        </section>
      )}
      {otherJobs.length > 0 && (
        <AdaptiveGrid
          columns={layout.columns}
          itemBlockSize={JOB_CARD_BLOCK_SIZE_PX}
          itemCount={otherJobs.length}
        >
          {otherJobs.map((job) => (
            <JobCard job={job} key={job.id} />
          ))}
        </AdaptiveGrid>
      )}
    </div>
  )
}
