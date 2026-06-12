import { ErrorsPanel } from "../../components/ErrorsPanel/ErrorsPanel"
import { usePageTitle } from "../../hooks/usePageTitle"

export const ErrorsPage = () => {
  usePageTitle("Errors")

  return (
    <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <a
            href="/"
            className="text-sm text-blue-400 hover:text-blue-300"
          >
            ← Jobs
          </a>
          <a
            href="/builder"
            className="text-sm text-blue-400 hover:text-blue-300"
          >
            Sequence Builder ↗
          </a>
        </div>
      </div>
      <ErrorsPanel />
    </main>
  )
}
