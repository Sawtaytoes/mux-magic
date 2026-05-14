import type { LookupState } from "../../components/LookupModal/types"
import { useBuilderActions } from "../../hooks/useBuilderActions"

interface LookupReleaseStageProps {
  state: LookupState
  onClose: () => void
}

export const LookupReleaseStage = ({
  state,
  onClose,
}: LookupReleaseStageProps) => {
  const { setParam } = useBuilderActions()
  if (state.isLoading) {
    return (
      <p className="text-slate-500 text-sm text-center py-4">
        Loading releases…
      </p>
    )
  }

  if (state.releasesError) {
    return (
      <p className="text-rose-400 text-xs">
        {String(state.releasesError)}
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
            // The lookup populates up to four params on the parent step:
            //   - dvdCompareId          : numeric film id
            //   - dvdCompareName        : film title (companion display)
            //   - dvdCompareReleaseHash : numeric release hash
            //   - dvdCompareReleaseLabel: release label (companion display)
            // Writing an object into the numeric field renders
            // "[object Object]" in NumberWithLookupField, so each is set
            // separately. The two release-related field names are
            // dvdcompare-specific so they're hardcoded here.
            const fid = state.selectedFid
              ? Number(state.selectedFid)
              : undefined
            if (fid !== undefined && !Number.isNaN(fid)) {
              setParam(state.stepId, state.fieldName, fid)
            }
            if (
              state.companionNameField &&
              state.selectedGroup
            ) {
              setParam(
                state.stepId,
                state.companionNameField,
                state.selectedGroup.baseTitle,
              )
            }
            setParam(
              state.stepId,
              "dvdCompareReleaseHash",
              Number(release.hash),
            )
            setParam(
              state.stepId,
              "dvdCompareReleaseLabel",
              release.label,
            )
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
