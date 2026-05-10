import { useBuilderActions } from "../../hooks/useBuilderActions"
import type { LookupState } from "../../types"

interface LookupReleaseStageProps {
  state: LookupState
  onClose: () => void
}

export const LookupReleaseStage = ({
  state,
  onClose,
}: LookupReleaseStageProps) => {
  const { setParam } = useBuilderActions()
  if (state.loading) {
    return (
      <p className="text-slate-500 text-sm text-center py-4">
        Loading releases…
      </p>
    )
  }

  if (state.releasesError) {
    return (
      <p className="text-rose-400 text-xs">
        {state.releasesError}
      </p>
    )
  }

  const releases = state.releases ?? []

  if (releases.length === 0) {
    return (
      <p className="text-slate-500 text-sm text-center py-4">
        No releases found.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-slate-400 text-xs">
        Select a release:
      </p>
      {releases.map((release, index) => (
        <button
          type="button"
          key={String(release.hash)}
          onClick={() => {
            setParam(state.stepId, state.fieldName, {
              hash: release.hash,
              label: release.label,
            })
            onClose()
          }}
          className="text-left text-sm px-3 py-2 rounded border border-slate-700 hover:border-blue-500 hover:bg-blue-900/20 text-slate-200 transition-colors"
        >
          <span className="text-xs font-mono bg-slate-700 px-1 rounded mr-2">
            {index + 1}
          </span>
          {release.label}
        </button>
      ))}
    </div>
  )
}
