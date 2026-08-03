import { ToolCard } from "../../components/ToolCard/ToolCard"
import { usePageTitle } from "../../hooks/usePageTitle"

// Inline SVG module constants, matching the pattern PageHeader already
// uses for its collapse/expand glyphs — these two are used once each and
// don't warrant standalone icon components.

const builderIcon = (
  <svg
    aria-hidden="true"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="w-7 h-7 text-sky-400"
  >
    <rect x="3" y="4" width="7" height="6" rx="1.5" />
    <rect x="14" y="14" width="7" height="6" rx="1.5" />
    <path d="M10 7h3.5a2 2 0 0 1 2 2v5" />
  </svg>
)

const jobsIcon = (
  <svg
    aria-hidden="true"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="w-7 h-7 text-emerald-400"
  >
    <path d="M12 8v4l2.5 2.5" />
    <path d="M3.5 12a8.5 8.5 0 1 0 2.2-5.7" />
    <path d="M3 4v3.5h3.5" />
  </svg>
)

export const HomePage = () => {
  usePageTitle("Tools")

  return (
    <main className="max-w-6xl mx-auto px-6 py-20">
      <h1 className="text-5xl font-bold tracking-tight text-slate-100 text-center">
        Mux Magic
      </h1>
      <p className="mt-4 text-lg text-slate-400 text-center">
        Pick a tool.
      </p>
      <div className="mt-14 grid gap-8 sm:grid-cols-2">
        <ToolCard
          href="/builder"
          icon={builderIcon}
          title="Builder"
          description="Compose a sequence of media commands — remux, rename, merge subtitles — and run it locally or on the server."
        />
        <ToolCard
          href="/jobs"
          icon={jobsIcon}
          title="Jobs"
          description="Watch running and finished jobs — live progress, logs, paused steps awaiting input, and failures."
        />
      </div>
    </main>
  )
}
