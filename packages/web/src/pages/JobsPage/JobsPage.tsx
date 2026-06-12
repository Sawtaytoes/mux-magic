import { StatusBar } from "../../components/StatusBar/StatusBar"
import { usePageTitle } from "../../hooks/usePageTitle"
import { useSseStream } from "../../hooks/useSseStream"

import { JobsList } from "../JobsList/JobsList"

export const JobsPage = () => {
  usePageTitle("Jobs")
  useSseStream()

  return (
    <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">
          Jobs{" "}
          <a
            href="/builder"
            className="text-sm font-normal text-blue-400 hover:text-blue-300 ml-3"
          >
            Sequence Builder ↗
          </a>
          <a
            href="/errors"
            className="text-sm font-normal text-slate-400 hover:text-slate-300 ml-3"
          >
            Errors ↗
          </a>
        </h1>
        <StatusBar />
      </div>
      <JobsList />
    </main>
  )
}
