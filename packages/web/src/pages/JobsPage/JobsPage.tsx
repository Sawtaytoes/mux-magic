import { UnstyledLink } from "@charcuterie/ui"

import { JobStatusFilter } from "../../components/JobStatusFilter/JobStatusFilter"
import { StatusBar } from "../../components/StatusBar/StatusBar"
import { usePageTitle } from "../../hooks/usePageTitle"
import { useSseStream } from "../../hooks/useSseStream"

import { JobsList } from "../JobsList/JobsList"

/**
 * The page is no longer capped at `max-w-3xl`.
 *
 * That cap was the reason the jobs view could only ever be a stack
 * of full-width rows: `AdaptiveGrid` widens the content as it takes
 * columns, and a fixed outer cap makes that impossible — it would
 * have divided one narrow column into narrower ones instead. The
 * cap the page has now comes from the grid, and moves with it (one
 * column stays at a reading measure; four earns 140rem).
 */
export const JobsPage = () => {
  usePageTitle("Jobs")
  useSseStream()

  return (
    <main className="px-4 py-6 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">
          <UnstyledLink
            href="/"
            className="text-sm font-normal text-content-secondary hover:text-content-secondary me-3"
          >
            ← Tools
          </UnstyledLink>
          Jobs{" "}
          <UnstyledLink
            href="/builder"
            className="text-sm font-normal text-intent-accent-content hover:text-intent-accent-content ms-3"
          >
            Sequence Builder ↗
          </UnstyledLink>
          <UnstyledLink
            href="/errors"
            className="text-sm font-normal text-content-secondary hover:text-content-secondary ms-3"
          >
            Errors ↗
          </UnstyledLink>
        </h1>
        <StatusBar />
      </div>
      <JobStatusFilter />
      <JobsList />
    </main>
  )
}
