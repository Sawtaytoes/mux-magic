import type { LookupState } from "../../components/LookupModal/types"
import { useBuilderActions } from "../../hooks/useBuilderActions"
import { formatDvdCompareDisplayName } from "../../utils/formatDvdCompareDisplayName"

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
              // Format must match the server-side lookupDvdCompareFilm
              // formatter so cache hits survive round-trips. Without
              // this, picker selection writes "Soldier" while the
              // reverse-lookup writes "Soldier (UHD Blu-ray) (1998)" —
              // visible as a value flicker on the next refresh or ID
              // toggle. The shared formatter also handles the variant
              // rename ("Blu-ray 4K" → "UHD Blu-ray") and the bare-DVD
              // suppression rule (no variant suffix when variant=DVD).
              setParam(
                state.stepId,
                state.companionNameField,
                formatDvdCompareDisplayName({
                  baseTitle: state.selectedGroup.baseTitle,
                  variant:
                    state.selectedVariant ?? undefined,
                  year: state.selectedGroup.year,
                }),
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
