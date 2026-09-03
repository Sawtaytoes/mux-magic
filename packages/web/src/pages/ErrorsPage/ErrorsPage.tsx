import { UnstyledLink } from "@charcuterie/ui"

import { ErrorsPanel } from "../../components/ErrorsPanel/ErrorsPanel"
import { usePageTitle } from "../../hooks/usePageTitle"

export const ErrorsPage = () => {
  usePageTitle("Errors")

  return (
    <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <UnstyledLink
            href="/jobs"
            className="text-sm text-intent-accent-content hover:text-intent-accent-content"
          >
            ← Jobs
          </UnstyledLink>
          <UnstyledLink
            href="/builder"
            className="text-sm text-intent-accent-content hover:text-intent-accent-content"
          >
            Sequence Builder ↗
          </UnstyledLink>
        </div>
      </div>
      <ErrorsPanel />
    </main>
  )
}
